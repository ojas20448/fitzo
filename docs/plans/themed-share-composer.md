# Themed Share Composer Implementation Plan

**Goal:** Let a user pick *which* lifts from their session to feature, and *which* theme to render them in, then share a 9:16 card — the Spotify lyric-share model applied to a workout.

**Architecture:** A zustand store carries the finished session (route params can't hold it). Pure functions normalise PRs, pick the notable moment, and map exercises to art. A theme registry renders one normalised payload into five structurally-different 9:16 layouts. A hero preview shows the active theme at legible scale while a hidden 1:1 copy is what actually gets captured.

**Tech Stack:** React Native / Expo SDK 54, TypeScript, zustand 4.4.7, react-native-view-shot 4.0.3, expo-sharing, react-native-svg, jest + jest-expo. **No new dependencies.**

## Global Constraints

- **Canvas: 9:16 only.** Every theme renders at exactly `1080 x 1920`. No 1:1, no 4:5.
- **No user identity on cards.** No name, no avatar. A small `FITZO` wordmark only.
- **No new dependencies.** Everything needed is installed.
- **Tests are pure-logic only.** `@testing-library/react-native` and `react-test-renderer` are NOT installed. Follow the existing pattern in `src/utils/__tests__/` (4 files, all pure functions). Do not add component render tests.
- **Test location:** `src/utils/__tests__/*.test.ts` — jest `testMatch` is `**/__tests__/**/*.test.ts(x)`, preset `jest-expo`.
- **Backend is untouched.** This is a frontend-only feature.
- Run from `mobile/`: `npx jest`, `npx tsc --noEmit`.
- Asset paths: from `src/utils/` and `src/components/`, dither PNGs resolve as `../../assets/<name>_dither.png`.

## Controller Rulings (binding — supersede conflicting plan text)

- **R1 — `getVolumeMilestone` labels are hardcoded, never `toLocaleString()`.** Use the existing label strings from `WorkoutShareCard`: `1M KG LIFETIME`, `500K KG LIFETIME`, `250K KG LIFETIME`, `100K KG LIFETIME`. Boundary is `vol >= t && vol < t * 1.02` (exclusive upper, matching existing code).
- **R2 — `React` namespace types must be imported explicitly** in every `.ts` (non-TSX) file: `import type { ComponentType, RefObject } from 'react'`. Never rely on a global `React` namespace in a `.ts` module.
- **R3 — `muscleVolume` is derived locally from session exercises. No network call.** Build it in the composer by reducing `session.exercises` with `ex.target?.toLowerCase()` as the key and summing `setCount`.
- **R4 — heatmap muscle keys are all lowercase.** Valid keys: `abs, arms, back, biceps, calves, chest, core, forearms, glutes, hamstrings, lats, legs, obliques, quads, shoulders, traps, triceps, 'lower back'`. Exercise `target` values are MIXED CASE in the DB (`Chest`, `Biceps` alongside `quads`), so lowercasing is mandatory. `Vol` is `Record<string, number>` and will NOT type-error on a bad key — a mismatch silently renders a blank heatmap.
- **R5 — preserve the trophy-on-PR art rule.** `ReceiptShareCard` currently selects `trophy_dither.png` when PRs exist, before any other rule. Keep that precedence in the new mapping: PRs present -> trophy, else muscle-based.
- **R7 — one task owns one file.** Task 7 must NOT modify `StatsScreen.tsx`; its `left: -4000` replacement belongs to Task 8, which already edits that file.
- **R10 — per-exercise volume/setCount use the SAME predicate as the existing session-total loop: `w > 0 && r > 0`, NOT `s.completed`.** Verified in `WorkoutLogScreen.tsx` ~605-616: the already-shipped `totalVolume`/`totalSets` loop never checks `completed`. If the store used a different rule, the per-exercise rows and the session headline on the SAME card would not agree arithmetically. Changing the session-total rule is out of scope.
- **R11 — verified types.** `ExerciseSet` = `{ id: string; weight_kg?: number|string; reps?: number|string; rir?: number|string; completed: boolean; previous?: string }`. `UserExercise` = `{ id: string; name: string; gifUrl?: string; target?: string; is_unilateral?: boolean; sets: ExerciseSet[] }`. Both in `mobile/src/components/workout/types.ts`. Note `weight_kg`/`reps` are `number | string | undefined`, so always `parseFloat(String(x || 0))`.
- **R12 — the store holds RAW per-exercise `volumeKg`; rounding happens ONCE at render, over exactly the selected set.** Storing `Math.round(vol)` per exercise makes "sum of rounded parts" diverge from "round of the sum" (verified: 135.0 + 82.5 + 87.5 rounds to 305, but the rounded parts sum to 306). A store-level allocation scheme cannot fix this, because the user selects an ARBITRARY SUBSET and no pre-allocation satisfies every subset (verified: the {82.5, 87.5} subset mismatches 170 vs 171). Therefore: per-exercise `volumeKg` is unrounded. Session-level `LastSession.volumeKg` stays `Math.round(totalVolume)` so it continues to equal the shipped `recap.volume`. **Task 7 must derive any displayed total by summing the exact `volumeKg` values it is rendering and rounding once**, never by summing pre-rounded parts.
- **R13 — the session -> ShareExercise[] mapping is a pure exported helper, not inline in the screen.** `mobile/src/utils/buildShareExercises.ts`. This project's testing constraint is pure-logic-only (no component render tests are possible), so logic left inline inside `handleFinish` is permanently untestable — which is how the R12 rounding bug reached review. Extracting it also removes an eightfold repetition of `parseFloat(String(x || 0))`.
- **R14 — `useShareCapture` guards re-entrancy with a ref, and logs the caught error.** The plan's original hook guarded on `isSharing` state read from a `useCallback` closure, which only updates after React commits the re-render — a second call arriving before that commit passes the guard, yielding two concurrent captures and two share sheets. It also used a bare `catch {}`, discarding the error. That is self-defeating: this hook's stated purpose is to make blank/half-painted captures tractable, and a swallowed error makes them untraceable while masking a real capture failure as a successful text share. Guard on `useRef`, keep `isSharing` state for UI only, and log via the repo's existing `src/utils/logger.ts`.
- **R6 — backend route paths are `backend/src/routes/`,** not `backend/routes/`.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/share/SharePayload.ts` | The single type every theme consumes. No logic. |
| `src/utils/normalizePr.ts` | Collapse the two incompatible backend PR shapes into one. |
| `src/utils/shareMoment.ts` | Pick what to pre-select and which theme to open on. Milestone helpers live here. |
| `src/utils/ditherForExercise.ts` | Map an exercise to one of the 16 bundled dither PNGs. |
| `src/stores/lastSessionStore.ts` | Carry the finished session between screens, with explicit lifecycle. |
| `src/hooks/useShareCapture.ts` | One capture+share implementation, replacing three. |
| `src/components/share/themes/*.tsx` | One file per theme. Each is a pure render of `SharePayload`. |
| `src/components/share/themes/index.ts` | Registry. Adding a theme = one file + one line. |
| `src/screens/member/ShareComposerScreen.tsx` | Chips, hero preview, theme picker, hidden capture target. |

Existing files modified: `WorkoutLogScreen.tsx` (populate store), `WorkoutRecapScreen.tsx`, `StatsScreen.tsx`, `HealthReportScreen.tsx` (use the hook).
Deleted: `ShareCard.tsx` (dead), `WorkoutShareCard.tsx` (dead — extract helpers first).

---

### Task 1: Share payload types and PR normalisation

Two backend paths emit incompatible PR shapes. `backend/src/routes/workouts.js` emits `{name, current, previous}`; `backend/src/routes/workout-sessions.js` emits `{exerciseName, newWeight, improvement}`. The card's mapper (`WorkoutRecapScreen.tsx` ~line 270) handles only the first, so **live-session PRs currently render as the literal string "PR"**. That is a live bug this task fixes.

**Files:**
- Create: `mobile/src/components/share/SharePayload.ts`
- Create: `mobile/src/utils/normalizePr.ts`
- Test: `mobile/src/utils/__tests__/normalizePr.test.ts`

**Interfaces produced:** `SharePayload`, `SharePr`, `ShareExercise`, `ShareSet`, `CARD_W`, `CARD_H`, `normalizePr(raw: unknown): SharePr | null`, `normalizePrs(raw: unknown): SharePr[]`

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/utils/__tests__/normalizePr.test.ts
import { normalizePr, normalizePrs } from '../normalizePr';

describe('normalizePr — two backend shapes, one output', () => {
    it('reads the Smart Log shape (workouts.js)', () => {
        expect(normalizePr({ name: 'Bench Press', current: '80 kg x 5', previous: '75 kg x 5' }))
            .toEqual({ exercise: 'Bench Press', current: '80 kg x 5', previous: '75 kg x 5' });
    });

    it('reads the live-session shape (workout-sessions.js)', () => {
        expect(normalizePr({ exerciseName: 'Squat', newWeight: 100, improvement: 5 }))
            .toEqual({ exercise: 'Squat', current: '100 kg', previous: '95 kg' });
    });

    it('omits previous when improvement is missing', () => {
        expect(normalizePr({ exerciseName: 'Deadlift', newWeight: 140 }))
            .toEqual({ exercise: 'Deadlift', current: '140 kg' });
    });

    it('returns null rather than a card that says "PR"', () => {
        expect(normalizePr({})).toBeNull();
        expect(normalizePr(null)).toBeNull();
        expect(normalizePr({ current: '80 kg x 5' })).toBeNull();
    });

    it('drops unusable entries from a list instead of failing the whole share', () => {
        const out = normalizePrs([
            { name: 'Bench Press', current: '80 kg x 5' },
            {},
            { exerciseName: 'Squat', newWeight: 100 },
        ]);
        expect(out).toHaveLength(2);
        expect(out.map(p => p.exercise)).toEqual(['Bench Press', 'Squat']);
    });

    it('tolerates a non-array', () => {
        expect(normalizePrs(undefined as never)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails.** `cd mobile && npx jest normalizePr` — expect FAIL, module not found.

- [ ] **Step 3: Write the types**

```ts
// mobile/src/components/share/SharePayload.ts

/** One personal record, after both backend shapes are collapsed. */
export interface SharePr {
    exercise: string;
    current: string;            // "80 kg x 5" or "100 kg"
    previous?: string;
}

export interface ShareSet {
    weight_kg?: number;
    reps?: number;
}

export interface ShareExercise {
    id: string;
    name: string;
    target?: string;            // muscle group — drives dither art selection
    volumeKg: number;
    setCount: number;
    topSet?: ShareSet;
    isPr?: boolean;
}

/** Everything a theme may render. Themes read from this and nothing else. */
export interface SharePayload {
    headline: string;           // "1,240 KG"
    caption?: string;           // "The weight of 3 auto-rickshaws"
    subtitle?: string;          // "Push - 24 Aug"
    rows: { label: string; value: string }[];
    prs: SharePr[];
    exercises: ShareExercise[];
    /** Per-muscle set counts, for the ANATOMY theme. Lowercase keys only. */
    muscleVolume?: Record<string, number>;
    date: Date;
}

/** 9:16 at story resolution. Every theme renders at exactly this size. */
export const CARD_W = 1080;
export const CARD_H = 1920;
```

- [ ] **Step 4: Write minimal implementation**

```ts
// mobile/src/utils/normalizePr.ts
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
        out.previous = `${weight - improvement} kg`;
    }
    return out;
}

export function normalizePrs(raw: unknown): SharePr[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizePr).filter((p): p is SharePr => p !== null);
}
```

- [ ] **Step 5: Run tests and typecheck.** `cd mobile && npx jest normalizePr && npx tsc --noEmit` — expect 6 passing, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/share/SharePayload.ts mobile/src/utils/normalizePr.ts mobile/src/utils/__tests__/normalizePr.test.ts
git commit -m "feat(share): normalise the two backend PR shapes"
```

---

### Task 2: Session store with explicit lifecycle

`WorkoutLogScreen.tsx` (~lines 605-627) aggregates `userExercises` into three numbers and navigates with JSON-stringified route params. **Per-exercise data is discarded there**, which is what makes "pick an exercise" impossible today. `userExercises` is in scope at the call site, as are `sessionTitle`, `workoutType`, `durationMinutes`, `totalVolume`, `totalSets`, and `result.prs`.

Route params are the wrong carrier — `expo-router` serialises them into the URL and a six-exercise session is several KB. Use a store.

**Files:**
- Create: `mobile/src/stores/lastSessionStore.ts`
- Test: `mobile/src/utils/__tests__/lastSessionStore.test.ts`
- Modify: `mobile/src/screens/member/WorkoutLogScreen.tsx`

**Interfaces:** consumes `ShareExercise`, `SharePr` (Task 1). Produces `useLastSessionStore` with `{ session, setSession(s), clearSession(), isStale() }`, `LastSession`, `STALE_AFTER_MS`.

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/utils/__tests__/lastSessionStore.test.ts
import { useLastSessionStore, STALE_AFTER_MS } from '../../stores/lastSessionStore';

const session = () => ({
    completedAt: Date.now(),
    title: 'Push', durationMin: 58, volumeKg: 12400, setCount: 24,
    exercises: [{ id: '1', name: 'Bench Press', volumeKg: 3200, setCount: 4 }],
    prs: [],
});

describe('lastSessionStore', () => {
    beforeEach(() => useLastSessionStore.getState().clearSession());

    it('holds a session', () => {
        useLastSessionStore.getState().setSession(session());
        expect(useLastSessionStore.getState().session?.title).toBe('Push');
    });

    it('clearSession empties it', () => {
        useLastSessionStore.getState().setSession(session());
        useLastSessionStore.getState().clearSession();
        expect(useLastSessionStore.getState().session).toBeNull();
    });

    it('is stale once the window has passed', () => {
        useLastSessionStore.getState().setSession({
            ...session(), completedAt: Date.now() - STALE_AFTER_MS - 1000,
        });
        expect(useLastSessionStore.getState().isStale()).toBe(true);
    });

    it('a fresh session is not stale', () => {
        useLastSessionStore.getState().setSession(session());
        expect(useLastSessionStore.getState().isStale()).toBe(false);
    });

    it('an absent session counts as stale', () => {
        expect(useLastSessionStore.getState().isStale()).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails.** `cd mobile && npx jest lastSessionStore`

- [ ] **Step 3: Write the store**

```ts
// mobile/src/stores/lastSessionStore.ts
import { create } from 'zustand';
import type { ShareExercise, SharePr } from '../components/share/SharePayload';

export interface LastSession {
    completedAt: number;
    title: string;
    durationMin: number;
    volumeKg: number;
    setCount: number;
    exercises: ShareExercise[];
    prs: SharePr[];
    streak?: number;
}

/**
 * Two hours. Long enough to leave the app and come back to share; short enough
 * that Monday's session cannot appear in the composer on Wednesday. Staleness is
 * belt-and-braces — clearSession() on the log screen is the primary guard — but
 * a crash between screens would otherwise leave the old session resident.
 */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

interface State {
    session: LastSession | null;
    setSession: (s: LastSession) => void;
    clearSession: () => void;
    isStale: () => boolean;
}

export const useLastSessionStore = create<State>((set, get) => ({
    session: null,
    setSession: (session) => set({ session }),
    clearSession: () => set({ session: null }),
    isStale: () => {
        const s = get().session;
        if (!s) return true;
        return Date.now() - s.completedAt > STALE_AFTER_MS;
    },
}));
```

- [ ] **Step 4: Run tests.** `cd mobile && npx jest lastSessionStore` — expect 5 passing.

- [ ] **Step 5: Populate the store on workout completion.** In `WorkoutLogScreen.tsx`, immediately before the existing `router.replace`, add — keeping the existing `recap` params untouched so nothing downstream breaks:

```ts
useLastSessionStore.getState().setSession({
    completedAt: Date.now(),
    title: sessionTitle || workoutType || 'Workout',
    durationMin: Math.max(durationMinutes, 1),
    volumeKg: Math.round(totalVolume),
    setCount: totalSets,
    prs: normalizePrs(result.prs),
    exercises: userExercises.map((ex) => {
        // RULING R10: counted exactly like the session-total loop above
        // (w > 0 && r > 0), NOT by `s.completed`. If these two predicates
        // disagree, the per-exercise rows on a card stop summing to the
        // headline volume on that same card.
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
            volumeKg: Math.round(vol),
            setCount: done.length,
            topSet: top ? { weight_kg: parseFloat(String(top.weight_kg || 0)), reps: parseFloat(String(top.reps || 0)) } : undefined,
        };
    }).filter((e) => e.setCount > 0),
});
```

- [ ] **Step 6: Clear the store when a new workout starts.** In `WorkoutLogScreen.tsx`, add to the mount effect:

```ts
// A previous session must not survive into a new one. This is the primary
// guard; the store's staleness window only covers a crash between screens.
useEffect(() => { useLastSessionStore.getState().clearSession(); }, []);
```

- [ ] **Step 7: Typecheck and commit.** `cd mobile && npx tsc --noEmit`

---

### Task 3: Moment detection, milestones and dither mapping

Most users don't know what is worth sharing, and "I lifted 12,400 kg" is noise. The composer should open with the notable thing already chosen.

`WorkoutShareCard.tsx` is dead code but contains the only milestone logic in the app (`getWorkoutMilestone` ~lines 27-33, `getVolumeMilestone` ~lines 36-49). **Extract before deleting in Task 8.**

12 of the 16 bundled `*_dither.png` assets are unused — the receipt picks art with a hardcoded string-sniff on the caption (`ReceiptShareCard.tsx` lines 96-107). Map on the exercise's `target` muscle instead.

**BINDING (ruling R1):** `getVolumeMilestone` returns the EXISTING hardcoded labels, not `toLocaleString()` output. `toLocaleString()` is locale-dependent and would make the test flake under a non-en locale.

**Files:**
- Create: `mobile/src/utils/shareMoment.ts`
- Create: `mobile/src/utils/ditherForExercise.ts`
- Test: `mobile/src/utils/__tests__/shareMoment.test.ts`
- Test: `mobile/src/utils/__tests__/ditherForExercise.test.ts`

**Interfaces:** consumes `LastSession` (Task 2), `ShareExercise` (Task 1). Produces `ThemeId`, `pickMoment(session)`, `getWorkoutMilestone(n)`, `getVolumeMilestone(kg)`, `ditherForExercise(ex)`, `DITHER_BY_MUSCLE`.

- [ ] **Step 1: Write the failing tests**

```ts
// mobile/src/utils/__tests__/shareMoment.test.ts
import { pickMoment, getWorkoutMilestone, getVolumeMilestone } from '../shareMoment';

const base = {
    completedAt: Date.now(), title: 'Push', durationMin: 58,
    volumeKg: 12400, setCount: 24, prs: [],
    exercises: [
        { id: 'a', name: 'Bench Press', volumeKg: 3200, setCount: 4 },
        { id: 'b', name: 'Overhead Press', volumeKg: 5100, setCount: 3 },
    ],
};

describe('pickMoment — open on the interesting thing', () => {
    it('prefers a PR over everything else', () => {
        const m = pickMoment({ ...base, prs: [{ exercise: 'Bench Press', current: '80 kg x 5' }] });
        expect(m.selection).toEqual(['pr:Bench Press']);
        expect(m.theme).toBe('scoreboard');
    });

    it('falls back to the heaviest exercise by volume, not the first', () => {
        const m = pickMoment(base);
        expect(m.selection).toEqual(['ex:b']);
        expect(m.theme).toBe('receipt');
    });

    it('falls back to session total when nothing stands out', () => {
        const m = pickMoment({ ...base, exercises: [] });
        expect(m.selection).toEqual(['total']);
        expect(m.theme).toBe('receipt');
    });

    it('picks only the first PR, so SCOREBOARD gets one number', () => {
        const m = pickMoment({ ...base, prs: [
            { exercise: 'Bench Press', current: '80 kg x 5' },
            { exercise: 'Squat', current: '120 kg x 3' },
        ]});
        expect(m.selection).toHaveLength(1);
    });
});

describe('milestones', () => {
    it('names round workout counts', () => {
        expect(getWorkoutMilestone(100)).toBe('100TH WORKOUT');
        expect(getWorkoutMilestone(50)).toBe('50TH WORKOUT');
    });

    it('is silent on unremarkable counts', () => {
        expect(getWorkoutMilestone(63)).toBeNull();
    });

    it('fires a volume milestone only near the crossing', () => {
        expect(getVolumeMilestone(101_000)).toBe('100K KG LIFETIME');
        expect(getVolumeMilestone(180_000)).toBeNull();
    });

    it('uses locale-independent labels', () => {
        expect(getVolumeMilestone(1_005_000)).toBe('1M KG LIFETIME');
    });
});
```

```ts
// mobile/src/utils/__tests__/ditherForExercise.test.ts
import { ditherForExercise, DITHER_BY_MUSCLE } from '../ditherForExercise';

describe('ditherForExercise', () => {
    it('matches on the target muscle', () => {
        expect(ditherForExercise({ id: '1', name: 'Bench Press', target: 'chest', volumeKg: 0, setCount: 0 }))
            .toBe(DITHER_BY_MUSCLE.chest);
    });

    it('falls back to the exercise name when target is absent', () => {
        expect(ditherForExercise({ id: '1', name: 'Kettlebell Swing', volumeKg: 0, setCount: 0 }))
            .toBe(DITHER_BY_MUSCLE.kettlebell);
    });

    it('always returns something rather than a blank slot', () => {
        expect(ditherForExercise({ id: '1', name: 'Zzz', volumeKg: 0, setCount: 0 })).toBeTruthy();
    });

    it('is case insensitive', () => {
        expect(ditherForExercise({ id: '1', name: 'X', target: 'CHEST', volumeKg: 0, setCount: 0 }))
            .toBe(DITHER_BY_MUSCLE.chest);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail.** `cd mobile && npx jest shareMoment ditherForExercise`

- [ ] **Step 3: Implement `shareMoment.ts`**

```ts
// mobile/src/utils/shareMoment.ts
import type { LastSession } from '../stores/lastSessionStore';

export type ThemeId = 'receipt' | 'spec' | 'scoreboard' | 'anatomy' | 'chalk';

/** Extracted from the dead WorkoutShareCard before deletion. */
const WORKOUT_MILESTONES = [500, 365, 200, 100, 50, 25, 10];
export function getWorkoutMilestone(count: number): string | null {
    return WORKOUT_MILESTONES.includes(count) ? `${count}TH WORKOUT` : null;
}

/**
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
 *   'total' | 'ex:<exerciseId>' | 'pr:<exerciseName>' | 'muscles'
 *
 * Exactly one item is pre-selected. SCOREBOARD renders a single figure at full
 * frame, so handing it two PRs would have nothing sensible to draw.
 */
export function pickMoment(session: LastSession): { selection: string[]; theme: ThemeId } {
    if (session.prs.length > 0) {
        return { selection: [`pr:${session.prs[0].exercise}`], theme: 'scoreboard' };
    }
    if (session.exercises.length > 0) {
        const heaviest = session.exercises.reduce((a, b) => (b.volumeKg > a.volumeKg ? b : a));
        return { selection: [`ex:${heaviest.id}`], theme: 'receipt' };
    }
    return { selection: ['total'], theme: 'receipt' };
}
```

- [ ] **Step 4: Implement `ditherForExercise.ts`**

```ts
// mobile/src/utils/ditherForExercise.ts
import type { ShareExercise } from '../components/share/SharePayload';

/**
 * 12 of the 16 bundled dither assets were unused, while the receipt picked art
 * by sniffing substrings out of the caption text. Mapping on the exercise's
 * target muscle makes the card feel specific to what was actually trained, at
 * no size cost — the PNGs already ship in the bundle.
 */
export const DITHER_BY_MUSCLE = {
    chest: require('../../assets/barbell_dither.png'),
    back: require('../../assets/dumbbell_dither.png'),
    shoulders: require('../../assets/kettlebell_dither.png'),
    arms: require('../../assets/dumbbell_dither.png'),
    legs: require('../../assets/treadmill_dither.png'),
    core: require('../../assets/yoga_mat_dither.png'),
    cardio: require('../../assets/running_shoe_dither.png'),
    kettlebell: require('../../assets/kettlebell_dither.png'),
    bike: require('../../assets/bicycle_dither.png'),
    trophy: require('../../assets/trophy_dither.png'),
    default: require('../../assets/barbell_dither.png'),
} as const;

const NAME_HINTS: [RegExp, keyof typeof DITHER_BY_MUSCLE][] = [
    [/kettlebell/i, 'kettlebell'],
    [/bike|cycl|spin/i, 'bike'],
    [/run|treadmill|jog/i, 'cardio'],
    [/squat|leg|lunge|calf/i, 'legs'],
    [/bench|chest|fly|press/i, 'chest'],
    [/row|pull|deadlift|lat/i, 'back'],
    [/curl|tricep|bicep/i, 'arms'],
    [/plank|crunch|ab/i, 'core'],
];

export function ditherForExercise(ex: ShareExercise) {
    const target = ex.target?.toLowerCase();
    if (target && target in DITHER_BY_MUSCLE) {
        return DITHER_BY_MUSCLE[target as keyof typeof DITHER_BY_MUSCLE];
    }
    for (const [re, key] of NAME_HINTS) {
        if (re.test(ex.name)) return DITHER_BY_MUSCLE[key];
    }
    return DITHER_BY_MUSCLE.default;
}
```

- [ ] **Step 5: Run tests and typecheck.** `cd mobile && npx jest shareMoment ditherForExercise && npx tsc --noEmit` — expect 12 passing across the two files (8 in shareMoment, 4 in ditherForExercise).

- [ ] **Step 6: Commit.**

---

### Task 4: Capture hook — the Android-safe path

Three duplicated capture implementations exist: `WorkoutRecapScreen.tsx` ~line 152 and `StatsScreen.tsx` ~line 158 (both `captureRef`), `HealthReportScreen.tsx` ~line 206 (`viewShotRef.current.capture()`). Only `StatsScreen` has a text fallback.

**This task carries the highest technical risk in the plan.** Off-screen capture in RN is fragile, and the failure mode is a blank or half-painted PNG that looks like a capture bug rather than a layout one.

**BINDING (ruling R2):** this is a `.ts` file. Import `RefObject` as a type from `react` — do NOT reference a global `React` namespace.

**Files:** Create `mobile/src/hooks/useShareCapture.ts`
**Interfaces produced:** `useShareCapture()` returning `{ captureAndShare(ref, opts), isSharing }`

- [ ] **Step 1: Write the hook**

```ts
// mobile/src/hooks/useShareCapture.ts
import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { logger } from '../utils/logger';

/**
 * One capture+share path, replacing three near-duplicates.
 *
 * Why the delay: react-native-svg and custom fonts can take an extra frame to
 * paint. Capturing immediately yields a card with the heatmap or the VT323 text
 * missing — which reads as a capture bug and is very hard to trace. Waiting two
 * frames plus a short settle is cheap insurance against a broken share.
 */
const PAINT_SETTLE_MS = 180;

export function useShareCapture() {
    const [isSharing, setIsSharing] = useState(false);
    const isSharingRef = useRef(false);

    const captureAndShare = useCallback(async (
        ref: RefObject<any>,
        opts?: { dialogTitle?: string; fallbackMessage?: string },
    ) => {
        // RULING R14: the re-entrancy guard reads a ref, not state. `isSharing`
        // state is only committed on the next render, so a second call landing
        // before that commit would close over `false` and sail past the guard.
        if (!ref.current || isSharingRef.current) return;
        isSharingRef.current = true;
        setIsSharing(true);
        try {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise((r) => setTimeout(r, PAINT_SETTLE_MS));

            const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: opts?.dialogTitle ?? 'Share',
                    UTI: 'public.png',
                });
                return;
            }
            throw new Error('sharing unavailable');
        } catch (err) {
            // RULING R14: never swallow this. A blank or half-painted capture is
            // the exact failure this hook exists to prevent, and without the
            // error a developer has nothing to go on. logger.error is the
            // established pattern in this repo (src/utils/logger.ts).
            logger.error('[useShareCapture] capture or share failed', err);
            // Sharing is unavailable on some Android builds and on web. Text is
            // a worse share but a better outcome than a dead button.
            if (opts?.fallbackMessage) {
                await Share.share({ message: opts.fallbackMessage }).catch(() => {});
            }
        } finally {
            isSharingRef.current = false;
            setIsSharing(false);
        }
    }, []);

    return { captureAndShare, isSharing };
}
```

- [ ] **Step 2: Typecheck.** `cd mobile && npx tsc --noEmit` — 0 errors.
- [ ] **Step 3: Commit.**

---

### Task 5: Theme registry and the first two themes

Themes must differ in **structure**, not palette. Two recoloured cards read as one template, which is what makes most theme pickers feel cheap.

`ReceiptShareCard` currently auto-heights (`CARD_W = Math.min(SW - 48, 360)` at line 15, no height) and uses hardcoded hex rather than theme tokens. Its palette is deliberate — cream paper is the point — so keep the colours and give it a fixed 9:16 frame.

**BINDING (ruling R2):** `index.ts` is a `.ts` file — import `ComponentType` as a type from `react`, do not reference a global `React` namespace.
**BINDING (ruling R5):** preserve trophy-on-PR art precedence.

**Files:**
- Create: `mobile/src/components/share/themes/index.ts`
- Create: `mobile/src/components/share/themes/Receipt.tsx`
- Create: `mobile/src/components/share/themes/Spec.tsx`

- [ ] **Step 1: Write the registry**

```ts
// mobile/src/components/share/themes/index.ts
import type { ComponentType } from 'react';
import type { ThemeId } from '../../../utils/shareMoment';
import type { SharePayload } from '../SharePayload';
import Receipt from './Receipt';
import Spec from './Spec';

export interface ShareTheme {
    id: ThemeId;
    label: string;
    /** True when the theme renders a single figure and cannot show a list. */
    singleSelectOnly?: boolean;
    Component: ComponentType<{ payload: SharePayload }>;
}

/**
 * Partial until Task 6 registers the remaining three. Typed as Partial so the
 * gap is visible to the compiler rather than hidden behind a cast.
 */
export const THEMES: Partial<Record<ThemeId, ShareTheme>> = {
    receipt: { id: 'receipt', label: 'Receipt', Component: Receipt },
    spec:    { id: 'spec',    label: 'Spec',    Component: Spec },
};

export const THEME_ORDER: ThemeId[] = ['receipt', 'spec', 'scoreboard', 'anatomy', 'chalk'];
```

- [ ] **Step 2: Build `Receipt.tsx`.** Port `ReceiptShareCard`'s visual language — cream `#F1EEE6` paper, ink `#141414`, black inverted bars, `VT323_400Regular` (bundled TTF, registered in `app/_layout.tsx`), the `DashedLine` and `InkCircle` SVG helpers, the `-0.6deg` paper rotation — into a fixed `CARD_W x CARD_H` frame. Keep `weightEquivalence` (exported from `ReceiptShareCard.tsx` line 29). Replace the hardcoded caption sniff with: PRs present -> `DITHER_BY_MUSCLE.trophy`, else `ditherForExercise(payload.exercises[0])`. Add a small `FITZO` wordmark at the foot; no user identity.

- [ ] **Step 3: Build `Spec.tsx`.** Pure black ground, Lexend, hairline `rgba(255,255,255,.12)` rules, letterspaced uppercase labels. Structure: eyebrow, hero figure, then one rule-separated row per selected exercise (`name` left, `topSet` and `volumeKg` right). This is the theme that handles a multi-exercise selection well.

- [ ] **Step 4: Typecheck and commit.**

---

### Task 6: Scoreboard, Anatomy and Chalk

**BINDING (ruling R4):** `AnatomyHeatmap` takes `volume: Record<string, number>` keyed by LOWERCASE muscle names. Valid keys: `abs, arms, back, biceps, calves, chest, core, forearms, glutes, hamstrings, lats, legs, obliques, quads, shoulders, traps, triceps, 'lower back'`. The type will not catch a bad key — a mismatch renders a silently blank figure. Verify against this list.

**Files:**
- Create: `mobile/src/components/share/themes/{Scoreboard,Anatomy,Chalk}.tsx`
- Modify: `mobile/src/components/share/themes/index.ts`

- [ ] **Step 1: `Scoreboard.tsx`** — one figure at ~320px filling the frame, everything else at 11px. Register with `singleSelectOnly: true`.
- [ ] **Step 2: `Anatomy.tsx`** — reuse the existing `AnatomyHeatmap` SVG component (`src/components/AnatomyHeatmap.tsx`, default export, props `{ volume, bodyWidth, bodyHeight, onMusclePress? }`) as the hero, fed from `payload.muscleVolume`. If `muscleVolume` is absent or all-zero, render the theme's non-heatmap content rather than an empty figure.
- [ ] **Step 3: `Chalk.tsx`** — dark slate ground, `VT323_400Regular`, the existing `InkCircle` SVG for emphasis.
- [ ] **Step 4: Register all three.** Change `THEMES` from `Partial<Record<ThemeId, ShareTheme>>` to `Record<ThemeId, ShareTheme>` now that all five exist. Typecheck and commit.

---

### Task 7: The composer screen

**Files:**
- Create: `mobile/src/screens/member/ShareComposerScreen.tsx`
- Create: `mobile/app/member/share.tsx` (route re-export, mirroring `app/member/workout-recap.tsx`)
- Modify: `mobile/app/_layout.tsx` (register the route alongside `member/workout-recap`)

Layout, top to bottom: content chips -> **hero preview** -> theme picker -> Share button.

- [ ] **Step 1: Hero preview, not a scaled-down carousel.** Render the active theme once at `transform: [{ scale: heroScale }]` where `heroScale = availableWidth / CARD_W`. The user must be able to read the exercise name and figure to confirm the card is right — a row of 0.4-scale cards is illegible, so the theme picker below is **labels only** (`Receipt / Spec / Scoreboard / Anatomy / Chalk`), not live previews.

- [ ] **Step 2: The hidden 1:1 capture target — the fragile part.** Render a second, unscaled copy at full `1080 x 1920` as the capture ref.

```tsx
{/*
  * Hidden capture target at true 1080x1920. The scaled hero above is for
  * reading; capturing it would export at preview resolution.
  *
  * Do NOT use opacity:0 — Android skips rendering it entirely and captureRef
  * returns a blank image. Do NOT use display:'none' — the tree never lays out.
  * Sitting it behind an opaque background at negative z keeps it painted and
  * capturable while invisible.
  */}
<View style={styles.captureHost} pointerEvents="none">
    <ViewShot ref={cardRef} style={{ width: CARD_W, height: CARD_H }}>
        <ActiveTheme payload={payload} />
    </ViewShot>
</View>
```

```ts
captureHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: -1,
    elevation: -1,        // Android draws by elevation, not zIndex
},
screenBody: {
    backgroundColor: colors.background,   // opaque, covers the host
    zIndex: 1,
    elevation: 1,
},
```

**Do NOT touch `StatsScreen.tsx` in this task (ruling R7).** Its `left: -4000` off-screen render is replaced with this same pattern in Task 8, which already modifies that file — one task owns one file.

- [ ] **Step 3: Enforce single-select for Scoreboard.**

```ts
const onSelectTheme = (id: ThemeId) => {
    if (THEMES[id].singleSelectOnly && selection.length > 1) setSelection([selection[0]]);
    setTheme(id);
};
const onToggleChip = (id: string) => {
    const next = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
    if (next.length === 0) return;                                  // never empty
    if (next.length > 1 && THEMES[theme].singleSelectOnly) setTheme('spec');
    setSelection(next);
};
```

- [ ] **Step 4: Open on the detected moment, and derive muscleVolume locally (ruling R3).**

```ts
const session = useLastSessionStore((s) => s.session);
const isStale = useLastSessionStore((s) => s.isStale);
useEffect(() => {
    if (!session || isStale()) { router.back(); return; }
    const m = pickMoment(session);
    setSelection(m.selection);
    setTheme(m.theme);
}, []);

// Derived, not fetched: the store already carries target + setCount per
// exercise, so a this-session heatmap costs zero network. Lowercase is
// mandatory — DB targets are mixed case, heatmap keys are lowercase.
const muscleVolume = useMemo(() => (session?.exercises ?? []).reduce((acc, ex) => {
    const target = ex.target?.toLowerCase();
    if (target) acc[target] = (acc[target] || 0) + ex.setCount;
    return acc;
}, {} as Record<string, number>), [session]);
```

- [ ] **Step 5: Typecheck and commit.**

---

### Task 8: Wire entry points, retire dead code

**Files:**
- Modify: `WorkoutRecapScreen.tsx`, `StatsScreen.tsx`, `HealthReportScreen.tsx`
- Delete: `mobile/src/components/ShareCard.tsx`, `mobile/src/components/WorkoutShareCard.tsx`

- [ ] **Step 1:** Point the recap "SHARE TO STORY" button at the composer. Keep the existing photo-composite flow as-is — it is a separate, working feature.
- [ ] **Step 2:** Route the Stats weekly share through the composer, and swap its capture to `useShareCapture`. **Also (ruling R7)** replace `StatsScreen.tsx` line 464's `left: -4000` off-screen render with the Task 7 `captureHost` pattern (`position:'absolute', top:0, left:0, zIndex:-1, elevation:-1`, behind an opaque body). That offset produces blank captures on Android for large trees.
- [ ] **Step 3:** Swap `HealthReportScreen.tsx` ~line 206 (`viewShotRef.current.capture()`) to `useShareCapture`. Note it passes a ViewShot component ref, which `captureRef` also accepts.
- [ ] **Step 4: Delete the dead components.** `ShareCard.tsx` has zero imports (verified). `WorkoutShareCard.tsx` is imported at `WorkoutRecapScreen.tsx` line 14 but never rendered — confirm the milestone helpers were extracted in Task 3, then remove the import and delete both files.
- [ ] **Step 5: Full verification and commit.** `cd mobile && npx tsc --noEmit && npx jest`. Stage explicitly scoped paths only — the repo has many untracked files outside `mobile/`, so never use a bare `git add -A`.

---

## Verification

1. `cd mobile && npx tsc --noEmit` -> 0 errors
2. `cd mobile && npx jest` -> the 4 existing util suites plus the 4 added here, all passing
3. `cd backend && npx jest` -> 349 passing (backend untouched; regression check)
4. **Visual, on the web build:** `cd mobile && EXPO_PUBLIC_API_URL=https://fitzo.onrender.com/api npx expo start --web --port 8100`. Screenshot all five themes at 440x956 via Playwright. Check: no overflow on a long exercise name, the heatmap renders in Anatomy, the `FITZO` wordmark is present on every theme, no user name anywhere. NOTE: `react-native-view-shot` does not work on web, so this verifies LAYOUT only, never capture.
5. **On a physical device** — capture must be verified on a phone: exported PNG is exactly 1080x1920; Anatomy and Chalk specifically show heatmap SVG and VT323 text, not blank; the share sheet opens and WhatsApp Status accepts the image without cropping.
6. **Lifecycle check:** finish a workout, share, background the app, start a *new* workout — the composer must not offer the previous session's exercises.
7. **Edge cases:** a one-exercise session with no PR still produces a card that does not look broken; deselecting the last chip is refused rather than producing an empty card.

## Out of Scope

1:1 and 4:5 canvases; rep/1RM/volume PR detection (backend); per-set PR markers during a workout; a custom colour picker. Two pre-existing bugs found but NOT fixed here: live-session PR detection does not filter `is_warmup` (`backend/src/routes/workout-sessions.js`), so a heavy warm-up registers a false PR; and the recap photo-composite captures the whole screen rather than the card.
