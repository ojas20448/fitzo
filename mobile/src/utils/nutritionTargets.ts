// Instant preview of backend/src/utils/nutritionTargets.js. Parity-tested.
export const PROTEIN_PER_KG = 1.6;
export const ACTIVITY: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
};

export function calculateEnergy(
    weight: number,
    height: number,
    age: number,
    gender: string,
    activity = 'sedentary'
) {
    const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
    return {
        bmr: Math.round(bmr),
        tdee: Math.round(bmr * (ACTIVITY[activity] || ACTIVITY.sedentary)),
    };
}

export function calculateCalories(
    tdee: number,
    goal: string,
    gender: string,
    bmi: number
) {
    let adjustment = 0;
    // Lean surplus: ~10% of TDEE clamped to 180–280 kcal to fuel hypertrophy with minimal fat gain
    if (goal === 'muscle_gain') {
        adjustment = Math.min(280, Math.max(180, Math.round(tdee * 0.10)));
    }
    // Moderate deficit: ~18% of TDEE clamped to 300–500 kcal, disabled if already underweight
    if (goal === 'fat_loss' && !(bmi < 18.5)) {
        adjustment = -Math.min(500, Math.max(300, Math.round(tdee * 0.18)));
    }
    return Math.max(gender === 'male' ? 1500 : 1200, Math.round(tdee + adjustment));
}

export function calculateMacros(
    calories: number,
    weight: number,
    overrides: { protein?: number; carbs?: number; fat?: number } = {}
) {
    const hasProtein = overrides.protein != null && Number.isFinite(overrides.protein);
    const hasFat = overrides.fat != null && Number.isFinite(overrides.fat);
    const hasCarbs = overrides.carbs != null && Number.isFinite(overrides.carbs);

    // If all three macros are explicitly customized, accept them directly
    if (hasProtein && hasFat && hasCarbs) {
        const protein = Math.max(0, Math.round(overrides.protein!));
        const fat = Math.max(0, Math.round(overrides.fat!));
        const carbs = Math.max(0, Math.round(overrides.carbs!));
        return { protein, carbs, fat };
    }

    // Protein: athletic 30% of calories or minimum 1.6 g/kg of body weight (e.g. ~210g at 2800 kcal)
    const defaultProtein = Math.round(Math.max(weight * PROTEIN_PER_KG, (calories * 0.30) / 4));
    const protein = hasProtein
        ? Math.max(0, Math.round(overrides.protein!))
        : defaultProtein;

    // Fat: athletic 25% cap of calories for optimal body composition
    const fat = hasFat
        ? Math.max(0, Math.round(overrides.fat!))
        : Math.max(0, Math.round((calories * 0.25) / 9));

    let carbs: number;
    if (hasCarbs) {
        carbs = Math.max(0, Math.round(overrides.carbs!));
    } else {
        const remainingCal = calories - (protein * 4 + fat * 9);
        carbs = Math.max(0, Math.round(remainingCal / 4));
    }

    return { protein, carbs, fat };
}
