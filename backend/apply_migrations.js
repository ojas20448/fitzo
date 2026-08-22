require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

/**
 * Apply every migration in the repo, in dependency order.
 *
 * ── Why this was rewritten ──────────────────────────────────────────────────
 * The previous version ran five hardcoded files from src/db/ plus everything in
 * data/migrations/. That left THIRTEEN files in src/db/ and all SEVEN in
 * src/db/migrations/ unreachable — including migrate_workout_logging.sql, which
 * creates workout_sessions, exercise_logs, set_logs and user_splits.
 *
 * The live database has those tables because they were applied by hand long
 * ago. The repo could not reproduce them. A rebuild from source would have come
 * up without the core workout-logging schema, and the failure would only
 * surface later as 42P01 "relation does not exist" in a new environment.
 * That is a disaster-recovery hole, not a tidiness problem.
 *
 * ── Ordering ────────────────────────────────────────────────────────────────
 * Three phases, because dependencies cross directory boundaries:
 *   1. schema.sql            base tables and enums
 *   2. src/db/               ORDERED explicitly — FKs make order load-bearing
 *   3. src/db/migrations/    additive feature migrations
 *   4. data/migrations/      numbered, lexical order
 *
 * ── Idempotency ─────────────────────────────────────────────────────────────
 * Older files use bare CREATE TABLE / ADD COLUMN with no IF NOT EXISTS, so
 * re-running them on a live database raises "already exists". That is the
 * expected steady state, not a failure, and must never halt the run — a single
 * unhandled "already exists" is why user_foods went missing for weeks.
 *
 *   node apply_migrations.js --dry-run   # print the plan, touch nothing
 *   node apply_migrations.js             # apply
 *   node apply_migrations.js --with-rls  # also apply enable_rls.sql (see below)
 */

const DRY = process.argv.includes('--dry-run');
const WITH_RLS = process.argv.includes('--with-rls');

// Explicit order for src/db/. Files not listed here are swept alphabetically
// afterwards, so adding a new migration needs no edit unless it has a
// dependency — in which case name it here.
const SRC_DB_ORDER = [
    'migrate_username.sql',              // users.username, NOT NULL + UNIQUE
    'migrate_fitness_profile.sql',       // fitness_profiles, body_measurements
    'alter_measurements.sql',            // extends body_measurements
    'migrate_nutrition_profile.sql',
    'migrate_workout_logging.sql',       // workout_sessions -> exercise_logs -> set_logs
    'migrate_splits.sql',
    'migrate_recipes.sql',
    'migrate_published_splits.sql',
    'migrate_user_foods.sql',            // must precede the FK below
    'migrate_calorie_logs_source.sql',   // FK -> user_foods
];

// Deliberately excluded from the automatic sweep:
//   seed.sql        demo data, not schema — never run implicitly
//   schema.sql      handled as phase 1
//   enable_rls.sql  turning on row-level security against a database whose
//                   policies are untested would lock the API out of its own
//                   tables. Opt in with --with-rls, on a staging copy first.
const EXCLUDED = new Set(['seed.sql', 'schema.sql', 'enable_rls.sql']);

// Postgres codes that mean "this migration has already been applied".
const ALREADY_APPLIED = new Set([
    '42P07', // duplicate_table
    '42710', // duplicate_object (constraint, index, type)
    '42701', // duplicate_column  <- bare ADD COLUMN, e.g. migrate_username.sql
    '42P06', // duplicate_schema
    '42723', // duplicate_function
]);

function listDir(dir, filter = () => true) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).filter(filter).sort();
}

function buildPlan() {
    const srcDb = path.join(__dirname, 'src', 'db');
    const srcMig = path.join(__dirname, 'src', 'db', 'migrations');
    const dataMig = path.join(__dirname, 'data', 'migrations');

    const plan = [];

    // Phase 1 — base schema.
    plan.push({ label: 'src/db/schema.sql', path: path.join(srcDb, 'schema.sql') });

    // Phase 2 — ordered, then the alphabetical remainder.
    const named = new Set(SRC_DB_ORDER);
    for (const f of SRC_DB_ORDER) {
        plan.push({ label: `src/db/${f}`, path: path.join(srcDb, f) });
    }
    for (const f of listDir(srcDb, (f) => !named.has(f) && !EXCLUDED.has(f))) {
        plan.push({ label: `src/db/${f}`, path: path.join(srcDb, f) });
    }

    // Phase 3 — feature migrations that the old runner never reached at all.
    for (const f of listDir(srcMig)) {
        plan.push({ label: `src/db/migrations/${f}`, path: path.join(srcMig, f) });
    }

    // Phase 4 — numbered. Zero-padded prefixes make lexical order correct.
    for (const f of listDir(dataMig, (f) => /^\d+.*\.sql$/i.test(f))) {
        plan.push({ label: `data/migrations/${f}`, path: path.join(dataMig, f) });
    }

    if (WITH_RLS) {
        plan.push({ label: 'src/db/enable_rls.sql', path: path.join(srcDb, 'enable_rls.sql') });
    }

    return plan;
}

async function runMigrations() {
    const plan = buildPlan();

    if (DRY) {
        console.log(`Plan — ${plan.length} file(s), in this order:\n`);
        plan.forEach((m, i) => {
            const missing = fs.existsSync(m.path) ? '' : '   [FILE MISSING]';
            console.log(`  ${String(i + 1).padStart(2)}. ${m.label}${missing}`);
        });
        console.log('\n--dry-run: nothing executed.');
        if (!WITH_RLS) console.log('enable_rls.sql excluded — pass --with-rls to include it.');
        return;
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        console.log('🔌 Connected to database...');

        let applied = 0, skipped = 0, failed = 0;
        const failures = [];

        for (const { label: file, path: filePath } of plan) {
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️  ${file} not found — skipping`);
                continue;
            }

            const sql = fs.readFileSync(filePath, 'utf8');
            try {
                await client.query(sql);
                console.log(`✅ ${file}`);
                applied++;
            } catch (err) {
                try {
                    await client.query('ROLLBACK');
                } catch (e) {
                    // ignore rollback errors
                }
                
                if (ALREADY_APPLIED.has(err.code) || /already exists/i.test(err.message)) {
                    console.log(`⏭️  ${file} — already applied`);
                    skipped++;
                } else {
                    console.error(`❌ ${file} — ${err.code || ''} ${err.message}`);
                    failures.push(`${file}: ${err.message}`);
                    failed++;
                }
            }
        }

        console.log(`\n✨ ${applied} applied, ${skipped} already present, ${failed} failed.`);
        if (failed > 0) {
            console.log('\nFailures:');
            failures.forEach((f) => console.log(`  ${f}`));
            process.exitCode = 1;
        }
    } catch (err) {
        console.error('\n❌ Could not run migrations:', err.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

runMigrations();
