/**
 * One-shot: rewrite `category` on every record in indian-foods.json
 * through canonicalCategory(). Categories only — no macro values are touched.
 *
 * Usage:
 *   node scripts/normalize_food_categories.js --dry
 *   node scripts/normalize_food_categories.js
 */

const fs = require('fs');
const path = require('path');
const { canonicalCategory } = require('../src/utils/foodCategories');

const DATA_PATH = path.resolve(__dirname, '../src/data/indian-foods.json');
const dryRun = process.argv.includes('--dry');

const foods = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const before = {};
const after = {};
let changed = 0;

foods.forEach((f) => {
    const from = f.category;
    const to = canonicalCategory(from);
    before[from] = (before[from] || 0) + 1;
    after[to] = (after[to] || 0) + 1;
    if (from !== to) {
        changed++;
        if (!dryRun) f.category = to;
    }
});

console.log(`records:            ${foods.length}`);
console.log(`categories before:  ${Object.keys(before).length}`);
console.log(`categories after:   ${Object.keys(after).length}`);
console.log(`records changed:    ${changed}`);

if (dryRun) {
    console.log('\n--dry: nothing written');
} else {
    fs.writeFileSync(DATA_PATH, JSON.stringify(foods, null, 2));
    console.log('\n✅ written');
}
