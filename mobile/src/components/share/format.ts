import type { ShareSet } from './SharePayload';

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
