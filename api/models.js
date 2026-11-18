/**
 * 模型配置表（modelConfigMap）
 *
 * 设计思路：
 * 所有大模型平台都提供「OpenAI 兼容网关」，
 * 请求地址、请求体（messages / stream）、鉴权头（Authorization: Bearer xxx）、
 * SSE 返回分片（delta.content）的格式完全一致。
 * 因此只要把「地址 + 密钥 + 模型名」放进一张配置表，
 * 后端就只写一段调用代码，切换模型 = 换一条配置，不需要给每个模型写一套代码。
 *
 * 密钥统一从环境变量读取，绝不写死在代码里，也不会提交到 GitHub。
 */

const BASE_URL = 'https://api.siliconflow.cn/v1';
const API_KEY = process.env.SILICONFLOW_API_KEY;

export const modelConfigMap = {
    qwen: {
        label: '通义千问 Qwen2.5',
        baseURL: BASE_URL,
        apiKey: API_KEY,
        model: 'Qwen/Qwen2.5-7B-Instruct',
    },
    deepseek: {
        label: 'DeepSeek V3',
        baseURL: BASE_URL,
        apiKey: API_KEY,
        model: 'deepseek-ai/DeepSeek-V3',
    },
    kimi: {
        label: 'Kimi K2',
        baseURL: BASE_URL,
        apiKey: API_KEY,
        model: 'moonshotai/Kimi-K2-Instruct',
    },
    glm: {
        label: '智谱 GLM',
        baseURL: BASE_URL,
        apiKey: API_KEY,
        model: 'THUDM/GLM-4-9B-0414',
    },
};

/** 给前端用的模型清单（不含任何密钥） */
export function listModels() {
    return Object.entries(modelConfigMap).map(([key, cfg]) => ({
        key,
        label: cfg.label,
    }));
}
