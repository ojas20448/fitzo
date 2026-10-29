/** Durable AI allowances shared by API requests, bulk calls and reports. */
const { query } = require('../config/database');
const context = require('../services/aiContext');
const { AppError, AIUnavailableError } = require('../utils/errors');
function positiveLimit(value, fallback) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
const LIMITS = {
    minute: { max: positiveLimit(process.env.AI_BURST_LIMIT, 3), ttl: 120 },
    day: { max: positiveLimit(process.env.AI_DAILY_LIMIT, 10), ttl: 60 * 60 * 26 },
    month: { max: positiveLimit(process.env.AI_MONTHLY_LIMIT, 150), ttl: 60 * 60 * 24 * 32 },
};
const PROJECT_MONTHLY_LIMIT = positiveLimit(process.env.AI_PROJECT_MONTHLY_LIMIT, 1000);
const QUOTA_MESSAGES = {
    minute: 'Please wait a minute before using Fitzo AI again.',
    day: 'You have used your AI allowance for today. It resets at midnight UTC.',
    month: 'You have used your AI allowance for this month. It resets on the 1st UTC.',
    project: 'Fitzo AI has reached its shared monthly allowance. Please try again next month.',
};
function windowKeys(userId, now = new Date()) {
    return {
        minute: `ai:${userId}:m:${Math.floor(now.getTime() / 60000)}`,
        day: `ai:${userId}:d:${now.toISOString().slice(0, 10)}`,
        month: `ai:${userId}:mo:${now.toISOString().slice(0, 7)}`,
        project: `ai:project:mo:${now.toISOString().slice(0, 7)}`,
    };
}
async function consumeQuota(userId, res) {
    if (!userId) throw new AIUnavailableError('AI needs an authenticated account.');
    const keys = windowKeys(userId);
    try {
        await query('DELETE FROM ai_usage_counters WHERE expires_at < NOW()');
        for (const window of ['minute', 'day', 'month', 'project']) {
            const { max, ttl } = window === 'project' ? { max: PROJECT_MONTHLY_LIMIT, ttl: LIMITS.month.ttl } : LIMITS[window];
            const result = await query(`INSERT INTO ai_usage_counters (key, used, expires_at)
                VALUES ($1, 1, NOW() + $2::int * INTERVAL '1 second')
                ON CONFLICT (key) DO UPDATE SET used = ai_usage_counters.used + 1
                RETURNING used`, [keys[window], ttl]);
            const count = Number(result.rows[0].used);
            if (count > max) {
                const error = new AppError(QUOTA_MESSAGES[window], 429, 'AI_LIMIT_REACHED');
                Object.assign(error, { window, limit: max });
                throw error;
            }
            if (window === 'day') res?.set('X-AI-Daily-Remaining', String(max - count));
            if (window === 'month') res?.set('X-AI-Monthly-Remaining', String(max - count));
        }
    } catch (error) {
        if (error.code === 'AI_LIMIT_REACHED') throw error;
        console.error('AI allowance accounting failed');
        throw new AIUnavailableError('Fitzo AI is unavailable while its allowance is checked. Please try again later.');
    }
}
const aiQuota = async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ error: true, message: 'Please log in to continue', code: 'AUTH_REQUIRED' });
    try {
        await consumeQuota(req.user.id, res);
        const store = context.getStore();
        if (store?.userId === req.user.id) store.aiQuotaCredit = (store.aiQuotaCredit || 0) + 1;
        next();
    } catch (error) {
        if (error.code === 'AI_LIMIT_REACHED') return res.status(429).json({ error: true, code: error.code, message: error.message, window: error.window, limit: error.limit });
        next(error);
    }
};
async function reserveProviderCall(userId) {
    const store = context.getStore();
    if (store?.userId === userId && store.aiQuotaCredit > 0) {
        store.aiQuotaCredit -= 1;
        return;
    }
    await consumeQuota(userId);
}
async function getUsage(userId) {
    const keys = windowKeys(userId);
    const result = await query('SELECT key, used FROM ai_usage_counters WHERE key = ANY($1::text[]) AND expires_at > NOW()', [[keys.day, keys.month]]);
    const counts = Object.fromEntries(result.rows.map(row => [row.key, Number(row.used)]));
    return Object.fromEntries(['day', 'month'].map(window => [window === 'day' ? 'daily' : 'monthly', {
        used: counts[keys[window]] || 0, limit: LIMITS[window].max, remaining: Math.max(0, LIMITS[window].max - (counts[keys[window]] || 0)),
    }]));
}
module.exports = { aiQuota, getUsage, LIMITS, reserveProviderCall };
