const { ValidationError } = require('./errors');

/** Normalize structured logs before either representation is written. */
function finalizeWorkoutJson(value) {
    let exercises;
    try { exercises = typeof value === 'string' ? JSON.parse(value) : value; }
    catch { return value; } // Existing free-text logs remain supported.
    if (!Array.isArray(exercises)) return value;
    const finished = exercises.filter(ex => ex && typeof ex.name === 'string' && ex.name.trim()).map(ex => ({
        ...ex,
        sets: (Array.isArray(ex.sets) ? ex.sets : []).filter(set => {
            if (!set) return false;
            const weight = Number(set.weight_kg ?? 0);
            const reps = Number(set.reps);
            // Older clients omit the flag; an explicit unchecked set never counts.
            const completed = set.completed === undefined || set.completed === true;
            if (ex.tracking_type === 'cardio') {
                const minutes = Number(set.duration_minutes);
                const effort = set.rpe == null || String(set.rpe).trim() === '' ? null : Number(set.rpe);
                return completed && Number.isFinite(minutes) && minutes >= 1 / 60 && minutes <= 1440
                    && (effort === null || (Number.isInteger(effort) && effort >= 1 && effort <= 10));
            }
            return completed && Number.isFinite(weight) && weight >= 0 && Number.isInteger(reps) && reps > 0;
        }).map(set => {
            if (ex.tracking_type !== 'cardio') return { ...set, completed: true, weight_kg: Number(set.weight_kg ?? 0), reps: Number(set.reps) };
            const { weight_kg, reps, rir, rpe, ...timed } = set;
            return { ...timed, completed: true, duration_minutes: Number(set.duration_minutes),
                ...(rpe == null || String(rpe).trim() === '' ? {} : { rpe: Number(rpe) }) };
        }),
    })).filter(ex => ex.sets.length > 0);
    if (!finished.length) throw new ValidationError('Complete at least one strength set or cardio interval before finishing');
    return JSON.stringify(finished);
}

module.exports = { finalizeWorkoutJson };
