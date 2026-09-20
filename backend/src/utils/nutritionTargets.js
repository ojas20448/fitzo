// Keep the mobile preview in sync; its tests compare both calculators.
// Defaults for fitness planning, grounded in sports nutrition literature.
const PROTEIN_PER_KG = { maintenance: 1.8, muscle_gain: 1.8, fat_loss: 2.0 };
const FORMULA_VERSION = 4;
const DEFAULT_FAT_SHARE = 0.30;
// Practical adult fitness defaults; rationale: docs/reviews/2026-09-20-nutrition-policy.md.
function proteinPerKgForGoal(goal = 'maintenance') {
    return Object.hasOwn(PROTEIN_PER_KG, goal) ? PROTEIN_PER_KG[goal] : PROTEIN_PER_KG.maintenance;
}
const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };

function calculateEnergy(weight, height, age, gender, activity = 'sedentary') {
    const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
    return { bmr: Math.round(bmr), tdee: Math.round(bmr * (ACTIVITY[activity] || ACTIVITY.sedentary)) };
}

function calculateCalories(tdee, goal, gender, bmi) {
    let adjustment = 0;
    // Lean surplus: ~10% of TDEE clamped to 180–280 kcal to fuel hypertrophy with minimal fat gain
    if (goal === 'muscle_gain') {
        adjustment = Math.min(280, Math.max(180, Math.round(tdee * 0.10)));
    }
    // Moderate deficit: ~18% of TDEE clamped to 300–500 kcal, disabled if already underweight
    if (goal === 'fat_loss' && !(bmi < 18.5)) {
        adjustment = -Math.min(500, Math.max(300, Math.round(tdee * 0.18)));
    }
    // Existing product floors; these do not establish individual calorie adequacy.
    return Math.max(gender === 'male' ? 1500 : 1200, Math.round(tdee + adjustment));
}

function calculateMacros(calories, weight, overrides = {}, goal = 'maintenance') {
    for (const [macro, value] of Object.entries(overrides)) {
        if (value == null) continue;
        if (value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
            throw new Error(`${macro} must be a non-negative number.`);
        }
    }
    const hasProtein = overrides.protein != null && Number.isFinite(Number(overrides.protein));
    const hasFat = overrides.fat != null && Number.isFinite(Number(overrides.fat));
    const hasCarbs = overrides.carbs != null && Number.isFinite(Number(overrides.carbs));

    // If all three macros are explicitly customized, accept them directly
    if (hasProtein && hasFat && hasCarbs) {
        const protein = Math.max(0, Math.round(Number(overrides.protein)));
        const fat = Math.max(0, Math.round(Number(overrides.fat)));
        const carbs = Math.max(0, Math.round(Number(overrides.carbs)));
        return { protein, carbs, fat };
    }

    // Weight-based default; personal targets are explicit overrides.
    const defaultProtein = Math.round(weight * proteinPerKgForGoal(goal));
    const protein = hasProtein
        ? Math.max(0, Math.round(Number(overrides.protein)))
        : defaultProtein;

    // Balanced default, rounded to whole grams; custom targets remain explicit.
    const fat = hasFat
        ? Math.max(0, Math.round(Number(overrides.fat)))
        : Math.max(0, Math.round((calories * DEFAULT_FAT_SHARE) / 9));

    let carbs;
    if (hasCarbs) {
        carbs = Math.max(0, Math.round(Number(overrides.carbs)));
    } else {
        const remainingCal = calories - (protein * 4 + fat * 9);
        if (remainingCal < 0) throw new Error('Protein and fat exceed your calorie target.');
        carbs = Math.round(remainingCal / 4);
    }

    return { protein, carbs, fat };
}

function validateProfile(p) {
    for (const [key, min, max] of [['weight_kg', 20, 300], ['height_cm', 100, 250], ['age', 14, 100]]) {
        if (p[key] == null || !Number.isFinite(Number(p[key])) || Number(p[key]) < min || Number(p[key]) > max) {
            throw new Error(`${key} must be between ${min} and ${max}.`);
        }
    }
    if (!Number.isInteger(Number(p.age))) throw new Error('Age must be a whole number.');
    if (!['male', 'female'].includes(p.gender)) throw new Error('Choose a sex for the calorie estimate.');
    if (p.activity_level != null && !Object.hasOwn(ACTIVITY, p.activity_level)) throw new Error('Choose a valid activity level.');
    if (p.goal_type != null && !['fat_loss', 'muscle_gain', 'maintenance'].includes(p.goal_type)) throw new Error('Choose a valid goal.');
}

// Older clients sent their generated targets exactly like manual overrides.
// Recognize those fingerprints, but preserve numbers that do not match them.
function legacyModes(p) {
    const calories = Number(p.target_calories);
    const gainOrLoss = ['muscle_gain', 'fat_loss'].includes(p.goal_type);
    const pct = gainOrLoss ? 0.30 : 0.20;
    const fatPct = gainOrLoss ? 0.25 : 0.30;
    const macroMatch = [0, ...(p.is_vegetarian ? [0.03] : [])].some(reduction => {
        const expected = [Math.round(calories * (pct - reduction) / 4), Math.round(calories * (1 - pct - fatPct + reduction) / 4), Math.round(calories * fatPct / 9)];
        return ['target_protein', 'target_carbs', 'target_fat'].every((key, i) => p[key] != null && Number(p[key]) === expected[i]);
    });
    const bmr = 10 * Number(p.weight_kg) + 6.25 * Number(p.height_cm) - 5 * Number(p.age) + (p.gender === 'male' ? 5 : -161);
    const oldCalories = Math.round(bmr * (ACTIVITY[p.activity_level] || 1.55) + (p.goal_type === 'muscle_gain' ? 300 : p.goal_type === 'fat_loss' ? -500 : 0));
    return {
        calorie_target_mode: !p.target_calories || (macroMatch && calories === oldCalories) ? 'automatic' : 'custom',
        macro_target_mode: ['target_protein', 'target_carbs', 'target_fat'].every(k => p[k] == null) || macroMatch ? 'automatic' : 'custom',
    };
}

function resolveTargets(p) {
    validateProfile(p);
    const legacy = legacyModes(p);
    const calorieMode = p.calorie_target_mode ?? legacy.calorie_target_mode;
    const macroMode = p.macro_target_mode ?? legacy.macro_target_mode;
    if (![calorieMode, macroMode].every(m => ['automatic', 'custom'].includes(m))) throw new Error('Invalid target mode.');
    const energy = calculateEnergy(Number(p.weight_kg), Number(p.height_cm), Number(p.age), p.gender, p.activity_level);
    const bmi = Number(p.weight_kg) / (Number(p.height_cm) / 100) ** 2;
    let calories = calorieMode === 'automatic'
        ? calculateCalories(energy.tdee, p.goal_type, p.gender, bmi) : Number(p.target_calories);
    if (!Number.isFinite(calories) || calories < 800 || calories > 8000) throw new Error('Calorie target must be between 800 and 8000 kcal.');
    
    const overrides = {};
    if (macroMode === 'custom') {
        for (const macro of ['protein', 'carbs', 'fat']) {
            if (p[`target_${macro}`] != null && p[`target_${macro}`] !== '') {
                overrides[macro] = Number(p[`target_${macro}`]);
            }
        }
    }
    
    const macros = calculateMacros(Math.round(calories), Number(p.weight_kg), overrides, p.goal_type);

    if (macroMode === 'custom' && overrides.protein != null && overrides.carbs != null && overrides.fat != null) {
        if (calorieMode === 'automatic' || !p.target_calories) {
            calories = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
        }
    }

    // Validate after all overrides: macro-derived calories must not bypass limits.
    const minimumCalories = calorieMode === 'automatic' ? (p.gender === 'male' ? 1500 : 1200) : 800;
    if (!Number.isFinite(calories) || calories < minimumCalories || calories > 8000) {
        throw new Error(`Final calorie target must be between ${minimumCalories} and 8000 kcal.`);
    }
    const macroCalories = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
    if (Math.abs(macroCalories - calories) > 10) {
        throw new Error('Your macros must add up to your calorie target. Adjust carbs or calories.');
    }

    return {
        target_calories: Math.round(calories),
        target_protein: macros.protein,
        target_carbs: macros.carbs,
        target_fat: macros.fat,
        calorie_target_mode: calorieMode,
        macro_target_mode: macroMode,
        target_formula_version: FORMULA_VERSION
    };
}

module.exports = { PROTEIN_PER_KG, DEFAULT_FAT_SHARE, proteinPerKgForGoal, FORMULA_VERSION, ACTIVITY, calculateEnergy, calculateCalories, calculateMacros, validateProfile, legacyModes, resolveTargets };
