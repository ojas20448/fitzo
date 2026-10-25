const { z } = require('zod');
const { ValidationError } = require('./errors');

const ids = [
    'leg_press', 'chest_press_machine', 'lat_pulldown', 'romanian_deadlift_dumbbell', 'crunches',
    'machine_row', 'lateral_raise_dumbbell', 'shoulder_press_dumbbell', 'bicep_curl_dumbbell',
    'leg_curl_seated', 'calf_raise_standing', 'tricep_pushdown_rope', 'pec_deck', 'face_pull',
    'hammer_curl', 'goblet_squat', 'push_up', 'dumbbell_row_single', 'glute_bridge',
    'bodyweight_reverse_lunge', 'overhead_tricep_extension_dumbbell', 'prone_arm_raise',
    'bodyweight_squat', 'knee_push_up',
];
const schema = z.object({
    version: z.literal(1),
    preferences: z.object({
        experience: z.enum(['new', 'returning', 'regular']),
        equipment: z.enum(['gym', 'dumbbells', 'bodyweight']),
        session_minutes: z.union([z.literal(20), z.literal(35), z.literal(50), z.literal(90)]),
    }).strict(),
    sessions: z.array(z.object({
        day_name: z.string().trim().min(1).max(80),
        exercises: z.array(z.object({
            id: z.enum(ids), set_count: z.number().int().min(1).max(3), reps: z.number().int().min(1).max(30),
        }).strict()).min(1).max(5),
    }).strict()).min(1).max(6),
}).strict();

const tempo = z.string().regex(/^\d{1,2}(-\d{1,2}){3}$/).optional();
const customSchema = z.object({
    version: z.literal(2), type: z.literal('custom'), tempo,
    sessions: z.array(z.object({
        day_name: z.string().trim().min(1).max(80),
        exercises: z.array(z.object({
            id: z.string().min(1).max(100).optional(), name: z.string().trim().min(1).max(200),
            target: z.string().max(80).optional(), instructions: z.string().max(2000).optional(),
            set_count: z.number().int().min(1).max(20), reps_min: z.number().int().min(1).max(100),
            reps_max: z.number().int().min(1).max(100), tempo, is_unilateral: z.boolean().optional(),
        }).strict().refine(ex => ex.reps_min <= ex.reps_max)).min(1).max(30),
    }).strict()).min(1).max(7),
}).strict();

function validateStarterPlan(value, days) {
    if (value === undefined || value === null) return null;
    const result = (value.version === 2 ? customSchema : schema).safeParse(value);
    if (!result.success) throw new ValidationError('Check your starting workout preferences and exercises.');
    const plan = result.data;
    if (plan.sessions.length !== days.length || plan.sessions.some((session, i) => session.day_name !== days[i])) {
        throw new ValidationError('Starting workouts must match the saved training days.');
    }
    if (new Set(days.map(day => day.trim().toLowerCase())).size !== days.length) throw new ValidationError('Choose distinct training days.');
    if (plan.version === 2) return plan;
    if (plan.sessions.some(session => new Set(session.exercises.map(ex => ex.id)).size !== session.exercises.length)) {
        throw new ValidationError('Each starting workout needs distinct exercises.');
    }
    const floor = ['bodyweight_squat', 'bodyweight_reverse_lunge', 'knee_push_up', 'prone_arm_raise', 'glute_bridge', 'crunches', 'push_up'];
    const home = [...floor, 'goblet_squat', 'romanian_deadlift_dumbbell', 'dumbbell_row_single', 'shoulder_press_dumbbell', 'bicep_curl_dumbbell', 'hammer_curl', 'lateral_raise_dumbbell', 'overhead_tricep_extension_dumbbell'];
    const allowed = plan.preferences.equipment === 'bodyweight' ? floor : plan.preferences.equipment === 'dumbbells' ? home : ids;
    if (plan.sessions.some(session => session.exercises.some(ex => !allowed.includes(ex.id)))) {
        throw new ValidationError('Starting exercises must match your available equipment.');
    }
    return plan;
}
module.exports = { validateStarterPlan };
