import type { LastSession } from '../stores/lastSessionStore';

export type ThemeId = 'receipt' | 'spec' | 'scoreboard' | 'anatomy' | 'chalk';

/**
 * The composer's selection-id namespace — the ONE place these four literals
 * are spelled out. `pickMoment` below, `buildSharePayload.ts` (which parses
 * a selection back into exercises/PRs), and `ShareComposerScreen.tsx` (which
 * generates the chip list these ids identify) all import from here instead
 * of hand-writing their own copies of the same strings. Before this, all
 * three independently agreed by coincidence — an edit to one could have
 * silently desynced chip generation from payload derivation with no type
 * error and no test catching it.
 */
export const TOTAL_ID = 'total';
export const EX_PREFIX = 'ex:';
export const PR_PREFIX = 'pr:';
export const MUSCLES_ID = 'muscles';

/**
 * DEAD CODE, DELIBERATELY KEPT — not deleted, and not wired to any consumer.
 *
 * `getWorkoutMilestone` and `getVolumeMilestone` (both below) are fully
 * implemented and unit-tested (shareMoment.test.ts), but as of this branch
 * neither has a single live caller — verified by grep across `src/` and
 * `app/`. They were extracted from the now-deleted `WorkoutShareCard.tsx`
 * (Task 3) specifically so Task 8 could delete that component without
 * losing the milestone logic: a "100TH WORKOUT" / "500K KG LIFETIME"
 * callout is exactly the notable-moment hook this feature is built around,
 * so the intent was always to reuse it, not to keep it as a historical
 * artifact.
 *
 * They stay unreachable because `LastSession`
 * (`../stores/lastSessionStore.ts`) carries only THIS session's own numbers
 * (`volumeKg`, `setCount`, `durationMin`, etc.) — nothing cumulative across
 * a user's history. Wiring either function up would need, at minimum:
 *   1. Two new fields on `LastSession`: a lifetime workout count and a
 *      lifetime volume total.
 *   2. Both populated at the one place a `LastSession` is constructed —
 *      `WorkoutLogScreen.tsx`'s `setSession(...)` call.
 *   3. A render site for whichever milestone string comes back non-null.
 *      `Scoreboard.tsx` already has a tag slot built for exactly this shape
 *      of callout — the `hasPr && <Text style={styles.tag}>NEW PR</Text>`
 *      block — which a milestone string could occupy under the same
 *      treatment instead of, or alongside, the PR tag.
 *
 * Until that lands, treat these two functions as reference implementations
 * preserved for later use, not as shipped behaviour.
 */
const WORKOUT_MILESTONES = [500, 365, 200, 100, 50, 25, 10];
export function getWorkoutMilestone(count: number): string | null {
    return WORKOUT_MILESTONES.includes(count) ? `${count}TH WORKOUT` : null;
}

/**
 * Same status as `getWorkoutMilestone` immediately above — extracted,
 * tested, and not wired to any consumer. See that function's doc comment
 * for the full explanation and what wiring it up would require.
 *
 * Labels are hardcoded, not derived via toLocaleString(): that formats by the
 * host locale, so "100,000" becomes "100.000" under a European locale and the
 * assertion flakes. These strings are also what the old card shipped.
 */
const VOLUME_MILESTONES: { threshold: number; label: string }[] = [
    { threshold: 1_000_000, label: '1M KG LIFETIME' },
    { threshold: 500_000, label: '500K KG LIFETIME' },
    { threshold: 250_000, label: '250K KG LIFETIME' },
    { threshold: 100_000, label: '100K KG LIFETIME' },
];
export function getVolumeMilestone(totalKg: number): string | null {
    // Only within 2% above the threshold. Announcing "100K KG" to someone at
    // 180,000 is not a milestone, it is noise.
    for (const m of VOLUME_MILESTONES) {
        if (totalKg >= m.threshold && totalKg < m.threshold * 1.02) return m.label;
    }
    return null;
}

/**
 * What the composer opens with.
 *
 * Selection ids are namespaced so a chip list can mix kinds:
 *   TOTAL_ID | `${EX_PREFIX}<exerciseId>` | `${PR_PREFIX}<exerciseName>` | MUSCLES_ID
 * (the constants above — 'total' | 'ex:<exerciseId>' | 'pr:<exerciseName>' | 'muscles').
 *
 * Exactly one item is pre-selected. SCOREBOARD renders a single figure at full
 * frame, so handing it two PRs would have nothing sensible to draw.
 */
export function pickMoment(session: LastSession): { selection: string[]; theme: ThemeId } {
    if (session.prs.length > 0) {
        return { selection: [`${PR_PREFIX}${session.prs[0].exercise}`], theme: 'scoreboard' };
    }
    if (session.exercises.length > 0) {
        const heaviest = session.exercises.reduce((a, b) => (b.volumeKg > a.volumeKg ? b : a));
        return { selection: [`${EX_PREFIX}${heaviest.id}`], theme: 'receipt' };
    }
    return { selection: [TOTAL_ID], theme: 'receipt' };
}
