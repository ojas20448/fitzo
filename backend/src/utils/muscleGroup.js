/**
 * Infer a muscle group from a free-text exercise name.
 *
 * Why this exists: the muscle-volume heatmap resolves a set's muscle group as
 *
 *     COALESCE(exercises.muscle_groups[1], exercise_logs.muscle_group, 'other')
 *
 * A custom exercise has no catalogue row, so the first term is NULL. If
 * exercise_logs.muscle_group is also NULL the set lands in the 'other' bucket —
 * and the client folds results into six named buckets, so 'other' is dropped
 * without a trace. The user sees "UNTRAINED" next to a muscle they trained.
 *
 * Classifying at write time keeps the read query untouched and means the
 * heatmap needs no knowledge of how the name was resolved.
 *
 * Deliberately a keyword matcher rather than anything cleverer: exercise naming
 * is a small, stable vocabulary, and a lookup table is inspectable and testable
 * in a way a fuzzy match or an LLM call would not be.
 */

const VALID_GROUPS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

// Order matters — the first match wins, so the more specific pattern must come
// first. "leg curl" has to beat the generic "curl" → arms rule, and "front
// raise" has to beat "raise". Adding a keyword? Put it above anything more
// general that would also match it.
const RULES = [
    // Legs — checked first because several leg movements contain words that
    // otherwise read as arms ("curl") or back ("deadlift", "pull").
    [/\b(squat|leg press|leg curl|leg extension|lunge|split squat|bulgarian|hack squat|calf|calves|romanian|rdl|hip thrust|glute|hamstring|quad|adductor|abductor|step[- ]?up|sissy)\b/i, 'legs'],

    // Back — pulls, rows, and the hinge patterns that are not leg-dominant.
    [/\b(deadlift|row|pull[- ]?up|chin[- ]?up|pulldown|lat|pullover|shrug|rack pull|good morning|back extension|hyperextension|face pull|reverse fly|rear delt)\b/i, 'back'],

    // Chest.
    [/\b(bench|chest|pec|fly|flye|dip|push[- ]?up|press[- ]?up|crossover|svend)\b/i, 'chest'],

    // Shoulders — "overhead press" and friends. Must follow chest so that
    // "bench press" is not caught by a bare "press".
    [/\b(shoulder|overhead press|ohp|military|lateral raise|side raise|front raise|upright row|arnold|delt|shrug press)\b/i, 'shoulders'],

    // Arms.
    [/\b(curl|bicep|tricep|pushdown|push[- ]?down|skull ?crusher|kickback|hammer|preacher|concentration|forearm|wrist|extension \(tricep\)|close[- ]?grip)\b/i, 'arms'],

    // Core.
    [/\b(crunch|sit[- ]?up|plank|ab |abs\b|oblique|russian twist|leg raise|knee raise|hollow|dead ?bug|pallof|woodchop|cable twist|hanging)\b/i, 'core'],

    // Bare "press" fallback — "Incline Dumbbell Press" names no body part, so
    // nothing above catches it. Deliberately last: every rule that could claim
    // a press has already had its turn, so "Overhead Press" is shoulders and
    // "Incline Curl" is arms before control reaches here.
    [/\b(incline|decline|flat|dumbbell|db|machine|smith|chest|barbell|bb)\b.*\bpress\b/i, 'chest'],
];

/**
 * @param {string} name Free-text exercise name, e.g. "Incline DB Press".
 * @returns {string|null} One of VALID_GROUPS, or null when nothing matches —
 *   null is meaningful and must not be coerced to a guess, because a wrong
 *   muscle group corrupts the heatmap more than a missing one does.
 */
function inferMuscleGroup(name) {
    if (!name || typeof name !== 'string') return null;
    const n = name.trim();
    if (!n) return null;

    for (const [pattern, group] of RULES) {
        if (pattern.test(n)) return group;
    }
    return null;
}

/** Guards a client-supplied value before it reaches the database. */
function normalizeMuscleGroup(value) {
    if (typeof value !== 'string') return null;
    const v = value.trim().toLowerCase();
    return VALID_GROUPS.includes(v) ? v : null;
}

/**
 * Resolve the muscle group to persist for an exercise log.
 *
 * Precedence: an explicit client value, then inference from the custom name.
 * Catalogue exercises return null on purpose — their group already comes from
 * exercises.muscle_groups, and duplicating it here would create two sources of
 * truth that drift the moment the catalogue is corrected.
 */
function resolveMuscleGroup({ exercise_id, custom_exercise_name, muscle_group }) {
    const explicit = normalizeMuscleGroup(muscle_group);
    if (explicit) return explicit;
    if (exercise_id) return null;
    return inferMuscleGroup(custom_exercise_name);
}

module.exports = { inferMuscleGroup, normalizeMuscleGroup, resolveMuscleGroup, VALID_GROUPS };
