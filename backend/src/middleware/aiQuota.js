/**
 * AI Quota Middleware
 *
 * Protects Gemini-backed endpoints from cost blowout and abuse:
 *   1. Burst limit  — max requests per minute per user
 *   2. Daily limit  — max requests per day per user
 *   3. Monthly cap  — hard ceiling per user per calendar month
 *
 * Counters live in Redis (Upstash) when available, with an in-memory
 * fallback so limits still apply on a single instance without Redis.
 *
 * Configure via env (all optional):
 *   AI_BURST_LIMIT    requests/minute  (default 6)
 *   AI_DAILY_LIMIT    requests/day     (default 25)
 *   AI_MONTHLY_LIMIT  requests/month   (default 150)
 */

const cache = require('../services/cache');

const LIMITS = {
    minute: { max: parseInt(process.env.AI_BURST_LIMIT || '6', 10), ttl: 120 },
    day: { max: parseInt(process.env.AI_DAILY_LIMIT || '25', 10), ttl: 60 * 60 * 26 },
    month: { max: parseInt(process.env.AI_MONTHLY_LIMIT || '150', 10), ttl: 60 * 60 * 24 * 32 },
};

// In-memory fallback when Redis is unavailable (single-instance safe)
const memoryCounters = new Map();

function memoryIncr(key, ttlSeconds) {
    const now = Date.now();
    const entry = memoryCounters.get(key);
    if (!entry || entry.expiresAt < now) {
        memoryCounters.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
        return 1;
    }
    entry.count += 1;
    return entry.count;
}

// Lazy cleanup so the Map doesn't grow forever
function memoryCleanup() {
    if (memoryCounters.size < 5000) return;
    const now = Date.now();
    for (const [key, entry] of memoryCounters) {
        if (entry.expiresAt < now) memoryCounters.delete(key);
    }
}

function windowKeys(userId, now = new Date()) {
    const minuteBucket = Math.floor(now.getTime() / 60000);
    const dayBucket = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const monthBucket = now.toISOString().slice(0, 7); // YYYY-MM
    return {
        minute: `ai:${userId}:m:${minuteBucket}`,
        day: `ai:${userId}:d:${dayBucket}`,
        month: `ai:${userId}:mo:${monthBucket}`,
    };
}

async function incrementCounter(key, ttlSeconds) {
    const redisCount = await cache.incrWithExpire(key, ttlSeconds);
    if (redisCount !== null) return redisCount;
    memoryCleanup();
    return memoryIncr(key, ttlSeconds);
}

const QUOTA_MESSAGES = {
    minute: "Whoa, slow down! The AI coach needs a breather. Try again in a minute.",
    day: "You've used all your AI coach sessions for today. They reset at midnight! 🌙",
    month: "You've reached this month's AI coach limit. It resets on the 1st. 💪",
};

/**
 * Express middleware — must run AFTER authenticate (needs req.user.id)
 */
const aiQuota = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            // Should never happen (authenticate runs first) — fail closed
            return res.status(401).json({ error: true, message: 'Please log in to continue', code: 'AUTH_REQUIRED' });
        }

        const keys = windowKeys(req.user.id);

        for (const window of ['minute', 'day', 'month']) {
            const { max, ttl } = LIMITS[window];
            const count = await incrementCounter(keys[window], ttl);

            if (count > max) {
                return res.status(429).json({
                    error: true,
                    code: 'AI_LIMIT_REACHED',
                    message: QUOTA_MESSAGES[window],
                    window,
                    limit: max,
                });
            }

            if (window === 'day') {
                res.set('X-AI-Daily-Remaining', String(Math.max(0, max - count)));
            }
            if (window === 'month') {
                res.set('X-AI-Monthly-Remaining', String(Math.max(0, max - count)));
            }
        }

        next();
    } catch (error) {
        // Quota check should never take the AI feature down — log and continue
        console.error('AI quota check failed:', error.message);
        next();
    }
};

/**
 * Read-only usage lookup for GET /api/ai/quota (does not increment)
 */
async function getUsage(userId) {
    const keys = windowKeys(userId);
    const readCounter = async (key) => {
        const cached = await cache.get(key);
        if (cached !== null && cached !== undefined) return parseInt(cached, 10) || 0;
        const entry = memoryCounters.get(key);
        return entry && entry.expiresAt > Date.now() ? entry.count : 0;
    };

    const [day, month] = await Promise.all([readCounter(keys.day), readCounter(keys.month)]);

    return {
        daily: { used: day, limit: LIMITS.day.max, remaining: Math.max(0, LIMITS.day.max - day) },
        monthly: { used: month, limit: LIMITS.month.max, remaining: Math.max(0, LIMITS.month.max - month) },
    };
}

module.exports = { aiQuota, getUsage, LIMITS };
