const { PGlite } = require('@electric-sql/pglite');
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const path = require('node:path');
let db;
let clock = '2026-10-23T22:30:00Z';
process.env.JWT_SECRET = 'isolated-timezone-test-secret';
require.cache[require.resolve('../src/config/database')] = { exports: { query: (sql, values) => db.query(sql.replace(/\bNOW\(\)/gi, `'${clock}'::timestamptz`), values) } };
require.cache[require.resolve('../src/services/cache')] = { exports: { del: async () => {}, keys: { nutritionToday: id => `nutrition:${id}`, userStreak: id => id, homeData: id => id } } };
require.cache[require.resolve('../src/services/contextPack')] = { exports: { invalidateContextPack: async () => {} } };
require.cache[require.resolve('../src/services/xpService')] = { exports: { awardXP: async () => {} } };
const app = express();
app.use(express.json());
app.use('/calories', require('../src/routes/calories'));
app.use('/nutrition', require('../src/routes/nutrition'));
app.use(require('../src/utils/errors').errorHandler);
const token = jwt.sign({ userId: 'member', tokenVersion: 0 }, process.env.JWT_SECRET);
const call = (method, url, timezone = 'Europe/London') => {
    const req = request(app)[method](url).set('Authorization', `Bearer ${token}`);
    return timezone ? req.set('X-Fitzo-Timezone', timezone) : req;
};
before(async () => {
    db = new PGlite();
    await db.exec(`CREATE TABLE users (id text PRIMARY KEY, email text, name text, role text, gym_id text,
        trainer_id text, xp_points integer, avatar_url text, token_version integer DEFAULT 0, share_logs_default boolean DEFAULT true);
        CREATE TABLE calorie_logs (id serial PRIMARY KEY, user_id text, food_name text, calories integer,
        protein numeric DEFAULT 0, carbs numeric DEFAULT 0, fat numeric DEFAULT 0, serving_size text,
        meal_type text DEFAULT 'snack', visibility text DEFAULT 'friends', community_food_id uuid,
        is_estimate boolean DEFAULT false, logged_date date DEFAULT CURRENT_DATE,
        created_at timestamptz DEFAULT '2026-10-23T22:30:00Z');
        CREATE TABLE nutrition_profiles (user_id text, target_calories integer, target_protein integer,
        target_carbs integer, target_fat integer, goal_type text);
        CREATE TABLE friendships (user_id text, friend_id text, status text);`);
    const migration = path.join(__dirname, '../data/migrations/024_member_timezones.sql');
    await db.exec(fs.readFileSync(migration, 'utf8'));
    await db.exec(fs.readFileSync(migration, 'utf8'));
});
beforeEach(async () => {
    clock = '2026-10-23T22:30:00Z';
    await db.exec("TRUNCATE calorie_logs, users; INSERT INTO users (id) VALUES ('member');");
});
after(async () => { await db.close(); });

test('every food write uses the member day and persists it for history', async () => {
    const meal = { food_name: 'Rice', calories: 200, protein: 4, carbs: 40, fat: 2, meal_type: 'dinner' };
    assert.equal((await call('post', '/nutrition/log').send(meal)).status, 200);
    assert.equal((await call('post', '/nutrition/log-bulk').send({ items: [{ meal_name: 'Dal', calories: 100 }] })).status, 201);
    assert.equal((await call('post', '/calories').send({ meal_name: 'Tea', calories: 50 })).status, 200);
    const rows = (await db.query('SELECT logged_date::text, logged_timezone FROM calorie_logs ORDER BY id')).rows;
    assert.deepEqual(rows, Array(3).fill({ logged_date: '2026-10-23', logged_timezone: 'Europe/London' }));
    const today = await call('get', '/calories/today');
    assert.equal(today.body.totals.calories, 350);
    assert.equal((await call('get', '/nutrition/today')).body.logged.calories, 350);
    assert.equal((await call('get', '/calories/day/2026-10-23')).body.totals.calories, 350);
});

test('single food, bulk meals and recipes save to the selected Friday instead of today', async () => {
    clock = '2026-10-25T12:00:00Z';
    assert.equal((await call('post', '/nutrition/log').send({ food_name: 'Rice', calories: 200, logged_date: '2026-10-23' })).status, 200);
    assert.equal((await call('post', '/nutrition/log-bulk').send({ logged_date: '2026-10-23', items: [{ meal_name: 'Dal', calories: 100 }, { meal_name: 'Roti', calories: 120 }] })).status, 201);
    assert.equal((await call('post', '/calories').send({ meal_name: 'Recipe', calories: 300, logged_date: '2026-10-23' })).status, 200);
    const rows = (await db.query('SELECT logged_date::text, logged_timezone FROM calorie_logs')).rows;
    assert.deepEqual(rows, Array(4).fill({ logged_date: '2026-10-23', logged_timezone: 'Europe/London' }));
    assert.equal((await call('get', '/calories/day/2026-10-23')).body.totals.calories, 720);
    assert.equal((await call('get', '/calories/today')).body.totals.calories, 0);
    assert.equal((await call('get', '/nutrition/today')).body.logged.calories, 0);
    assert.equal((await call('get', '/calories/day/2026-10-23', 'Asia/Kolkata')).body.totals.calories, 720);
});

test('invalid explicit diary dates cannot write food to today by falling back', async () => {
    for (const logged_date of ['', null, 42, '2026-02-30', '23-10-2026', ['2026-10-23']]) {
        for (const [url, payload] of [
            ['/nutrition/log', { food_name: 'Rice', calories: 200 }],
            ['/nutrition/log-bulk', { items: [{ meal_name: 'Dal', calories: 100 }] }],
            ['/calories', { meal_name: 'Recipe', calories: 300 }],
        ]) assert.equal((await call('post', url).send({ ...payload, logged_date })).status, 400, `${url}: ${JSON.stringify(logged_date)}`);
    }
    assert.equal((await db.query('SELECT count(*)::int AS n FROM calorie_logs')).rows[0].n, 0);
});

test('legacy London evening meals are corrected in diary, history and weekly totals without rewriting rows', async () => {
    await db.exec(`INSERT INTO calorie_logs (user_id, calories, logged_date, created_at) VALUES
        ('member', 1528, '2026-10-23', '2026-10-22T19:10:00Z'),
        ('member', 1159, '2026-10-23', '2026-10-23T18:20:00Z');`);
    const yesterday = await call('get', '/calories/day/2026-10-22');
    assert.equal(yesterday.body.totals.calories, 1528);
    assert.equal(yesterday.body.entries[0].logged_date.slice(0, 10), '2026-10-22');
    assert.equal((await call('get', '/calories/today')).body.totals.calories, 1159);
    assert.equal((await call('get', '/nutrition/today')).body.logged.calories, 1159);
    const history = (await call('get', '/calories/history')).body.history;
    assert.deepEqual(history.map(row => [row.logged_date.slice(0, 10), Number(row.total_calories)]), [['2026-10-23', 1159], ['2026-10-22', 1528]]);
    const weekly = (await call('get', '/nutrition/weekly')).body.history;
    assert.deepEqual(weekly.map(row => [row.date.slice(0, 10), Number(row.calories)]), [['2026-10-22', 1528], ['2026-10-23', 1159]]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM calorie_logs WHERE logged_date = \'2026-10-23\'')).rows[0].n, 2);
});

test('London midnight follows both daylight-saving transitions', async () => {
    for (const [instant, day] of [
        ['2026-03-28T23:59:59Z', '2026-03-28'], ['2026-03-29T00:00:00Z', '2026-03-29'],
        ['2026-03-29T22:59:59Z', '2026-03-29'], ['2026-03-29T23:00:00Z', '2026-03-30'],
        ['2026-10-24T22:59:59Z', '2026-10-24'], ['2026-10-24T23:00:00Z', '2026-10-25'],
        ['2026-10-25T00:30:00Z', '2026-10-25'], ['2026-10-25T01:30:00Z', '2026-10-25'],
        ['2026-10-25T23:59:59Z', '2026-10-25'], ['2026-10-26T00:00:00Z', '2026-10-26'],
    ]) {
        clock = instant;
        const response = await call('post', '/calories').send({ calories: 100 });
        assert.equal(response.status, 200);
        assert.equal(response.body.entry.logged_date.slice(0, 10), day, instant);
    }
});

test('a saved timezone works for older clients and invalid headers cannot change it', async () => {
    await call('get', '/calories/today');
    const saved = await call('post', '/calories', null).send({ calories: 100 });
    assert.equal(saved.body.entry.logged_date.slice(0, 10), '2026-10-23');
    for (const timezone of ['Invalid/Timezone', "Europe/London'; SELECT 1;--", '+05:30']) {
        assert.equal((await call('post', '/calories', timezone).send({ calories: 10 })).status, 400);
    }
    assert.equal((await db.query("SELECT timezone FROM users WHERE id = 'member'")).rows[0].timezone, 'Europe/London');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM calorie_logs')).rows[0].n, 1);
});

test('members who never supplied a timezone keep India dates', async () => {
    const saved = await call('post', '/calories', null).send({ calories: 100 });
    assert.equal(saved.body.entry.logged_date.slice(0, 10), '2026-10-24');
});

test('zones west of UTC and with fractional offsets use their own calendar dates', async () => {
    for (const [timezone, day] of [['America/New_York', '2026-10-23'], ['Asia/Kathmandu', '2026-10-24'], ['UTC', '2026-10-23']]) {
        const saved = await call('post', '/calories', timezone).send({ calories: 100 });
        assert.equal(saved.status, 200);
        assert.equal(saved.body.entry.logged_date.slice(0, 10), day);
    }
});

test('a revoked session cannot update a member timezone', async () => {
    await db.exec("UPDATE users SET token_version = 1 WHERE id = 'member'");
    assert.equal((await call('post', '/calories').send({ calories: 100 })).status, 401);
    assert.equal((await db.query("SELECT timezone FROM users WHERE id = 'member'")).rows[0].timezone, 'Asia/Kolkata');
});

test('travelling does not move a meal saved with its original local day', async () => {
    await call('post', '/calories').send({ calories: 100 });
    await call('get', '/calories/today', 'Asia/Kolkata');
    assert.equal((await call('get', '/calories/day/2026-10-23', null)).body.totals.calories, 100);
    assert.equal((await call('get', '/calories/today', null)).body.totals.calories, 0);
});

test('explicitly backdated legacy meals keep their chosen date', async () => {
    await db.exec("INSERT INTO calorie_logs (user_id, calories, logged_date) VALUES ('member', 100, '2026-10-10')");
    assert.equal((await call('get', '/calories/day/2026-10-10')).body.totals.calories, 100);
    assert.equal((await call('get', '/calories/today')).body.totals.calories, 0);
});

test('shared food totals use each owner timezone and keep private meals hidden', async () => {
    await db.exec(`INSERT INTO users (id, timezone) VALUES ('india', 'Asia/Kolkata'), ('uk', 'Europe/London');
        INSERT INTO calorie_logs (user_id, calories, logged_date, created_at, visibility) VALUES
        ('india', 100, '2026-10-24', '2026-10-23T19:00:00Z', 'public'),
        ('uk', 200, '2026-10-24', '2026-10-23T19:00:00Z', 'public'),
        ('uk', 500, '2026-10-24', '2026-10-23T19:00:00Z', 'private');`);
    const response = await call('get', '/calories/feed');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.feed.map(row => [row.user_id, row.logged_date.slice(0, 10), Number(row.total_calories)]),
        [['india', '2026-10-24', 100], ['uk', '2026-10-23', 200]]);
});
