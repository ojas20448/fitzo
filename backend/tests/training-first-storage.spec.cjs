const { PGlite } = require('@electric-sql/pglite');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
let db;
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
require.cache[require.resolve('../src/config/database')] = { exports: { query: (sql, values) => db.query(sql, values), getClient: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }) } };
require.cache[require.resolve('../src/services/contextPack')] = { exports: { invalidateContextPack: async () => {} } };
require.cache[require.resolve('../src/services/pushNotifications')] = { exports: {} };
require.cache[require.resolve('../src/services/xpService')] = { exports: {} };
require.cache[require.resolve('../src/middleware/auth')] = { exports: { authenticate: (req, res, next) => { req.user = { id: user }; next(); }, generateToken: async () => 'isolated-session-token' } };
process.env.JWT_SECRET = 'isolated-test-signing-key';
const app = express(); app.use(express.json());
app.use('/sessions', require('../src/routes/workout-sessions'));
app.use('/auth', require('../src/routes/auth'));
app.use('/nutrition', require('../src/routes/nutrition'));
app.use(require('../src/utils/errors').errorHandler);
const preferences = { experience: 'new', equipment: 'bodyweight', session_minutes: 20, goal_type: 'muscle_gain' };
const replacement = { split_id: 'full_body', name: 'Floor start', days: ['Full Body A'], days_per_week: 1,
    training_plan: { version: 1, preferences: { experience: 'new', equipment: 'bodyweight', session_minutes: 20 },
        sessions: [{ day_name: 'Full Body A', exercises: [{ id: 'bodyweight_squat', set_count: 2, reps: 10 }] }] } };
let original;
before(async () => {
    db = new PGlite();
    await db.exec(`CREATE TABLE users (id uuid PRIMARY KEY, email text, name text, username text, role text, gym_id uuid, xp_points integer, avatar_url text, password_hash text, token_version integer DEFAULT 0);
        CREATE TABLE gyms (id uuid, name text);
        CREATE TABLE user_splits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, split_id text, name text CHECK (name != 'fail-insert'), days text[], days_per_week integer, is_active boolean, created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW());
        CREATE TABLE nutrition_profiles (id uuid, user_id uuid, goal_type text, age integer, target_calories integer, target_protein integer, target_carbs integer, target_fat integer);
        CREATE TABLE calorie_logs (user_id uuid, logged_date date, calories integer, protein integer, carbs integer, fat integer, created_at timestamptz DEFAULT NOW());
        CREATE TABLE workout_logs (user_id uuid, exercises jsonb);
        INSERT INTO users (id, name, role) VALUES ('${user}', 'Example', 'member'), ('${other}', 'Other', 'member');
        INSERT INTO user_splits (user_id, split_id, name, days, days_per_week, is_active) VALUES ('${user}', 'adopted_example', 'My adopted routine', ARRAY['Push'], 1, true);
        INSERT INTO workout_logs VALUES ('${user}', '[{"name":"Bench press","sets":[{"weight":40,"reps":8}]}]');`);
    await db.exec(fs.readFileSync(path.join(__dirname, '../data/migrations/021_starter_workout_plan.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(__dirname, '../data/migrations/024_member_timezones.sql'), 'utf8'));
    await db.query('UPDATE users SET email = $2, password_hash = $3 WHERE id = $1', [user, 'example@test.invalid', await require('bcryptjs').hash('test-password', 4)]);
    original = (await db.query('SELECT * FROM user_splits WHERE user_id = $1', [user])).rows[0];
});
after(async () => { await db.close(); });

test('missing setup migration rolls back a replacement and keeps the existing active routine', async () => {
    const res = await request(app).put('/sessions/training-preferences').send({ preferences, expected_split_id: original.id, replacement });
    assert.equal(res.status, 500);
    assert.equal((await db.query('SELECT id FROM user_splits WHERE is_active')).rows[0].id, original.id);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM user_splits')).rows[0].n, 1);
    const sql = fs.readFileSync(path.join(__dirname, '../data/migrations/022_training_first_setup.sql'), 'utf8');
    await db.exec(sql); await db.exec(sql);
});
test('saving preferences alone preserves an adopted routine and does not complete onboarding', async () => {
    const res = await request(app).put('/sessions/training-preferences').send({ preferences, expected_split_id: original.id });
    assert.equal(res.status, 200); assert.deepEqual(res.body.split.days, original.days);
    assert.equal(res.body.split.id, original.id); assert.equal(res.body.split.training_plan, null);
    assert.equal((await request(app).get('/auth/me').set('X-Fitzo-Setup-Version', '2')).body.user.onboarding_completed, false);
});
test('training-only completion is durable while food targets stay absent', async () => {
    const saved = await request(app).post('/sessions/splits').send(replacement);
    assert.equal(saved.status, 201);
    const completed = await request(app).put('/sessions/training-preferences').send({ preferences, expected_split_id: saved.body.split.id, complete_setup: true });
    assert.equal(completed.status, 200);
    assert.equal((await request(app).get('/auth/me').set('X-Fitzo-Setup-Version', '2')).body.user.onboarding_completed, true);
    const login = await request(app).post('/auth/login').set('X-Fitzo-Setup-Version', '2').send({ email: 'example@test.invalid', password: 'test-password' });
    assert.equal(login.status, 200); assert.equal(login.body.user.onboarding_completed, true);
    assert.equal((await request(app).get('/auth/me')).body.user.onboarding_completed, false);
    const legacyToday = (await request(app).get('/nutrition/today')).body;
    assert.equal(legacyToday.targets.calories, 2000);
    assert.equal(typeof legacyToday.remaining.protein, 'number');
    const today = (await request(app).get('/nutrition/today').set('X-Fitzo-Setup-Version', '2')).body;
    assert.equal(today.targets, null); assert.equal(today.remaining, null);
    assert.deepEqual(today.logged, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM nutrition_profiles')).rows[0].n, 0);
});
test('stale previews, invalid suggestions and failed inserts cannot overwrite the current routine', async () => {
    const active = (await request(app).get('/sessions/training-preferences')).body.split;
    assert.equal((await request(app).put('/sessions/training-preferences').send({ preferences, expected_split_id: original.id, replacement })).status, 409);
    assert.equal((await request(app).put('/sessions/training-preferences').send({ preferences, expected_split_id: active.id, replacement: { ...replacement, name: 'fail-insert' } })).status, 500);
    const invalid = structuredClone(replacement); invalid.training_plan.sessions[0].exercises[0].completed = true;
    assert.equal((await request(app).put('/sessions/training-preferences').send({ preferences, expected_split_id: active.id, replacement: invalid })).status, 400);
    assert.equal((await request(app).get('/sessions/training-preferences')).body.split.id, active.id);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM workout_logs')).rows[0].n, 1);
});
test('removal clears embedded preferences across this account but keeps history, schedules, completion and other accounts', async () => {
    await db.query('INSERT INTO user_splits (user_id, split_id, name, days, days_per_week, is_active, training_plan) VALUES ($1, $2, $3, $4, 1, true, $5::jsonb)', [other, 'full_body', 'Other plan', ['Full Body A'], JSON.stringify(replacement.training_plan)]);
    const active = (await request(app).get('/sessions/training-preferences')).body.split;
    assert.equal((await request(app).delete('/sessions/training-preferences')).status, 200);
    const result = (await request(app).get('/sessions/training-preferences')).body;
    assert.equal(result.preferences, null); assert.equal(result.split.id, active.id); assert.equal(result.split.training_plan, null);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM user_splits WHERE user_id = $1 AND training_plan IS NOT NULL', [user])).rows[0].n, 0);
    assert.equal((await request(app).get('/auth/me').set('X-Fitzo-Setup-Version', '2')).body.user.onboarding_completed, true);
    assert.equal((await db.query('SELECT training_plan FROM user_splits WHERE user_id = $1', [other])).rows[0].training_plan.version, 1);
    assert.equal((await db.query('SELECT exercises FROM workout_logs WHERE user_id = $1', [user])).rows[0].exercises[0].sets[0].weight, 40);
});
