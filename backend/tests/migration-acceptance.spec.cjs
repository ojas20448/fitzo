const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const express = require('express');
const request = require('supertest');
const axios = require('axios');
let db, app;
const authPath = require.resolve('../src/middleware/auth');
const dbPath = require.resolve('../src/config/database');
require.cache[dbPath] = { id: dbPath, loaded: true, exports: { query: (...args) => db.query(...args) } };
require.cache[authPath] = { id: authPath, loaded: true, exports: {
    generateToken: async () => 'test-only-token', invalidateUserCache: async () => {},
    authenticate: (req, res, next) => { req.user = { id: 'test-only' }; next(); },
} };
const exerciseDB = require('../src/services/exercisedb');

before(async () => {
    db = new PGlite();
    await db.exec(`
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE,
            password_hash TEXT, name TEXT, role TEXT, gym_id UUID,
            username VARCHAR(30) UNIQUE, avatar_url TEXT, xp_points INTEGER DEFAULT 0
        );
        CREATE TABLE exercises (
            id UUID PRIMARY KEY, name TEXT, category TEXT, equipment TEXT, muscle_groups TEXT[]
        );
    `);
    app = express();
    app.use(express.json());
    app.use('/auth', require('../src/routes/auth'));
    app.use('/exercises', require('../src/routes/exercises'));
    app.use(require('../src/utils/errors').errorHandler);
});
after(async () => { await db.close(); });
beforeEach(async () => { await db.exec('TRUNCATE users, exercises'); });

test('a valid email with a long local part registers within the real username limit', async () => {
    const res = await request(app).post('/auth/register').send({
        email: 'a-valid-long-email-name-for-registration@example.invalid',
        password: 'Test-only-password-123!', name: 'Acceptance Test',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.username.length, 30);
    assert.equal(res.body.user.email, 'a-valid-long-email-name-for-registration@example.invalid');
});

test('long emails sharing a prefix get distinct usernames within the database limit', async () => {
    const usernames = [];
    for (const domain of ['one.invalid', 'two.invalid']) {
        const res = await request(app).post('/auth/register').send({
            email: 'a-valid-long-email-name-for-registration@' + domain,
            password: 'Test-only-password-123!', name: 'Acceptance Test',
        });
        assert.equal(res.status, 201);
        assert.ok(res.body.user.username.length <= 30);
        usernames.push(res.body.user.username);
    }
    assert.equal(new Set(usernames).size, 2);
});

test('rate-limited exercise browsing returns a paginated usable local catalog', async () => {
    await db.exec(`INSERT INTO exercises VALUES
        ('11111111-1111-4111-8111-111111111111', 'Bench Press', 'chest', 'barbell', ARRAY['chest','triceps']),
        ('22222222-2222-4222-8222-222222222222', 'Curl', 'arms', 'dumbbell', ARRAY['biceps']),
        ('33333333-3333-4333-8333-333333333333', 'Squat', 'legs', 'barbell', ARRAY['quads']);`);
    axios.get = async () => { throw { response: { status: 429, data: { message: 'Too many requests' } } }; };
    const res = await request(app).get('/exercises?limit=1&offset=1');
    assert.equal(res.status, 200);
    assert.equal(res.body.exercises.length, 1);
    assert.equal(res.body.exercises[0].id, '22222222-2222-4222-8222-222222222222');
    assert.equal(res.body.exercises[0].name, 'Curl');
    assert.equal(res.body.exercises[0].bodyPart, 'upper arms');
    assert.equal(res.body.exercises[0].target, 'biceps');
    assert.equal(res.body.exercises[0].equipment, 'dumbbell');
    assert.equal(res.body.count, 1);
});

test('local catalog entries resolve by ID while the upstream is unavailable', async () => {
    await db.exec(`INSERT INTO exercises VALUES
        ('11111111-1111-4111-8111-111111111111', 'Bench Press', 'chest', 'barbell', ARRAY['chest','triceps']);`);
    axios.get = async () => { throw new Error('Upstream unavailable'); };
    const res = await request(app).get('/exercises/11111111-1111-4111-8111-111111111111');
    assert.equal(res.status, 200);
    assert.equal(res.body.exercise.name, 'Bench Press');
    assert.equal(res.body.exercise.target, 'chest');
});

test('successful upstream catalog responses retain their existing fields', async () => {
    const exercises = [{ id: 'upstream-1', name: 'Bench Press', gifUrl: 'https://example.invalid/bench.gif' }];
    axios.get = async () => ({ data: exercises });
    assert.deepEqual(await exerciseDB.getAllExercises(), exercises);
});

test('unknown exercise IDs remain not found when the upstream fails', async () => {
    axios.get = async () => { throw new Error('Upstream unavailable'); };
    const res = await request(app).get('/exercises/not-an-id');
    assert.equal(res.status, 404);
});
