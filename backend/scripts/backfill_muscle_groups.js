/**
 * Backfill exercise_logs.muscle_group for custom exercises.
 *
 * The primary logging path never wrote this column, so every custom exercise
 * ever logged has muscle_group NULL. With no catalogue row to fall back on,
 * the volume query buckets those sets as 'other' and the heatmap drops them —
 * users saw "UNTRAINED" for muscles they had actually trained.
 *
 * The route now classifies on write, but that only helps new rows. This
 * reclassifies the history.
 *
 *   node scripts/backfill_muscle_groups.js --dry-run   # report only
 *   node scripts/backfill_muscle_groups.js             # apply
 *
 * Safe to re-run: it only touches rows where muscle_group IS NULL, so applying
 * it twice is a no-op. It never overwrites a value a user or the API already
 * set, and rows whose names cannot be classified are left NULL rather than
 * guessed — a wrong muscle group is worse than a missing one.
 */

require('dotenv').config();
const { query } = require('../src/config/database');
const { inferMuscleGroup } = require('../src/utils/muscleGroup');

const DRY = process.argv.includes('--dry-run');

(async () => {
    const rows = await query(`
        SELECT id, custom_exercise_name
          FROM exercise_logs
         WHERE exercise_id IS NULL
           AND muscle_group IS NULL
           AND custom_exercise_name IS NOT NULL
    `);

    console.log(`${rows.rows.length} unclassified custom exercise logs\n`);
    if (rows.rows.length === 0) { process.exit(0); }

    const byGroup = {};
    const unmatched = new Map();
    const updates = [];

    for (const r of rows.rows) {
        const g = inferMuscleGroup(r.custom_exercise_name);
        if (g) {
            byGroup[g] = (byGroup[g] || 0) + 1;
            updates.push([r.id, g]);
        } else {
            unmatched.set(r.custom_exercise_name, (unmatched.get(r.custom_exercise_name) || 0) + 1);
        }
    }

    console.log('Would classify:');
    Object.entries(byGroup).sort((a, b) => b[1] - a[1])
        .forEach(([g, n]) => console.log(`  ${g.padEnd(10)} ${n}`));

    if (unmatched.size) {
        // Printed rather than swallowed: these are the names the classifier
        // does not know, and they are exactly the keywords worth adding to
        // src/utils/muscleGroup.js on the next pass.
        console.log(`\nUnmatched (${unmatched.size} distinct) — left NULL, add keywords if these recur:`);
        [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
            .forEach(([n, c]) => console.log(`  ${String(c).padStart(4)}x  ${n}`));
    }

    if (DRY) {
        console.log('\n--dry-run: nothing written');
        process.exit(0);
    }

    let done = 0;
    for (const [id, g] of updates) {
        await query('UPDATE exercise_logs SET muscle_group = $1 WHERE id = $2', [g, id]);
        done++;
    }
    console.log(`\nUpdated ${done} rows`);
    process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
