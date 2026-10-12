const { PGlite } = require('@electric-sql/pglite');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
let db;
require.cache[require.resolve('../src/config/database')] = { exports: { query: (sql, values) => db.query(sql, values) } };
require.cache[require.resolve('../src/services/contextPack')] = { exports: { invalidateContextPack: async () => {} } };
require.cache[require.resolve('../src/middleware/auth')] = { exports: { authenticate: (req, res, next) => { req.user = { id: 'sample' }; next(); } } };
const app = express();
app.use(express.json()); app.use('/readiness', require('../src/routes/readiness')); app.use(require('../src/utils/errors').errorHandler);
before(async () => {
    db = new PGlite();
    await db.exec(`CREATE TABLE readiness_logs (
        id serial PRIMARY KEY, user_id text NOT NULL, log_date date NOT NULL DEFAULT CURRENT_DATE,
        energy_level integer NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
        sleep_quality integer NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
        soreness integer NOT NULL CHECK (soreness BETWEEN 1 AND 5), sleep_hours decimal(3,1),
        readiness_score integer, recommendation text, recommendation_message text, notes text,
        created_at timestamptz DEFAULT NOW(), UNIQUE(user_id, log_date));`);
});
after(async () => { await db.close(); });
test('actual upsert SQL saves the chosen day and zero hours, preserves notes, and updates one row', async () => {
    const body = { energy_level: 3, sleep_quality: 4, soreness: 2, sleep_hours: 0, date: '2026-10-07' };
    assert.equal((await request(app).post('/readiness/checkin').send({ ...body, notes: 'Sample note' })).status, 200);
    assert.equal((await request(app).post('/readiness/checkin').send({ ...body, energy_level: 4 })).status, 200);
    const rows = await db.query('SELECT * FROM readiness_logs');
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].log_date.toISOString().slice(0, 10), '2026-10-07');
    assert.equal(Number(rows.rows[0].sleep_hours), 0);
    assert.equal(rows.rows[0].energy_level, 4);
    assert.equal(rows.rows[0].notes, 'Sample note');
    const today = await request(app).get('/readiness/today?date=2026-10-07');
    assert.equal(today.body.checked_in, true);
    const history = await request(app).get('/readiness/history?date=2026-10-07&days=7');
    assert.equal(history.status, 200);
    assert.equal(history.body.days_logged, 1);
    assert.equal((await request(app).post('/readiness/checkin').send({ ...body, notes: '' })).status, 200);
    assert.equal((await db.query('SELECT notes FROM readiness_logs')).rows[0].notes, null);
});
