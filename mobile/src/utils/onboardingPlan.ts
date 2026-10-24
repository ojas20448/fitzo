import type { TrainingExperience, TrainingEquipment } from './starterWorkout';
export type Goal = 'fat_loss' | 'maintenance' | 'muscle_gain';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export interface OnboardingForm {
    goal: Goal | null;
    days: number | null;
    activity: Activity | null;
    experience: TrainingExperience | null;
    equipment: TrainingEquipment | null;
    sessionMinutes: 20 | 35 | 50 | null;
    height: string;
    weight: string;
    age: string;
    gender: 'male' | 'female' | null;
    vegetarian: boolean | null;
    customCalories: string;
    nutritionEnabled: boolean;
}
export const EMPTY_ONBOARDING: OnboardingForm = {
    goal: null, days: null, activity: null, experience: null, equipment: null, sessionMinutes: null, height: '', weight: '', age: '',
    gender: null, vegetarian: null, customCalories: '', nutritionEnabled: false,
};

export function validateBody(form: OnboardingForm): string | null {
    const h = Number(form.height), w = Number(form.weight), a = Number(form.age);
    if (!form.height.trim() || !Number.isFinite(h) || h < 100 || h > 250) return 'Enter a height between 100 and 250 cm.';
    if (!form.weight.trim() || !Number.isFinite(w) || w < 20 || w > 300) return 'Enter a weight between 20 and 300 kg.';
    if (!form.age.trim() || !Number.isInteger(a) || a < 14 || a > 100) return 'Enter your age as a whole number between 14 and 100.';
    if (!form.gender) return 'Choose the sex used for your calorie estimate.';
    if (form.vegetarian === null) return 'Choose your food preference.';
    return null;
}

/** A training schedule, not an invented exercise prescription. These labels are
 * supported by the existing workout intent and logging flow. */
export function startingSplit(days: number, equipment?: TrainingEquipment | null) {
    if (!Number.isInteger(days) || days < 1 || days > 6) throw new Error('Choose between 1 and 6 training days.');
    if (equipment === 'bodyweight' && days === 6) return { split_id: 'upper_lower', name: 'Bodyweight Upper / Lower · 6 days', days: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C'], days_per_week: days };
    switch (days) {
        case 1: return { split_id: 'full_body', name: 'Full Body · 1 day', days: ['Full Body A'], days_per_week: 1 };
        case 2: return { split_id: 'full_body', name: 'Full Body · 2 days', days: ['Full Body A', 'Full Body B'], days_per_week: 2 };
        case 3: return { split_id: 'full_body', name: 'Full Body · 3 days', days: ['Full Body A', 'Full Body B', 'Full Body C'], days_per_week: 3 };
        case 4: return { split_id: 'upper_lower', name: 'Upper / Lower · 4 days', days: ['Upper A', 'Lower A', 'Upper B', 'Lower B'], days_per_week: 4 };
        case 5: return { split_id: 'custom', name: 'Upper / Lower / Full Body · 5 days', days: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Full Body'], days_per_week: 5 };
        case 6: return { split_id: 'ppl', name: 'Push / Pull / Legs · 6 days', days: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'], days_per_week: 6 };
        default: throw new Error('Choose between 1 and 6 training days.');
    }
}

export function validateStep(step: number, form: OnboardingForm): string | null {
    if (step === 1 && !form.goal) return 'Choose what you would like to work on.';
    if (step === 2 && form.days === null) return 'Choose your training days.';
    if (step === 2 && !form.experience) return 'Choose your training experience.';
    if (step === 2 && !form.equipment) return 'Choose the equipment you can train with.';
    if (step === 2 && !form.sessionMinutes) return 'Choose how much time you have for a session.';
    if (step >= 3 && form.nutritionEnabled && !form.activity) return 'Choose your everyday activity for the calorie estimate.';
    if (step >= 3 && form.nutritionEnabled) return validateBody(form);
    return null;
}

export function restoreOnboarding(raw: string | null): { step: number; form: OnboardingForm } | null {
    if (!raw) return null;
    try {
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !saved.form || typeof saved.form !== 'object') return null;
        const source = saved.form;
        const form: OnboardingForm = { ...EMPTY_ONBOARDING };
        if (['fat_loss', 'maintenance', 'muscle_gain'].includes(source.goal)) form.goal = source.goal;
        if ([1, 2, 3, 4, 5, 6].includes(source.days)) form.days = source.days;
        if (['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(source.activity)) form.activity = source.activity;
        if (['new', 'returning', 'regular'].includes(source.experience)) form.experience = source.experience;
        if (['gym', 'dumbbells', 'bodyweight'].includes(source.equipment)) form.equipment = source.equipment;
        if ([20, 35, 50].includes(source.sessionMinutes)) form.sessionMinutes = source.sessionMinutes;
        if (['male', 'female'].includes(source.gender)) form.gender = source.gender;
        if (typeof source.vegetarian === 'boolean') form.vegetarian = source.vegetarian;
        for (const key of ['height', 'weight', 'age', 'customCalories'] as const) {
            if (typeof source[key] === 'string' && source[key].length <= 16) form[key] = source[key];
        }
        // Keep completed food answers in older drafts. New users take the
        // three-screen training path unless they explicitly add food targets.
        form.nutritionEnabled = typeof source.nutritionEnabled === 'boolean' ? source.nutritionEnabled : !validateBody(form);
        let step = Number.isInteger(saved.step) ? Math.min(4, Math.max(1, saved.step)) : 1;
        if (step === 3 && !form.nutritionEnabled) step = 4;
        // A corrupt draft must not jump past required answers.
        for (let previous = 1; previous < step; previous++) {
            if (validateStep(previous, form)) { step = previous; break; }
        }
        return { step, form };
    } catch { return null; }
}
