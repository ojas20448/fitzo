/**
 * Food Category Canonicalisation
 *
 * indian-foods.json grew in batches, leaving singular/plural splits that
 * fragment both search scoring and category browsing:
 *   Snacks (353) + Snack (284), Beverages (324) + Beverage (255)
 *   ...and ~20 more pairs (Biscuit/Biscuits, Fruit/Fruits, Sandwich/
 *   Sandwiches, Cooking Oil/Cooking Oils, etc.) covering ~1,000 records.
 */

const CATEGORY_ALIASES = new Map([
    ['snack', 'Snacks'],
    ['snacks', 'Snacks'],
    ['beverage', 'Beverages'],
    ['beverages', 'Beverages'],
    ['sweet', 'Sweets'],
    ['sweets', 'Sweets'],
    ['bread', 'Breads'],
    ['breads', 'Breads'],
    ['dessert', 'Desserts'],
    ['desserts', 'Desserts'],
    ['biscuit', 'Biscuits'],
    ['biscuits', 'Biscuits'],
    ['fruit', 'Fruits'],
    ['fruits', 'Fruits'],
    ['vegetable', 'Vegetables'],
    ['vegetables', 'Vegetables'],
    ['chocolate', 'Chocolates'],
    ['chocolates', 'Chocolates'],
    ['condiment', 'Condiments'],
    ['condiments', 'Condiments'],
    ['cereal', 'Cereals'],
    ['cereals', 'Cereals'],
    ['spread', 'Spreads'],
    ['spreads', 'Spreads'],
    ['supplement', 'Supplements'],
    ['supplements', 'Supplements'],
    ['egg', 'Eggs'],
    ['eggs', 'Eggs'],
    ['pickle', 'Pickles'],
    ['pickles', 'Pickles'],
    ['juice', 'Juices'],
    ['juices', 'Juices'],
    ['spice', 'Spices'],
    ['spices', 'Spices'],
    ['millet', 'Millets'],
    ['millets', 'Millets'],
    ['wrap', 'Wraps'],
    ['wraps', 'Wraps'],
    ['roll', 'Rolls'],
    ['rolls', 'Rolls'],
    ['sandwich', 'Sandwiches'],
    ['sandwiches', 'Sandwiches'],
    ['health food', 'Health Foods'],
    ['health foods', 'Health Foods'],
    ['packaged snack', 'Packaged Snacks'],
    ['packaged snacks', 'Packaged Snacks'],
    ['fitness meal', 'Fitness Meals'],
    ['fitness meals', 'Fitness Meals'],
    ['cooking oil', 'Cooking Oils'],
    ['cooking oils', 'Cooking Oils'],
]);

/**
 * Title-case a string: first letter of each whitespace-separated word
 * uppercased, remainder left as-is.
 *
 * If the input already carries any uppercase letter, it is an intentional
 * form (acronym, compound, proper noun — e.g. "QSR Indian Chains",
 * "Non-Veg", "Indo-Chinese") and is returned untouched. Only wholly
 * lowercase input gets lifted.
 * @param {string} s
 * @returns {string}
 */
function titleCase(s) {
    if (/[A-Z]/.test(s)) return s;
    return s
        .split(/\s+/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');
}

/**
 * Normalise a raw category string to its canonical form.
 * Known singular/plural aliases collapse to one plural form; unknown
 * categories are title-cased rather than dropped; empty/junk input
 * becomes 'Uncategorised'.
 * @param {string} raw
 * @returns {string}
 */
function canonicalCategory(raw) {
    if (!raw || typeof raw !== 'string') return 'Uncategorised';
    const key = raw.trim().toLowerCase();
    if (!key) return 'Uncategorised';
    if (CATEGORY_ALIASES.has(key)) return CATEGORY_ALIASES.get(key);
    return titleCase(raw.trim());
}

module.exports = { canonicalCategory, CATEGORY_ALIASES };
