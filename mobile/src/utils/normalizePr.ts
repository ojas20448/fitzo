import type { SharePr } from '../components/share/SharePayload';

/**
 * The two completion paths emit different PR shapes:
 *   POST /workouts                        -> { name, current, previous }
 *   PUT  /workout-sessions/:id/complete   -> { exerciseName, newWeight, improvement }
 *
 * Only the first was ever handled, so a live-session PR rendered as the literal
 * string "PR" on the share card. Returning null for an unusable entry is
 * deliberate: a card that silently says "PR" is worse than one PR fewer.
 */
export function normalizePr(raw: unknown): SharePr | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;

    const exercise = (r.name ?? r.exerciseName ?? r.exercise_name) as string | undefined;
    if (!exercise || typeof exercise !== 'string') return null;

    if (typeof r.current === 'string' && r.current.trim()) {
        const out: SharePr = { exercise, current: r.current };
        if (typeof r.previous === 'string' && r.previous.trim()) out.previous = r.previous;
        return out;
    }

    const weight = Number(r.newWeight ?? r.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0) return null;

    const out: SharePr = { exercise, current: `${weight} kg` };
    const improvement = Number(r.improvement);
    if (Number.isFinite(improvement) && improvement > 0) {
        out.previous = `${Math.round((weight - improvement) * 100) / 100} kg`;
    }
    return out;
}

export function normalizePrs(raw: unknown): SharePr[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizePr).filter((p): p is SharePr => p !== null);
}
