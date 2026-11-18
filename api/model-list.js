/**
 * GET /api/model-list
 * 返回可切换的模型清单（只含展示名，不含任何密钥）。
 */
import { listModels } from './models.js';

export default function handler(req, res) {
    res.status(200).json({ models: listModels() });
}
