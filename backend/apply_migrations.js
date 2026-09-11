const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { Client } = require('pg');

// Normal runs never execute the destructive base schema. Bootstrap is explicit
// and restricted to an empty application database. See docs/MIGRATIONS.md.

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

function listDir(dir, filter = () => true) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).filter(filter).sort();
}

function buildPlan({ bootstrap = false, withRls = false } = {}) {
    const srcDb = path.join(__dirname, 'src', 'db');
    const srcMig = path.join(__dirname, 'src', 'db', 'migrations');
    const dataMig = path.join(__dirname, 'data', 'migrations');

    const plan = [];

    // Phase 1 — base schema.
    if (bootstrap) plan.push({ label: 'src/db/schema.sql', path: path.join(srcDb, 'schema.sql') });

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

    if (withRls) {
        plan.push({ label: 'src/db/enable_rls.sql', path: path.join(srcDb, 'enable_rls.sql') });
    }

    return plan;
}

// Strip only a whole-file transaction wrapper, never BEGIN/END inside functions.
function migrationBody(sql) {
    // Keep comments intact; they cannot contain executable statements.
    const start = sql.match(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*BEGIN\s*;/i);
    const end = sql.match(/COMMIT\s*;\s*$/i);
    if (start && end) return sql.slice(start[0].length, end.index).trim();
    return sql;
}

async function applyPlan(client, plan, { bootstrap = false } = {}) {
    // Read all files before touching the database; a missing file is fatal.
    const files = plan.map(file => {
        const sql = fs.readFileSync(file.path, 'utf8');
        return { ...file, sql, checksum: createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex') };
    });
    await client.query("SELECT pg_advisory_lock(741203891)");
    try {
        if (bootstrap) {
            const existing = await client.query(`SELECT c.relname AS name FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
                UNION ALL SELECT t.typname FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd')`);
            if (existing.rows.length) throw new Error('Bootstrap requires an empty database; existing relations were found.');
        }
        await client.query(`CREATE TABLE IF NOT EXISTS fitzo_schema_migrations (
            name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        const results = [];
        for (const file of files) {
            const existing = await client.query('SELECT checksum FROM fitzo_schema_migrations WHERE name = $1', [file.label]);
            if (existing.rows.length) {
                if (existing.rows[0].checksum !== file.checksum) throw new Error(`Migration checksum changed: ${file.label}. Add a new migration instead.`);
                results.push({ name: file.label, status: 'already recorded' });
                continue;
            }
            await client.query('BEGIN');
            try {
                await client.query(migrationBody(file.sql));
                await client.query('INSERT INTO fitzo_schema_migrations (name, checksum) VALUES ($1, $2)', [file.label, file.checksum]);
                await client.query('COMMIT');
                results.push({ name: file.label, status: 'applied' });
            } catch (error) {
                await client.query('ROLLBACK');
                throw new Error(`${file.label}: ${error.message}. Rolled back; later migrations were not run. An existing object does not prove the whole file was applied.`, { cause: error });
            }
        }
        return results;
    } finally {
        await client.query('SELECT pg_advisory_unlock(741203891)');
    }
}

async function runMigrations(args = process.argv.slice(2)) {
    const flags = new Set(['--bootstrap', '--with-rls', '--only', '--dry-run']);
    for (let index = 0; index < args.length; index++) {
        if (!flags.has(args[index])) throw new Error(`Unknown migration option: ${args[index]}`);
        if (args[index] === '--only') index++;
    }
    const bootstrap = args.includes('--bootstrap');
    const plan = buildPlan({ bootstrap, withRls: args.includes('--with-rls') });
    const onlyIndex = args.indexOf('--only');
    const selected = onlyIndex < 0 ? plan : plan.filter(file => file.label === args[onlyIndex + 1]);
    if (!selected.length || (onlyIndex >= 0 && (!args[onlyIndex + 1] || bootstrap))) {
        throw new Error('Use --only with an exact migration label from --dry-run, without --bootstrap.');
    }
    if (args.includes('--dry-run')) {
        selected.forEach(file => console.log(file.label));
        return;
    }
    require('dotenv').config();
    if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL explicitly to select the migration target.');
    const client = new Client(require('./src/config/databaseOptions').databaseOptions());
    try {
        await client.connect();
        const results = await applyPlan(client, selected, { bootstrap });
        results.forEach(result => console.log(`${result.status}: ${result.name}`));
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    runMigrations().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { buildPlan, applyPlan, migrationBody, runMigrations };
