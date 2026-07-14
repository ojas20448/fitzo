/**
 * AI Quota Middleware Tests
 * The quota is the cost-control for Gemini — it must hold even without Redis
 * (in-memory fallback path is what these tests exercise).
 */

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
});
