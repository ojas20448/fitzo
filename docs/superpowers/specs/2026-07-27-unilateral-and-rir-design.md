# Unilateral Sets and Optional RIR — Design

**Date:** 2026-07-27
**Status:** Approved

## Problem

Two gaps in workout logging:

1. **Unilateral work is under-counted.** Single-arm rows, Bulgarian split squats, and single-leg presses are logged as if they were bilateral. A member who does 10 reps per arm at 20kg has their volume recorded as 200kg when the real training volume is 400kg. Volume feeds weekly totals, the anatomy heatmap, and PR detection — so every one of those is wrong for anyone who trains unilaterally.

2. **RIR has no way in.** `ExerciseSet` already declares `rir?: number | string` (`mobile/src/components/workout/types.ts:9`) and three call sites initialise it to `''`, but no UI ever sets it. The field is a stub. Meanwhile RIR is how most lifters actually gauge intensity.

Neither should be forced on people who don't want them. Unilateral is off unless flagged; RIR is opt-in.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Unilateral rep semantics | Reps entered are **per side**; volume doubles | Matches how lifters speak ("10 each arm") and how Strong/Hevy behave |
| Flag scope | **Per logged exercise**, default off | Same movement can be done either way; no catalog migration needed |
| RIR storage | **New `rir` column**, stores what the user typed | No inversion logic anywhere; leaves `rpe` free for a future RPE mode |
| RIR scale | **0–5** | Standard. Values outside are rejected. |
| First run | **One-time sheet with the RIR switch inline** | One screen, one decision; also changeable in Settings |
| Pill wording | **`1 SIDE`** | Readable at a glance in a set row; "unilateral" is jargon |

## Architecture

### Data model — migration `008_unilateral_and_rir.sql`

Four additive, idempotent columns. Existing rows default to `false`/`NULL`, so **no historical volume changes**.

```sql
ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS is_unilateral BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS rir INTEGER;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS log_rir_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workout_prefs_seen BOOLEAN NOT NULL DEFAULT false;
```

`is_unilateral` lives on `exercise_logs`, not `set_logs` — the flag describes the exercise as performed, and putting it per-set would allow incoherent states (set 1 unilateral, set 2 not).

### Volume — one rule, one definition

This is the part that can corrupt existing stats, and it carries a lesson from the crowd-intelligence work: that plan expressed one rule as a JS constant *and* two hand-synced SQL literals, and the final review flagged the drift risk. This design does not repeat that.

**Verified against the codebase:**
- Volume is computed in exactly **four** places, all in `backend/src/routes/progress.js`: lines 38, 70, 71, 114.
- There is **no JS-side volume math** anywhere — not in `backend/src/services/`, not in mobile.
- All three query blocks **already** `JOIN exercise_logs el` (lines 42, 74, 118), so no new joins are required.

Create `backend/src/utils/volume.js` as the single source:

```js
/** Unilateral sets are entered per side, so both sides count toward volume. */
const UNILATERAL_MULTIPLIER = 2;

/** SQL fragment. Requires `exercise_logs` aliased as `el` and `set_logs` as `sl`. */
const VOLUME_SQL = `(sl.weight_kg * sl.reps * CASE WHEN el.is_unilateral THEN ${UNILATERAL_MULTIPLIER} ELSE 1 END)`;

/** JS equivalent, for any non-SQL computation. Kept in step with VOLUME_SQL. */
function setVolume(weightKg, reps, isUnilateral) {
    const w = Number(weightKg);
    const r = Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return 0;
    return w * r * (isUnilateral ? UNILATERAL_MULTIPLIER : 1);
}
```

All four `progress.js` sites use `VOLUME_SQL`. If the rule ever changes, it changes in one place.

**Knock-on effect:** `max_volume_single_set` and `best_volume_set` are PR metrics. A unilateral PR will now correctly outrank an equivalent bilateral set. This is the intended correction, not a regression.

### API

**Path prefixes verified against `backend/src/index.js`.** `routes/workout-sessions.js` mounts at `/api/workout-sessions` (line 131), *not* `/api/workouts` (line 126, a different router). Mobile already calls `/workout-sessions/sessions/...` (`api.ts:557`). Getting this wrong would produce endpoints nothing can reach.

| Endpoint | Change |
|---|---|
| `POST /api/workout-sessions/sessions/:sessionId/exercises` | Accepts `is_unilateral` (boolean, default false) |
| `PATCH /api/workout-sessions/exercises/:exerciseLogId` | **New.** Toggles `is_unilateral` on an existing logged exercise |
| `POST /api/workout-sessions/exercises/:exerciseLogId/sets` | Accepts `rir` (0–5, nullable) |
| `PUT /api/workout-sessions/sets/:id` | Accepts `rir` (0–5, nullable) |
| `GET /api/settings/workout` | **New.** Returns `log_rir_enabled`, `workout_prefs_seen` |
| `PATCH /api/settings/workout` | **New.** Updates either field |

The settings pair follows the existing `GET`/`PATCH /api/settings/sharing` pattern exactly (direct columns on `users`, not a JSONB blob).

RIR validation is a pure function so it can be unit tested without a database: reject non-integers, anything outside 0–5, and pass `null`/`undefined` through as "not recorded".

### Mobile

**`ExerciseCard.tsx`** (306 lines) — a small pill in the exercise header, off by default. Reads `1 SIDE` when active. Tapping it calls the new `PATCH` and updates local state optimistically.

**Set row** — an RIR cell rendered only when `log_rir_enabled`. Reuses the existing `ScrollWheelPicker` with a 0–5 range, matching how weight and reps already work.

**`WorkoutPrefsSheet.tsx`** (new) — shown once on Log Workout open when `workout_prefs_seen` is false. One sentence each on unilateral and RIR, the RIR switch inline, and a dismiss that writes `workout_prefs_seen: true`.

**`SettingsScreen.tsx`** — a "Log RIR" switch alongside the existing rows, so it stays changeable.

## Error handling

- RIR outside 0–5 → `ValidationError` (400), naming the field.
- The `PATCH` to toggle unilateral is scoped to the caller's own session; another user's `exerciseLogId` returns 403.
- Preference writes that fail must not break logging — the settings call is independent of the set-write path.
- The first-run sheet failing to persist `workout_prefs_seen` shows the sheet again next time. Annoying, not harmful; no retry logic.

## Testing

`setVolume` and the RIR validator are pure and get real unit tests.

**Fixtures must not be the benign case.** Two bugs in the previous session's food work hid behind `fat: 5` — the one value where every multiplier happened to land on a whole number, so a green suite proved nothing. Here that means explicitly covering:

- `setVolume` with `isUnilateral` true and false at the same weight/reps, asserting the exact 2× relationship
- zero reps and zero weight (must be 0, not `NaN`)
- decimal weights (`weight_kg` is `DECIMAL(6,2)`, so 2.5kg increments are real)
- RIR at both boundaries: 0 and 5 accepted, −1 and 6 rejected
- RIR `null`/`undefined` accepted as "not recorded", distinct from 0 which means "went to failure"

That last one matters: RIR 0 and "no RIR" are different states and must not collapse.

## Out of scope

- Marking exercises unilateral in the 164-exercise catalog. Per-instance only.
- An RPE mode. The `rpe` column stays untouched.
- Retroactively flagging historical exercise logs.
- Per-side different weights (e.g. 20kg left, 22kg right).
