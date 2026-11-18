/**
 * POST /api/name
 * 流式返回 AI 起名结果，并把「需求 + 结果 + 模型」保存到 Supabase。
 *
 * 请求体：{ requirement: string, model: string, style: string }
 * 响应：text/event-stream，逐条推送 { text } 片段，最后推送 { done: true }
 */
import { createClient } from '@supabase/supabase-js';
import { modelConfigMap } from './models.js';

const SYSTEM_PROMPT = (style) =>
    `你是一名专业中文起名专家。请根据用户给出的需求，一次性给出 3 组起名方案。` +
    `起名风格要求：${style}。` +
    `每组方案必须包含：名字、读音（如适用）、寓意解释（2-3 句，讲清字义与整体寓意）。` +
    `请直接用中文输出，条理清晰，不要输出 JSON，不要解释你的思考过程。`;

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: '只支持 POST 请求' });
        return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const requirement = (body.requirement || '').toString().trim();
    const modelKey = (body.model || 'qwen').toString();
    const style = (body.style || '国风').toString();

    if (!requirement) {
        res.status(400).json({ error: '请先输入起名需求' });
        return;
    }
    if (requirement.length > 500) {
        res.status(400).json({ error: '需求太长了，请控制在 500 字以内' });
        return;
    }

    const cfg = modelConfigMap[modelKey];
    if (!cfg) {
        res.status(400).json({ error: '不支持的模型：' + modelKey });
        return;
    }
    if (!cfg.apiKey) {
        res.status(500).json({ error: '服务端未配置模型密钥（SILICONFLOW_API_KEY），请联系管理员' });
        return;
    }

    // 1. 调用大模型（OpenAI 兼容接口，开启流式）
    let upstream;
    try {
        upstream = await fetch(`${cfg.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: cfg.model,
                stream: true,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT(style) },
                    { role: 'user', content: requirement },
                ],
            }),
        });
    } catch (err) {
        res.status(502).json({ error: '连接模型服务失败：' + (err.message || '网络错误') });
        return;
    }

    if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => '');
        res.status(502).json({
            error: `模型调用失败（HTTP ${upstream.status}）`,
            detail: detail.slice(0, 300),
        });
        return;
    }

    // 2. 建立 SSE 通道，把模型吐出的文字实时转发给浏览器
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    let fullText = '';
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        for await (const chunk of upstream.body) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]') continue;
                try {
                    const json = JSON.parse(payload);
                    const delta = json.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        fullText += delta;
                        send({ text: delta });
                    }
                } catch {
                    // 忽略无法解析的分片
                }
            }
        }
    } catch (err) {
        send({ error: '生成中断：' + (err.message || '连接异常') });
    }

    // 3. 存历史记录
    if (fullText.trim()) {
        const supabase = getSupabase();
        if (supabase) {
            const { error } = await supabase.from('name_history').insert({
                user_requirement: requirement,
                name_result: fullText,
                model_name: cfg.label,
            });
            if (error) send({ warning: '历史保存失败：' + error.message });
        }
        send({ done: true });
    } else {
        send({ error: '模型没有返回内容，请稍后重试' });
    }

    res.end();
}
