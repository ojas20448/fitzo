/**
 * Seed the exercises table from the mobile app's catalog.
 *
 * The live DB had only 38 exercises while mobile ships 142 with muscle
 * targets — so most Smart Log exercises never matched the catalog, weakening
 * heatmap attribution, PR detection, and coach context. This upserts the
 * full catalog (insert-only: existing rows are never modified).
 *
 * Usage: node scripts/seed_exercises_from_catalog.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const CATALOG = path.resolve(__dirname, '..', '..', 'mobile', 'src', 'data', 'defaultExercises.ts');

// target → DB muscle_groups vocabulary (matches existing rows + StatsScreen buckets)
const TARGET_MAP = {
    pectorals: 'chest',
    delts: 'shoulders',
    'rear delts': 'rear_delts',
    traps: 'traps',
    lats: 'lats',
    'upper back': 'back',
    'lower back': 'back',
    biceps: 'biceps',
    triceps: 'triceps',
    forearms: 'forearms',
    abs: 'core',
    obliques: 'core',
    quads: 'quads',
    hamstrings: 'hamstrings',
    glutes: 'glutes',
    calves: 'calves',
    adductors: 'quads',
    abductors: 'glutes',
    legs: 'quads',
    'full body': 'full_body',
    cardiovascular: 'cardio',
};

// bodyPart → category (the 6 heatmap groups; cardio/full body → other)
const CATEGORY_MAP = {
    chest: 'chest',
    back: 'back',
    shoulders: 'shoulders',
    'upper arms': 'arms',
    'lower arms': 'arms',
    arms: 'arms',
    'upper legs': 'legs',
    'lower legs': 'legs',
    legs: 'legs',
    waist: 'core',
    core: 'core',
    cardio: 'other',
    'full body': 'other',
};

const COMPOUND_HINTS = /press|squat|deadlift|row|pull-?up|chin-?up|dip|lunge|clean|snatch|thrust|pulldown/i;

async function main() {
    const src = fs.readFileSync(CATALOG, 'utf8');
    const re = /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*bodyPart:\s*'([^']+)',\s*target:\s*'([^']+)',\s*equipment:\s*'([^']+)'/g;

    const rows = [];
    let m;
    while ((m = re.exec(src)) !== null) {
        const [, , name, bodyPart, target, equipment] = m;
        const primary = TARGET_MAP[target.toLowerCase()] || target.toLowerCase().replace(/\s+/g, '_');
        const category = CATEGORY_MAP[bodyPart.toLowerCase()] || 'other';
        rows.push({
            name,
            category,
            equipment,
            muscles: [primary],
            compound: COMPOUND_HINTS.test(name),
        });
    }
    console.log(`Parsed ${rows.length} exercises from mobile catalog`);

    const before = await pool.query('SELECT COUNT(*)::int c FROM exercises');
    let inserted = 0, skipped = 0;

    for (const r of rows) {
        const exists = await pool.query('SELECT 1 FROM exercises WHERE LOWER(name) = LOWER($1)', [r.name]);
        if (exists.rows.length > 0) { skipped++; continue; }
        await pool.query(
            `INSERT INTO exercises (name, category, equipment, muscle_groups, is_compound)
             VALUES ($1, $2, $3, $4, $5)`,
            [r.name, r.category, r.equipment, r.muscles, r.compound]
        );
        inserted++;
    }

    const after = await pool.query('SELECT COUNT(*)::int c FROM exercises');
    console.log(`Inserted ${inserted}, skipped ${skipped} (already present)`);
    console.log(`exercises table: ${before.rows[0].c} → ${after.rows[0].c} rows`);
    await pool.end();
}

main().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
