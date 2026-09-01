import type { LastSession } from '../stores/lastSessionStore';
import type { SharePayload, ShareExercise, SharePr } from '../components/share/SharePayload';
import { formatDate, formatVolumeKg } from '../components/share/format';
import { weightEquivalence } from '../components/ReceiptShareCard';
import { TOTAL_ID, EX_PREFIX, PR_PREFIX } from './shareMoment';

/**
 * Turns a composer chip selection into the payload a theme renders.
 *
 * Selection ids are the namespaced scheme shareMoment.ts defines and
 * exports (TOTAL_ID, EX_PREFIX, PR_PREFIX — imported above rather than
 * re-declared here, so this file can't silently drift from the ids
 * ShareComposerScreen actually generates). shareMoment.ts also exports a
 * fourth id, MUSCLES_ID ('muscles'), which this function does not import:
 * it carries no volume/PR content of its own, so it is a no-op here by
 * construction — nothing below ever needs to test for it. (Not used means
 * unimported, not "still hand-written" — there is no 'muscles' literal
 * anywhere in this file for it to replace.) ShareComposerScreen derives
 * `muscleVolume` separately, via `deriveMuscleVolume` below, from the WHOLE
 * session and independent of selection, then attaches it to this
 * function's output only when MUSCLES_ID is itself selected — see that
 * function's own doc comment for why.
 *
 * RULING R12: `session.exercises[].volumeKg` is RAW/unrounded (see
 * buildShareExercises.ts). Every total below is summed from exactly the
 * selected exercises' raw volumeKg and rounded exactly once — by
 * `formatVolumeKg`'s own `Math.round`, applied to the finished sum — never
 * by summing parts that were each rounded independently first.
 *
 * Headline precedence mirrors pickMoment's own three destinations:
 *   1. Any exercise content is selected (the 'total' chip, which stands for
 *      every exercise, or one or more 'ex:' chips) -> the summed,
 *      once-rounded volume of exactly those exercises. Exercises only ever
 *      reach `session.exercises` with at least one valid set (see
 *      buildShareExercises.ts), so this sum is always strictly positive
 *      whenever this branch is taken — it can never itself read "0 KG".
 *   2. No exercise content selected, but a PR is -> that PR's own
 *      already-formatted `current` string (e.g. "82.5 kg x 3"), unmodified.
 *      Receipt and Scoreboard already render `pr.current`/`pr.previous` as
 *      -is with no case transform, so this stays consistent with them.
 *   3. Neither -> the session's own pre-computed volumeKg, so a selection
 *      like ['muscles'] alone (nothing exercise- or PR-shaped) never
 *      headlines "0 KG" just because nothing in THIS function's view of the
 *      selection carries a number.
 */
export function buildSharePayload(session: LastSession, selection: string[]): SharePayload {
    const exIds = selection
        .filter((id) => id.startsWith(EX_PREFIX))
        .map((id) => id.slice(EX_PREFIX.length));
    const prNames = selection
        .filter((id) => id.startsWith(PR_PREFIX))
        .map((id) => id.slice(PR_PREFIX.length));
    const hasTotal = selection.includes(TOTAL_ID);

    const selectedExercises: ShareExercise[] = hasTotal
        ? session.exercises
        : session.exercises.filter((ex) => exIds.includes(ex.id));

    const selectedPrs: SharePr[] = session.prs.filter((pr) => prNames.includes(pr.exercise));

    // Raw sum over exactly the selected exercises — round once, below, not here.
    const totalVolumeKg = selectedExercises.reduce((sum, ex) => sum + ex.volumeKg, 0);

    let headline: string;
    if (selectedExercises.length > 0) {
        headline = `${formatVolumeKg(totalVolumeKg)} KG`;
    } else if (selectedPrs.length > 0) {
        headline = selectedPrs[0].current;
    } else {
        headline = `${formatVolumeKg(session.volumeKg)} KG`;
    }

    // weightEquivalence divides/rounds the RATIO (totalKg / equivalentKg),
    // not totalVolumeKg itself, so handing it the raw sum here is not a
    // second rounding pass — see its body in ReceiptShareCard.tsx. Left
    // undefined (not '') when there is no selected volume, so Receipt's own
    // `payload.caption || weightEquivalence(...)` fallback and Scoreboard's
    // `payload.caption || null` both treat "no caption" the same way.
    const caption = totalVolumeKg > 0 ? weightEquivalence(totalVolumeKg) : undefined;

    const date = new Date(session.completedAt);

    return {
        headline,
        caption,
        subtitle: `${session.title} · ${formatDate(date)}`,
        // Session-level stats, deliberately independent of `selection`:
        // unlike exercises/prs (which can legitimately be empty — e.g.
        // selection === ['muscles']), Receipt's BREAKDOWN section renders a
        // visibly blank block when `rows` is empty, and duration/setCount
        // are the one pair of fields `LastSession` always carries no matter
        // what is selected, so this can never be empty.
        rows: [
            { label: 'Duration', value: `${session.durationMin} min` },
            { label: 'Sets', value: `${session.setCount}` },
            ...(session.streak ? [{ label: 'Streak', value: `${session.streak} days` }] : []),
        ],
        prs: selectedPrs,
        exercises: selectedExercises,
        date,
    };
}

/**
 * RULINGS R3/R4: per-muscle set counts for the ANATOMY theme, summed from
 * the WHOLE session — never filtered by `selection` — a heatmap of "what
 * you trained today" does not change just because the card happens to
 * feature one exercise. `ShareComposerScreen` calls this once (memoized on
 * `session`) and spreads the result onto whatever `buildSharePayload`
 * returns, independent of the current chip selection.
 *
 * Exported and tested separately from `buildSharePayload` rather than
 * inlined in the screen's own useMemo: R4's trap is a silent one —
 * `AnatomyHeatmap`'s `volume` prop is typed `Record<string, number>`, so a
 * mixed-case key like "Chest" (DB `target` values are mixed case; heatmap
 * keys are all lowercase) is not a type error, it is simply never read, and
 * that muscle renders as untrained. A component tree can't be rendered in
 * this repo's test setup, so this is the only place that trap can actually
 * be caught by a test.
 */
export function deriveMuscleVolume(exercises: ShareExercise[]): Record<string, number> {
    return exercises.reduce((acc, ex) => {
        const target = ex.target?.toLowerCase();
        if (target) acc[target] = (acc[target] || 0) + ex.setCount;
        return acc;
    }, {} as Record<string, number>);
}
