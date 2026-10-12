jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => { req.user = { id: 'u1' }; next(); } }));
jest.mock('../services/contextPack', () => ({ invalidateContextPack: jest.fn(async () => {}) }));
jest.mock('../services/cache', () => ({ del: jest.fn(async () => {}), keys: { nutritionToday: id => `nutrition:${id}` } }));
const express = require('express');
const request = require('supertest');
const { query } = require('../config/database');
const app = express();
app.use(express.json()); app.use('/nutrition', require('../routes/nutrition')); app.use(require('../utils/errors').errorHandler);
beforeEach(() => { query.mockReset(); query.mockResolvedValue({ rows: [] }); });

test('defaults ideas to the saved vegetarian preference without requiring nutrition targets', async () => {
    query.mockResolvedValueOnce({ rows: [{ is_vegetarian: true }] });
    const res = await request(app).get('/nutrition/presets');
    expect(res.status).toBe(200);
    expect(res.body.diet).toBe('vegetarian');
    expect(res.body.presets).toHaveLength(6);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('is_vegetarian'), ['u1']);
    const emptyProfile = await request(app).get('/nutrition/presets');
    expect(emptyProfile.status).toBe(200);
    expect(emptyProfile.body.presets).toHaveLength(8);
});
test('a deliberate diet filter works independently and rejects invalid input', async () => {
    expect((await request(app).get('/nutrition/presets?diet=vegetarian')).body.presets).toHaveLength(6);
    expect((await request(app).get('/nutrition/presets?diet=all')).body.presets).toHaveLength(8);
    expect((await request(app).get('/nutrition/presets?diet=bad')).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
});
test('logs the reviewed portions and meal type atomically and preserves legacy bulk payloads', async () => {
    const res = await request(app).post('/nutrition/log-bulk').send({ meal_type: 'lunch', items: [
        { meal_name: 'Rice', calories: 103, protein: 2.2, serving_size: '0.5 cup · 75 g, cooked', is_estimate: true },
        { meal_name: 'Dal', calories: 198, protein: 11, serving_size: '1 cup · 200 g, cooked' },
    ] });
    expect(res.status).toBe(201);
    expect(res.body.totals.calories).toBe(301);
    const inserts = query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO calorie_logs'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual(['u1', 'Rice', 103, 2, 0, 0, '0.5 cup · 75 g, cooked', 'lunch', 'friends', true, 'u1', 'Dal', 198, 11, 0, 0, '1 cup · 200 g, cooked', 'lunch', 'friends', false]);
    expect(inserts[0][0]).toContain('is_estimate');
    expect((await request(app).post('/nutrition/log-bulk').send({ items: [{ meal_name: 'Roti', calories: 120 }] })).status).toBe(201);
});
test('invalid meal types or malformed portions cannot create any rows', async () => {
    for (const payload of [
        { meal_type: 'bad', items: [{ meal_name: 'Rice', calories: 103 }] },
        { items: [{ meal_name: 'Rice', calories: 103, serving_size: { grams: 75 } }] },
        { items: [{ meal_name: 'Rice', calories: 103, is_estimate: 'true' }] },
    ]) expect((await request(app).post('/nutrition/log-bulk').send(payload)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
});
