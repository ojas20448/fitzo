/**
 * Workout preference shaping — deliberately schema-tolerant.
 *
 * WHY: these columns arrive by migration, and this backend deploys from a git
 * push while migrations are run by hand. So there is always a window where the
 * code knows about a preference the database does not have yet. A plain
 * `SELECT rest_timer_enabled, …` throws 42703 in that window, and because every
 * workout preference is fetched by one query, a single missing column takes the
 * whole endpoint down — including preferences that predate it (RIR logging, the
 * first-run sheet).
 *
 * The route therefore reads the row as jsonb, which simply omits absent
 * columns rather than erroring, and these helpers fill the gaps with the same
 * defaults the migration declares. Writes to a column that does not exist yet
 * are reported back as `pending_migration` instead of failing the request.
 */

const WORKOUT_PREF_COLUMNS = [
    'log_rir_enabled',
    'workout_prefs_seen',
    'rest_timer_enabled',
    'warmup_card_enabled',
];

// Must mirror the column DEFAULTs in the migrations, or a pre-migration client
// sees different behaviour from a post-migration one.
//   008_unilateral_and_rir.sql        → log_rir_enabled FALSE, workout_prefs_seen FALSE
//   013_rest_timer_and_warmup_prefs   → rest_timer_enabled FALSE, warmup_card_enabled TRUE
const WORKOUT_PREF_DEFAULTS = Object.freeze({
    log_rir_enabled: false,
    workout_prefs_seen: false,
    rest_timer_enabled: false,
    warmup_card_enabled: true,
});

/**
 * Build the full preference payload from however much of the row exists.
 * Always returns every key, so the client never has to branch on absence.
 */
function readPrefs(row) {
    const source = row || {};
    const out = {};
    for (const col of WORKOUT_PREF_COLUMNS) {
        const value = source[col];
        out[col] = typeof value === 'boolean' ? value : WORKOUT_PREF_DEFAULTS[col];
    }
    return out;
}

/**
 * Split a PATCH body into what can be written now and what cannot.
 *
 * @param body             the request body
 * @param availableColumns columns the table actually has right now
 * @returns {{requested, invalid, applicable, deferred}}
 *   invalid    — present but not a boolean; the caller should 400
 *   applicable — write these
 *   deferred   — valid, but the column does not exist yet
 */
function planPrefUpdate(body, availableColumns) {
    const source = body || {};
    const available = new Set(availableColumns || WORKOUT_PREF_COLUMNS);

    const requested = WORKOUT_PREF_COLUMNS.filter(col => source[col] !== undefined);
    const invalid = requested.filter(col => typeof source[col] !== 'boolean');
    const valid = requested.filter(col => typeof source[col] === 'boolean');

    return {
        requested,
        invalid,
        applicable: valid.filter(col => available.has(col)),
        deferred: valid.filter(col => !available.has(col)),
    };
}

module.exports = {
    WORKOUT_PREF_COLUMNS,
    WORKOUT_PREF_DEFAULTS,
    readPrefs,
    planPrefUpdate,
};
