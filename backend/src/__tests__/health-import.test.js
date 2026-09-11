jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'u1' }; next(); } }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn(async () => {}) }));
const express = require('express');
const request = require('supertest');
const { query } = require('../config/database');
const app = express();
app.use(express.json()); app.use('/health', require('../routes/health')); app.use(require('../utils/errors').errorHandler);
beforeEach(() => query.mockClear());
it('accepts sleep-only imports and preserves unknown activity instead of writing zero', async () => {
    const res = await request(app).post('/health/sync').send({ sleep_hours: 7.5, date: '2026-09-10' });
    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual(['u1', '2026-09-10', null, null, null, 7.5]);
});
it('rejects impossible calendar dates and empty measurements', async () => {
    expect((await request(app).post('/health/sync').send({ steps: 4, active_calories: 1, date: '2026-02-30' })).status).toBe(400);
    expect((await request(app).post('/health/sync').send({ date: '2026-09-10' })).status).toBe(400);
});
it('queries the same explicit day that the device imported', async () => {
    await request(app).get('/health/today?date=2026-09-10');
    expect(query.mock.calls[0][1]).toEqual(['u1', '2026-09-10']);
});
