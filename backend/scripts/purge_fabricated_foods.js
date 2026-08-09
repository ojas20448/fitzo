/**
 * Remove fabricated brand x dish rows from src/data/indian-foods.json.
 *
 * WHAT WAS FOUND
 * 51 generic dish names appear under 43 brands — 676 rows — as a full
 * cross-product. Coca-Cola, Pepsi and Sprite carry "Butter Panner Meal" and
 * "Farmhouse Veg Pizza". Lays and Kurkure carry "Frappuccino" and "Cola
 * (Regular)". Each row has invented macros stated to one decimal place, so a
 * user logging one gets a confident, wrong calorie number — worse than the
 * food simply being absent.
 *
 * WHY THIS IS A HAND-WRITTEN MAP AND NOT A HEURISTIC
 * The obvious signal — real rows are named "Brand - Product" with a hyphen,
 * generated ones "Brand Product" without — was tested first and REJECTED: the
 * no-hyphen set contains ~2,800 rows including "MuscleBlaze Raw Whey",
 * "Maggi No Onion No Garlic Noodles" and "Chettinad Chicken". Purging on that
 * rule would have destroyed thousands of legitimate foods to remove hundreds
 * of fake ones.
 *
 * So plausibility is declared explicitly below. A pair survives only if the
 * brand's domain can actually sell the dish. The map is the reviewable part of
 * this script — every deletion traces to one line of it.
 */

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'src', 'data', 'indian-foods.json');

// --- brand -> what that company actually sells ---------------------------
const DOMAIN = {
    SOFT_DRINK: ['Coca Cola', 'Coca-Cola', 'Pepsi', 'Sprite', 'Limca', 'Thums Up', 'Mountain Dew', 'Red Bull', 'Appy Fizz'],
    CHIPS_SNACK: ['Lays', 'Kurkure', 'Bikano', "Haldiram's", 'Bikanervala'],
    BAKERY: ['Britannia', 'Parle', 'Bonn', 'English Oven', 'Harvest Gold', 'Modern'],
    DAIRY: ['Amul', 'Mother Dairy', 'Nandini'],
    QSR: ["McDonald's", 'KFC', 'Burger King', 'Subway', 'Pizza Hut', 'Taco Bell', 'Barbeque Nation', 'Box8', 'Faasos'],
    CAFE: ['Starbucks', 'CCD', 'Chai Point', 'Dunkin', 'Nescafe'],
    SUPPLEMENT: ['MuscleBlaze', 'Yoga Bar'],
    PACKAGED: ['ITC', 'Nestle', 'Maggi', 'MTR'],
};

const brandDomain = new Map();
for (const [d, brands] of Object.entries(DOMAIN)) for (const b of brands) brandDomain.set(b, d);

// --- dish -> domains that could plausibly sell it ------------------------
// null  = nobody sells this under a brand name; delete every instance.
const DISH_OK = {
    // Not a real product name anywhere, and misspelled "Panner" in all 18.
    'Butter Panner Meal': null,
    'Paneer Butter Masala (Ready-to-Eat)': ['PACKAGED'],
    'Dal Makhani (Ready-to-Eat)': ['PACKAGED'],

    'Protein Bar': ['SUPPLEMENT', 'PACKAGED'],
    'Granola Bar': ['SUPPLEMENT', 'PACKAGED', 'BAKERY'],
    'Masala Oats': ['PACKAGED'],
    'Instant Noodles': ['PACKAGED'],
    'Cheese Noodles': ['PACKAGED'],

    'Cola (Regular)': ['SOFT_DRINK'],
    'Diet Soda': ['SOFT_DRINK'],
    'Fruit Juice (1 cup)': ['SOFT_DRINK', 'DAIRY', 'PACKAGED'],
    '(250ml)': ['SOFT_DRINK', 'DAIRY'],
    '250ml': ['SOFT_DRINK', 'DAIRY'],
    '(330ml can)': ['SOFT_DRINK'],

    'Frappuccino': ['CAFE'],
    'Cold Coffee': ['CAFE', 'DAIRY'],
    'Chocolate Shake': ['CAFE', 'QSR', 'DAIRY'],

    'Potato Chips': ['CHIPS_SNACK'],
    'Cream & Onion Chips': ['CHIPS_SNACK'],
    'Aloo Bhujia': ['CHIPS_SNACK'],
    'Moong Dal Snack': ['CHIPS_SNACK'],
    'Roasted Cashews': ['CHIPS_SNACK', 'PACKAGED'],
    'Roasted Almonds': ['CHIPS_SNACK', 'PACKAGED'],

    'Chocolate Chip Cookies (2 pcs)': ['BAKERY'],
    'Digestive Biscuits (2 pcs)': ['BAKERY'],
    'White Bread': ['BAKERY'],
    'Dark Chocolate Bar': ['BAKERY', 'PACKAGED', 'DAIRY'],
    'Milk Chocolate Bar': ['BAKERY', 'PACKAGED', 'DAIRY'],

    'Plain Yogurt (1 cup)': ['DAIRY'],
    'Greek Yogurt': ['DAIRY'],
    'Butter (1 tbsp)': ['DAIRY'],
    'Cheese Slices (2)': ['DAIRY'],
    'Peanut Butter (2 tbsp)': ['PACKAGED', 'DAIRY'],
    'Vanilla Ice Cream (1 Scoop)': ['DAIRY', 'QSR', 'CAFE'],
    'Chocolate Ice Cream (1 Scoop)': ['DAIRY', 'QSR', 'CAFE'],
    'Rasgulla (Canned)': ['DAIRY', 'CHIPS_SNACK', 'PACKAGED'],
    'Gulab Jamun (Canned)': ['DAIRY', 'CHIPS_SNACK', 'PACKAGED'],

    'Cheese Burger': ['QSR'],
    'Classic Burger': ['QSR'],
    'Veggie Burger': ['QSR'],
    'French Fries (Medium)': ['QSR'],
    'Peri Peri Fries': ['QSR'],
    'Chicken Nuggets (6 pcs)': ['QSR', 'PACKAGED'],
    'Crispy Chicken Wrap': ['QSR'],
    'Paneer Tikka Wrap': ['QSR'],
    'Farmhouse Veg Pizza': ['QSR'],
    'Margherita Pizza (Regular)': ['QSR'],
    'Pepperoni Pizza (Regular)': ['QSR'],
    'Tandoori Chicken Pizza': ['QSR'],
    'Chicken Biryani (Medium)': ['QSR'],
    'Veg Biryani': ['QSR', 'PACKAGED'],
};

function main() {
    const apply = process.argv.includes('--apply');
    const foods = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    const before = foods.length;

    const brands = [...new Set(foods.map(f => f.region))].filter(r => r && r.length > 2);

    const removed = [];
    const kept = [];
    const unmapped = new Set();

    for (const food of foods) {
        // Only rows of the form "<Brand> <Dish>" (no hyphen) are candidates.
        const brand = brands.find(b =>
            food.name.startsWith(b + ' ') && !/^\s*-\s/.test(food.name.slice(b.length))
        );
        if (!brand) { kept.push(food); continue; }

        const dish = food.name.slice(brand.length).trim();
        if (!(dish in DISH_OK)) { kept.push(food); continue; } // not part of the cross-product

        const allowed = DISH_OK[dish];
        const domain = brandDomain.get(brand);
        if (!domain) { unmapped.add(brand); kept.push(food); continue; }

        if (allowed === null || !allowed.includes(domain)) {
            removed.push({ name: food.name, brand, domain, dish, kcal: food.calories });
        } else {
            kept.push(food);
        }
    }

    console.log(`rows before      : ${before}`);
    console.log(`fabricated       : ${removed.length}`);
    console.log(`rows after       : ${kept.length}`);
    if (unmapped.size) console.log(`brands not in map (kept): ${[...unmapped].join(', ')}`);

    const byDish = {};
    removed.forEach(r => { (byDish[r.dish] ||= []).push(r.brand); });
    console.log('\nremoved, grouped by dish:');
    Object.entries(byDish).sort((a, b) => b[1].length - a[1].length).forEach(([d, bs]) =>
        console.log(`  ${String(bs.length).padStart(3)}  ${d.padEnd(36)} ${bs.slice(0, 6).join(', ')}${bs.length > 6 ? ' …' : ''}`));

    // Pre-existing defect, surfaced by the guard below rather than assumed:
    // three rows store macros as strings ("440" instead of 440). In JS that
    // silently concatenates during any daily total — "440" + 100 = "440100" —
    // so coerce them while we are rewriting the file anyway.
    let coerced = 0;
    for (const f of kept) {
        for (const k of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
            if (typeof f[k] === 'string' && f[k].trim() !== '' && !isNaN(Number(f[k]))) {
                f[k] = Number(f[k]);
                coerced++;
            }
        }
    }
    if (coerced) console.log(`coerced ${coerced} string macro value(s) to numbers`);

    // Integrity guards. The lesson from a previous data pass: check that the
    // SURVIVING data is still intact, not merely that rows were deleted.
    const problems = [];
    if (kept.length + removed.length !== before) problems.push('row accounting does not add up');
    const ids = new Set(kept.map(f => f.id));
    if (ids.size !== kept.length) problems.push('duplicate ids among survivors');
    for (const f of kept) {
        if (!f.name || typeof f.name !== 'string') { problems.push('a survivor lost its name'); break; }
        if (typeof f.calories !== 'number') { problems.push(`non-numeric calories survived: ${f.name}`); break; }
    }
    // Foods that must never be touched by this script.
    for (const must of ['Paneer (100g)', 'Maggi Noodles (60g)', 'Chicken Biryani']) {
        if (!kept.some(f => f.name === must)) problems.push(`SENTINEL LOST: ${must}`);
    }
    if (problems.length) {
        console.error('\nINTEGRITY FAILURES:\n  ' + problems.join('\n  '));
        process.exit(1);
    }
    console.log('\nintegrity: row accounting ok, ids unique, sentinels intact');

    if (apply) {
        fs.writeFileSync(DATA, JSON.stringify(kept, null, 2));
        fs.writeFileSync(path.join(__dirname, 'purged-foods.json'), JSON.stringify(removed, null, 2));
        console.log(`\nAPPLIED. Wrote ${kept.length} rows. Removal log: scripts/purged-foods.json`);
    } else {
        console.log('\nDry run — nothing written. Re-run with --apply.');
    }
}

main();
