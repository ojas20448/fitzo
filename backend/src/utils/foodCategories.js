/**
 * Food Category Canonicalisation
 *
 * indian-foods.json grew in batches, leaving singular/plural splits that
 * fragment both search scoring and category browsing:
 *   Snacks (353) + Snack (284), Beverages (324) + Beverage (255)
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
]);

/**
 * Title-case a string: first letter of each whitespace-separated word
 * uppercased, remainder lowercased.
 * @param {string} s
 * @returns {string}
 */
function titleCase(s) {
    return s
        .split(/\s+/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
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
