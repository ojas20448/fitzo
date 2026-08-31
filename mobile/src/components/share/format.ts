import type { ShareSet, SharePayload } from './SharePayload';

/**
 * Shared pure formatting helpers for the share themes.
 *
 * Kept separate from ink.tsx (hand-drawn SVG marks — a date formatter there
 * would be a naming lie) and separate from each theme file: R16 already
 * treats identical logic duplicated across Receipt and Spec as a defect for
 * InkCircle/DashedLine, and the same class of duplication showed up again
 * as near-identical date formatting in both files (R19). Pure functions in
 * a .ts file are also the only part of a theme that CAN be unit-tested in
 * this repo — there is no react-test-renderer, so the component tree itself
 * never gets coverage. This module is where that coverage lives; see
 * utils/__tests__/shareFormat.test.ts.
 */

/**
 * RULING R18: a share card must render identically on every device.
 * Hermes on Expo SDK 54 ships full ICU, so a bare `.toLocaleString()` with
 * no locale argument resolves the VIEWER's device locale at runtime —
 * 123456 becomes "123,456" on an en-US phone, "1,23,456" on en-IN, or
 * "123.456" on de-DE. `shareMoment.ts` already documents and refuses this
 * exact pattern for milestone labels; the per-exercise volume figure on
 * Spec was the one place it slipped through, because it routinely exceeds
 * 1000 (unlike weightEquivalence's bounded 2-999 count, which never crosses
 * a grouping separator).
 *
 * 'en-IN' matches the product's own voice — auto-rickshaw / Royal Enfield /
 * gas-cylinder weight equivalences, rickshaw and samosa dither art — so
 * Indian digit grouping is the one that actually fits what the card already
 * sounds like. Exported as a single constant so it is one line to change if
 * that call is ever revisited.
 */
export const CARD_LOCALE = 'en-IN';

/** Whole-kg volume, comma-grouped under the pinned CARD_LOCALE — never the ambient device locale. */
export function formatVolumeKg(kg: number): string {
    return Math.round(kg).toLocaleString(CARD_LOCALE);
}

/**
 * "DD MON YYYY", e.g. "31 AUG 2026". The month name goes through
 * `toLocaleString('en', ...)` with an EXPLICIT locale argument — that is
 * the fix, not a repeat of the R18 bug. The day and year are plain
 * template-literal numbers and are never locale-formatted.
 */
export function formatDate(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')} ${d
        .toLocaleString('en', { month: 'short' })
        .toUpperCase()} ${d.getFullYear()}`;
}

/**
 * ex.topSet is only ever fully populated or fully absent in practice
 * (buildShareExercises.ts builds it as `top ? { weight_kg, reps } : undefined`),
 * but ShareSet's fields are individually optional at the type level, so this
 * stays defensive about a partial value rather than assuming both are
 * always present together.
 */
export function formatTopSet(topSet: ShareSet | undefined): string | null {
    if (!topSet) return null;
    const w = topSet.weight_kg;
    const r = topSet.reps;
    if (w != null && r != null) return `${Math.round(w * 10) / 10}×${r}`;
    if (w != null) return `${Math.round(w * 10) / 10} kg`;
    if (r != null) return `${r} reps`;
    return null;
}

/**
 * The exact lowercase muscle keys AnatomyHeatmap's SVG (src/components/
 * AnatomyHeatmap.tsx) reads — ruling R4. `Vol` there is typed as
 * `Record<string, number>`, so a key outside this list is NOT a type error;
 * it is simply never read, and the muscle it was meant for renders as
 * untrained. Kept here (not just in a comment) so `hasMuscleVolume` below
 * can check against it mechanically instead of every future editor needing
 * to re-verify the list by hand.
 */
export const ANATOMY_MUSCLE_KEYS = [
    'abs', 'arms', 'back', 'biceps', 'calves', 'chest', 'core', 'forearms',
    'glutes', 'hamstrings', 'lats', 'legs', 'obliques', 'quads', 'shoulders',
    'traps', 'triceps', 'lower back',
] as const;

/**
 * True only when `volume` has at least one strictly-positive entry under a
 * KEY ANATOMYHEATMAP ACTUALLY READS.
 *
 * ANATOMY's whole reason to exist is a colored heatmap — but AnatomyHeatmap
 * renders an all-`untrained` (faint, uncolored) figure for an absent, empty,
 * or all-zero volume record, and an all-untrained figure reads as a broken
 * card, not a design choice (task brief, binding constraint). This is the
 * single predicate that decides whether ANATOMY's hero is safe to draw; it
 * is pulled out to here — instead of inlined in the component — specifically
 * because a component tree can't be rendered in this repo's test setup, so a
 * bug in this exact condition would otherwise ship with zero coverage.
 *
 * Checking against ANATOMY_MUSCLE_KEYS (rather than `Object.values(volume)`
 * generically) closes the exact gap ruling R4 warns about: a record like
 * `{ cardio: 5 }` has a positive value, but "cardio" is not a key
 * AnatomyHeatmap reads, so the figure it would draw is STILL all-untrained.
 * A naive "any positive value anywhere" check would call that "has data"
 * and render the broken-looking figure anyway.
 *
 * Negative entries are defensively treated as "no signal" (not `true`) even
 * though set counts are never negative in practice — `v > 0` already gets
 * this right without extra branching, so it costs nothing to keep.
 */
export function hasMuscleVolume(
    volume: Record<string, number> | undefined
): volume is Record<string, number> {
    if (!volume) return false;
    return ANATOMY_MUSCLE_KEYS.some((key) => {
        const v = volume[key];
        return typeof v === 'number' && v > 0;
    });
}

/**
 * Layered fallback content for a theme's secondary list: a PR beats a plain
 * exercise beats a generic stat row, because that is the order of "how
 * interesting is this to show" — a PR is the one thing worth leading with
 * when it exists.
 *
 * Two callers share this, not one: ANATOMY uses it for the entire card body
 * when `hasMuscleVolume` is false (no heatmap to draw), and CHALK uses it
 * unconditionally for its exercise checklist (Chalk has no optional hero —
 * `payload.headline` is a required field — so there is no separate
 * degraded-vs-normal split for it, just "what goes in the list"). Sharing
 * one tested implementation means both themes' sparse-payload behaviour is
 * verified in one place instead of two hand-rolled, unverifiable JSX
 * branches (see module doc: components have no test coverage here).
 *
 * `max` is clamped to >= 0 before reaching `Array.prototype.slice` —
 * `slice(0, negative)` means "up to N from the END" in JS, not "empty," so
 * an accidental negative cap would silently return the wrong rows instead
 * of nothing.
 */
export function pickSummaryRows(
    payload: SharePayload,
    max: number
): { label: string; value: string }[] {
    const n = Math.max(0, max);
    if (payload.prs.length > 0) {
        return payload.prs.slice(0, n).map((pr) => ({ label: pr.exercise, value: pr.current }));
    }
    if (payload.exercises.length > 0) {
        return payload.exercises.slice(0, n).map((ex) => ({
            label: ex.name,
            value: formatTopSet(ex.topSet) || `${formatVolumeKg(ex.volumeKg)} KG`,
        }));
    }
    if (payload.rows.length > 0) {
        return payload.rows.slice(0, n);
    }
    return [];
}
