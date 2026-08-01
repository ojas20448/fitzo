/**
 * Training Volume
 *
 * ONE definition of what a set is worth, because five places need it:
 * four SQL queries in routes/progress.js and one JS sum in the mobile
 * post-workout recap. When those disagree, the recap and the stats screen
 * report different numbers for the same session.
 *
 * A unilateral set is entered PER SIDE — "10 reps" means 10 on each — so
 * both sides count toward volume.
 */

const UNILATERAL_MULTIPLIER = 2;

/**
 * Volume of a single set, in kg-reps.
 * @param {number|string} weightKg
 * @param {number|string} reps
 * @param {boolean} isUnilateral
 * @returns {number} 0 for missing, zero, negative, or unparseable input
 */
function setVolume(weightKg, reps, isUnilateral) {
    const w = Number(weightKg);
    const r = Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return 0;
    return w * r * (isUnilateral ? UNILATERAL_MULTIPLIER : 1);
}

/**
 * The same rule as a SQL expression.
 * Requires `set_logs` aliased as `sl` and `exercise_logs` aliased as `el`.
 * Every query in routes/progress.js must use this rather than inlining the
 * arithmetic — that is what keeps the five sites in step.
 */
const VOLUME_SQL =
    `(sl.weight_kg * sl.reps * CASE WHEN el.is_unilateral THEN ${UNILATERAL_MULTIPLIER} ELSE 1 END)`;

module.exports = { setVolume, VOLUME_SQL, UNILATERAL_MULTIPLIER };
