/**
 * Per-user cooking-medium preferences.
 *
 * If someone always logs their dal as "Home (ghee)", asking every time is a
 * tax. This records the choice and lets the food detail endpoint pre-select it.
 *
 * Keyed on a normalised food NAME: calorie_logs has no food_id column, and
 * the same dish arrives from several upstream sources with different ids.
 */

const { query } = require('../config/database');

const MAX_KEY_LENGTH = 120;

function normaliseFoodKey(name) {
    if (!name || typeof name !== 'string') return '';
    return name
        .replace(/\([^)]*\)/g, ' ')   // drop "(Chapati)", "(Toor/Arhar)"
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .slice(0, MAX_KEY_LENGTH);
}

/**
 * Record a choice. Upsert — repeated picks strengthen the preference.
 * Never throws: a preference failing to save must not fail a food log.
 */
async function recordMediumChoice(userId, foodName, mediumId) {
    const key = normaliseFoodKey(foodName);
    if (!key || !mediumId) return;

    try {
        await query(
            `INSERT INTO user_food_prefs (user_id, food_key, medium_id, choice_count, updated_at)
             VALUES ($1, $2, $3, 1, NOW())
             ON CONFLICT (user_id, food_key) DO UPDATE
               SET medium_id    = EXCLUDED.medium_id,
                   choice_count = user_food_prefs.choice_count + 1,
                   updated_at   = NOW()`,
            [userId, key, mediumId]
        );
    } catch (err) {
        console.error('recordMediumChoice failed:', err.message);
    }
}

/**
 * @returns {Promise<string|null>} preferred medium id, or null if none
 */
async function getPreferredMedium(userId, foodName) {
    const key = normaliseFoodKey(foodName);
    if (!key) return null;

    try {
        const result = await query(
            `SELECT medium_id FROM user_food_prefs
              WHERE user_id = $1 AND food_key = $2
              LIMIT 1`,
            [userId, key]
        );
        return result.rows.length ? result.rows[0].medium_id : null;
    } catch (err) {
        console.error('getPreferredMedium failed:', err.message);
        return null;
    }
}

module.exports = {
    normaliseFoodKey,
    recordMediumChoice,
    getPreferredMedium,
    MAX_KEY_LENGTH,
};
