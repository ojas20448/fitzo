jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => {
    req.user = { id: 'member', timezone: req.headers['x-fitzo-timezone'] }; next();
} }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn(async () => {}) }));
const express = require('express');
const request = require('supertest');
const { query } = require('../config/database');
const app = express();
app.use(express.json());
app.use('/health', require('../routes/health'));
app.use('/readiness', require('../routes/readiness'));
app.use(require('../utils/errors').errorHandler);

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout'] });
    jest.setSystemTime(new Date('2026-10-24T22:30:00Z'));
    query.mockResolvedValue({ rows: [] });
});
afterEach(() => jest.useRealTimers());

test.each([['Europe/London', '2026-10-24'], ['Asia/Kolkata', '2026-10-25']])('health and readiness defaults use %s', async (zone, day) => {
    expect((await request(app).post('/health/sync').set('X-Fitzo-Timezone', zone).send({ steps: 100 })).status).toBe(200);
    expect(query.mock.calls.at(-1)[1][1]).toBe(day);
    expect((await request(app).post('/readiness/checkin').set('X-Fitzo-Timezone', zone).send({ energy_level: 3, sleep_quality: 3, soreness: 2 })).status).toBe(200);
    expect(query.mock.calls.at(-1)[1][9]).toBe(day);
    await request(app).get('/health/today').set('X-Fitzo-Timezone', zone);
    expect(query.mock.calls.at(-1)[1][1]).toBe(day);
    await request(app).get('/readiness/today').set('X-Fitzo-Timezone', zone);
    expect(query.mock.calls.at(-1)[1][1]).toBe(day);
});

test('a supplied historical calendar date survives travel', async () => {
    await request(app).post('/health/sync').set('X-Fitzo-Timezone', 'Europe/London').send({ date: '2026-10-20', steps: 100 });
    expect(query.mock.calls.at(-1)[1][1]).toBe('2026-10-20');
});
