/**
 * ⚠️  DESTRUCTIVE — THIS IS NOT A MIGRATION RUNNER.
 *
 * It DROPs 12 tables (workout_logs, calorie_logs, nutrition_profiles,
 * body_measurements, …) and rebuilds the schema from supabase_setup.sql. On a
 * live database that is total, unrecoverable user-data loss.
 *
 * It is one letter away from `backend/apply_migrations.js` — the safe,
 * idempotent runner you almost certainly want:
 *
 *     node apply_migrations.js        ← additive, safe to re-run
 *     node scripts/apply_migration.js ← wipes and recreates
 *
 * So it now refuses to run unless you opt in explicitly, and refuses outright
 * against production:
 *
 *     node scripts/apply_migration.js --force-reset
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

if (!process.argv.includes('--force-reset')) {
    console.error(`
⛔ Refusing to run: this script DROPS ALL TABLES and recreates them.

   Every workout log, food log, profile and measurement in the target
   database would be permanently deleted.

   If you want to APPLY MIGRATIONS (the usual intent), run:
       node apply_migrations.js

   If you genuinely want to wipe and rebuild the schema, re-run with:
       node scripts/apply_migration.js --force-reset
`);
    process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
    console.error('⛔ Refusing to wipe the schema with NODE_ENV=production.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Last line of defence: name the target so a wrong DATABASE_URL is visible
// before anything is dropped.
const target = (process.env.DATABASE_URL || '').replace(/:[^:@/]*@/, ':****@');
console.warn(`\n⚠️  About to DROP AND RECREATE all tables on:\n   ${target || '(no DATABASE_URL set)'}\n`);

async function migrate() {
    try {
        const sqlPath = path.join(__dirname, '..', 'supabase_setup.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Cleaning up existing tables...');
        await client.query(`
      DROP TABLE IF EXISTS set_logs CASCADE;
      DROP TABLE IF EXISTS exercise_logs CASCADE;
      DROP TABLE IF EXISTS workout_sessions CASCADE;
      DROP TABLE IF EXISTS user_splits CASCADE;
      DROP TABLE IF EXISTS exercises CASCADE;
      DROP TABLE IF EXISTS workout_logs CASCADE;
      DROP TABLE IF EXISTS calorie_logs CASCADE;
      DROP TABLE IF EXISTS recipes CASCADE;
      DROP TABLE IF EXISTS nutrition_profiles CASCADE;
      DROP TABLE IF EXISTS fitness_profiles CASCADE;
      DROP TABLE IF EXISTS body_measurements CASCADE;
      DROP TABLE IF EXISTS published_splits CASCADE;
    `);

        console.log('Applying migration...');
        await client.query(sql);

        console.log('✅ Migration applied successfully!');
        client.release();
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
