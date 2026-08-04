/**
 * Weekly Nutrition Summary
 *
 * Answers "how was my week" rather than "what did each day look like" — the
 * per-day chart already exists in NutritionInsights (components/WeeklyCharts).
 *
 * Two rules worth stating outright:
 *
 * 1. Averages divide by DAYS LOGGED, not by 7. Logging three days at 2000 kcal
 *    is a 2000 kcal average, not 857. `daysLogged` is returned alongside, so a
 *    partially-logged week reads as incomplete rather than as starvation.
 *
 * 2. Calories are a BAND and protein is a FLOOR. Landing 40% over your calorie
 *    target is not hitting it; landing 6% over your protein target is. Treating
 *    both the same would be wrong nutrition.
 *
 * Every numeric goes through Number(): SUM() over an INTEGER column returns
 * bigint, which node-pg yields as a STRING, and "2333" + "200" is "2333200".
 */

/** A calorie day counts as on-target within +/- this fraction of the target. */
const CALORIE_BAND = 0.10;

const DEFAULT_TARGET_CALORIES = 2000;
const DEFAULT_TARGET_PROTEIN = 150;

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * @param {Array<{calories: number|string, protein: number|string}>} history
 * @param {{target_calories?: number|string, target_protein?: number|string}} targets
 * @returns {{daysLogged: number, avgCalories: number, avgProtein: number,
 *            calorieTargetDays: number, proteinTargetDays: number,
 *            targetCalories: number, targetProtein: number}}
 */
function summariseWeek(history, targets) {
    const targetCalories = num(targets && targets.target_calories) || DEFAULT_TARGET_CALORIES;
    const targetProtein = num(targets && targets.target_protein) || DEFAULT_TARGET_PROTEIN;

    const days = (Array.isArray(history) ? history : []).filter(
        (d) => d && typeof d === 'object',
    );

    if (days.length === 0) {
        return {
            daysLogged: 0,
            avgCalories: 0,
            avgProtein: 0,
            calorieTargetDays: 0,
            proteinTargetDays: 0,
            targetCalories,
            targetProtein,
        };
    }

    let totalCalories = 0;
    let totalProtein = 0;
    let calorieTargetDays = 0;
    let proteinTargetDays = 0;

    const lower = targetCalories * (1 - CALORIE_BAND);
    const upper = targetCalories * (1 + CALORIE_BAND);

    for (const d of days) {
        const calories = num(d.calories);
        const protein = num(d.protein);

        totalCalories += calories;
        totalProtein += protein;

        // Band, not ceiling: under-eating misses the target as surely as over.
        if (calories >= lower && calories <= upper) calorieTargetDays += 1;
        // Floor: at or above counts.
        if (protein >= targetProtein) proteinTargetDays += 1;
    }

    return {
        daysLogged: days.length,
        avgCalories: Math.round(totalCalories / days.length),
        avgProtein: Math.round(totalProtein / days.length),
        calorieTargetDays,
        proteinTargetDays,
        targetCalories,
        targetProtein,
    };
}

module.exports = {
    summariseWeek,
    CALORIE_BAND,
    DEFAULT_TARGET_CALORIES,
    DEFAULT_TARGET_PROTEIN,
};
