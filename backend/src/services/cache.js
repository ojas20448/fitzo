/**
 * Upstash Redis Cache Service
 *
 * Provides caching for hot queries to reduce database load.
 * Falls back gracefully to no-cache if Redis is unavailable.
 *
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

const { Redis } = require('@upstash/redis');

let redis = null;
let cacheEnabled = false;

// Initialize Redis connection
try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        cacheEnabled = true;
        console.log('🟢 Redis cache connected (Upstash)');
    } else {
        console.log('⚠️  Redis not configured — running without cache (set UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN)');
    }
} catch (err) {
    console.error('⚠️  Redis init failed, running without cache:', err.message);
}

// Default TTLs in seconds
const TTL = {
    CROWD_LEVEL: 5 * 60,        // 5 min — changes slowly
    NUTRITION_TOTALS: 60,        // 1 min — user may log food
    EXERCISE_DB: 60 * 60,       // 1 hour — rarely changes
    HOME_DATA: 2 * 60,          // 2 min — balance freshness
    FOOD_SEARCH: 30 * 60,       // 30 min — external API results
    USER_STREAK: 5 * 60,        // 5 min — changes once per day
};

/**
 * Get a cached value by key
 * @returns {any|null} Parsed value or null if miss/error
 */
async function get(key) {
    if (!cacheEnabled) return null;
    try {
        const value = await redis.get(key);
        return value;
    } catch (err) {
        console.error('Cache GET error:', err.message);
        return null;
    }
}

/**
 * Set a cached value
 * @param {string} key
 * @param {any} value - Will be JSON serialized
 * @param {number} ttlSeconds - Time to live in seconds
 */
async function set(key, value, ttlSeconds = 300) {
    if (!cacheEnabled) return;
    try {
        await redis.set(key, value, { ex: ttlSeconds });
    } catch (err) {
        console.error('Cache SET error:', err.message);
    }
}

/**
 * Delete a cached key (for invalidation)
 */
async function del(key) {
    if (!cacheEnabled) return;
    try {
        await redis.del(key);
    } catch (err) {
        console.error('Cache DEL error:', err.message);
    }
}

/**
 * Delete all keys matching a pattern (e.g., user:*:nutrition)
 * Uses SCAN for safety (no KEYS command)
 */
async function invalidatePattern(pattern) {
    if (!cacheEnabled) return;
    try {
        let cursor = 0;
        do {
            const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== 0);
    } catch (err) {
        console.error('Cache pattern invalidation error:', err.message);
    }
}

/**
 * Cache-aside helper: get from cache or compute & store
 */
async function getOrSet(key, computeFn, ttlSeconds = 300) {
    const cached = await get(key);
    if (cached !== null) return cached;

    const value = await computeFn();
    await set(key, value, ttlSeconds);
    return value;
}

// Key builders for consistent naming
const keys = {
    crowdLevel: (gymId) => `gym:${gymId}:crowd`,
    userStreak: (userId) => `user:${userId}:streak`,
    nutritionToday: (userId) => `user:${userId}:nutrition:today`,
    homeData: (userId) => `user:${userId}:home`,
    foodSearch: (query) => `food:search:${query.toLowerCase().trim()}`,
    exerciseDb: (category) => `exercises:${category || 'all'}`,
};

module.exports = {
    get,
    set,
    del,
    invalidatePattern,
    getOrSet,
    keys,
    TTL,
    cacheEnabled,
};
