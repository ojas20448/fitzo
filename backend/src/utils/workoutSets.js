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
            return completed && Number.isFinite(weight) && weight >= 0 && Number.isInteger(reps) && reps > 0;
        }).map(set => ({ ...set, completed: true, weight_kg: Number(set.weight_kg ?? 0), reps: Number(set.reps) })),
    })).filter(ex => ex.sets.length > 0);
    if (!finished.length) throw new ValidationError('Complete at least one set with reps before finishing');
    return JSON.stringify(finished);
}

module.exports = { finalizeWorkoutJson };
