const express = require('express');
const request = require('supertest');

jest.mock('../services/dailyInsight', () => ({ generateAllDailyInsights: jest.fn() }));
jest.mock('../services/weeklyRecap', () => ({ generateAllWeeklyRecaps: jest.fn() }));
jest.mock('../services/quietHours', () => ({ runQuietAlerts: jest.fn(async () => ({ sent: 0, skipped: 0 })) }));

const dailyInsights = require('../services/dailyInsight');
const weeklyRecaps = require('../services/weeklyRecap');
const quietHours = require('../services/quietHours');
const app = express();
app.use('/cron', require('../routes/cron'));
const originalSecret = process.env.CRON_SECRET;

beforeEach(() => { jest.clearAllMocks(); process.env.CRON_SECRET = 'test-cron-secret'; });
afterAll(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
});

it.each(['daily-insights', 'weekly-recaps'])('does not run %s without server-verifiable user consent', async (endpoint) => {
    const response = await request(app).post(`/cron/${endpoint}`).set('x-cron-secret', 'test-cron-secret');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, skipped: true });
    expect(dailyInsights.generateAllDailyInsights).not.toHaveBeenCalled();
    expect(weeklyRecaps.generateAllWeeklyRecaps).not.toHaveBeenCalled();
});

it('keeps cron authentication in place', async () => {
    expect((await request(app).post('/cron/daily-insights')).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await request(app).post('/cron/weekly-recaps')).status).toBe(404);
});

it('preserves non-AI gym alerts', async () => {
    const response = await request(app).post('/cron/quiet-alerts').set('x-cron-secret', 'test-cron-secret');
    expect(response.status).toBe(202);
    expect(quietHours.runQuietAlerts).toHaveBeenCalledTimes(1);
});
