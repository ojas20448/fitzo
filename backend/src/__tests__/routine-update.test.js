jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })), getClient: jest.fn() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'owner' }; next(); } }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn(async () => {}) }));
const express = require('express'), request = require('supertest');
const { query } = require('../config/database');
const { validateStarterPlan } = require('../utils/starterWorkoutPlan');
const app = express(); app.use(express.json()); app.use(require('../routes/workout-sessions')); app.use(require('../utils/errors').errorHandler);
const id = '11111111-1111-4111-8111-111111111111';
const original = { version: 1, preferences: { experience: 'new', equipment: 'gym', session_minutes: 20 }, sessions: [{ day_name: 'Upper 1', exercises: [{ id: 'chest_press_machine', set_count: 2, reps: 10 }] }] };
const plan = { version: 2, type: 'custom', sessions: [{ day_name: 'Upper 1', exercises: [{ id: 'chest_press_machine', name: 'Machine Chest Press', set_count: 3, reps_min: 10, reps_max: 10 }] }] };
beforeEach(() => { jest.clearAllMocks(); query.mockResolvedValue({ rows: [{ id, training_plan: plan }] }); });
test('updates only the authenticated owner and active routine that still matches the expected plan', async () => {
    const response = await request(app).patch(`/splits/${id}/plan`).send({ training_plan: plan, expected_plan: original });
    expect(response.status).toBe(200);
    const [sql, args] = query.mock.calls[0];
    expect(sql).toContain('user_id = $1'); expect(sql).toContain('training_plan = $4::jsonb'); expect(sql).toContain('is_active = true');
    expect(args).toEqual(['owner', id, JSON.stringify(plan), JSON.stringify(original), ['Upper 1']]);
    expect(query.mock.calls.some(([s]) => s.includes('INSERT') || s.includes('is_active = false'))).toBe(false);
});
test('a stale, inactive or unowned routine cannot be overwritten', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const response = await request(app).patch(`/splits/${id}/plan`).send({ training_plan: plan, expected_plan: original });
    expect(response.status).toBe(409); expect(query).toHaveBeenCalledTimes(1);
});
test('rejects malformed plans and mismatched training days before writing', async () => {
    const response = await request(app).patch(`/splits/${id}/plan`).send({ training_plan: { ...plan, sessions: [{ ...plan.sessions[0], day_name: 'Wrong day' }] }, expected_plan: original });
    expect(response.status).toBe(400); expect(query).not.toHaveBeenCalled();
});
test('custom plan validation keeps valid ranges and rejects unknown fields and invalid targets', () => {
    expect(validateStarterPlan(plan, ['Upper 1'])).toEqual(plan);
    expect(() => validateStarterPlan({ ...plan, unexpected: true }, ['Upper 1'])).toThrow();
    expect(() => validateStarterPlan({ ...plan, sessions: [{ ...plan.sessions[0], exercises: [{ ...plan.sessions[0].exercises[0], reps_min: 20, reps_max: 10 }] }] }, ['Upper 1'])).toThrow();
});
