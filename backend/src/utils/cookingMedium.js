/**
 * Cooking Medium Adjustment
 *
 * The single biggest accuracy gap for Indian food logging: a home dal and a
 * restaurant dal tadka share a name and a portion but not a calorie count.
 * The difference is almost entirely added fat (ghee, oil, cream, butter).
 *
 * Rather than storing 4x variants for 10,388 foods, we derive them at read
 * time: scale fat, recompute calories from the fat delta, hold protein and
 * carbs constant.
 *
 * NOTE: fatFactor values are informed estimates, not lab measurements. They
 * live here, in one table, precisely so they can be tuned against real data
 * later without touching any call site.
 */

const MEDIUMS = [
    { id: 'home_light', label: 'Home (light oil)', fatFactor: 1.0 },
    { id: 'home_ghee', label: 'Home (ghee)', fatFactor: 1.8 },
    { id: 'restaurant', label: 'Restaurant', fatFactor: 2.4 },
    { id: 'street', label: 'Street / dhaba', fatFactor: 2.8 },
];

const MEDIUM_BY_ID = new Map(MEDIUMS.map((m) => [m.id, m]));

/**
 * Categories where a cooking medium is a real variable.
 * Packaged goods, drinks, and chain fast food have fixed, label-printed
 * nutrition — offering a "ghee" option there would be noise, not accuracy.
 */
const APPLICABLE_CATEGORIES = new Set([
    'sabzi',
    'home cooking',
    'south indian',
    'street food',
    'non-veg',
    'regional',
    'breakfast',
    'curry',
    'dal',
    'lentils',
]);

const KCAL_PER_GRAM_FAT = 9;

function isMediumApplicable(category) {
    if (!category || typeof category !== 'string') return false;
    return APPLICABLE_CATEGORIES.has(category.trim().toLowerCase());
}

/**
 * Adjust a serving for a cooking medium.
 * Fat only. Calories follow from the fat delta. Input is never mutated.
 */
function applyCookingMedium(serving, mediumId) {
    const medium = MEDIUM_BY_ID.get(mediumId);
    if (!serving) return serving;
    if (!medium) return { ...serving };

    const baseFat = Number(serving.fat) || 0;
    const baseCalories = Number(serving.calories) || 0;

    const newFat = Math.round(baseFat * medium.fatFactor * 10) / 10;
    const newCalories = Math.round(baseCalories + KCAL_PER_GRAM_FAT * (newFat - baseFat));

    return {
        ...serving,
        fat: newFat,
        calories: newCalories,
    };
}

/**
 * Build the servings array for a food: base first, then one entry per medium.
 * The mobile picker (CalorieLogScreen) renders whatever is in this array and
 * pre-selects index 0 — so ordering here IS the default-selection mechanism.
 */
function buildServingVariants(serving, category) {
    if (!serving) return [];
    if (!isMediumApplicable(category)) return [{ ...serving }];

    return MEDIUMS.map((medium) => {
        const adjusted = applyCookingMedium(serving, medium.id);
        return {
            ...adjusted,
            id: medium.id,
            description: `${serving.description} · ${medium.label}`,
            measurementDescription: serving.measurementDescription,
            cookingMedium: medium.id,
        };
    });
}

module.exports = {
    MEDIUMS,
    APPLICABLE_CATEGORIES,
    isMediumApplicable,
    applyCookingMedium,
    buildServingVariants,
};
