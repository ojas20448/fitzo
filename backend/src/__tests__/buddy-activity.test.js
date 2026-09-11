jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'viewer', gym_id: 'gym' }; next(); } }));
jest.mock('../services/cache', () => ({ del: jest.fn(), keys: { homeData: id => id } }));
jest.mock('../services/xpService', () => ({ awardXP: jest.fn() }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn() }));
jest.mock('../services/communityFoods', () => ({}));
jest.mock('../services/pushNotifications', () => ({}));
const express = require('express');
const request = require('supertest');
const { query } = require('../config/database');
function appFor(route) { const app = express(); app.use(express.json()); app.use(require(`../routes/${route}`)); app.use(require('../utils/errors').errorHandler); return app; }
beforeEach(() => { query.mockReset(); query.mockResolvedValue({ rows: [] }); });
for (const route of ['workouts', 'calories', 'workout-sessions']) {
    it(`${route} requires the owner's sharing preference for friends-only feed entries`, async () => {
        const res = await request(appFor(route)).get('/feed');
        expect(res.status).toBe(200);
        const sql = query.mock.calls.map(c => c[0]).find(s => s.includes("visibility = 'friends'"));
        // Verify the real route's SQL contract, not a duplicate test-only router.
        expect(sql).toMatch(/visibility = 'friends' AND u.share_logs_default IS TRUE/);
    });
}
it('denies activity when the real friendship query finds no accepted relationship', async () => {
    const res = await request(appFor('buddy-activity')).get('/target');
    expect(res.status).toBe(403); expect(res.body.blocked_reason).toBe('not_friend');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/\)\s+AND status = 'accepted'/);
});
it('passes a disabled sharing flag to workout, meal and meal-total filters', async () => {
    query.mockResolvedValueOnce({ rows: [{ status: 'accepted' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'target', share_logs_default: false }] })
        .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ meal_count: 0 }] })
        .mockResolvedValueOnce({ rows: [] });
    const res = await request(appFor('buddy-activity')).get('/target');
    expect(res.status).toBe(200); expect(res.body.can_view).toBe(false);
    for (const call of query.mock.calls.filter(([sql]) => sql.includes("visibility = 'public'"))) {
        expect(call[1]).toEqual(['target', false]);
        expect(call[0]).toContain("visibility = 'private' AND false");
    }
});
