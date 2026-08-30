import type { UserExercise } from '../components/workout';
import type { ShareExercise } from '../components/share/SharePayload';

/**
 * Maps a finished workout's exercises into the shape a share card renders.
 *
 * RULING R10: a set counts by `w > 0 && r > 0` — the same predicate the
 * session-total loop in WorkoutLogScreen uses — NOT by `s.completed`. If
 * these two predicates disagree, the per-exercise rows on a card stop
 * summing to the headline volume on that same card.
 *
 * RULING R11: `weight_kg`/`reps` are `number | string | undefined`. Always
 * `parseFloat(String(x || 0))`, never `parseFloat(String(x))` — the latter
 * yields `NaN` on undefined.
 *
 * RULING R12: `volumeKg` is left RAW here — deliberately not rounded. The
 * user picks an arbitrary subset of exercises to feature on a card, and no
 * fixed per-exercise rounding can make "sum of rounded parts" equal "round
 * of the sum" for every possible subset (three exercises with raw volumes
 * 135.0, 82.5, 87.5 round to 305 as a sum, but 306 if each part is rounded
 * first). Round once, at render time, over exactly the set being shown.
 *
 * Pulled out of WorkoutLogScreen's handleFinish (RULING R13) because this
 * project can only test pure logic — no react-test-renderer — so the
 * mapping stayed permanently untestable while it lived inline, which is
 * exactly how the rounding bug above reached review.
 */
export function buildShareExercises(userExercises: UserExercise[]): ShareExercise[] {
    return userExercises
        .map((ex) => {
            const done = ex.sets.filter((s) => {
                const w = parseFloat(String(s.weight_kg || 0));
                const r = parseFloat(String(s.reps || 0));
                return w > 0 && r > 0;
            });
            const vol = done.reduce((sum, s) => {
                const w = parseFloat(String(s.weight_kg || 0));
                const r = parseFloat(String(s.reps || 0));
                return sum + w * r * (ex.is_unilateral ? 2 : 1);
            }, 0);
            const top = done.reduce<typeof done[0] | undefined>(
                (best, s) => (parseFloat(String(s.weight_kg || 0))) > (parseFloat(String(best?.weight_kg || 0))) ? s : best,
                undefined,
            );
            return {
                id: ex.id,
                name: ex.name,
                target: ex.target,
                volumeKg: vol,
                setCount: done.length,
                topSet: top ? { weight_kg: parseFloat(String(top.weight_kg || 0)), reps: parseFloat(String(top.reps || 0)) } : undefined,
            };
        })
        .filter((e) => e.setCount > 0);
}
