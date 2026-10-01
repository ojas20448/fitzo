import { create } from 'zustand';
import type { LastSession } from './lastSessionStore';
import { STALE_AFTER_MS } from './lastSessionStore';
import type { SharePayload } from '../components/share/SharePayload';

/**
 * What ShareComposerScreen renders from — a discriminated union, not a bare
 * payload (task-9 ruling R26).
 *
 * 'session' carries a LastSession so the composer's content chips can
 * RE-DERIVE the payload per selection (pickMoment seeds it, buildSharePayload
 * rebuilds it on every chip toggle). 'static' carries an already-finished
 * SharePayload for a producer with no selectable content of its own — a
 * weekly recap today, a future digest or milestone card later — and the
 * composer renders it exactly as given, chips hidden, theme picker still
 * fully live.
 *
 * The obvious-looking alternative — one bare `SharePayload` in the store,
 * rendered blindly — silently kills the chips on the session path: a
 * finished payload has nothing left to re-derive from. See
 * buildSharePayload.ts's own doc comment for what the chips actually
 * recompute.
 *
 * `fallbackMessage` on 'static' is a narrow, deliberate addition beyond the
 * two-field shape: it is NOT rendered card content (SharePayload is), it is
 * the text useShareCapture falls back to if the native share sheet is
 * unavailable or the capture throws. Stats' weekly-recap fallback references
 * summary_text / workouts_count / streak_days — none of which are part of
 * SharePayload — so without this field that user-facing failure message
 * would be silently lost the moment Stats stopped calling captureAndShare
 * itself. The session path needs no equivalent: its generic
 * "`${payload.headline}` — shared from Fitzo" fallback is unchanged from
 * before this task and stays inline in the composer.
 */
export type ComposerSource =
    | { kind: 'session'; session: LastSession }
    | { kind: 'static'; payload: SharePayload; fallbackMessage?: string };

/**
 * Same staleness discipline as lastSessionStore, but measuring a different
 * clock: THIS store's `setAt` is "how long ago was setSource() called",
 * independent of anything on the session/payload itself (a session already
 * carries its own `completedAt`, checked separately by whoever sets it — see
 * WorkoutRecapScreen). Without this, a source set on Monday and never
 * cleared could still open the composer on Wednesday if the route is ever
 * reached again — same failure mode STALE_AFTER_MS already guards against in
 * lastSessionStore, reused here rather than a second magic number.
 */
interface State {
    source: ComposerSource | null;
    setAt: number | null;
    setSource: (s: ComposerSource) => void;
    clearSource: () => void;
    isStale: () => boolean;
}

export const useShareComposerStore = create<State>((set, get) => ({
    source: null,
    setAt: null,
    setSource: (source) => set({ source, setAt: Date.now() }),
    clearSource: () => set({ source: null, setAt: null }),
    isStale: () => {
        const { source, setAt } = get();
        if (!source || setAt == null) return true;
        return Date.now() - setAt > STALE_AFTER_MS;
    },
}));
