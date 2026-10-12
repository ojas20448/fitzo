jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'u1' }; next(); } }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn(async () => {}) }));
const express = require('express');
const request = require('supertest');
const { query } = require('../config/database');
const { invalidateContextPack } = require('../services/contextPack');
const app = express();
app.use(express.json()); app.use('/readiness', require('../routes/readiness')); app.use(require('../utils/errors').errorHandler);
const answers = { energy_level: 3, sleep_quality: 4, soreness: 2 };
beforeEach(() => { jest.clearAllMocks(); query.mockResolvedValue({ rows: [{ ...answers, log_date: '2026-10-07' }] }); });
it('saves an explicit local day, preserves zero sleep, and refreshes the coach context', async () => {
    expect((await request(app).post('/readiness/checkin').send({ ...answers, date: '2026-10-07', sleep_hours: 0 })).status).toBe(200);
    expect(query.mock.calls[0][1][4]).toBe(0);
    expect(query.mock.calls[0][1][9]).toBe('2026-10-07');
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (user_id, log_date)');
    expect(query.mock.calls[0][0]).toContain('ELSE readiness_logs.notes');
    expect(query.mock.calls[0][1][10]).toBe(false);
    expect(invalidateContextPack).toHaveBeenCalledWith('u1');
});
it.each([{ energy_level: 2.5 }, { energy_level: '3junk' }, { sleep_quality: 6 }, { soreness: 0 }, { sleep_hours: -1 }, { sleep_hours: 25 }, { sleep_hours: 'eight' }, { date: '2026-02-30' }, { notes: 'a'.repeat(1001) }])('rejects invalid ratings, hours, dates or notes before writing: %j', async patch => {
    expect((await request(app).post('/readiness/checkin').send({ ...answers, ...patch })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
});
it('does not assign missing-sleep credit to a reported zero hours', async () => {
    await request(app).post('/readiness/checkin').send(answers);
    const missingScore = query.mock.calls[0][1][5];
    await request(app).post('/readiness/checkin').send({ ...answers, sleep_hours: 0 });
    expect(query.mock.calls[1][1][5]).toBe(missingScore - 5);
});
it('reads the same device day and bounds history to the requested range', async () => {
    await request(app).get('/readiness/today?date=2026-10-07');
    expect(query.mock.calls[0][1]).toEqual(['u1', '2026-10-07']);
    await request(app).get('/readiness/history?date=2026-10-07&days=7');
    expect(query.mock.calls[1][1]).toEqual(['u1', 7, '2026-10-07']);
    expect((await request(app).get('/readiness/history?days=-1')).status).toBe(400);
});
