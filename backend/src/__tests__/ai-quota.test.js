/**
 * AI Quota Middleware Tests
 * The quota is the cost-control for Gemini — it must hold even without Redis
 * Provider reservations share durable counters with endpoint admission.
 */

let mockCounters;
jest.mock('../config/database', () => ({ query: jest.fn(async (sql, params) => {
    if (sql.startsWith('INSERT')) {
        const used = (mockCounters.get(params[0]) || 0) + 1;
        mockCounters.set(params[0], used);
        return { rows: [{ used }] };
    }
    if (sql.startsWith('SELECT')) return { rows: params[0].filter(key => mockCounters.has(key)).map(key => ({ key, used: mockCounters.get(key) })) };
    return { rows: [] };
}) }));

describe('aiQuota middleware', () => {
    let aiQuota, getUsage;

    const mockRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.set = jest.fn().mockReturnValue(res);
        return res;
    };

    const mockReq = (userId) => ({ user: userId ? { id: userId } : null });

    beforeEach(() => {
        mockCounters = new Map();
        jest.resetModules();
        process.env.AI_BURST_LIMIT = '3';
        process.env.AI_DAILY_LIMIT = '5';
        process.env.AI_MONTHLY_LIMIT = '10';
        // No Upstash env vars → cache disabled → in-memory fallback
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
        ({ aiQuota, getUsage } = require('../middleware/aiQuota'));
    });

    it('allows requests under the burst limit', async () => {
        const res = mockRes();
        const next = jest.fn();

        for (let i = 0; i < 3; i++) {
            await aiQuota(mockReq('user-a'), res, next);
        }

        expect(next).toHaveBeenCalledTimes(3);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks the request that exceeds the burst limit with 429', async () => {
        const res = mockRes();
        const next = jest.fn();

        for (let i = 0; i < 4; i++) {
            await aiQuota(mockReq('user-b'), res, next);
        }

        expect(next).toHaveBeenCalledTimes(3);
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'AI_LIMIT_REACHED', window: 'minute' })
        );
    });

    it('tracks users independently', async () => {
        const next = jest.fn();

        for (let i = 0; i < 3; i++) {
            await aiQuota(mockReq('user-c'), mockRes(), next);
        }
        // user-d should still have a fresh allowance
        const res = mockRes();
        await aiQuota(mockReq('user-d'), res, next);

        expect(next).toHaveBeenCalledTimes(4);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests with 401 (fail closed)', async () => {
        const res = mockRes();
        const next = jest.fn();

        await aiQuota(mockReq(null), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('sets remaining-quota headers on allowed requests', async () => {
        const res = mockRes();
        await aiQuota(mockReq('user-e'), res, jest.fn());

        expect(res.set).toHaveBeenCalledWith('X-AI-Daily-Remaining', '4');
        expect(res.set).toHaveBeenCalledWith('X-AI-Monthly-Remaining', '9');
    });

    it('getUsage reports used and remaining without incrementing', async () => {
        const next = jest.fn();
        await aiQuota(mockReq('user-f'), mockRes(), next);
        await aiQuota(mockReq('user-f'), mockRes(), next);

        const usage = await getUsage('user-f');
        expect(usage.daily).toEqual({ used: 2, limit: 5, remaining: 3 });
        expect(usage.monthly).toEqual({ used: 2, limit: 10, remaining: 8 });

        // Reading usage must not consume quota
        const usageAgain = await getUsage('user-f');
        expect(usageAgain.daily.used).toBe(2);
    });

    it('invalid environment limits cannot disable cost protection', async () => {
        jest.resetModules();
        process.env.AI_DAILY_LIMIT = 'not-a-number';
        process.env.AI_MONTHLY_LIMIT = '-1';
        const quota = require('../middleware/aiQuota');
        const usage = await quota.getUsage('invalid-config-user');
        expect(usage.daily.limit).toBe(10);
        expect(usage.monthly.limit).toBe(150);
    });

    it('limits an otherwise unlimited user to ten AI requests per day by default', async () => {
        jest.resetModules();
        delete process.env.AI_DAILY_LIMIT;
        process.env.AI_BURST_LIMIT = '100';
        process.env.AI_MONTHLY_LIMIT = '100';
        const quota = require('../middleware/aiQuota');
        const next = jest.fn();
        const res = mockRes();
        for (let i = 0; i < 11; i++) await quota.aiQuota(mockReq('default-daily-user'), res, next);
        expect(next).toHaveBeenCalledTimes(10);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AI_LIMIT_REACHED', window: 'day', limit: 10 }));
    });

    it('fails closed when durable accounting is unavailable', async () => {
        require('../config/database').query.mockRejectedValueOnce(new Error('database offline'));
        const next = jest.fn();
        await aiQuota(mockReq('outage'), mockRes(), next);
        expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 503 });
    });

    it('uses endpoint admission for the first provider call and charges each extra call', async () => {
        const context = require('../services/aiContext');
        const { reserveProviderCall } = require('../middleware/aiQuota');
        await context.run({ userId: 'bulk' }, async () => {
            await aiQuota(mockReq('bulk'), mockRes(), jest.fn());
            await reserveProviderCall('bulk');
            expect((await getUsage('bulk')).daily.used).toBe(1);
            await reserveProviderCall('bulk');
            expect((await getUsage('bulk')).daily.used).toBe(2);
            await reserveProviderCall('bulk');
            await expect(reserveProviderCall('bulk')).rejects.toMatchObject({ statusCode: 429 });
        });
    });
});
