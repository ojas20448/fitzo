jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'member' }; next(); }, authenticateAdmin: (req, res, next) => next() }));
jest.mock('../services/pushNotifications', () => ({}));
jest.mock('../services/xpService', () => ({ awardXP: jest.fn() }));
const db = require('../config/database');
require('../routes/notifications');
const startupQueries = [...db.query.mock.calls];
const express = require('express');
const request = require('supertest');
const app = express();
app.use(express.json());
app.use(require('../routes/workouts-published'));
app.use(require('../utils/errors').errorHandler);
test('loading notification routes does not create tables or contact the database', () => {
    expect(startupQueries).toHaveLength(0);
});
test('adopting a preset alias increments the resolved split UUID', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [{ id, name: 'PPL (6 Day)', program_structure: { 'Day 1': 'Push' }, days_per_week: 6 }] });
    const res = await request(app).post('/ppl_6/adopt').send({});
    expect(res.status).toBe(200);
    const increment = db.query.mock.calls.find(([sql]) => sql.includes('download_count + 1'));
    expect(increment[1]).toEqual([id]);
});
