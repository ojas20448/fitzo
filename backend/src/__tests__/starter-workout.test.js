jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })), getClient: jest.fn() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'member' }; next(); } }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn(async () => {}) }));
jest.mock('../services/pushNotifications', () => ({}));
jest.mock('../services/xpService', () => ({}));
const express = require('express');
const request = require('supertest');
const db = require('../config/database');
const { validateStarterPlan } = require('../utils/starterWorkoutPlan');
const app = express(); app.use(express.json());
app.use('/sessions', require('../routes/workout-sessions'));
app.use('/workouts', require('../routes/workouts'));
app.use(require('../utils/errors').errorHandler);
const client = { query: jest.fn(), release: jest.fn() };
const plan = { version: 1, preferences: { experience: 'new', equipment: 'gym', session_minutes: 35 }, sessions: [{ day_name: 'Full Body A', exercises: [{ id: 'leg_press', set_count: 2, reps: 10 }] }] };
const split = { split_id: 'full_body', name: 'My starting plan', days: ['Full Body A'], days_per_week: 1 };
beforeEach(() => {
    jest.clearAllMocks(); db.getClient.mockResolvedValue(client);
    client.query.mockResolvedValue({ rows: [{ ...split, training_plan: plan }] });
});
test('saves suggestions with the active split, without creating performed work', async () => {
    const res = await request(app).post('/sessions/splits').send({ ...split, training_plan: plan });
    expect(res.status).toBe(201);
    const insert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO user_splits'));
    expect(insert[0]).toContain('training_plan'); expect(JSON.parse(insert[1][5])).toEqual(plan);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query.mock.calls.some(([sql]) => /INSERT INTO (workout_logs|workout_sessions|set_logs|exercise_logs)/.test(sql))).toBe(false);
    expect(require('../services/contextPack').invalidateContextPack).toHaveBeenCalledWith('member');
});
test('rolls back deactivation if saving the template fails', async () => {
    client.query.mockImplementation(async sql => { if (sql.includes('INSERT INTO')) throw new Error('storage failed'); return { rows: [] }; });
    const res = await request(app).post('/sessions/splits').send({ ...split, training_plan: plan });
    expect(res.status).toBe(500);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
});
test('legacy custom splits do not require the new column', async () => {
    const res = await request(app).post('/sessions/splits').send(split);
    expect(res.status).toBe(201);
    const insert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO'));
    expect(insert[0]).not.toContain('training_plan'); expect(insert[1]).toHaveLength(5);
});
test.each([
    { ...plan, preferences: { ...plan.preferences, session_minutes: 120 } },
    { ...plan, preferences: { ...plan.preferences, equipment: 'bodyweight' } },
    { ...plan, sessions: [{ ...plan.sessions[0], day_name: 'Push' }] },
    { ...plan, sessions: [{ ...plan.sessions[0], exercises: [{ id: 'unknown', set_count: 2, reps: 10 }] }] },
    { ...plan, sessions: [{ ...plan.sessions[0], exercises: [{ ...plan.sessions[0].exercises[0], completed: true }] }] },
    { ...plan, sessions: [{ ...plan.sessions[0], exercises: [plan.sessions[0].exercises[0], plan.sessions[0].exercises[0]] }] },
])('rejects invalid or performed plan data before changing any split', async training_plan => {
    const res = await request(app).post('/sessions/splits').send({ ...split, training_plan });
    expect(res.status).toBe(400); expect(db.getClient).not.toHaveBeenCalled();
});
test('latest lookup binds the selected day to the owning source workout', async () => {
    const res = await request(app).get('/workouts/latest?type=chest&day_name=Full%20Body%20B');
    expect(res.status).toBe(200);
    const [sql, args] = db.query.mock.calls[0];
    expect(sql).toContain('s.source_workout_log_id = w.id');
    expect(sql).toContain('s.user_id = $1'); expect(sql).toContain('w.completed = true');
    expect(args).toEqual(['member', ['chest', 'push'], 'Full Body B']);
});
test('accepts a 90-minute starting plan and retains its selected time', () => {
    const longer = { ...plan, preferences: { ...plan.preferences, session_minutes: 90 } };
    expect(validateStarterPlan(longer, split.days)).toEqual(longer);
});
test('template validator accepts absence and legacy latest queries remain supported', async () => {
    expect(validateStarterPlan(undefined, split.days)).toBeNull();
    const res = await request(app).get('/workouts/latest?type=legs');
    expect(res.status).toBe(200); expect(db.query.mock.calls[0][1]).toEqual(['member', ['legs', 'lower']]);
});

test('accepts timed cardio prescriptions and rejects missing or invalid durations', () => {
    const cardio = { version: 2, type: 'custom', sessions: [{ day_name: 'Cardio', exercises: [
        { name: 'Treadmill Run', tracking_type: 'cardio', set_count: 1, duration_minutes: 20.5 },
    ] }] };
    expect(validateStarterPlan(cardio, ['Cardio'])).toEqual(cardio);
    for (const duration_minutes of [undefined, 0, -5, 1441]) {
        const invalid = structuredClone(cardio);
        invalid.sessions[0].exercises[0].duration_minutes = duration_minutes;
        expect(() => validateStarterPlan(invalid, ['Cardio'])).toThrow();
    }
});
