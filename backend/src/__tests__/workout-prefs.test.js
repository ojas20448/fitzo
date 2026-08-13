/**
 * Workout preferences must survive an unapplied migration.
 *
 * This backend deploys on a git push, but migrations are run by hand, so there
 * is always a window where the code knows about a column the database does not
 * have. All four preferences are fetched by ONE query, so naming a missing
 * column would 42703 the request and take RIR logging and the first-run sheet
 * down alongside the new preferences.
 *
 * These tests pin the degraded behaviour: defaults that match the migration,
 * writes to existing columns still applied, writes to missing columns reported
 * rather than silently dropped or fatal.
 */

const {
    WORKOUT_PREF_COLUMNS,
    WORKOUT_PREF_DEFAULTS,
    readPrefs,
    planPrefUpdate,
} = require('../utils/workoutPrefs');

// What a jsonb row looks like before 013 has run.
const PRE_MIGRATION_ROW = {
    id: 'u1',
    log_rir_enabled: true,
    workout_prefs_seen: true,
};

const POST_MIGRATION_ROW = {
    ...PRE_MIGRATION_ROW,
    rest_timer_enabled: true,
    warmup_card_enabled: false,
};

describe('readPrefs', () => {
    it('returns every key even when the row has none of them', () => {
        const prefs = readPrefs({});
        expect(Object.keys(prefs).sort()).toEqual([...WORKOUT_PREF_COLUMNS].sort());
    });

    it('fills missing columns with the migration defaults', () => {
        const prefs = readPrefs(PRE_MIGRATION_ROW);
        expect(prefs.log_rir_enabled).toBe(true);      // real value preserved
        expect(prefs.workout_prefs_seen).toBe(true);
        expect(prefs.rest_timer_enabled).toBe(false);  // 013 default
        expect(prefs.warmup_card_enabled).toBe(true);  // 013 default
    });

    it('the rest timer defaults OFF and the warm-up ON', () => {
        // The whole point of 013. If these ever flip, the pre-migration and
        // post-migration experiences diverge.
        expect(WORKOUT_PREF_DEFAULTS.rest_timer_enabled).toBe(false);
        expect(WORKOUT_PREF_DEFAULTS.warmup_card_enabled).toBe(true);
    });

    it('passes real values through once the columns exist', () => {
        expect(readPrefs(POST_MIGRATION_ROW)).toEqual({
            log_rir_enabled: true,
            workout_prefs_seen: true,
            rest_timer_enabled: true,
            warmup_card_enabled: false,
        });
    });

    it('treats SQL NULL as "use the default", not as false', () => {
        const prefs = readPrefs({ ...PRE_MIGRATION_ROW, warmup_card_enabled: null });
        expect(prefs.warmup_card_enabled).toBe(true);
    });

    it('survives a null/undefined row', () => {
        expect(readPrefs(null)).toEqual(WORKOUT_PREF_DEFAULTS);
        expect(readPrefs(undefined)).toEqual(WORKOUT_PREF_DEFAULTS);
    });
});

describe('planPrefUpdate', () => {
    const preMigrationColumns = Object.keys(PRE_MIGRATION_ROW).filter(k =>
        WORKOUT_PREF_COLUMNS.includes(k));

    it('applies writes to columns that exist', () => {
        const plan = planPrefUpdate({ log_rir_enabled: false }, preMigrationColumns);
        expect(plan.applicable).toEqual(['log_rir_enabled']);
        expect(plan.deferred).toEqual([]);
    });

    it('defers writes to columns that do not exist yet', () => {
        const plan = planPrefUpdate({ warmup_card_enabled: false }, preMigrationColumns);
        expect(plan.applicable).toEqual([]);
        expect(plan.deferred).toEqual(['warmup_card_enabled']);
    });

    it('splits a mixed write instead of failing all of it', () => {
        const plan = planPrefUpdate(
            { log_rir_enabled: true, rest_timer_enabled: true },
            preMigrationColumns,
        );
        expect(plan.applicable).toEqual(['log_rir_enabled']);
        expect(plan.deferred).toEqual(['rest_timer_enabled']);
    });

    it('applies everything once the migration has run', () => {
        const plan = planPrefUpdate(
            { rest_timer_enabled: true, warmup_card_enabled: false },
            WORKOUT_PREF_COLUMNS,
        );
        expect(plan.applicable.sort()).toEqual(['rest_timer_enabled', 'warmup_card_enabled']);
        expect(plan.deferred).toEqual([]);
    });

    it('flags non-booleans so the route can 400', () => {
        const plan = planPrefUpdate({ log_rir_enabled: 'yes' }, WORKOUT_PREF_COLUMNS);
        expect(plan.invalid).toEqual(['log_rir_enabled']);
        expect(plan.applicable).toEqual([]);
    });

    it('reports nothing requested for an empty body', () => {
        expect(planPrefUpdate({}, WORKOUT_PREF_COLUMNS).requested).toEqual([]);
        expect(planPrefUpdate(null, WORKOUT_PREF_COLUMNS).requested).toEqual([]);
    });

    it('ignores keys that are not preferences', () => {
        const plan = planPrefUpdate({ is_admin: true }, WORKOUT_PREF_COLUMNS);
        expect(plan.requested).toEqual([]);
        expect(plan.applicable).toEqual([]);
    });

    it('does not treat an explicit false as absent', () => {
        const plan = planPrefUpdate({ warmup_card_enabled: false }, WORKOUT_PREF_COLUMNS);
        expect(plan.applicable).toEqual(['warmup_card_enabled']);
    });
});
