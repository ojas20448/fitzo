const { PGlite } = require('@electric-sql/pglite');
const { before, beforeEach, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const alice = '11111111-1111-4111-8111-111111111111', bob = '22222222-2222-4222-8222-222222222222';
let db;
require.cache[require.resolve('../src/config/database')] = { exports: { query: (sql, values) => db.query(sql, values) } };
require.cache[require.resolve('../src/middleware/auth')] = { exports: { authenticate: (req, res, next) => { req.user = { id: req.headers['x-test-user'] || alice }; next(); }, invalidateUserCache: async () => {} } };
const app = express(); app.use(express.json()); app.use('/settings', require('../src/routes/settings')); app.use(require('../src/utils/errors').errorHandler);
before(async () => {
    db = new PGlite();
    await db.exec('CREATE TABLE users (id uuid PRIMARY KEY);');
    const migration = fs.readFileSync(path.join(__dirname, '../data/migrations/026_exercise_preferences.sql'), 'utf8');
    await db.exec(migration); await db.exec(migration);
});
beforeEach(async () => { await db.exec(`TRUNCATE users CASCADE; INSERT INTO users VALUES ('${alice}'), ('${bob}');`); });
after(async () => { await db?.close(); });
test('exercise notes and rest times persist per account and support default and off', async () => {
    assert.deepEqual((await request(app).get('/settings/exercises')).body.preferences, []);
    const preference = { exercise_name: ' Cable Row ', note: 'Seat 4, neutral grip', rest_seconds: 120 };
    const save = await request(app).patch('/settings/exercises').send(preference);
    assert.equal(save.status, 200);
    assert.deepEqual((await request(app).get('/settings/exercises')).body.preferences, [{ exercise_name: 'cable row', note: preference.note, rest_seconds: 120 }]);
    assert.deepEqual((await request(app).get('/settings/exercises').set('X-Test-User', bob)).body.preferences, []);
    for (const rest_seconds of [0, null]) {
        assert.equal((await request(app).patch('/settings/exercises').send({ ...preference, rest_seconds })).status, 200);
        assert.equal((await request(app).get('/settings/exercises')).body.preferences[0].rest_seconds, rest_seconds);
    }
    await db.query('DELETE FROM users WHERE id = $1', [alice]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM user_exercise_preferences')).rows[0].n, 0);
});
test('invalid preferences cannot overwrite saved notes or another account', async () => {
    const good = { exercise_name: 'Cable Row', note: 'Seat 4', rest_seconds: 90 };
    await request(app).patch('/settings/exercises').send(good);
    for (const bad of [{ rest_seconds: -1 }, { rest_seconds: 90.5 }, { rest_seconds: 1801 }, { rest_seconds: '90' }, { note: 'x'.repeat(301) }, { note: null }, { exercise_name: '' }]) {
        assert.equal((await request(app).patch('/settings/exercises').send({ ...good, ...bad })).status, 400);
    }
    await request(app).patch('/settings/exercises').set('X-Test-User', bob).send({ ...good, note: 'Bob only', user_id: alice });
    assert.equal((await request(app).get('/settings/exercises')).body.preferences[0].note, 'Seat 4');
    assert.equal((await db.query('SELECT relrowsecurity FROM pg_class WHERE relname = $1', ['user_exercise_preferences'])).rows[0].relrowsecurity, true);
});
