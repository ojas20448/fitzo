/**
 * Calorie Entry Edit Validation
 *
 * Returns ONLY the fields the caller actually sent, so the route can build a
 * partial UPDATE. A PATCH that reset omitted columns would zero a member's
 * protein when they only meant to correct calories.
 *
 * Bounds are reused from mealCombo.js rather than redefined — one set of
 * limits for every write path into calorie_logs.
 */

const { MAX_ITEM_CALORIES, MAX_ITEM_MACRO_GRAMS } = require('./mealCombo');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MACRO_FIELDS = ['protein', 'carbs', 'fat'];
const FOOD_NAME_MAX = 100;
const SERVING_SIZE_MAX = 100;

function fail(error) {
    return { valid: false, error, fields: {} };
}

/**
 * @param {object} body
 * @returns {{valid: boolean, error: string|null, fields: object}}
 */
function validateEntryPatch(body) {
    if (!body || typeof body !== 'object') return fail('Nothing to update');

    const fields = {};

    if ('calories' in body) {
        // `Number(null) === 0`, which would silently accept a null as a real
        // zero — reject it explicitly so only an actual 0 counts as one.
        const n = body.calories === null ? NaN : Number(body.calories);
        if (!Number.isFinite(n) || n < 0 || n > MAX_ITEM_CALORIES) {
            return fail(`calories must be between 0 and ${MAX_ITEM_CALORIES}`);
        }
        fields.calories = Math.round(n);
    }

    for (const key of MACRO_FIELDS) {
        if (!(key in body)) continue;
        const raw = body[key];
        const n = raw === null ? NaN : Number(raw);
        if (!Number.isFinite(n) || n < 0 || n > MAX_ITEM_MACRO_GRAMS) {
            return fail(`${key} must be between 0 and ${MAX_ITEM_MACRO_GRAMS}`);
        }
        fields[key] = Math.round(n);
    }

    if ('food_name' in body) {
        const s = typeof body.food_name === 'string' ? body.food_name.trim() : '';
        if (!s) return fail('food_name cannot be empty');
        fields.food_name = s.slice(0, FOOD_NAME_MAX);
    }

    if ('serving_size' in body) {
        const s = typeof body.serving_size === 'string' ? body.serving_size.trim() : '';
        fields.serving_size = s.slice(0, SERVING_SIZE_MAX);
    }

    if ('meal_type' in body) {
        if (!MEAL_TYPES.includes(body.meal_type)) {
            return fail(`meal_type must be one of ${MEAL_TYPES.join(', ')}`);
        }
        fields.meal_type = body.meal_type;
    }

    if (Object.keys(fields).length === 0) return fail('Nothing to update');

    return { valid: true, error: null, fields };
}

module.exports = { validateEntryPatch, MEAL_TYPES, FOOD_NAME_MAX, SERVING_SIZE_MAX };
