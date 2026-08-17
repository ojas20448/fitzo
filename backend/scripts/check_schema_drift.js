/**
 * Detect columns that exist in the live database but in no repo SQL file.
 *
 * The failure mode this catches is a column added by hand in the Supabase
 * console. Those are invisible to the repo: `apply_migrations.js` will never
 * create them, so a database rebuilt from source silently lacks them, and any
 * code that later depends on one fails with 42703 only in the new environment.
 *
 * It is NOT drift for a column to be missing from src/db/schema.sql — that file
 * is the base table definition, and migrations layer on top. `username`, for
 * example, is added by src/db/migrate_username.sql and is entirely reproducible.
 * So this compares the live schema against the UNION of every .sql file, not
 * against schema.sql alone. Comparing against schema.sql alone reports ~17
 * false positives on the users table and trains you to ignore the output.
 *
 *   node scripts/check_schema_drift.js
 *
 * Exit code 1 when orphans are found, so CI can gate on it.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

// Tables worth guarding. Extend freely — the cost is one catalogue query.
const TABLES = [
    'users', 'workout_sessions', 'exercise_logs', 'set_logs',
    'calorie_logs', 'nutrition_profiles', 'fitness_profiles',
    'body_measurements', 'user_splits', 'attendances', 'gyms',
];

function readAllSql() {
    // All three migration locations. src/db/migrations/ is a subdirectory of
    // src/db/ and readdirSync is not recursive, so omitting it reports its
    // seven files' columns as orphans — which is exactly the false alarm this
    // script produced on its first run.
    const dirs = [
        path.join(__dirname, '..', 'src', 'db'),
        path.join(__dirname, '..', 'src', 'db', 'migrations'),
        path.join(__dirname, '..', 'data', 'migrations'),
    ];
    let text = '';
    for (const d of dirs) {
        if (!fs.existsSync(d)) continue;
        for (const f of fs.readdirSync(d).filter((f) => f.endsWith('.sql'))) {
            text += '\n' + fs.readFileSync(path.join(d, f), 'utf8');
        }
    }
    return text.toLowerCase();
}

(async () => {
    const sql = readAllSql();
    let orphans = 0;

    for (const table of TABLES) {
        const r = await query(
            `SELECT column_name FROM information_schema.columns
              WHERE table_name = $1 AND table_schema = 'public'
              ORDER BY ordinal_position`,
            [table]
        );
        if (r.rows.length === 0) {
            console.log(`  ${table}: not present in the live database`);
            continue;
        }

        // A column counts as accounted-for if its name appears anywhere in the
        // repo's SQL. Deliberately loose: the goal is catching columns nothing
        // in the repo has heard of, not parsing DDL precisely. A loose match
        // errs toward silence, which is the right bias for a CI gate.
        const missing = r.rows
            .map((x) => x.column_name)
            .filter((c) => !new RegExp(`\\b${c}\\b`).test(sql));

        if (missing.length) {
            orphans += missing.length;
            console.log(`\n  ${table}`);
            missing.forEach((c) => console.log(`    ${c}  — in the live DB, in no repo .sql file`));
        }
    }

    if (orphans === 0) {
        console.log('No orphan columns. Every live column is reproducible from the repo.');
        process.exit(0);
    }

    console.log(`\n${orphans} orphan column(s).`);
    console.log('Each was almost certainly added by hand in the Supabase console.');
    console.log('Either write a migration for it, or drop it if it is dead.');
    process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
