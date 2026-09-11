jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })), getClient: jest.fn() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'u' }; next(); } }));
jest.mock('../services/xpService', () => ({ awardXP: jest.fn(async () => {}) }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn(async () => {}) }));
const express = require('express'); const request = require('supertest');
const db = require('../config/database');
const client = { query: jest.fn(), release: jest.fn() };
const app = express(); app.use(express.json()); app.use(require('../routes/workouts')); app.use(require('../utils/errors').errorHandler);
beforeEach(() => {
    jest.clearAllMocks(); db.getClient.mockResolvedValue(client);
    client.query.mockImplementation(async sql => {
        if (sql.includes('INSERT INTO workout_logs')) return { rows: [{ id: 'log' }] };
        if (sql.includes('INSERT INTO workout_sessions')) throw new Error('mirror unavailable');
        return { rows: [] };
    });
});
it('rolls back the flat log and mirror together when structured storage fails', async () => {
    const res = await request(app).post('/').send({ workout_type: 'chest', exercises: JSON.stringify([{ name: 'Bench', sets: [{ reps: 8, weight_kg: 40 }] }]) });
    expect(res.status).toBe(500);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
});
it('ties each mirror to the flat source record instead of deleting by a display label', async () => {
    client.query.mockImplementation(async sql => {
        if (sql.includes('INSERT INTO workout_logs')) return { rows: [{ id: 'log' }] };
        if (sql.includes('INSERT INTO workout_sessions')) return { rows: [{ id: 'session' }] };
        if (sql.includes('INSERT INTO exercise_logs')) return { rows: [{ id: 'exercise' }] };
        return { rows: [] };
    });
    const res = await request(app).post('/').send({ workout_type: 'chest', exercises: JSON.stringify([{ name: 'Bench', sets: [] }]) });
    expect(res.status).toBe(200);
    const insert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO workout_sessions'));
    expect(insert[0]).toContain('source_workout_log_id'); expect(insert[1]).toContain('log');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
});
