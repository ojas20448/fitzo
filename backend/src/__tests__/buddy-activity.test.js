jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'viewer', gym_id: 'gym' }; next(); } }));
jest.mock('../services/cache', () => ({ del: jest.fn(), keys: { homeData: id => id, nutritionToday: id => id } }));
jest.mock('../services/xpService', () => ({ awardXP: jest.fn() }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn() }));
jest.mock('../services/communityFoods', () => ({
    isCommunityId: jest.fn(() => false),
    stripPrefix: jest.fn(id => id),
    recordLog: jest.fn()
}));
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

it('enforces active gym attendance contract for checked_in status', async () => {
    query.mockResolvedValueOnce({ rows: [{ status: 'accepted' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'target', name: 'Target', share_logs_default: true }] })
        .mockResolvedValueOnce({ rows: [] }) // intent
        .mockResolvedValueOnce({ rows: [] }) // workouts
        .mockResolvedValueOnce({ rows: [] }) // food
        .mockResolvedValueOnce({ rows: [{ total_calories: 0, meal_count: 0 }] }) // food summary
        .mockResolvedValueOnce({ rows: [{ checked_in_at: new Date().toISOString() }] }); // active checkin

    const res = await request(appFor('buddy-activity')).get('/target');
    expect(res.status).toBe(200);
    expect(res.body.today.checked_in).toBe(true);

    const checkinQuery = query.mock.calls.find(([sql]) => sql.includes('FROM attendances'));
    expect(checkinQuery).toBeDefined();
    const [sql] = checkinQuery;
    expect(sql).toContain('gym_id IS NOT NULL');
    expect(sql).toContain('checked_out_at IS NULL');
    expect(sql).toContain("checked_in_at > NOW() - INTERVAL '90 minutes'");
});

it('reports checked_in as false when user has no active attendance at gym', async () => {
    query.mockResolvedValueOnce({ rows: [{ status: 'accepted' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'target', name: 'Target', share_logs_default: true }] })
        .mockResolvedValueOnce({ rows: [] }) // intent
        .mockResolvedValueOnce({ rows: [] }) // workouts
        .mockResolvedValueOnce({ rows: [] }) // food
        .mockResolvedValueOnce({ rows: [{ total_calories: 0, meal_count: 0 }] }) // food summary
        .mockResolvedValueOnce({ rows: [] }); // no active checkin

    const res = await request(appFor('buddy-activity')).get('/target');
    expect(res.status).toBe(200);
    expect(res.body.today.checked_in).toBe(false);
    expect(res.body.today.food.total_calories).toBe(0);
    expect(res.body.today.food.meals).toEqual([]);
});

it('does not insert into attendances when logging calories', async () => {
    query.mockResolvedValueOnce({
        rows: [{ id: 'cal-log-1', calories: 450, protein: 30, carbs: 40, fat: 12, food_name: 'Paneer Wrap' }]
    });

    const res = await request(appFor('calories'))
        .post('/')
        .send({ calories: 450, protein: 30, carbs: 40, fat: 12, meal_name: 'Paneer Wrap' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify attendances table was NEVER touched
    const attendanceQueries = query.mock.calls.filter(([sql]) =>
        sql.toLowerCase().includes('attendances')
    );
    expect(attendanceQueries).toHaveLength(0);
});

