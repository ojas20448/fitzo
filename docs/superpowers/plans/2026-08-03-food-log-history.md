# Food Log History and Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member see what they logged today, correct or delete any entry, and review the past week by tapping a day on the calendar already in Profile.

**Architecture:** The day boundary moves to IST and lives in exactly one module, because five-plus sites currently disagree about what "today" means. Most of the read path already exists and is unused — `GET /api/calories/today` already returns the entry list, and `caloriesAPI.getToday`/`.delete` are already wired — so this is mainly UI plus two endpoints.

**Tech Stack:** Node 20, Express 4, PostgreSQL (Supabase), Jest, Expo/React Native 0.81, TypeScript.

## Global Constraints

- **The app's day is IST (`Asia/Kolkata`).** `checkin.js:43` already uses `DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata')`; food queries use bare `CURRENT_DATE` against a **UTC** database. Measured live: `CURRENT_DATE` returned `2026-08-02` while the IST date was `2026-08-03`. For 5½ hours nightly the food log and the check-in streak disagree about the day. This plan makes food match check-in.
- **The rule gets ONE definition**, in `backend/src/utils/dayBoundary.js`. Do not inline `AT TIME ZONE 'Asia/Kolkata'` at call sites. This is the same failure mode a previous review flagged when one rule was hand-synced across two languages — `backend/src/utils/volume.js` is the pattern to copy.
- **No backfill.** The 18 existing `calorie_logs` rows keep their UTC-derived `logged_date`. This is a deliberate human decision. Do not write an `UPDATE` against historical rows.
- **Reads use the stored `logged_date` column**, not a value derived from `created_at`. `idx_calorie_log_user (user_id, logged_date DESC)` exists and a derived expression would not use it.
- **Ownership is enforced by `WHERE id = $1 AND user_id = $2`, returning 404 when nothing matches** — the pattern `DELETE /:id` already uses (`calories.js:161-175`). 404, not 403: 403 would confirm the row exists but belongs to someone else.
- **A `PATCH` must leave omitted fields untouched.** Nulling unspecified macros would silently zero a member's protein when they only meant to fix calories. Use `COALESCE($n, column)`.
- **Macro bounds already exist** — `MAX_ITEM_CALORIES` (10000) and `MAX_ITEM_MACRO_GRAMS` (2000) are exported from `backend/src/utils/mealCombo.js:69`. Reuse them; do not define a second set.
- **Already wired, do not re-add:** `caloriesAPI.getToday()` (`api.ts:673`) and `caloriesAPI.delete(entryId)` (`api.ts:688`).
- CommonJS backend, 4-space indent, JSDoc on exported functions. Mobile is TypeScript, 4-space indent.
- **Mobile styling uses tokens only.** `typography.caption`, `typography.body`, and `colors.text.tertiary` **do not exist** — use `typography.sizes.*` + `typography.fontFamily.*` and `colors.text.muted`. The toast API takes **two** arguments: `toast.error(title, message)`.
- **Another session commits to this repo concurrently.** Stage paths explicitly; never `git add -A`.

---

### Task 1: Day boundary module

**Files:**
- Create: `backend/src/utils/dayBoundary.js`
- Test: `backend/src/__tests__/day-boundary.test.js`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `APP_TIMEZONE` (`'Asia/Kolkata'`)
  - `IST_TODAY_SQL` (string) — SQL for the member's current date
  - `IST_DAY_OF_SQL` (string) — SQL for the day a row belongs to; requires `created_at` in scope
  - `istDateString(at?)` → `'YYYY-MM-DD'` or `null`
  - `isValidDateString(s)` → boolean

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/day-boundary.test.js`:

```js
/**
 * Day Boundary Tests
 *
 * The app's day is IST. The database is UTC, so a naive CURRENT_DATE is
 * wrong for 5.5 hours every night — a meal logged at 01:00 IST would file
 * under the previous day. These tests pin the exact edges, because the
 * middle of the day works under either rule and proves nothing.
 */

const {
    istDateString,
    isValidDateString,
    IST_TODAY_SQL,
    IST_DAY_OF_SQL,
    APP_TIMEZONE,
} = require('../utils/dayBoundary');

describe('istDateString', () => {
    it('rolls to the next day at exactly 18:30 UTC', () => {
        // 18:29 UTC is 23:59 IST the same day; 18:30 UTC is 00:00 IST the next.
        expect(istDateString(new Date('2026-08-02T18:29:59Z'))).toBe('2026-08-02');
        expect(istDateString(new Date('2026-08-02T18:30:00Z'))).toBe('2026-08-03');
    });

    it('treats 00:00 UTC as the same IST day, not the next', () => {
        // 00:00 UTC = 05:30 IST, still the same calendar day in India.
        expect(istDateString(new Date('2026-08-03T00:00:00Z'))).toBe('2026-08-03');
    });

    it('puts 23:59 IST and 00:01 IST on different days', () => {
        expect(istDateString(new Date('2026-08-02T18:29:00Z'))).toBe('2026-08-02'); // 23:59 IST
        expect(istDateString(new Date('2026-08-02T18:31:00Z'))).toBe('2026-08-03'); // 00:01 IST
    });

    it('crosses a month boundary correctly', () => {
        expect(istDateString(new Date('2026-07-31T18:30:00Z'))).toBe('2026-08-01');
    });

    it('crosses a year boundary correctly', () => {
        expect(istDateString(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
    });

    it('accepts an ISO string as well as a Date', () => {
        expect(istDateString('2026-08-02T18:30:00Z')).toBe('2026-08-03');
    });

    it('returns null for an invalid date instead of throwing', () => {
        expect(istDateString('not a date')).toBeNull();
        expect(istDateString(new Date('nonsense'))).toBeNull();
    });
});

describe('isValidDateString', () => {
    it('accepts a well-formed date', () => {
        expect(isValidDateString('2026-08-03')).toBe(true);
    });

    it('rejects malformed input', () => {
        expect(isValidDateString('2026-8-3')).toBe(false);
        expect(isValidDateString('03-08-2026')).toBe(false);
        expect(isValidDateString('2026-08-03T00:00:00Z')).toBe(false);
        expect(isValidDateString('')).toBe(false);
        expect(isValidDateString(null)).toBe(false);
        expect(isValidDateString('2026-13-01')).toBe(false);
        expect(isValidDateString('2026-02-30')).toBe(false);
    });

    it("rejects anything that could reach SQL as something other than a date", () => {
        expect(isValidDateString("2026-08-03'; DROP TABLE calorie_logs;--")).toBe(false);
    });
});

describe('SQL fragments', () => {
    it('name the app timezone', () => {
        expect(IST_TODAY_SQL).toContain(APP_TIMEZONE);
        expect(IST_DAY_OF_SQL).toContain(APP_TIMEZONE);
    });

    it('reference the column each one needs', () => {
        expect(IST_DAY_OF_SQL).toContain('created_at');
        expect(IST_TODAY_SQL).toContain('NOW()');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest day-boundary --verbose`
Expected: FAIL — `Cannot find module '../utils/dayBoundary'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/utils/dayBoundary.js`:

```js
/**
 * The Member's Day
 *
 * ONE definition of when a day starts and ends, because several places need
 * it and they currently disagree. The database runs in UTC, so a bare
 * CURRENT_DATE is wrong for 5.5 hours every night: a meal logged at 01:00 IST
 * would be filed under the previous day. Meanwhile checkin.js already uses
 * IST, so today the food log and the check-in streak disagree about the date.
 *
 * India does not observe DST, so a fixed +05:30 offset is correct and avoids
 * pulling in an Intl/tz dependency for the JS side.
 */

const APP_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The member's current date. */
const IST_TODAY_SQL = `(NOW() AT TIME ZONE '${APP_TIMEZONE}')::date`;

/** The day a row belongs to. Requires `created_at` to be in scope. */
const IST_DAY_OF_SQL = `(created_at AT TIME ZONE '${APP_TIMEZONE}')::date`;

/**
 * @param {Date|string} [at] defaults to now
 * @returns {string|null} 'YYYY-MM-DD' in IST, or null if unparseable
 */
function istDateString(at = new Date()) {
    const d = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Strict 'YYYY-MM-DD' check for a client-supplied date, including that the
 * date actually exists (rejects 2026-02-30). Anything reaching a query as a
 * date must pass this first.
 */
function isValidDateString(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    return d.toISOString().slice(0, 10) === s;
}

module.exports = {
    APP_TIMEZONE,
    IST_TODAY_SQL,
    IST_DAY_OF_SQL,
    istDateString,
    isValidDateString,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest day-boundary --verbose`
Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/dayBoundary.js backend/src/__tests__/day-boundary.test.js
git commit -m "feat(food): add single-source IST day boundary

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Entry-edit validator

**Files:**
- Create: `backend/src/utils/entryEdit.js`
- Test: `backend/src/__tests__/entry-edit.test.js`

**Interfaces:**
- Consumes: `MAX_ITEM_CALORIES`, `MAX_ITEM_MACRO_GRAMS` from `backend/src/utils/mealCombo.js`.
- Produces: `validateEntryPatch(body)` → `{ valid, error, fields }` where `fields` contains **only** the keys present in `body`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/entry-edit.test.js`:

```js
/**
 * Entry Edit Tests
 *
 * A PATCH must only touch what was sent. Nulling unspecified macros would
 * silently zero a member's protein when they only meant to fix calories,
 * which is exactly the kind of quiet corruption this feature exists to undo.
 */

const { validateEntryPatch } = require('../utils/entryEdit');
const { MAX_ITEM_CALORIES, MAX_ITEM_MACRO_GRAMS } = require('../utils/mealCombo');

describe('validateEntryPatch', () => {
    it('returns only the fields that were sent', () => {
        const r = validateEntryPatch({ calories: 250 });
        expect(r.valid).toBe(true);
        expect(r.fields).toEqual({ calories: 250 });
        expect('protein' in r.fields).toBe(false);
    });

    it('accepts every editable field together', () => {
        const r = validateEntryPatch({
            food_name: 'Dal', calories: 200, protein: 9, carbs: 25, fat: 5,
            serving_size: '1 katori', meal_type: 'lunch',
        });
        expect(r.valid).toBe(true);
        expect(Object.keys(r.fields).sort()).toEqual(
            ['calories', 'carbs', 'fat', 'food_name', 'meal_type', 'protein', 'serving_size'],
        );
    });

    it('rejects an empty body — a PATCH that changes nothing is a mistake', () => {
        expect(validateEntryPatch({}).valid).toBe(false);
        expect(validateEntryPatch(null).valid).toBe(false);
    });

    it('ignores unknown keys rather than passing them toward SQL', () => {
        const r = validateEntryPatch({ calories: 100, user_id: 'someone-else', id: 'x' });
        expect(r.valid).toBe(true);
        expect(r.fields).toEqual({ calories: 100 });
    });

    it('accepts 0 as a real value for every macro', () => {
        const r = validateEntryPatch({ calories: 0, protein: 0, carbs: 0, fat: 0 });
        expect(r.valid).toBe(true);
        expect(r.fields).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    });

    it('enforces the bounds already used by bulk logging', () => {
        expect(validateEntryPatch({ calories: MAX_ITEM_CALORIES }).valid).toBe(true);
        expect(validateEntryPatch({ calories: MAX_ITEM_CALORIES + 1 }).valid).toBe(false);
        expect(validateEntryPatch({ protein: MAX_ITEM_MACRO_GRAMS }).valid).toBe(true);
        expect(validateEntryPatch({ protein: MAX_ITEM_MACRO_GRAMS + 1 }).valid).toBe(false);
    });

    it('rejects negatives and junk', () => {
        expect(validateEntryPatch({ calories: -1 }).valid).toBe(false);
        expect(validateEntryPatch({ fat: 'abc' }).valid).toBe(false);
        expect(validateEntryPatch({ carbs: null }).valid).toBe(false);
    });

    it('rejects an empty or whitespace-only food name', () => {
        expect(validateEntryPatch({ food_name: '' }).valid).toBe(false);
        expect(validateEntryPatch({ food_name: '   ' }).valid).toBe(false);
    });

    it('trims and truncates text to the column widths', () => {
        const r = validateEntryPatch({ food_name: '  Dal  ', serving_size: 'x'.repeat(200) });
        expect(r.fields.food_name).toBe('Dal');
        expect(r.fields.serving_size.length).toBeLessThanOrEqual(100);
    });

    it('rejects an unknown meal_type', () => {
        expect(validateEntryPatch({ meal_type: 'brunch' }).valid).toBe(false);
        expect(validateEntryPatch({ meal_type: 'lunch' }).valid).toBe(true);
    });

    it('names the offending field in its error', () => {
        expect(validateEntryPatch({ protein: 99999 }).error).toMatch(/protein/i);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest entry-edit --verbose`
Expected: FAIL — `Cannot find module '../utils/entryEdit'`

- [ ] **Step 3: Implement**

Create `backend/src/utils/entryEdit.js`:

```js
/**
 * Calorie Entry Edit Validation
 *
 * Returns ONLY the fields the caller actually sent, so the route can build a
 * partial UPDATE. A PATCH that reset omitted columns would zero a member's
 * protein when they only meant to correct calories.
 *
 * Bounds are reused from mealCombo.js rather than redefined — one set of
 * limits for every write path into calorie_logs.
 */

const { MAX_ITEM_CALORIES, MAX_ITEM_MACRO_GRAMS } = require('./mealCombo');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MACRO_FIELDS = ['protein', 'carbs', 'fat'];
const FOOD_NAME_MAX = 100;
const SERVING_SIZE_MAX = 100;

function fail(error) {
    return { valid: false, error, fields: {} };
}

/**
 * @param {object} body
 * @returns {{valid: boolean, error: string|null, fields: object}}
 */
function validateEntryPatch(body) {
    if (!body || typeof body !== 'object') return fail('Nothing to update');

    const fields = {};

    if ('calories' in body) {
        const n = Number(body.calories);
        if (!Number.isFinite(n) || n < 0 || n > MAX_ITEM_CALORIES) {
            return fail(`calories must be between 0 and ${MAX_ITEM_CALORIES}`);
        }
        fields.calories = Math.round(n);
    }

    for (const key of MACRO_FIELDS) {
        if (!(key in body)) continue;
        const n = Number(body[key]);
        if (!Number.isFinite(n) || n < 0 || n > MAX_ITEM_MACRO_GRAMS) {
            return fail(`${key} must be between 0 and ${MAX_ITEM_MACRO_GRAMS}`);
        }
        fields[key] = Math.round(n);
    }

    if ('food_name' in body) {
        const s = typeof body.food_name === 'string' ? body.food_name.trim() : '';
        if (!s) return fail('food_name cannot be empty');
        fields.food_name = s.slice(0, FOOD_NAME_MAX);
    }

    if ('serving_size' in body) {
        const s = typeof body.serving_size === 'string' ? body.serving_size.trim() : '';
        fields.serving_size = s.slice(0, SERVING_SIZE_MAX);
    }

    if ('meal_type' in body) {
        if (!MEAL_TYPES.includes(body.meal_type)) {
            return fail(`meal_type must be one of ${MEAL_TYPES.join(', ')}`);
        }
        fields.meal_type = body.meal_type;
    }

    if (Object.keys(fields).length === 0) return fail('Nothing to update');

    return { valid: true, error: null, fields };
}

module.exports = { validateEntryPatch, MEAL_TYPES, FOOD_NAME_MAX, SERVING_SIZE_MAX };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest entry-edit --verbose`
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/entryEdit.js backend/src/__tests__/entry-edit.test.js
git commit -m "feat(food): add partial-update validator for calorie entries

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Move food dates to IST

**Files:**
- Modify: `backend/src/routes/calories.js` (lines 46, 69, 83, 137)
- Modify: `backend/src/routes/nutrition.js` (the `POST /log` and `POST /log-bulk` INSERTs, plus `/today` at line 239 and `/weekly` at line 331)

**Interfaces:**
- Consumes: `IST_TODAY_SQL` from Task 1.
- Produces: every food write stamps `logged_date` in IST; every food read compares against IST.

- [ ] **Step 1: Add the require to both files**

```js
const { IST_TODAY_SQL } = require('../utils/dayBoundary');
```

- [ ] **Step 2: Stamp writes in IST**

`nutrition.js`'s `POST /log` INSERT currently omits `logged_date`, so it falls back to the column's `DEFAULT CURRENT_DATE` — that default is what produces UTC dates. Add the column explicitly:

```js
        `INSERT INTO calorie_logs (
            user_id, food_name, calories, protein, carbs, fat, serving_size, meal_type, visibility, logged_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${IST_TODAY_SQL})
        RETURNING *`
```

Do the same for `POST /log-bulk`: append `, ${IST_TODAY_SQL}` inside each row's placeholder group. **The placeholder arithmetic there is index-based (`i * 9`)** — `IST_TODAY_SQL` is a literal SQL expression, NOT a bound value, so the `values` array and the `$n` count must stay exactly as they are. Adding it must not shift any `$n`.

Also update `calories.js:46`, which passes `CURRENT_DATE` explicitly.

- [ ] **Step 3: Compare reads in IST**

Replace `logged_date = CURRENT_DATE` with `logged_date = ${IST_TODAY_SQL}` at `calories.js:69` and `:83`, and the interval comparison at `:137`. In `nutrition.js`, replace `DATE(created_at) = CURRENT_DATE` at `:239` and the `DATE(created_at)` grouping at `:331` with the IST equivalent.

Confirm each affected query string is a template literal (backticks) before interpolating. If any is a plain quoted string, convert it.

- [ ] **Step 4: Verify no bare CURRENT_DATE remains in food routes**

Run: `cd backend && grep -n "CURRENT_DATE" src/routes/calories.js src/routes/nutrition.js`
Expected: no hits. Any remaining hit is a site that still uses the UTC day.

- [ ] **Step 5: Verify the SQL executes and actually differs**

Run:
```bash
cd backend && node -e "
require('dotenv').config();
const {Client}=require('pg');
const {IST_TODAY_SQL}=require('./src/utils/dayBoundary');
const c=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{
  await c.connect();
  const r=(await c.query(\`SELECT CURRENT_DATE AS utc_today, \${IST_TODAY_SQL} AS ist_today\`)).rows[0];
  console.log('UTC today:', r.utc_today.toISOString().slice(0,10));
  console.log('IST today:', r.ist_today.toISOString().slice(0,10));
  const n=(await c.query(\`SELECT COUNT(*) c FROM calorie_logs WHERE logged_date = \${IST_TODAY_SQL}\`)).rows[0];
  console.log('entries on IST today:', n.c);
  await c.end();
})();
"
```
Expected: both dates print and the query runs. They may or may not differ depending on the hour — the point is that the fragment is valid SQL against the live schema.

- [ ] **Step 6: Run the suite and commit**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; full suite green.

```bash
git add backend/src/routes/calories.js backend/src/routes/nutrition.js
git commit -m "fix(food): use IST for the day boundary, matching check-in

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Edit and per-day endpoints

**Files:**
- Modify: `backend/src/routes/calories.js`

**Interfaces:**
- Consumes: `validateEntryPatch` (Task 2), `isValidDateString` (Task 1).
- Produces:
  - `PATCH /api/calories/:id` → `200 { success: true, entry }` · `404` if not the caller's · `400` on invalid input
  - `GET /api/calories/day/:date` → `200 { entries, totals }`, same shape as `/today`

- [ ] **Step 1: Add the requires**

```js
const { validateEntryPatch } = require('../utils/entryEdit');
const { isValidDateString } = require('../utils/dayBoundary');
```

- [ ] **Step 2: Add the per-day route**

Place it **above** the existing `router.delete('/:id', ...)` and any other `/:id` route so `day` is not swallowed as an id. Add it near `/today` for readability:

```js
/**
 * GET /api/calories/day/:date
 * Entries for one day, 'YYYY-MM-DD'. Same shape as /today.
 */
router.get('/day/:date', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { date } = req.params;

    if (!isValidDateString(date)) {
        throw new ValidationError('Date must be YYYY-MM-DD');
    }

    const entries = await query(
        `SELECT * FROM calorie_logs
          WHERE user_id = $1 AND logged_date = $2::date
          ORDER BY created_at DESC`,
        [userId, date]
    );

    const totals = await query(
        `SELECT
            COALESCE(SUM(calories), 0) as total_calories,
            COALESCE(SUM(protein), 0) as total_protein,
            COALESCE(SUM(carbs), 0) as total_carbs,
            COALESCE(SUM(fat), 0) as total_fat,
            COUNT(*) as entry_count
         FROM calorie_logs
         WHERE user_id = $1 AND logged_date = $2::date`,
        [userId, date]
    );

    res.json({
        date,
        entries: entries.rows,
        totals: {
            calories: parseInt(totals.rows[0].total_calories),
            protein: parseInt(totals.rows[0].total_protein),
            carbs: parseInt(totals.rows[0].total_carbs),
            fat: parseInt(totals.rows[0].total_fat),
            entry_count: parseInt(totals.rows[0].entry_count),
        },
    });
}));
```

- [ ] **Step 3: Add the edit route**

```js
/**
 * PATCH /api/calories/:id
 * Correct a logged entry. Only the fields sent are changed — omitted columns
 * keep their current value, so fixing calories cannot blank the macros.
 */
router.patch('/:id', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const entryId = req.params.id;

    const { valid, error, fields } = validateEntryPatch(req.body);
    if (!valid) throw new ValidationError(error);

    // Build a partial UPDATE from exactly the keys that were sent. COALESCE is
    // not needed because absent keys never appear in the SET list at all.
    const keys = Object.keys(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map((k) => fields[k]);

    const result = await query(
        `UPDATE calorie_logs
            SET ${setClause}
          WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}
      RETURNING *`,
        [...values, entryId, userId]
    );

    if (result.rows.length === 0) {
        // 404 rather than 403: 403 would confirm the row exists but belongs to
        // someone else. Matches the DELETE handler below.
        throw new NotFoundError('Entry not found');
    }

    await cache.del(cache.keys.nutritionToday(userId));

    res.json({ success: true, entry: result.rows[0] });
}));
```

The column names in `setClause` come from `validateEntryPatch`'s own allow-list, never from raw request keys — unknown keys are dropped by the validator, so no caller-controlled string reaches the SQL text.

Confirm `ValidationError`, `NotFoundError`, and `cache` are already imported in `calories.js`; add only what is missing.

- [ ] **Step 4: Verify route ordering**

Run: `cd backend && grep -n "router\.\(get\|patch\|delete\)('/" src/routes/calories.js`
Expected: `/day/:date` appears **before** `/:id` and `/frequent`. A `/:id` route registered first would capture `day` as an id.

- [ ] **Step 5: Run the suite and commit**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; full suite green.

```bash
git add backend/src/routes/calories.js
git commit -m "feat(food): add per-day and edit endpoints for calorie entries

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Mobile API additions

**Files:**
- Modify: `mobile/src/services/api.ts` (the `caloriesAPI` object, ~line 667)

**Interfaces:**
- Consumes: the endpoints from Task 4.
- Produces:
  - `caloriesAPI.getDay(date: string)` → `Promise<{ date, entries, totals }>`
  - `caloriesAPI.update(entryId, patch)` → `Promise<{ success, entry }>`
  - `CalorieEntry` interface, exported

- [ ] **Step 1: Add the type and methods**

`caloriesAPI.getToday()` (line 673) and `caloriesAPI.delete(entryId)` (line 688) already exist — **do not re-add them.** Add alongside:

```ts
export interface CalorieEntry {
    id: string;
    food_name: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    serving_size: string | null;
    meal_type: string | null;
    logged_date: string;
    created_at: string;
}

export interface CalorieDay {
    date?: string;
    entries: CalorieEntry[];
    totals: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        entry_count: number;
    };
}
```

```ts
    getDay: async (date: string): Promise<CalorieDay> => {
        const response = await api.get(`/calories/day/${date}`);
        return response.data;
    },

    update: async (entryId: string, patch: {
        food_name?: string;
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
        serving_size?: string;
        meal_type?: string;
    }) => {
        const response = await api.patch(`/calories/${entryId}`, patch);
        return response.data;
    },
```

- [ ] **Step 2: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

```bash
git add mobile/src/services/api.ts
git commit -m "feat(food): add per-day and update calorie API methods

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: FoodEntrySheet

**Files:**
- Create: `mobile/src/components/FoodEntrySheet.tsx`

**Interfaces:**
- Consumes: `CalorieEntry`, `caloriesAPI.update`, `caloriesAPI.delete` (Task 5).
- Produces: `<FoodEntrySheet entry={CalorieEntry|null} onClose={() => void} onChanged={() => void} />`. `onChanged` fires after a successful edit or delete so the caller can refetch.

- [ ] **Step 1: Build the component**

Create `mobile/src/components/FoodEntrySheet.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { caloriesAPI, CalorieEntry } from '../services/api';
import { useToast } from './Toast';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface FoodEntrySheetProps {
    entry: CalorieEntry | null;
    onClose: () => void;
    onChanged: () => void;
}

const MACROS = [
    { key: 'calories' as const, label: 'Calories', unit: 'kcal' },
    { key: 'protein' as const, label: 'Protein', unit: 'g' },
    { key: 'carbs' as const, label: 'Carbs', unit: 'g' },
    { key: 'fat' as const, label: 'Fat', unit: 'g' },
];

const FoodEntrySheet: React.FC<FoodEntrySheetProps> = ({ entry, onClose, onChanged }) => {
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<Record<string, string>>({});

    // Reset whenever a different entry opens, so a previous edit never leaks
    // into the next entry the member taps.
    useEffect(() => {
        setEditing(false);
        setDraft(
            entry
                ? {
                      calories: String(entry.calories ?? 0),
                      protein: String(entry.protein ?? 0),
                      carbs: String(entry.carbs ?? 0),
                      fat: String(entry.fat ?? 0),
                  }
                : {},
        );
    }, [entry?.id]);

    if (!entry) return null;

    const save = async () => {
        const patch: Record<string, number> = {};
        for (const m of MACROS) {
            const n = Number(draft[m.key]);
            if (!Number.isFinite(n) || n < 0) {
                toast.error('Check the numbers', `${m.label} must be 0 or more`);
                return;
            }
            patch[m.key] = Math.round(n);
        }
        setBusy(true);
        try {
            await caloriesAPI.update(entry.id, patch);
            toast.success('Updated', entry.food_name || 'Entry saved');
            onChanged();
            onClose();
        } catch (e: any) {
            // Leave the sheet open with what they typed — never discard input.
            toast.error('Could not save', e?.message || 'Please try again');
        } finally {
            setBusy(false);
        }
    };

    const confirmDelete = () => {
        Alert.alert('Delete entry', `Remove ${entry.food_name || 'this entry'} from your log?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setBusy(true);
                    try {
                        await caloriesAPI.delete(entry.id);
                        toast.success('Deleted', 'Entry removed');
                        onChanged();
                        onClose();
                    } catch (e: any) {
                        toast.error('Could not delete', e?.message || 'Please try again');
                    } finally {
                        setBusy(false);
                    }
                },
            },
        ]);
    };

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.name} numberOfLines={2}>{entry.food_name || 'Entry'}</Text>
                    {!!entry.serving_size && <Text style={styles.serving}>{entry.serving_size}</Text>}

                    <View style={styles.macros}>
                        {MACROS.map((m) => (
                            <View key={m.key} style={styles.macroRow}>
                                <Text style={styles.macroLabel}>{m.label}</Text>
                                {editing ? (
                                    <TextInput
                                        style={styles.macroInput}
                                        value={draft[m.key]}
                                        onChangeText={(v) => setDraft((d) => ({ ...d, [m.key]: v }))}
                                        keyboardType="numeric"
                                        selectTextOnFocus
                                        accessibilityLabel={`${m.label} in ${m.unit}`}
                                    />
                                ) : (
                                    <Text style={styles.macroValue}>
                                        {entry[m.key]} {m.unit}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>

                    <View style={styles.actions}>
                        {editing ? (
                            <>
                                <Pressable style={styles.secondary} onPress={() => setEditing(false)} disabled={busy}>
                                    <Text style={styles.secondaryText}>CANCEL</Text>
                                </Pressable>
                                <Pressable style={styles.primary} onPress={save} disabled={busy}>
                                    {busy ? <ActivityIndicator color={colors.text.primary} /> : <Text style={styles.primaryText}>SAVE</Text>}
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Pressable style={styles.danger} onPress={confirmDelete} disabled={busy}>
                                    <Text style={styles.dangerText}>DELETE</Text>
                                </Pressable>
                                <Pressable style={styles.primary} onPress={() => setEditing(true)} disabled={busy}>
                                    <Text style={styles.primaryText}>EDIT</Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

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
    name: { fontSize: typography.sizes.xl, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary },
    serving: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.regular, color: colors.text.muted, marginTop: spacing.xs },
    macros: { marginTop: spacing.lg },
    macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
    macroLabel: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.regular, color: colors.text.secondary },
    macroValue: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary },
    macroInput: {
        minWidth: 90,
        textAlign: 'right',
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        borderBottomWidth: 1,
        borderColor: colors.glass.borderLight,
        paddingVertical: 2,
    },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    primary: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.glass.surfaceLight, alignItems: 'center' },
    primaryText: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary, letterSpacing: 1 },
    secondary: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.glass.border, alignItems: 'center' },
    secondaryText: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.semiBold, color: colors.text.muted, letterSpacing: 1 },
    danger: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.error, alignItems: 'center' },
    dangerText: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.semiBold, color: colors.error, letterSpacing: 1 },
});

export default FoodEntrySheet;
```

Verify every token exists in `mobile/src/styles/theme.ts` before finishing; substitute the nearest existing one if not and record it in your report.

- [ ] **Step 2: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors. The component is not mounted yet — Task 7 mounts it. Do not commit alone; commit together with Task 7.

---

### Task 7: Today's list on CalorieLogScreen

**Files:**
- Modify: `mobile/src/screens/member/CalorieLogScreen.tsx`

**Interfaces:**
- Consumes: `caloriesAPI.getToday` (already exists), `FoodEntrySheet` (Task 6), `CalorieEntry` (Task 5).
- Produces: nothing downstream.

- [ ] **Step 1: Import and add state**

```tsx
import FoodEntrySheet from '../../components/FoodEntrySheet';
import { caloriesAPI, CalorieEntry } from '../../services/api';
```

`caloriesAPI` may already be imported in this file — check the existing `services/api` import line and extend it rather than adding a second import statement.

```tsx
const [todayEntries, setTodayEntries] = useState<CalorieEntry[]>([]);
const [openEntry, setOpenEntry] = useState<CalorieEntry | null>(null);
```

- [ ] **Step 2: Load today's entries**

```tsx
const loadTodayEntries = useCallback(() => {
    caloriesAPI.getToday()
        .then((r) => setTodayEntries(r.entries || []))
        .catch(() => setTodayEntries([]));
}, []);

useEffect(() => { loadTodayEntries(); }, [loadTodayEntries]);
```

Also call `loadTodayEntries()` wherever the screen already refreshes after a successful log, so a newly logged food appears in the list immediately. Read the existing log-success path (`logFoodOptimistic` is called around line 607) and add the call beside the existing `refreshToday()`.

- [ ] **Step 3: Render the list**

Place it below the existing quick-add / search area:

```tsx
{todayEntries.length > 0 && (
    <View style={{ marginTop: spacing.lg }}>
        <Text style={styles.servingPickerLabel}>TODAY'S LOG</Text>
        {todayEntries.map((e) => (
            <Pressable
                key={e.id}
                onPress={() => setOpenEntry(e)}
                style={styles.todayRow}
                accessibilityRole="button"
                accessibilityLabel={`${e.food_name || 'Entry'}, ${e.calories} calories. Tap to edit or delete.`}
            >
                <View style={{ flex: 1 }}>
                    <Text style={styles.todayName} numberOfLines={1}>{e.food_name || 'Entry'}</Text>
                    {!!e.serving_size && <Text style={styles.todayServing} numberOfLines={1}>{e.serving_size}</Text>}
                </View>
                <Text style={styles.todayKcal}>{e.calories} kcal</Text>
            </Pressable>
        ))}
    </View>
)}

<FoodEntrySheet
    entry={openEntry}
    onClose={() => setOpenEntry(null)}
    onChanged={loadTodayEntries}
/>
```

`styles.servingPickerLabel` already exists in this file. Add the three new row styles to the existing `StyleSheet.create`:

```tsx
    todayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    todayName: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    todayServing: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    todayKcal: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
```

- [ ] **Step 4: Verify**

Run: `cd mobile && npx tsc --noEmit` → 0 errors
Run: `cd backend && node scripts/wiring_audit.js` → `nav orphans=0, api orphans=0`

- [ ] **Step 5: Commit Tasks 6 and 7 together**

```bash
git add mobile/src/components/FoodEntrySheet.tsx mobile/src/screens/member/CalorieLogScreen.tsx
git commit -m "feat(food): show today's log with tap-to-edit sheet

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Tappable calendar days in Profile

**Files:**
- Modify: `mobile/src/components/WorkoutCalendar.tsx`
- Modify: `mobile/app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `caloriesAPI.getDay` (Task 5), `FoodEntrySheet` (Task 6).
- Produces: `WorkoutCalendar` gains `onDayPress?: (date: string) => void`.

- [ ] **Step 1: Add the prop**

```tsx
interface WorkoutCalendarProps {
    history: string[];
    foodHistory?: string[];
    /** Tapping a day opens that day's detail. Omit to keep days inert. */
    onDayPress?: (date: string) => void;
}
```

Destructure `onDayPress` alongside the existing props.

- [ ] **Step 2: Make each day tappable**

The whole calendar is wrapped in a `Pressable` at line 62 that toggles expand/collapse, and days are mapped at line 77 as `<View key={d.day} style={styles.dayContainer}>`. Wrap each day's contents so a day tap does not also toggle the calendar:

```tsx
                            <Pressable
                                key={d.day}
                                style={styles.dayContainer}
                                onPress={onDayPress ? () => onDayPress(d.dateStr) : undefined}
                                disabled={!onDayPress}
                                accessibilityRole={onDayPress ? 'button' : undefined}
                                accessibilityLabel={onDayPress ? `View ${d.dateStr}` : undefined}
                            >
```

replacing the `<View key={d.day} style={styles.dayContainer}>` opening tag and its matching closing `</View>`. A child `Pressable` receives the touch before the parent, so tapping a day opens the day and tapping the surrounding area still expands the calendar.

- [ ] **Step 3: Wire Profile**

In `mobile/app/(tabs)/profile.tsx`, add state and the handler near the existing stats state (~line 35):

```tsx
const [dayView, setDayView] = useState<{ date: string; entries: CalorieEntry[] } | null>(null);
const [openEntry, setOpenEntry] = useState<CalorieEntry | null>(null);
```

```tsx
const openDay = useCallback((date: string) => {
    caloriesAPI.getDay(date)
        .then((r) => setDayView({ date, entries: r.entries || [] }))
        .catch(() => setDayView({ date, entries: [] }));
}, []);
```

Pass it to the calendar at line ~240:

```tsx
<WorkoutCalendar history={stats.history} foodHistory={stats.foodHistory} onDayPress={openDay} />
```

- [ ] **Step 4: Render the day list**

`caloriesAPI` is **already imported** at `profile.tsx:18` and `useToast` at `:24` — extend the line-18 import with `CalorieEntry` rather than adding a second import statement. Also add:

```tsx
import FoodEntrySheet from '../../src/components/FoodEntrySheet';
```

Render both modals near the root of the screen's JSX. Reuse `FoodEntrySheet` for the entry detail so edit and delete behave identically to the Today list — do **not** build a second editor:

```tsx
<Modal
    visible={dayView !== null}
    transparent
    animationType="slide"
    onRequestClose={() => setDayView(null)}
>
    <Pressable style={styles.dayBackdrop} onPress={() => setDayView(null)}>
        <Pressable style={styles.daySheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dayTitle}>{dayView?.date}</Text>

            {dayView?.entries.length === 0 ? (
                <Text style={styles.dayEmpty}>Nothing logged this day</Text>
            ) : (
                dayView?.entries.map((e) => (
                    <Pressable
                        key={e.id}
                        style={styles.dayRow}
                        onPress={() => setOpenEntry(e)}
                        accessibilityRole="button"
                        accessibilityLabel={`${e.food_name || 'Entry'}, ${e.calories} calories. Tap to edit or delete.`}
                    >
                        <Text style={styles.dayRowName} numberOfLines={1}>
                            {e.food_name || 'Entry'}
                        </Text>
                        <Text style={styles.dayRowKcal}>{e.calories} kcal</Text>
                    </Pressable>
                ))
            )}
        </Pressable>
    </Pressable>
</Modal>

<FoodEntrySheet
    entry={openEntry}
    onClose={() => setOpenEntry(null)}
    onChanged={() => { if (dayView) openDay(dayView.date); }}
/>
```

`Modal` and `Pressable` come from `react-native` — check the existing import block at `profile.tsx:2-13` and add only what is missing.

Add these styles to the existing `StyleSheet.create`:

```tsx
    dayBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    daySheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
        borderTopWidth: 1,
        borderColor: colors.glass.border,
        maxHeight: '70%',
    },
    dayTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    dayEmpty: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        paddingVertical: spacing.lg,
    },
    dayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    dayRowName: {
        flex: 1,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    dayRowKcal: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
```

Note the two modals are siblings, not nested — `FoodEntrySheet` renders its own `Modal`, and nesting one inside another is unreliable on Android.

- [ ] **Step 5: Verify**

Run: `cd mobile && npx tsc --noEmit` → 0 errors
Run: `cd backend && npx jest && node scripts/wiring_audit.js` → suite green, `nav orphans=0, api orphans=0`

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/WorkoutCalendar.tsx "mobile/app/(tabs)/profile.tsx"
git commit -m "feat(food): open a day's food log from the profile calendar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Rollout Notes

- **Task 3 changes which rows count as "today"** for every member, immediately on deploy. Between 00:00 and 05:30 IST the visible set shifts by a day. That is the fix, not a regression.
- **No migration.** Nothing is added to or altered in the schema, and no historical row is touched.
- **The 18 existing rows keep UTC-derived `logged_date`.** A few will show on the wrong day in the week view, permanently. This was a deliberate human decision; the module docstring should say so.
- **Tasks 1–5 are backend-plus-client-only** and ship with nothing user-visible. Stopping after Task 5 leaves the app exactly as it is today.
- **Tasks 6 and 7 must land together** — the sheet is unmounted until Task 7 renders it.
