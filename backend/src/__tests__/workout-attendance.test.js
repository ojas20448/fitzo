jest.mock('../config/database', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'u' }; next(); } }));
jest.mock('../services/xpService', () => ({ awardXP: jest.fn(async () => {}) }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn(async () => {}) }));
jest.mock('../services/cache', () => ({ del: jest.fn(async () => {}), keys: { userStreak: id => id, homeData: id => id, crowdLevel: id => id } }));
jest.mock('../services/pushNotifications', () => ({ sendToUsers: jest.fn(), NotificationType: {} }));
const express = require('express');
const request = require('supertest');
const db = require('../config/database');
const xp = require('../services/xpService');
const { completeWorkoutAttendance } = require('../utils/workoutAttendance');
function appFor(route) { const app = express(); app.use(express.json()); app.use(require(`../routes/${route}`)); app.use(require('../utils/errors').errorHandler); return app; }
beforeEach(() => { jest.clearAllMocks(); db.query.mockResolvedValue({ rows: [] }); });

test('closes existing open gym attendance without awarding another attendance bonus', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValueOnce({ rows: [] });
    expect(await completeWorkoutAttendance('u', db.query)).toBe(false);
    expect(db.query.mock.calls[0][0]).toContain('UPDATE attendances SET checked_out_at = NOW()');
    expect(db.query.mock.calls[0][1]).toEqual(['u']);
    expect(db.query.mock.calls[1][0]).toContain('VALUES ($1, NULL,');
});
test('new workout attendance records training without claiming a gym visit', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'attendance' }] });
    expect(await completeWorkoutAttendance('u', db.query)).toBe(true);
    expect(db.query.mock.calls[1][0]).toContain('VALUES ($1, NULL,');
});
test('structured completion closes attendance and does not notify friends about a private workout', async () => {
    db.query.mockImplementation(async sql => {
        if (sql.includes('WITH session_volume')) return { rows: [{ id: 's', visibility: 'private', duration_minutes: 30, sets: 5, volume: 1000 }] };
        if (sql.includes('SELECT name, share_logs_default')) return { rows: [{ name: 'Member', share_logs_default: true }] };
        return { rows: [] };
    });
    const res = await request(appFor('workout-sessions')).put('/sessions/s/complete').send({});
    expect(res.status).toBe(200);
    expect(db.query.mock.calls.some(([sql]) => sql.includes('UPDATE attendances SET checked_out_at'))).toBe(true);
    expect(db.query.mock.calls.some(([sql]) => sql.includes('FROM friendships'))).toBe(false);
    expect(xp.awardXP.mock.calls.filter(([, , kind]) => kind === 'checkin')).toHaveLength(0);
});
test('QR upgrades synthetic attendance without duplicate check-in XP', async () => {
    db.query.mockImplementation(async sql => {
        if (sql.includes('FROM gyms')) return { rows: [{ id: 'gym', name: 'Gym' }] };
        if (sql.includes('INSERT INTO attendances')) return { rows: [{ inserted: false }] };
        if (sql.includes('get_user_streak')) return { rows: [{ streak: 1 }] };
        return { rows: [] };
    });
    expect((await request(appFor('checkin')).post('/').send({ gym_id: 'gym' })).status).toBe(201);
    expect(xp.awardXP).not.toHaveBeenCalled();
});
test('QR race with an existing check-in does not report success or duplicate XP', async () => {
    db.query.mockImplementation(async sql => sql.includes('FROM gyms') ? { rows: [{ id: 'gym', name: 'Gym' }] } : { rows: [] });
    expect((await request(appFor('checkin')).post('/').send({ gym_id: 'gym' })).status).toBe(409);
    expect(xp.awardXP).not.toHaveBeenCalled();
});
