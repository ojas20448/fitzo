const { PGlite } = require('@electric-sql/pglite');
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
let queryImpl; const query = (...args) => queryImpl(...args);
require.cache[require.resolve('../src/config/database')] = { exports: { query } };
const deleted = []; const cache = { getOrSet: (_key, build) => build(), del: async key => deleted.push(key), invalidatePattern: async key => deleted.push(key) };
require.cache[require.resolve('../src/services/cache')] = { exports: cache };

const { getContextPack, invalidateContextPack } = require('../src/services/contextPack');

function assertSubset(actual, expected) {
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, key);
}
let db;
before(async () => {
    db = new PGlite();
    await db.exec(`
        CREATE TYPE fitness_goal AS ENUM ('deficit', 'maintenance', 'surplus');
        CREATE TYPE nutrition_goal AS ENUM ('fat_loss', 'maintenance', 'muscle_gain');
        CREATE TYPE activity AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');
        CREATE TABLE users (id text PRIMARY KEY);
        CREATE TABLE fitness_profiles (user_id text, goal_type fitness_goal, current_weight numeric, target_weight numeric, height numeric, age integer, gender text, activity_level text, target_calories integer, ai_profile_summary text);
        CREATE TABLE nutrition_profiles (user_id text, goal_type nutrition_goal, weight_kg numeric, target_weight_kg numeric, height_cm numeric, age integer, gender text, activity_level activity, target_calories integer, target_protein integer, target_carbs integer, target_fat integer, is_vegetarian boolean);
    `);
});
after(async () => { await db.close(); });
beforeEach(async () => {
    await db.exec(`TRUNCATE users, fitness_profiles, nutrition_profiles; INSERT INTO users VALUES ('member');`);
    queryImpl = (sql, values) => sql.includes('LEFT JOIN nutrition_profiles') ? db.query(sql, values) : Promise.resolve({ rows: [] });
});
async function legacy() {
    await db.exec(`INSERT INTO fitness_profiles VALUES ('member', 'surplus', 80, 85, 180, 30, 'male', 'active', 3200, 'Prefers morning training');`);
}
async function nutrition() {
    await db.exec(`INSERT INTO nutrition_profiles VALUES ('member', 'fat_loss', 70, 65, 175, 25, 'male', 'light', 2200, 140, 245, 73, true);`);
}
test('uses edited nutrition targets ahead of conflicting fitness-profile values', async () => {
    await legacy(); await nutrition();
    const { profile } = await getContextPack('member');
    assertSubset(profile, { goal_type: 'fat_loss', target_calories: 2200, target_protein: 140, is_vegetarian: true, ai_profile_summary: 'Prefers morning training', activity_level: 'light' });
    assert.equal(Number(profile.current_weight), 70);
    await db.exec(`UPDATE nutrition_profiles SET target_calories = 2400 WHERE user_id = 'member'`);
    await invalidateContextPack('member');
    assert.ok(deleted.includes('user:member:context_pack'));
    assert.equal((await getContextPack('member')).profile.target_calories, 2400);
});
test('supports onboarding accounts with a nutrition profile and no fitness profile', async () => {
    await nutrition();
    const profile = (await getContextPack('member')).profile; assertSubset(profile, { target_calories: 2200, target_protein: 140, ai_profile_summary: null });
});
test('retains legacy fitness data when no nutrition profile exists', async () => {
    await legacy();
    const profile = (await getContextPack('member')).profile; assertSubset(profile, { goal_type: 'surplus', target_calories: 3200, target_protein: null });
});
test('does not invent a profile for a user with no saved measurements or targets', async () => {
    assert.equal((await getContextPack('member')).profile, null);
});
