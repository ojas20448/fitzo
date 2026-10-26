const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('cardio migration is additive, repeatable and persists time/effort alongside strength sets', () => {
    const migration = path.join(__dirname, '../db/migrations/add_cardio_duration.sql');
    execFileSync(process.execPath, ['-e', `
        const { PGlite } = require('@electric-sql/pglite');
        const assert = require('node:assert/strict');
        const fs = require('node:fs');
        (async () => {
            const db = new PGlite();
            try {
                await db.exec('CREATE TABLE set_logs (id serial, reps integer, weight_kg numeric, rpe integer)');
                await db.exec('INSERT INTO set_logs (reps, weight_kg) VALUES (8, 40)');
                const sql = fs.readFileSync(process.argv[1], 'utf8');
                await db.exec(sql); await db.exec(sql);
                await db.query('INSERT INTO set_logs (duration_seconds, rpe) VALUES ($1, $2)', [1230, 6]);
                const { rows } = await db.query('SELECT reps, weight_kg, duration_seconds, rpe FROM set_logs ORDER BY id');
                assert.equal(Number(rows[0].weight_kg), 40); assert.equal(rows[0].reps, 8);
                assert.deepEqual(rows[1], { reps: null, weight_kg: null, duration_seconds: 1230, rpe: 6 });
                await assert.rejects(db.query('INSERT INTO set_logs (duration_seconds) VALUES (0)'));
                await assert.rejects(db.query('INSERT INTO set_logs (duration_seconds) VALUES (86401)'));
            } finally { await db.close(); }
        })().catch(error => { console.error(error); process.exitCode = 1; });
    `, migration], { timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
}, 35000);
