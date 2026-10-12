const { PGlite } = require('@electric-sql/pglite');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
let db;
require.cache[require.resolve('../src/config/database')] = { exports: { query: (sql, values) => db.query(sql, values), getClient: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }) } };
require.cache[require.resolve('../src/services/contextPack')] = { exports: { invalidateContextPack: async () => {} } };
require.cache[require.resolve('../src/services/pushNotifications')] = { exports: {} };
require.cache[require.resolve('../src/services/xpService')] = { exports: {} };
require.cache[require.resolve('../src/middleware/auth')] = { exports: { authenticate: (req, res, next) => { req.user = { id: 'sample' }; next(); } } };
const app = express(); app.use(express.json());
app.use('/sessions', require('../src/routes/workout-sessions')); app.use('/workouts', require('../src/routes/workouts'));
app.use(require('../src/utils/errors').errorHandler);
const plan = { version: 1, preferences: { experience: 'new', equipment: 'dumbbells', session_minutes: 20 }, sessions: [{ day_name: 'Full Body A', exercises: [{ id: 'goblet_squat', set_count: 2, reps: 10 }] }] };
before(async () => {
    db = new PGlite();
    await db.exec(`CREATE TABLE users (id text primary key); INSERT INTO users VALUES ('sample'); CREATE TABLE user_splits (id serial primary key, user_id text, split_id text, name text, days text[], days_per_week integer, is_active boolean, created_at timestamptz DEFAULT now());
        CREATE TABLE workout_logs (id text PRIMARY KEY, user_id text, workout_type text, completed boolean, exercises jsonb, logged_date date, created_at timestamptz);
        CREATE TABLE workout_sessions (id text, user_id text, source_workout_log_id text, day_name text);
        INSERT INTO user_splits (user_id, split_id, name, days, days_per_week, is_active) VALUES ('sample', 'custom', 'Existing plan', ARRAY['Push'], 1, true);`);
});
after(async () => { await db.close(); });
test('a missing column leaves the existing plan active; migration is repeatable and persists JSON', async () => {
    const body = { split_id: 'full_body', name: 'Dumbbell start', days: ['Full Body A'], days_per_week: 1, training_plan: plan };
    assert.equal((await request(app).post('/sessions/splits').send(body)).status, 500);
    assert.equal((await db.query('SELECT name FROM user_splits WHERE is_active')).rows[0].name, 'Existing plan');
    const migration = fs.readFileSync(path.join(__dirname, '../data/migrations/021_starter_workout_plan.sql'), 'utf8');
    await db.exec(migration); await db.exec(migration);
    const saved = await request(app).post('/sessions/splits').send(body);
    assert.equal(saved.status, 201); assert.deepEqual(saved.body.split.training_plan, plan);
    const active = (await db.query('SELECT * FROM user_splits WHERE is_active')).rows;
    assert.equal(active.length, 1); assert.deepEqual(active[0].training_plan, plan);
    const fetched = await request(app).get('/sessions/splits');
    assert.deepEqual(fetched.body.splits[0].training_plan, plan);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM workout_logs')).rows[0].n, 0);
});
test('latest workout is scoped to day, owner and completed source even when another chest-based day is newer', async () => {
    await db.exec(`INSERT INTO workout_logs VALUES
        ('a', 'sample', 'chest', true, '[]', '2026-10-01', '2026-10-01'),
        ('b', 'sample', 'chest', true, '[]', '2026-10-03', '2026-10-03'),
        ('c', 'other', 'chest', true, '[]', '2026-10-05', '2026-10-05'),
        ('d', 'sample', 'chest', false, '[]', '2026-10-06', '2026-10-06');
        INSERT INTO workout_sessions VALUES ('sa', 'sample', 'a', 'Full Body A'), ('sb', 'sample', 'b', 'Upper B'), ('sc', 'other', 'c', 'Full Body A'), ('sd', 'sample', 'd', 'Full Body A');`);
    const named = await request(app).get('/workouts/latest?type=chest&day_name=Full%20Body%20A');
    assert.equal(named.status, 200); assert.equal(named.body.workout.id, 'a');
    assert.equal((await request(app).get('/workouts/latest?type=chest&day_name=Full%20Body%20B')).body.found, false);
    assert.equal((await request(app).get('/workouts/latest?type=chest')).body.workout.id, 'b');
});
