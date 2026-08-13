require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Order matters: migrate_calorie_logs_source adds an FK to user_foods, so
// the table must exist first.
const LEGACY_MIGRATIONS = [
    'migrate_nutrition_profile.sql',
    'migrate_recipes.sql',
    'migrate_published_splits.sql',
    'migrate_user_foods.sql',
    'migrate_calorie_logs_source.sql'
];

/**
 * Everything in data/migrations/ is numbered (005_… through 013_…) and gets run
 * in filename order after the legacy set.
 *
 * These used to be applied by hand, one bespoke run_*_migration.js at a time,
 * which meant a fresh database could not be rebuilt from the repo and a new
 * migration silently never ran anywhere. They are all written with
 * IF NOT EXISTS and contain no DROP/TRUNCATE/DELETE, so re-running them is a
 * no-op — safe to sweep on every invocation.
 */
function numberedMigrations() {
    const dir = path.join(__dirname, 'data', 'migrations');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => /^\d+.*\.sql$/i.test(f))
        .sort() // zero-padded prefixes make lexical order the intended order
        .map(f => ({ label: `data/migrations/${f}`, path: path.join(dir, f) }));
}

const MIGRATIONS = [
    ...LEGACY_MIGRATIONS.map(f => ({
        label: f,
        path: path.join(__dirname, 'src', 'db', f),
    })),
    ...numberedMigrations(),
];

async function runMigrations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('🔌 Connected to database...');

        let applied = 0, skipped = 0, failed = 0;

        for (const { label: file, path: filePath } of MIGRATIONS) {
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️  Warning: ${file} not found at ${filePath}`);
                continue;
            }

            console.log(`\n📜 Running migration: ${file}...`);
            const sql = fs.readFileSync(filePath, 'utf8');
            try {
                await client.query(sql);
                console.log(`✅ ${file} applied successfully!`);
                applied++;
            } catch (err) {
                // Older migrations use bare CREATE TABLE, so re-running them on a
                // live database throws "already exists". That is the expected
                // state, not a failure — and it must not stop later migrations
                // from running (this is why user_foods never got created).
                if (err.code === '42P07' || err.code === '42710' || /already exists/i.test(err.message)) {
                    console.log(`⏭️  ${file} — already applied, skipping`);
                    skipped++;
                } else {
                    console.error(`❌ ${file} FAILED: ${err.message}`);
                    failed++;
                }
            }
        }

        console.log(`\n✨ Migrations finished — ${applied} applied, ${skipped} already present, ${failed} failed.`);
        if (failed > 0) process.exitCode = 1;

    } catch (err) {
        console.error('\n❌ Could not run migrations:', err.message);
        process.exitCode = 1;
    } finally {
        await client.end();
        // exit code set above
    }
}

runMigrations();
