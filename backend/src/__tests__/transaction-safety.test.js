jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })), getClient: jest.fn() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'u', gym_id: 'gym' }; next(); } }));
const express = require('express'); const request = require('supertest');
const db = require('../config/database');
const client = { query: jest.fn(), release: jest.fn() };
function appFor(route) { const app = express(); app.use(express.json()); app.use(require(`../routes/${route}`)); app.use(require('../utils/errors').errorHandler); return app; }
beforeEach(() => { jest.clearAllMocks(); db.getClient.mockResolvedValue(client); client.query.mockResolvedValue({ rows: [] }); });
it('rolls back split deactivation on the same client if the replacement cannot be inserted', async () => {
    client.query.mockImplementation(async sql => { if (sql.includes('INSERT INTO user_splits')) throw new Error('insert failed'); return { rows: [] }; });
    const res = await request(appFor('workout-sessions')).post('/splits').send({ name: 'Plan', days: ['Push'] });
    expect(res.status).toBe(500);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK'); expect(client.release).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalledWith('BEGIN');
});
it('refuses a class outside the member gym or in the past', async () => {
    const res = await request(appFor('classes')).post('/other/book');
    expect(res.status).toBe(404);
    const call = client.query.mock.calls.find(([sql]) => sql.includes('class_sessions'));
    expect(call[0]).toMatch(/gym_id = \$2.*scheduled_at > NOW\(\)/s); expect(call[1]).toEqual(['other', 'gym']);
    expect(client.release).toHaveBeenCalledTimes(1);
});
it('locks the class before checking capacity and never inserts into a full class', async () => {
    client.query.mockImplementation(async sql => {
        if (sql.includes('FROM class_sessions')) return { rows: [{ id: 'c', name: 'Class', max_capacity: 1 }] };
        if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }] };
        return { rows: [] };
    });
    const res = await request(appFor('classes')).post('/c/book');
    expect(res.status).toBe(409);
    expect(client.query.mock.calls.find(([s]) => s.includes('FROM class_sessions'))[0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls.some(([s]) => s.includes('INSERT INTO class_bookings'))).toBe(false);
});
