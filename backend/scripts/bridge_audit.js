/**
 * Bridge Audit — producer/consumer matrix for every table.
 *
 * Finds "unwired bridges": tables some code WRITES but nothing READS
 * (data collected for nothing), and tables code READS but nothing WRITES
 * (features that always show empty) — the class of bug that made the AI
 * coach blind to workouts.
 *
 * Usage: node scripts/bridge_audit.js
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');

function walk(dir, files = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, files);
        else if (e.name.endsWith('.js')) files.push(full);
    }
    return files;
}

// App tables (exclude Supabase-internal)
const TABLES = [
    'users', 'gyms', 'attendances', 'friendships', 'workout_intents',
    'workout_plans', 'calorie_plans', 'class_sessions', 'class_bookings',
    'learn_lessons', 'learn_attempts', 'workout_logs', 'calorie_logs',
    'workout_sessions', 'exercise_logs', 'set_logs', 'exercises',
    'workout_splits', 'published_splits', 'body_measurements',
    'fitness_profiles', 'nutrition_profiles', 'readiness_logs',
    'health_data', 'recipes', 'recipe_ingredients', 'posts', 'post_likes',
    'comments', 'password_reset_tokens', 'coach_messages', 'daily_insights',
    'weekly_recaps', 'kudos', 'xp_logs', 'user_splits',
];

const writers = {}; const readers = {};
for (const t of TABLES) { writers[t] = new Set(); readers[t] = new Set(); }

for (const file of walk(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(SRC, file).replace(/\\/g, '/');
    for (const t of TABLES) {
        const writeRe = new RegExp(`(INSERT INTO|UPDATE|DELETE FROM)\\s+${t}\\b`, 'i');
        const readRe = new RegExp(`(FROM|JOIN)\\s+${t}\\b`, 'i');
        if (writeRe.test(src)) writers[t].add(rel);
        if (readRe.test(src)) readers[t].add(rel);
    }
}

console.log('===== TABLES WRITTEN BUT NEVER READ (data collected for nothing) =====');
let found = 0;
for (const t of TABLES) {
    if (writers[t].size > 0 && readers[t].size === 0) {
        found++;
        console.log(`  ⚠️  ${t}  ← written by: ${[...writers[t]].join(', ')}`);
    }
}
if (!found) console.log('  none');

console.log('\n===== TABLES READ BUT NEVER WRITTEN (features that always show empty) =====');
found = 0;
for (const t of TABLES) {
    if (readers[t].size > 0 && writers[t].size === 0) {
        found++;
        console.log(`  ⚠️  ${t}  ← read by: ${[...readers[t]].join(', ')}`);
    }
}
if (!found) console.log('  none');

console.log('\n===== NEITHER READ NOR WRITTEN (dead tables) =====');
found = 0;
for (const t of TABLES) {
    if (readers[t].size === 0 && writers[t].size === 0) {
        found++;
        console.log(`  💀 ${t}`);
    }
}
if (!found) console.log('  none');

console.log('\n===== FULL MATRIX (writers → readers count) =====');
for (const t of TABLES) {
    if (writers[t].size || readers[t].size) {
        console.log(`  ${t}: ${writers[t].size}W / ${readers[t].size}R`);
    }
}
