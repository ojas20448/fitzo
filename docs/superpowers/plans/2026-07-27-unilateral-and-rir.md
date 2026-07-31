# Unilateral Sets and Optional RIR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let members mark an exercise as done one side at a time (so its volume counts both sides), optionally record RIR, and learn about both the first time they open Log Workout.

**Architecture:** One additive migration. The volume rule lives in exactly one module — a SQL fragment for the four `progress.js` queries and a matching JS function for the mobile recap — because those five sites must never disagree. The unilateral flag rides in the existing `exercises` JSON blob that `POST /api/workouts` already receives, so no new endpoint is needed for it.

**Tech Stack:** Node 20, Express 4, PostgreSQL (Supabase), Jest, Expo/React Native 0.81, TypeScript.

## Global Constraints

- **The Log Workout screen posts to `/api/workouts` (`routes/workouts.js`), NOT `/api/workout-sessions`.** `workoutsAPI.log()` at `mobile/src/services/api.ts:551` → `WorkoutLogScreen.tsx:507`. `routes/workout-sessions.js` serves a different, active-session flow and is **out of scope**. Targeting it would produce code nothing calls — this exact mistake was made once already in this codebase (`food_name` vs `meal_name`) and once in this plan's own spec.
- **`POST /api/workouts` receives `exercises` as a JSON string** of `UserExercise[]`. `workouts.js` parses it, writes one `exercise_logs` row per exercise (~line 91) and one `set_logs` row per set (~line 123).
- **RIR already flows client→server.** `workouts.js:121-122` reads `sets[s].rir` and writes `rpe = clamp(10 - rir, 1, 10)`. Keep that conversion working; add the `rir` column alongside it. Do not remove the `rpe` write.
- **Unilateral reps are entered PER SIDE.** Volume for a unilateral set is `weight × reps × 2`. This is the whole point of the feature; getting it backwards silently halves or doubles every affected stat.
- **RIR scale is 0–5 inclusive.** Values outside are rejected. `null`/`undefined` means "not recorded" and is a DIFFERENT state from `0`, which means "went to failure". Never collapse them.
- **Migrations** are numbered `.sql` files in `backend/data/migrations/`, applied with `node apply_migration.js data/migrations/<file>.sql`, and must be idempotent (`IF NOT EXISTS`).
- **User preferences are direct columns on `users`**, exposed via `GET`/`PATCH /api/settings/<topic>`. Copy the shape of `GET`/`PATCH /api/settings/sharing` (`backend/src/routes/settings.js:111-166`) exactly.
- **Mobile styling uses tokens only** from `mobile/src/styles/theme.ts`. `typography.caption`, `typography.body`, and `colors.text.tertiary` **do not exist** — use `typography.sizes.*` + `typography.fontFamily.*` and `colors.text.muted`.
- **The toast API takes TWO arguments**: `toast.error(title, message)`.
- CommonJS backend, 4-space indent, JSDoc on exported functions. Mobile is TypeScript, 4-space indent.
- **Another session commits to this repo concurrently.** Stage paths explicitly; never `git add -A`.

---

### Task 1: Volume rule (pure module)

The single definition of "what a set is worth", used by both SQL and JS.

**Files:**
- Create: `backend/src/utils/volume.js`
- Test: `backend/src/__tests__/volume.test.js`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `UNILATERAL_MULTIPLIER` (number, `2`)
  - `setVolume(weightKg, reps, isUnilateral)` → number
  - `VOLUME_SQL` (string) — a SQL expression requiring `set_logs` aliased `sl` and `exercise_logs` aliased `el`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/volume.test.js`:

```js
/**
 * Volume Tests
 *
 * A unilateral set is entered PER SIDE, so both sides count. Getting this
 * backwards silently halves or doubles weekly volume, the anatomy heatmap,
 * and PR detection.
 */

const { setVolume, VOLUME_SQL, UNILATERAL_MULTIPLIER } = require('../utils/volume');

describe('setVolume', () => {
    it('is weight times reps for a bilateral set', () => {
        expect(setVolume(20, 10, false)).toBe(200);
    });

    it('doubles for a unilateral set at the same weight and reps', () => {
        expect(setVolume(20, 10, true)).toBe(400);
        expect(setVolume(20, 10, true)).toBe(setVolume(20, 10, false) * UNILATERAL_MULTIPLIER);
    });

    it('handles decimal weights — 2.5kg is the standard plate jump', () => {
        expect(setVolume(2.5, 8, false)).toBe(20);
        expect(setVolume(22.5, 6, true)).toBe(270);
    });

    it('returns 0 for zero reps or zero weight, never NaN', () => {
        expect(setVolume(20, 0, false)).toBe(0);
        expect(setVolume(0, 10, false)).toBe(0);
        expect(setVolume(0, 0, true)).toBe(0);
    });

    it('returns 0 for junk input instead of NaN', () => {
        expect(setVolume(null, 10, false)).toBe(0);
        expect(setVolume(undefined, undefined, false)).toBe(0);
        expect(setVolume('abc', 10, false)).toBe(0);
        expect(setVolume(-5, 10, false)).toBe(0);
    });

    it('accepts numeric strings — set values arrive as strings from the picker', () => {
        expect(setVolume('20', '10', false)).toBe(200);
        expect(setVolume('20', '10', true)).toBe(400);
    });

    it('treats any truthy unilateral flag consistently', () => {
        expect(setVolume(20, 10, undefined)).toBe(200);
        expect(setVolume(20, 10, null)).toBe(200);
    });
});

describe('VOLUME_SQL', () => {
    it('references the aliases its consumers use', () => {
        expect(VOLUME_SQL).toContain('sl.weight_kg');
        expect(VOLUME_SQL).toContain('sl.reps');
        expect(VOLUME_SQL).toContain('el.is_unilateral');
    });

    it('embeds the same multiplier the JS helper uses', () => {
        expect(VOLUME_SQL).toContain(String(UNILATERAL_MULTIPLIER));
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest volume --verbose`
Expected: FAIL — `Cannot find module '../utils/volume'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/utils/volume.js`:

```js
/**
 * Training Volume
 *
 * ONE definition of what a set is worth, because five places need it:
 * four SQL queries in routes/progress.js and one JS sum in the mobile
 * post-workout recap. When those disagree, the recap and the stats screen
 * report different numbers for the same session.
 *
 * A unilateral set is entered PER SIDE — "10 reps" means 10 on each — so
 * both sides count toward volume.
 */

const UNILATERAL_MULTIPLIER = 2;

/**
 * Volume of a single set, in kg-reps.
 * @param {number|string} weightKg
 * @param {number|string} reps
 * @param {boolean} isUnilateral
 * @returns {number} 0 for missing, zero, negative, or unparseable input
 */
function setVolume(weightKg, reps, isUnilateral) {
    const w = Number(weightKg);
    const r = Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return 0;
    return w * r * (isUnilateral ? UNILATERAL_MULTIPLIER : 1);
}

/**
 * The same rule as a SQL expression.
 * Requires `set_logs` aliased as `sl` and `exercise_logs` aliased as `el`.
 * Every query in routes/progress.js must use this rather than inlining the
 * arithmetic — that is what keeps the five sites in step.
 */
const VOLUME_SQL =
    `(sl.weight_kg * sl.reps * CASE WHEN el.is_unilateral THEN ${UNILATERAL_MULTIPLIER} ELSE 1 END)`;

module.exports = { setVolume, VOLUME_SQL, UNILATERAL_MULTIPLIER };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest volume --verbose`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/volume.js backend/src/__tests__/volume.test.js
git commit -m "feat(workout): add single-source volume rule for unilateral sets

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: RIR validation (pure function)

**Files:**
- Create: `backend/src/utils/rir.js`
- Test: `backend/src/__tests__/rir.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `RIR_MIN` (0), `RIR_MAX` (5)
  - `parseRir(value)` → `{ valid: boolean, rir: number|null, error: string|null }`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/rir.test.js`:

```js
/**
 * RIR Tests
 *
 * Reps In Reserve, 0-5. RIR 0 means "went to failure"; null means "not
 * recorded". Collapsing those two would mark every unrecorded set as a
 * failure set, which would wreck any intensity analysis built on it.
 */

const { parseRir, RIR_MIN, RIR_MAX } = require('../utils/rir');

describe('parseRir', () => {
    it('accepts every value in range', () => {
        for (let v = RIR_MIN; v <= RIR_MAX; v++) {
            expect(parseRir(v)).toMatchObject({ valid: true, rir: v });
        }
    });

    it('keeps 0 distinct from not-recorded', () => {
        expect(parseRir(0)).toMatchObject({ valid: true, rir: 0 });
        expect(parseRir(null)).toMatchObject({ valid: true, rir: null });
        expect(parseRir(undefined)).toMatchObject({ valid: true, rir: null });
        expect(parseRir('')).toMatchObject({ valid: true, rir: null });
    });

    it('accepts numeric strings — the picker yields strings', () => {
        expect(parseRir('3')).toMatchObject({ valid: true, rir: 3 });
    });

    it('rejects values outside the scale', () => {
        expect(parseRir(-1).valid).toBe(false);
        expect(parseRir(6).valid).toBe(false);
        expect(parseRir(10).valid).toBe(false);
    });

    it('rejects non-integers and junk', () => {
        expect(parseRir(2.5).valid).toBe(false);
        expect(parseRir('abc').valid).toBe(false);
        expect(parseRir({}).valid).toBe(false);
    });

    it('names the field in its error so the client can show it', () => {
        expect(parseRir(9).error).toMatch(/RIR/i);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest rir --verbose`
Expected: FAIL — `Cannot find module '../utils/rir'`

- [ ] **Step 3: Implement**

Create `backend/src/utils/rir.js`:

```js
/**
 * RIR (Reps In Reserve) parsing and validation.
 *
 * Scale is 0-5. RIR 0 = went to failure. null = not recorded. These are
 * DIFFERENT states and must never be collapsed into each other.
 */

const RIR_MIN = 0;
const RIR_MAX = 5;

/**
 * @param {*} value raw input from the client
 * @returns {{valid: boolean, rir: number|null, error: string|null}}
 */
function parseRir(value) {
    if (value === null || value === undefined || value === '') {
        return { valid: true, rir: null, error: null };
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < RIR_MIN || n > RIR_MAX) {
        return {
            valid: false,
            rir: null,
            error: `RIR must be a whole number from ${RIR_MIN} to ${RIR_MAX}`,
        };
    }
    return { valid: true, rir: n, error: null };
}

module.exports = { parseRir, RIR_MIN, RIR_MAX };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest rir --verbose`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/rir.js backend/src/__tests__/rir.test.js
git commit -m "feat(workout): add RIR validation, keeping 0 distinct from unrecorded

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Migration 008

**Files:**
- Create: `backend/data/migrations/008_unilateral_and_rir.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `exercise_logs.is_unilateral`, `set_logs.rir`, `users.log_rir_enabled`, `users.workout_prefs_seen`.

> **This applies to the LIVE production database.** The repo owner approved this pattern for migrations 006 and 007. Every statement must be additive and idempotent. Never write `DROP`, `TRUNCATE`, `DELETE`, or a non-`IF NOT EXISTS` `ALTER`. If it errors partway, STOP and report — do not repair by hand.

- [ ] **Step 1: Write the migration**

Create `backend/data/migrations/008_unilateral_and_rir.sql`:

```sql
-- Unilateral exercises are entered per side, so their volume counts both.
-- Lives on exercise_logs, not set_logs: the flag describes the exercise as
-- performed, and per-set would allow set 1 unilateral, set 2 not.
ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS is_unilateral BOOLEAN NOT NULL DEFAULT false;

-- RIR as the member entered it. The existing rpe column keeps its derived
-- value (rpe = 10 - rir) so nothing already reading rpe breaks.
-- NULL here means "not recorded", which is NOT the same as 0 ("to failure").
ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS rir INTEGER;

-- Per-member preferences, following the users.share_logs_default pattern.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS log_rir_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workout_prefs_seen BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Apply it**

Run: `cd backend && node apply_migration.js data/migrations/008_unilateral_and_rir.sql`
Expected: `✅ Migration applied successfully!`

- [ ] **Step 3: Verify all four columns landed**

Run:
```bash
cd backend && node -e "
require('dotenv').config();
const {Client}=require('pg');
const c=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{
  await c.connect();
  const col=async(t,n)=>(await c.query(\"SELECT data_type,column_default FROM information_schema.columns WHERE table_name=\$1 AND column_name=\$2\",[t,n])).rows[0]||null;
  for (const [t,n] of [['exercise_logs','is_unilateral'],['set_logs','rir'],['users','log_rir_enabled'],['users','workout_prefs_seen']]) {
    const r=await col(t,n);
    console.log((t+'.'+n).padEnd(28), r?('PRESENT '+r.data_type+' default='+r.column_default):'*** MISSING ***');
  }
  await c.end();
})();
"
```
Expected: all four `PRESENT`. `is_unilateral` and both `users` columns default `false`; `set_logs.rir` has no default (nullable).

- [ ] **Step 4: Confirm no existing volume changed**

Because `is_unilateral` defaults to `false`, every historical row keeps its current volume. Verify:

```bash
cd backend && node -e "
require('dotenv').config();
const {Client}=require('pg');
const c=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{
  await c.connect();
  const r=await c.query('SELECT COUNT(*) total, COUNT(*) FILTER (WHERE is_unilateral) uni FROM exercise_logs');
  console.log('exercise_logs:', r.rows[0].total, 'rows,', r.rows[0].uni, 'unilateral (must be 0)');
  await c.end();
})();
"
```
Expected: unilateral count is `0`.

- [ ] **Step 5: Commit**

```bash
git add backend/data/migrations/008_unilateral_and_rir.sql
git commit -m "feat(workout): add unilateral flag, rir column, and workout prefs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Persist the flag and RIR

**Files:**
- Modify: `backend/src/routes/workouts.js` (the `exercise_logs` INSERT ~line 91, the `set_logs` INSERT ~line 123)

**Interfaces:**
- Consumes: `parseRir` from Task 2.
- Produces: `POST /api/workouts` stores `is_unilateral` per exercise and `rir` per set.

- [ ] **Step 1: Add the require**

At the top of `backend/src/routes/workouts.js`:

```js
const { parseRir } = require('../utils/rir');
```

- [ ] **Step 2: Store the unilateral flag**

The exercise INSERT currently reads:

```js
        const logResult = await query(
            `INSERT INTO exercise_logs (session_id, exercise_id, custom_exercise_name, order_index, muscle_group)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [sessionId, exerciseId, exerciseId ? null : name.slice(0, 100), i, muscle]
        );
```

Add the column and bind the flag from the parsed exercise object. Coerce explicitly — the value arrives from a JSON blob and may be absent:

```js
        // Unilateral reps are entered per side; volume doubles. See utils/volume.js.
        const isUnilateral = ex.is_unilateral === true;

        const logResult = await query(
            `INSERT INTO exercise_logs (session_id, exercise_id, custom_exercise_name, order_index, muscle_group, is_unilateral)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [sessionId, exerciseId, exerciseId ? null : name.slice(0, 100), i, muscle, isUnilateral]
        );
```

- [ ] **Step 3: Store RIR alongside the existing RPE conversion**

The set INSERT currently reads:

```js
            // RIR → RPE (rpe = 10 - rir), clamped to a sane 1–10
            const rir = parseInt(sets[s].rir, 10);
            const rpe = Number.isFinite(rir) ? Math.min(10, Math.max(1, 10 - rir)) : null;
            await query(
                `INSERT INTO set_logs (exercise_log_id, set_number, reps, weight_kg, is_warmup, rpe)
                 VALUES ($1, $2, $3, $4, false, $5)`,
                [exerciseLogId, s + 1, reps, weight, rpe]
            );
```

Replace with a version that validates and stores RIR directly, while keeping the `rpe` derivation exactly as it is so existing consumers are unaffected. An out-of-range RIR is dropped to `null` rather than rejecting the whole workout — a member should never lose a logged session over one bad field:

```js
            // Store RIR as entered. The rpe derivation stays so anything
            // already reading rpe keeps working.
            const parsed = parseRir(sets[s].rir);
            const rirValue = parsed.valid ? parsed.rir : null;
            const rpe = rirValue !== null ? Math.min(10, Math.max(1, 10 - rirValue)) : null;
            await query(
                `INSERT INTO set_logs (exercise_log_id, set_number, reps, weight_kg, is_warmup, rpe, rir)
                 VALUES ($1, $2, $3, $4, false, $5, $6)`,
                [exerciseLogId, s + 1, reps, weight, rpe, rirValue]
            );
```

- [ ] **Step 4: Verify**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; full suite green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/workouts.js
git commit -m "feat(workout): persist unilateral flag and RIR on log

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Apply the volume rule to all four stats queries

**Files:**
- Modify: `backend/src/routes/progress.js` (lines 38, 70, 71, 114)

**Interfaces:**
- Consumes: `VOLUME_SQL` from Task 1.
- Produces: unilateral sets counted at 2× in every stat.

- [ ] **Step 1: Add the require**

At the top of `backend/src/routes/progress.js`:

```js
const { VOLUME_SQL } = require('../utils/volume');
```

- [ ] **Step 2: Replace all four inlined computations**

Each of these becomes a template interpolation of `VOLUME_SQL`. Do NOT retype the arithmetic — the whole point is that it exists once.

| Line | Before | After |
|---|---|---|
| 38 | `MAX(sl.weight_kg * sl.reps) as max_volume_single_set` | `MAX(${VOLUME_SQL}) as max_volume_single_set` |
| 70 | `MAX(sl.weight_kg * sl.reps) as best_volume_set` | `MAX(${VOLUME_SQL}) as best_volume_set` |
| 71 | `SUM(sl.weight_kg * sl.reps) as total_volume` | `SUM(${VOLUME_SQL}) as total_volume` |
| 114 | `SUM(sl.weight_kg * sl.reps) as total_volume` | `SUM(${VOLUME_SQL}) as total_volume` |

All three surrounding query blocks already `JOIN exercise_logs el` (lines 42, 74, 118), so `el.is_unilateral` resolves without adding joins. Confirm each query string is a template literal (backticks) before interpolating; if any is a plain quoted string, convert it.

- [ ] **Step 3: Verify no inlined volume arithmetic survives**

Run: `cd backend && grep -rn "weight_kg \* sl\.reps\|sl\.weight_kg \* sl\.reps" src/`
Expected: only the line inside `src/utils/volume.js`. Any hit in `progress.js` means a site was missed.

- [ ] **Step 4: Verify the SQL still parses**

Run:
```bash
cd backend && node -e "
require('dotenv').config();
const {Client}=require('pg');
const {VOLUME_SQL}=require('./src/utils/volume');
const c=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{
  await c.connect();
  const r=await c.query(\`SELECT COALESCE(SUM(\${VOLUME_SQL}),0) AS v
    FROM set_logs sl JOIN exercise_logs el ON sl.exercise_log_id = el.id\`);
  console.log('VOLUME_SQL executes against the live schema. Total volume:', r.rows[0].v);
  await c.end();
})();
"
```
Expected: a number, no SQL error. This proves the fragment's aliases and the new column line up.

- [ ] **Step 5: Run the suite and commit**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; full suite green.

```bash
git add backend/src/routes/progress.js
git commit -m "feat(workout): count unilateral sets at 2x in all volume stats

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Workout preferences endpoint

**Files:**
- Modify: `backend/src/routes/settings.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `GET /api/settings/workout` → `{ log_rir_enabled: boolean, workout_prefs_seen: boolean }`
  - `PATCH /api/settings/workout` → same shape; accepts either or both fields.

- [ ] **Step 1: Add both routes**

Add to `backend/src/routes/settings.js` before `module.exports`, mirroring the `/sharing` pair above it:

```js
/**
 * GET /api/settings/workout
 * Workout logging preferences (RIR opt-in, first-run sheet state).
 */
router.get('/workout', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT log_rir_enabled, workout_prefs_seen
         FROM users
         WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({
        log_rir_enabled: result.rows[0].log_rir_enabled,
        workout_prefs_seen: result.rows[0].workout_prefs_seen,
    });
}));

/**
 * PATCH /api/settings/workout
 * Update either preference. Both fields are optional; at least one required.
 */
router.patch('/workout', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { log_rir_enabled, workout_prefs_seen } = req.body;

    const hasRir = log_rir_enabled !== undefined;
    const hasSeen = workout_prefs_seen !== undefined;

    if (!hasRir && !hasSeen) {
        throw new ValidationError('Provide log_rir_enabled or workout_prefs_seen');
    }
    if (hasRir && typeof log_rir_enabled !== 'boolean') {
        throw new ValidationError('log_rir_enabled must be a boolean');
    }
    if (hasSeen && typeof workout_prefs_seen !== 'boolean') {
        throw new ValidationError('workout_prefs_seen must be a boolean');
    }

    // COALESCE keeps the untouched field at its current value, so a partial
    // PATCH cannot silently reset the other preference.
    const result = await query(
        `UPDATE users
            SET log_rir_enabled    = COALESCE($1, log_rir_enabled),
                workout_prefs_seen = COALESCE($2, workout_prefs_seen)
          WHERE id = $3
      RETURNING log_rir_enabled, workout_prefs_seen`,
        [hasRir ? log_rir_enabled : null, hasSeen ? workout_prefs_seen : null, userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({
        success: true,
        log_rir_enabled: result.rows[0].log_rir_enabled,
        workout_prefs_seen: result.rows[0].workout_prefs_seen,
    });
}));
```

Check the top of the file: `authenticate`, `asyncHandler`, `query`, and `ValidationError` are already imported for the existing routes. Add nothing that is already there.

- [ ] **Step 2: Verify the routes mount**

Run:
```bash
cd backend && NODE_ENV=test node -e "
const app=require('./src/index');
const find=(stack,p)=>stack.some(l=>l.regexp&&l.regexp.source.includes(p));
console.log('settings router mounted:', find(app._router.stack,'settings'));
"
```
Expected: `true`.

- [ ] **Step 3: Run the suite and commit**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; full suite green.

```bash
git add backend/src/routes/settings.js
git commit -m "feat(workout): add workout preferences endpoint

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Mobile API client and types

**Files:**
- Modify: `mobile/src/services/api.ts`
- Modify: `mobile/src/components/workout/types.ts`

**Interfaces:**
- Consumes: the endpoints from Task 6.
- Produces:
  - `settingsAPI.getWorkoutPreferences()` → `Promise<{ log_rir_enabled: boolean; workout_prefs_seen: boolean }>`
  - `settingsAPI.updateWorkoutPreferences(prefs)` → same shape
  - `UserExercise.is_unilateral?: boolean`
  - `RIR_MIN`, `RIR_MAX`, `RIR_VALUES` exported from `types.ts`

- [ ] **Step 1: Extend the workout types**

In `mobile/src/components/workout/types.ts`, add `is_unilateral` to `UserExercise`:

```ts
export interface UserExercise {
    id: string;
    name: string;
    gifUrl?: string;
    target?: string;
    /** Entered per side — volume counts both. See backend/src/utils/volume.js */
    is_unilateral?: boolean;
    sets: ExerciseSet[];
}
```

And add the RIR picker range beside the existing `REPS_VALUES`:

```ts
export const RIR_MIN = 0;
export const RIR_MAX = 5;
export const RIR_VALUES = Array.from({ length: RIR_MAX - RIR_MIN + 1 }, (_, i) => RIR_MIN + i);
```

`ExerciseSet` already declares `rir?: number | string` — leave it as is.

`mobile/src/components/workout/index.ts` ends with `export * from './types'`, so `RIR_VALUES`, `RIR_MIN`, and `RIR_MAX` are re-exported automatically. **Do not add explicit export lines for them** — that would be a duplicate.

- [ ] **Step 2: Add the API methods**

In `mobile/src/services/api.ts`, add to the existing `settingsAPI` object:

```ts
    getWorkoutPreferences: async (): Promise<{ log_rir_enabled: boolean; workout_prefs_seen: boolean }> => {
        const response = await api.get('/settings/workout');
        return response.data;
    },

    updateWorkoutPreferences: async (prefs: {
        log_rir_enabled?: boolean;
        workout_prefs_seen?: boolean;
    }) => {
        const response = await api.patch('/settings/workout', prefs);
        return response.data;
    },
```

- [ ] **Step 3: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

```bash
git add mobile/src/services/api.ts mobile/src/components/workout/types.ts
git commit -m "feat(workout): add workout preference client and unilateral type

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The `1 SIDE` pill and the RIR cell

**Files:**
- Modify: `mobile/src/components/workout/ExerciseCard.tsx`

**Interfaces:**
- Consumes: `UserExercise.is_unilateral`, `RIR_VALUES` from Task 7.
- Produces: two new props on `ExerciseCardProps` — `showRir: boolean` and `onToggleUnilateral: (eIdx: number) => void`. `onOpenPicker`'s `type` parameter widens to `'weight' | 'reps' | 'rir'`.

- [ ] **Step 1: Widen the props**

In `ExerciseCardProps`:

```ts
interface ExerciseCardProps {
    exercise: UserExercise;
    exerciseIndex: number;
    /** When false the RIR column is hidden entirely — it is opt-in. */
    showRir: boolean;
    onUpdateSet: (eIdx: number, sIdx: number, field: keyof ExerciseSet, value: any) => void;
    onAddSet: (eIdx: number) => void;
    onRemoveExercise: (eIdx: number) => void;
    onRemoveSet: (eIdx: number, sIdx: number) => void;
    onToggleUnilateral: (eIdx: number) => void;
    onOpenPicker: (eIdx: number, sIdx: number, type: 'weight' | 'reps' | 'rir') => void;
}
```

Add `showRir` and `onToggleUnilateral` to the destructured parameter list.

- [ ] **Step 2: Add the pill to the exercise header**

Immediately after the `targetTag` block in the header (around line 62-66), add:

```tsx
                            <TouchableOpacity
                                onPress={() => onToggleUnilateral(exerciseIndex)}
                                hitSlop={8}
                                style={[
                                    styles.unilateralPill,
                                    exercise.is_unilateral && styles.unilateralPillActive,
                                ]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: !!exercise.is_unilateral }}
                                accessibilityLabel={
                                    exercise.is_unilateral
                                        ? 'Logged one side at a time. Tap to switch to both sides.'
                                        : 'Logged both sides. Tap if you do one side at a time.'
                                }
                            >
                                <Text
                                    style={[
                                        styles.unilateralPillText,
                                        exercise.is_unilateral && styles.unilateralPillTextActive,
                                    ]}
                                >
                                    1 SIDE
                                </Text>
                            </TouchableOpacity>
```

- [ ] **Step 3: Add the RIR column**

In the table header, after the existing reps column label, add a conditional column:

```tsx
                    {showRir && <Text style={[styles.colLabel, { width: 44 }]}>RIR</Text>}
```

In each set row, after the reps cell, add the matching cell:

```tsx
                        {showRir && (
                            <TouchableOpacity
                                style={[styles.valueCell, { width: 44 }]}
                                onPress={() => onOpenPicker(exerciseIndex, setIndex, 'rir')}
                                accessibilityLabel={`RIR for set ${setIndex + 1}`}
                            >
                                <Text
                                    style={[
                                        styles.valueCellText,
                                        (set.rir === undefined || set.rir === '') && styles.valueCellPlaceholder,
                                    ]}
                                >
                                    {set.rir === undefined || set.rir === '' ? '-' : `${set.rir}`}
                                </Text>
                            </TouchableOpacity>
                        )}
```

The emptiness check must test `undefined`/`''` explicitly, **not** falsiness — `set.rir === 0` is a real recorded value meaning "to failure" and must render as `0`, not `-`.

- [ ] **Step 4: Add the styles**

In the `StyleSheet.create` block:

```tsx
    unilateralPill: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginLeft: spacing.xs,
    },
    unilateralPillActive: {
        borderColor: colors.primary,
        backgroundColor: colors.glass.surfaceLight,
    },
    unilateralPillText: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
        letterSpacing: 0.8,
    },
    unilateralPillTextActive: {
        color: colors.text.primary,
    },
```

Confirm `spacing`, `borderRadius`, `typography`, and `colors` are already imported in this file before using them. If `borderRadius.sm` does not exist, substitute the nearest existing token and note the substitution.

- [ ] **Step 5: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: errors ONLY at the `<ExerciseCard>` call site in `WorkoutLogScreen.tsx`, which does not yet pass the two new required props. Task 9 resolves them. Do not commit yet — Task 9 finishes this.

---

### Task 9: Wire the screen, the picker, and the recap

**Files:**
- Modify: `mobile/src/screens/member/WorkoutLogScreen.tsx`

**Interfaces:**
- Consumes: `ExerciseCard`'s new props (Task 8), `settingsAPI.getWorkoutPreferences` (Task 7).
- Produces: nothing downstream.

- [ ] **Step 1: Load the preference**

Add state beside the existing declarations:

```tsx
const [showRir, setShowRir] = useState(false);
```

Fetch it in the same effect that already loads the sharing preference (`WorkoutLogScreen.tsx:140` calls `settingsAPI.getSharingPreference()`), so there is one preferences round trip rather than two:

```tsx
settingsAPI.getWorkoutPreferences()
    .then((p) => setShowRir(!!p.log_rir_enabled))
    .catch(() => setShowRir(false));
```

- [ ] **Step 2: Add the toggle handler**

```tsx
const handleToggleUnilateral = useCallback((eIdx: number) => {
    setUserExercises((prev) =>
        prev.map((ex, i) => (i === eIdx ? { ...ex, is_unilateral: !ex.is_unilateral } : ex)),
    );
}, []);
```

`setUserExercises` is verified to be the real setter — `const [userExercises, setUserExercises] = useState<UserExercise[]>([]);` at `WorkoutLogScreen.tsx:102`.

- [ ] **Step 3: Pass the new props**

At the `<ExerciseCard ... />` call site (~line 563):

```tsx
                showRir={showRir}
                onToggleUnilateral={handleToggleUnilateral}
```

- [ ] **Step 4: Teach the picker about RIR**

First widen `PickerConfig` in `mobile/src/components/workout/types.ts`:

```ts
export interface PickerConfig {
    visible: boolean;
    type: 'weight' | 'reps' | 'rir';
    exerciseIndex: number;
    setIndex: number;
    currentValue: number;
}
```

Then add `RIR_VALUES` to the existing import block at `WorkoutLogScreen.tsx:32-37`:

```tsx
import {
    ExerciseCard,
    PICKER_HEIGHT,
    WEIGHT_VALUES,
    REPS_VALUES,
    RIR_VALUES,
    REST_PRESETS,
} from '../../components/workout';
```

Finally, `WorkoutLogScreen.tsx:989` currently reads:

```tsx
                                values={pickerConfig.type === 'weight' ? WEIGHT_VALUES : REPS_VALUES}
```

A two-way ternary cannot express three types. Replace it:

```tsx
                                values={
                                    pickerConfig.type === 'weight'
                                        ? WEIGHT_VALUES
                                        : pickerConfig.type === 'rir'
                                            ? RIR_VALUES
                                            : REPS_VALUES
                                }
```

- [ ] **Step 5: Fix the recap volume — the fifth site**

`WorkoutLogScreen.tsx:517` currently computes:

```tsx
                    if (w > 0 && r > 0) {
                        totalVolume += w * r;
                        totalSets++;
                    }
```

A unilateral exercise must count double here too, or the post-workout recap will disagree with the stats screen for the same session. Change it to apply the same rule:

```tsx
                    if (w > 0 && r > 0) {
                        // Same rule as backend/src/utils/volume.js — unilateral
                        // reps are per side, so both sides count.
                        totalVolume += w * r * (ex.is_unilateral ? 2 : 1);
                        totalSets++;
                    }
```

- [ ] **Step 6: Typecheck and verify wiring**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

Run: `cd backend && node scripts/wiring_audit.js`
Expected: `nav orphans=0, api orphans=0`.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/components/workout/ExerciseCard.tsx mobile/src/screens/member/WorkoutLogScreen.tsx mobile/src/components/workout/types.ts
git commit -m "feat(workout): add 1 SIDE pill and optional RIR column

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: First-run sheet and Settings switch

**Files:**
- Create: `mobile/src/components/workout/WorkoutPrefsSheet.tsx`
- Modify: `mobile/src/components/workout/index.ts`
- Modify: `mobile/src/screens/member/WorkoutLogScreen.tsx`
- Modify: `mobile/src/screens/member/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `settingsAPI.getWorkoutPreferences` / `updateWorkoutPreferences` (Task 7).
- Produces: `<WorkoutPrefsSheet visible rirEnabled onChangeRir onDismiss />`

- [ ] **Step 1: Build the sheet**

Create `mobile/src/components/workout/WorkoutPrefsSheet.tsx`:

```tsx
import React from 'react';
import { View, Text, Modal, Pressable, Switch, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

interface WorkoutPrefsSheetProps {
    visible: boolean;
    rirEnabled: boolean;
    onChangeRir: (enabled: boolean) => void;
    onDismiss: () => void;
}

const WorkoutPrefsSheet: React.FC<WorkoutPrefsSheetProps> = ({
    visible,
    rirEnabled,
    onChangeRir,
    onDismiss,
}) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
        <View style={styles.backdrop}>
            <View style={styles.sheet}>
                <Text style={styles.title}>TWO THINGS BEFORE YOU LOG</Text>

                <View style={styles.row}>
                    <Text style={styles.rowTitle}>One side at a time</Text>
                    <Text style={styles.rowBody}>
                        Doing single-arm rows or split squats? Tap 1 SIDE on the exercise and
                        enter what you did on one side. We'll count both.
                    </Text>
                </View>

                <View style={styles.row}>
                    <View style={styles.switchRow}>
                        <Text style={styles.rowTitle}>Track RIR</Text>
                        <Switch
                            value={rirEnabled}
                            onValueChange={onChangeRir}
                            accessibilityLabel="Track reps in reserve"
                        />
                    </View>
                    <Text style={styles.rowBody}>
                        Reps in reserve — how many you had left. 0 means you went to failure.
                        Off by default; change it any time in Settings.
                    </Text>
                </View>

                <Pressable style={styles.dismiss} onPress={onDismiss} accessibilityRole="button">
                    <Text style={styles.dismissText}>GOT IT</Text>
                </Pressable>
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
        borderTopWidth: 1,
        borderColor: colors.glass.border,
    },
    title: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
        letterSpacing: 1.2,
        marginBottom: spacing.lg,
    },
    row: { marginBottom: spacing.lg },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    rowBody: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        lineHeight: 20,
    },
    dismiss: {
        marginTop: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surfaceLight,
        alignItems: 'center',
    },
    dismissText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 1,
    },
});

export default WorkoutPrefsSheet;
```

Verify every token used exists in `mobile/src/styles/theme.ts` before finishing. If `colors.surface`, `borderRadius.lg/xl`, or `spacing.xl` are absent, substitute the nearest existing token and record the substitution in your report.

- [ ] **Step 2: Export it**

Add to `mobile/src/components/workout/index.ts`, matching the existing export style:

```ts
export { default as WorkoutPrefsSheet } from './WorkoutPrefsSheet';
```

- [ ] **Step 3: Show it once on first open**

In `WorkoutLogScreen.tsx`, extend the preferences fetch from Task 9 to also drive the sheet:

```tsx
const [showPrefsSheet, setShowPrefsSheet] = useState(false);
```

```tsx
settingsAPI.getWorkoutPreferences()
    .then((p) => {
        setShowRir(!!p.log_rir_enabled);
        if (!p.workout_prefs_seen) setShowPrefsSheet(true);
    })
    .catch(() => setShowRir(false));
```

Render it near the root of the screen's JSX:

```tsx
<WorkoutPrefsSheet
    visible={showPrefsSheet}
    rirEnabled={showRir}
    onChangeRir={(enabled) => {
        setShowRir(enabled);
        settingsAPI.updateWorkoutPreferences({ log_rir_enabled: enabled }).catch(() => {});
    }}
    onDismiss={() => {
        setShowPrefsSheet(false);
        settingsAPI.updateWorkoutPreferences({ workout_prefs_seen: true }).catch(() => {});
    }}
/>
```

Both writes are fire-and-forget: a failed preference save must never block logging. If `workout_prefs_seen` fails to persist, the sheet reappears next time — mildly annoying, harmless, and no retry logic is warranted.

- [ ] **Step 4: Add the Settings switch**

`SettingsScreen.tsx:223` already defines exactly the helper needed:

```tsx
const renderToggle = (label: string, value: boolean, onValueChange: (val: boolean) => void) => ( … )
```

It is used in the PREFERENCES section at line ~297. **Use it — do not build a new row type**, and do not use `SettingItem` (that is a `TouchableOpacity` press row with an icon, not a switch).

Add state beside the other preference state in this file:

```tsx
const [logRir, setLogRir] = useState(false);
```

Load it wherever the screen already loads its other preferences:

```tsx
settingsAPI.getWorkoutPreferences()
    .then((p) => setLogRir(!!p.log_rir_enabled))
    .catch(() => setLogRir(false));
```

Add the handler, mirroring `handleShareLogsToggle`. Revert the optimistic flip if the write fails, so the switch never lies about persisted state:

```tsx
const handleLogRirToggle = async (val: boolean) => {
    setLogRir(val);
    try {
        await settingsAPI.updateWorkoutPreferences({ log_rir_enabled: val });
    } catch (e: any) {
        setLogRir(!val);
        toast.error('Could not save', e.message || 'Please try again');
    }
};
```

Render it in the PREFERENCES `GlassCard`, next to the existing Push Notifications toggle:

```tsx
                    <View style={styles.divider} />
                    {renderToggle('Track RIR', logRir, handleLogRirToggle)}
```

Confirm `toast` exists in this file before using it; if the screen uses `Alert` instead, match whatever it already does rather than introducing a second feedback mechanism.

- [ ] **Step 5: Full verification**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

Run: `cd backend && npx jest && node scripts/wiring_audit.js`
Expected: full suite green; `nav orphans=0, api orphans=0`.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/workout/WorkoutPrefsSheet.tsx mobile/src/components/workout/index.ts mobile/src/screens/member/WorkoutLogScreen.tsx mobile/src/screens/member/SettingsScreen.tsx
git commit -m "feat(workout): add first-run prefs sheet and settings RIR switch

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Rollout Notes

- **Task 3 writes to the live database.** Additive and idempotent, same pattern as migrations 006 and 007. Because `is_unilateral` defaults to `false`, no historical volume changes — Step 4 proves it.
- **Task 5 changes numbers members already see**, but only for sessions logged with the flag on. Existing sessions are untouched.
- **Tasks 1–6 are backend-only and ship independently.** If work stops after Task 6, nothing is user-visible and nothing is broken.
- **Task 8 deliberately leaves the tree not typechecking** until Task 9 passes the new required props. They are split because the component and its wiring are separately reviewable, but they must land together.
- **PR detection shifts.** `max_volume_single_set` and `best_volume_set` now count unilateral sets at 2×, so a unilateral PR can outrank a bilateral one. That is the intended correction.
