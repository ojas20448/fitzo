import { defaultExercises } from '../data/defaultExercises';
import type { UserExercise } from '../components/workout/types';

export type TrainingExperience = 'new' | 'returning' | 'regular';
export type TrainingEquipment = 'gym' | 'dumbbells' | 'bodyweight';
export const SESSION_MINUTES = [20, 35, 50, 90] as const;
export interface TrainingPreferences {
    experience: TrainingExperience;
    equipment: TrainingEquipment;
    session_minutes: typeof SESSION_MINUTES[number];
}
export interface SavedTrainingPreferences extends TrainingPreferences {
    goal_type: 'fat_loss' | 'maintenance' | 'muscle_gain';
}
export interface StarterSession {
    day_name: string;
    exercises: { id: string; set_count: number; reps: number }[];
}
export interface StarterWorkoutPlan {
    version: 1;
    preferences: TrainingPreferences;
    sessions: StarterSession[];
}
export const EXPERIENCE_CHOICES = [
    { id: 'new', title: 'Just starting', detail: 'New to strength training.' },
    { id: 'returning', title: 'Getting back into it', detail: 'Trained before, returning after a break.' },
    { id: 'regular', title: 'Training regularly', detail: 'Comfortable with the main movements.' },
] as const;
export const EQUIPMENT_CHOICES = [
    { id: 'gym', title: 'Gym equipment', detail: 'Machines, cables and dumbbells.' },
    { id: 'dumbbells', title: 'Dumbbells at home', detail: 'A pair of dumbbells. No bench needed.' },
    { id: 'bodyweight', title: 'No equipment', detail: 'Floor exercises using your body weight.' },
] as const;

// These are editable starting templates, not performance predictions. The time
// choice limits exercise count; it is not a promise about actual duration.
const GYM = {
    full: ['leg_press', 'chest_press_machine', 'lat_pulldown', 'romanian_deadlift_dumbbell', 'crunches'],
    fullB: ['romanian_deadlift_dumbbell', 'machine_row', 'chest_press_machine', 'leg_press', 'lateral_raise_dumbbell'],
    upper: ['chest_press_machine', 'lat_pulldown', 'shoulder_press_dumbbell', 'machine_row', 'bicep_curl_dumbbell'],
    lower: ['leg_press', 'romanian_deadlift_dumbbell', 'leg_curl_seated', 'calf_raise_standing', 'crunches'],
    push: ['chest_press_machine', 'shoulder_press_dumbbell', 'tricep_pushdown_rope', 'lateral_raise_dumbbell', 'pec_deck'],
    pull: ['lat_pulldown', 'machine_row', 'bicep_curl_dumbbell', 'face_pull', 'hammer_curl'],
};
const DUMBBELLS = {
    full: ['goblet_squat', 'push_up', 'dumbbell_row_single', 'romanian_deadlift_dumbbell', 'crunches'],
    fullB: ['romanian_deadlift_dumbbell', 'dumbbell_row_single', 'shoulder_press_dumbbell', 'goblet_squat', 'crunches'],
    upper: ['push_up', 'dumbbell_row_single', 'shoulder_press_dumbbell', 'bicep_curl_dumbbell', 'lateral_raise_dumbbell'],
    lower: ['goblet_squat', 'romanian_deadlift_dumbbell', 'glute_bridge', 'bodyweight_reverse_lunge', 'crunches'],
    push: ['push_up', 'shoulder_press_dumbbell', 'lateral_raise_dumbbell', 'overhead_tricep_extension_dumbbell'],
    pull: ['dumbbell_row_single', 'bicep_curl_dumbbell', 'hammer_curl', 'prone_arm_raise'],
};
const BODYWEIGHT = ['bodyweight_squat', 'knee_push_up', 'prone_arm_raise', 'glute_bridge', 'crunches'];
const BODYWEIGHT_UPPER = ['knee_push_up', 'prone_arm_raise', 'crunches'];
const BODYWEIGHT_LOWER = ['bodyweight_squat', 'glute_bridge', 'bodyweight_reverse_lunge', 'crunches'];

export function buildStarterPlan(days: string[], preferences: TrainingPreferences, age?: number): StarterWorkoutPlan {
    const count = preferences.session_minutes === 20 ? 3 : preferences.session_minutes === 35 ? 4 : 5;
    const sets = preferences.experience === 'regular' && preferences.session_minutes !== 20 && age !== undefined && age >= 18 ? 3 : 2;
    return {
        version: 1, preferences,
        sessions: days.map(day => {
            const label = day.toLowerCase();
            const kind = label.includes('upper') ? 'upper' : /lower|legs/.test(label) ? 'lower'
                : label.includes('push') ? 'push' : label.includes('pull') ? 'pull'
                    : label.endsWith('b') ? 'fullB' : 'full';
            const ids = preferences.equipment === 'bodyweight' ? (kind === 'upper' ? BODYWEIGHT_UPPER : kind === 'lower' ? BODYWEIGHT_LOWER : BODYWEIGHT)
                : (preferences.equipment === 'gym' ? GYM : DUMBBELLS)[kind];
            return { day_name: day, exercises: ids.slice(0, count).map(id => ({ id, set_count: sets, reps: 10 })) };
        }),
    };
}

/** Reject unknown/corrupt plans instead of turning arbitrary server JSON into
 * performed sets or silently loading a different day. */
export function readStarterPlan(value: unknown): StarterWorkoutPlan | null {
    if (!value || typeof value !== 'object') return null;
    const plan = value as StarterWorkoutPlan;
    const p = plan.preferences;
    if (plan.version !== 1 || !p || !['new', 'returning', 'regular'].includes(p.experience)
        || !['gym', 'dumbbells', 'bodyweight'].includes(p.equipment) || !SESSION_MINUTES.includes(p.session_minutes)
        || !Array.isArray(plan.sessions) || plan.sessions.length < 1 || plan.sessions.length > 6) return null;
    for (const session of plan.sessions) {
        if (!session || typeof session.day_name !== 'string' || !session.day_name.trim() || session.day_name.length > 80
            || !Array.isArray(session.exercises) || session.exercises.length < 1 || session.exercises.length > 5) return null;
        const seen = new Set<string>();
        for (const ex of session.exercises) {
            if (!ex || !defaultExercises.some(item => item.id === ex.id) || seen.has(ex.id)
                || !Number.isInteger(ex.set_count) || ex.set_count < 1 || ex.set_count > 3
                || !Number.isInteger(ex.reps) || ex.reps < 1 || ex.reps > 30) return null;
            seen.add(ex.id);
        }
    }
    return plan;
}

export function starterSessionDraft(plan: unknown, day: string): UserExercise[] | null {
    const session = readStarterPlan(plan)?.sessions.find(item => item.day_name.toLowerCase() === day.toLowerCase());
    if (!session) return null;
    return session.exercises.map(item => {
        const exercise = defaultExercises.find(ex => ex.id === item.id)!;
        return { id: exercise.id, name: exercise.name, target: exercise.target, gifUrl: exercise.gifUrl, instructions: exercise.instructions,
            is_unilateral: exercise.id === 'dumbbell_row_single' || exercise.id === 'bodyweight_reverse_lunge',
            sets: Array.from({ length: item.set_count }, (_, i) => ({ id: `${item.id}-${i}`, reps: item.reps,
                weight_kg: exercise.equipment === 'body weight' ? 0 : '', completed: false })) };
    });
}
