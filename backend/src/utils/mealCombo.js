/**
 * Meal Combo Validation
 *
 * A combo is a set of foods logged in one action — the Indian thali case.
 * Validation is pure so it can be tested without a database, and strict so a
 * malformed client payload can't write junk rows.
 */

const MAX_COMBO_ITEMS = 15;
const MAX_ITEM_CALORIES = 10000;

function toNonNegativeInt(value) {
    const n = Math.round(Number(value) || 0);
    return n < 0 ? 0 : n;
}

/**
 * Validate and normalise a list of foods logged together as one meal.
 * @param {any} items - candidate list of foods, straight from the request body
 * @returns {{valid: boolean, error: string|null, items: object[]}}
 */
function validateComboItems(items) {
    if (!Array.isArray(items)) {
        return { valid: false, error: 'Expected a list of foods', items: [] };
    }
    if (items.length === 0) {
        return { valid: false, error: 'Add at least one food', items: [] };
    }
    if (items.length > MAX_COMBO_ITEMS) {
        return { valid: false, error: `That's more than ${MAX_COMBO_ITEMS} items`, items: [] };
    }

    const cleaned = [];
    for (const raw of items) {
        if (!raw || typeof raw !== 'object') {
            return { valid: false, error: 'One of the foods is malformed', items: [] };
        }
        const name = typeof raw.meal_name === 'string' ? raw.meal_name.trim() : '';
        if (!name) {
            return { valid: false, error: 'Every food needs a name', items: [] };
        }
        const calories = Number(raw.calories);
        if (!Number.isFinite(calories) || calories < 0 || calories > MAX_ITEM_CALORIES) {
            return { valid: false, error: `Calories for "${name}" look wrong`, items: [] };
        }
        cleaned.push({
            meal_name: name.slice(0, 100),
            calories: Math.round(calories),
            protein: toNonNegativeInt(raw.protein),
            carbs: toNonNegativeInt(raw.carbs),
            fat: toNonNegativeInt(raw.fat),
            cooking_medium: typeof raw.cooking_medium === 'string' ? raw.cooking_medium : null,
        });
    }

    return { valid: true, error: null, items: cleaned };
}

module.exports = { validateComboItems, MAX_COMBO_ITEMS, MAX_ITEM_CALORIES };
