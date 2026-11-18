/**
 * GET /api/history
 * 返回最近的起名历史记录（默认 20 条）。
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: '只支持 GET 请求' });
        return;
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        res.status(500).json({ error: '服务端未配置 Supabase 连接信息' });
        return;
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const { data, error } = await supabase
        .from('name_history')
        .select('id, user_requirement, name_result, model_name, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        res.status(500).json({ error: '读取历史失败：' + error.message });
        return;
    }
    res.status(200).json({ items: data || [] });
}
