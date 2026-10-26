import type { UserExercise } from '../components/workout/types';
import { readCustomWorkoutPlan, type CustomWorkoutPlan } from './savedWorkoutPlan';
import { readStarterPlan, starterSessionDraft } from './starterWorkout';
import { cardioEntryError, isCardioExercise } from './cardio';

export function routineUpdate(original: unknown, day: string, exercises: UserExercise[]) {
    const custom = readCustomWorkoutPlan(original);
    const starter = custom ? null : readStarterPlan(original);
    const plan: CustomWorkoutPlan | null = custom || (starter ? {
        version: 2, type: 'custom', sessions: starter.sessions.map(session => ({ day_name: session.day_name,
            exercises: (starterSessionDraft(starter, session.day_name) || []).map(exercise => ({
                id: exercise.id, name: exercise.name, target: exercise.target, is_unilateral: exercise.is_unilateral,
                set_count: exercise.sets.length, reps_min: Number(exercise.sets[0]?.reps), reps_max: Number(exercise.sets[0]?.reps),
            })) })),
    } : null);
    const session = plan?.sessions.find(item => item.day_name.trim().toLowerCase() === day.trim().toLowerCase());
    if (!plan || !session) return { changed: false, plan: null, error: '', changes: [] as string[] };
    const signature = (items: { name: string; count: number }[]) => JSON.stringify(items.map(item => [item.name.trim().toLowerCase(), item.count]));
    const changed = signature(session.exercises.map(item => ({ name: item.name, count: item.set_count }))) !== signature(exercises.map(item => ({ name: item.name, count: item.sets.length })));
    if (!changed) return { changed: false, plan: null, error: '', changes: [] as string[] };
    const key = (name: string) => name.trim().toLowerCase();
    const changes = exercises.flatMap(exercise => {
        const old = session.exercises.find(item => key(item.name) === key(exercise.name));
        return !old ? [`Added ${exercise.name} · ${exercise.sets.length} sets`]
            : old.set_count !== exercise.sets.length ? [`${exercise.name}: ${old.set_count} → ${exercise.sets.length} sets`] : [];
    });
    for (const old of session.exercises) if (!exercises.some(exercise => key(exercise.name) === key(old.name))) changes.push(`Removed ${old.name}`);
    const oldOrder = session.exercises.filter(item => exercises.some(exercise => key(exercise.name) === key(item.name))).map(item => key(item.name));
    const newOrder = exercises.filter(exercise => session.exercises.some(item => key(item.name) === key(exercise.name))).map(exercise => key(exercise.name));
    if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) changes.push('Exercise order changed');
    if (!exercises.length || exercises.length > 30 || exercises.some(exercise => !exercise.sets.length || exercise.sets.length > 20)) return { changed: true, plan: null, changes, error: 'A saved routine needs 1–30 exercises and 1–20 sets per exercise.' };
    const replacements: CustomWorkoutPlan['sessions'][number]['exercises'] = [];
    for (const exercise of exercises) {
        const existing = session.exercises.find(item => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase());
        if (isCardioExercise(exercise)) {
            const timed = exercise.sets.find(set => !cardioEntryError(set, 'duration'));
            if (!timed) return { changed: true, plan: null, changes, error: `Enter a duration for ${exercise.name} before updating the routine.` };
            replacements.push({ id: exercise.id, name: exercise.name, target: exercise.target, tracking_type: 'cardio',
                duration_minutes: Number(timed.duration_minutes), set_count: exercise.sets.length });
            continue;
        }
        const reps = exercise.sets.find(set => Number.isInteger(Number(set.reps)) && Number(set.reps) > 0 && Number(set.reps) <= 100)?.reps;
        if (!existing && reps === undefined) return { changed: true, plan: null, changes, error: `Enter reps for ${exercise.name} before updating the routine.` };
        replacements.push({ ...(existing || { id: exercise.id, name: exercise.name, target: exercise.target, reps_min: Number(reps), reps_max: Number(reps) }),
            set_count: exercise.sets.length, is_unilateral: exercise.is_unilateral === true });
    }
    const updated = { ...plan, sessions: plan.sessions.map(item => item === session ? { ...item, exercises: replacements } : item) };
    const validated = readCustomWorkoutPlan(updated);
    return { changed: true, changes, plan: validated, error: validated ? '' : 'These exercises could not be saved as a routine. Save today only or review your exercises.' };
}
