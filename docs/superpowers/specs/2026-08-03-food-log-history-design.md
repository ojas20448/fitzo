# Food Log History and Correction — Design

**Date:** 2026-08-03
**Status:** Approved

## Problem

A member can log food but cannot see it back. Concretely:

1. **No list of today's entries anywhere in the app.** Log a dal with the wrong portion and the daily total is simply wrong — there is no screen that shows what went in, so there is nothing to correct.
2. **No way to review the past week.** Profile renders food as *dots on a calendar* (`WorkoutCalendar`), so you can see **that** you logged something on Tuesday but never **what**.

This is a trust problem more than a feature gap. A log you cannot audit or correct is a log you stop believing, and the daily total silently drifts from reality.

## What already exists

Most of the read path is built and unused:

| Capability | Status |
|---|---|
| `GET /api/calories/today` | **Already returns `entries[]` plus totals.** Nothing consumes it. |
| `DELETE /api/calories/:id` | Exists **and is already wired** at `mobile/src/services/api.ts:689` |
| `GET /api/calories/history?days=N` | Exists — daily *totals* grouped by date, not the foods |
| `GET /api/nutrition/today` | Totals only, no items |
| `GET /api/nutrition/weekly` | Daily totals only, no items |
| Any UI listing entries | **None, anywhere** |
| Any way to edit a log | **None.** No `PUT`/`PATCH` exists; delete is the only correction. |

So this is largely a UI job plus two endpoints, not a from-scratch build.

## The day boundary — the thing that makes this subtle

The database runs in **UTC** and every food query uses `CURRENT_DATE`. Measured against the live database while writing this spec:

```
CURRENT_DATE (what food queries use) : 2026-08-02
IST date     (what check-in uses)    : 2026-08-03   ← different at that moment
```

For **5½ hours every night** (00:00–05:30 IST) the app's "today" is yesterday in IST. `checkin.js` already uses `DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata')`, so **the food log and the check-in streak currently disagree about what day it is.**

A screen literally called "Today" cannot be built on top of that ambiguity without picking a side. For an India-first product, IST is the only defensible answer.

The root cause is not the queries — it is that `logged_date DATE NOT NULL DEFAULT CURRENT_DATE` stamps the date from the **column default**, in server time, at insert.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Day boundary | **IST**, matching `checkin.js` | One definition of "day" across the app |
| Where the rule lives | **One module**, `utils/dayBoundary.js` | Same shape of problem `volume.js` already solved; five-plus sites must not drift |
| Historical rows | **No backfill.** Fix going forward only. | Chosen deliberately: no existing row is mutated |
| Editing | **Macros edited directly** (calories/protein/carbs/fat as numbers) | Works for every entry regardless of source — search, barcode, AI photo, thali preset. `serving_size` is free text, so no multiplier can be reliably reverse-engineered. |
| Entry interaction | **Tap opens a detail sheet** | Safer than swipe for a destructive action, and gives edit somewhere to live |
| Week view | **Existing calendar dots become tappable** | Reuses what is already in Profile rather than adding a parallel screen |

### Accepted consequence of not backfilling

There are 18 existing `calorie_logs` rows. Any created between 18:30–00:00 UTC carries a `logged_date` one day behind its true IST date, and will keep showing on that earlier day in the week view. New rows will be correct. This is a deliberate trade to avoid mutating existing data, and it is small — but it means the data has two eras, and that should be stated in the module rather than discovered later.

## Architecture

### 1. Day boundary module

Create `backend/src/utils/dayBoundary.js`:

```js
const APP_TIMEZONE = 'Asia/Kolkata';

/** The member's current day, as SQL. */
const IST_TODAY_SQL = `(NOW() AT TIME ZONE '${APP_TIMEZONE}')::date`;

/** The day a row belongs to, derived from its timestamp. Requires `created_at` in scope. */
const IST_DAY_OF_SQL = `(created_at AT TIME ZONE '${APP_TIMEZONE}')::date`;

/** JS equivalent, for building request params and comparing client-side. */
function istDateString(at = new Date()) {
    const d = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(d.getTime())) return null;
    // Shift by IST's fixed +05:30 then read the UTC parts. India has no DST,
    // so a fixed offset is correct here and avoids an Intl dependency.
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
}
```

`MAX_ITEM_CALORIES` (10000) and `MAX_ITEM_MACRO_GRAMS` (2000) are already exported from `backend/src/utils/mealCombo.js:69` — verified, not assumed.

`POST /api/nutrition/log` and `POST /api/nutrition/log-bulk` stop relying on the UTC column default and stamp `logged_date` explicitly using `IST_TODAY_SQL`. All food reads compare `logged_date` against `IST_TODAY_SQL`.

Reads use the stored `logged_date` column rather than deriving from `created_at`, because `idx_calorie_log_user (user_id, logged_date DESC)` exists and a derived expression would not use it.

### 2. API

| Endpoint | Change |
|---|---|
| `GET /api/calories/today` | Compare against IST rather than `CURRENT_DATE`. Response shape unchanged. |
| `GET /api/calories/day/:date` | **New.** Entries for one `YYYY-MM-DD`, scoped to the caller. Same shape as `/today`. |
| `PATCH /api/calories/:id` | **New.** Edit `food_name`, `calories`, `protein`, `carbs`, `fat`, `serving_size`, `meal_type`. Scoped to the caller's own row — another user's id returns 403, not 404, and never leaks whether it exists. |
| `POST /api/nutrition/log`, `/log-bulk` | Stamp `logged_date` in IST |

Validation for `PATCH` is a pure function so it is unit-testable without a database, reusing the bounds already established in `utils/mealCombo.js` (`MAX_ITEM_CALORIES`, `MAX_ITEM_MACRO_GRAMS`) rather than inventing a second set.

### 3. Mobile

- **`FoodEntrySheet.tsx`** (new) — one component serving both read and edit. Shows food name, serving, four macros, meal type, time logged. Actions: Edit, Delete. Delete confirms first; it is destructive and there is no undo.
- **`CalorieLogScreen`** — a "Today" section listing entries from the already-existing `/calories/today`. Tap opens the sheet.
- **`WorkoutCalendar`** — gains an optional `onDayPress?: (date: string) => void`. The component currently wraps everything in a single `Pressable` (line 62) for expand/collapse and maps days at line 77, so day taps need a nested pressable that does not swallow the expand toggle on the surrounding area.
- **Profile** — passes `onDayPress`, opening a day view backed by `GET /api/calories/day/:date`.

## Error handling

- `PATCH` on someone else's entry → 403, without revealing existence.
- `PATCH` with out-of-range macros → 400 naming the field, same bounds as bulk logging.
- Invalid `:date` (not `YYYY-MM-DD`) → 400 before any query runs.
- A failed edit leaves the sheet open with the values the member typed — never silently discard their input.
- Delete is confirmed in the UI; the endpoint itself stays idempotent-ish (deleting an already-deleted id returns 404, which the client treats as success since the desired end state holds).

## Testing

Pure functions get real tests: `istDateString` and the `PATCH` validator.

**Fixtures must not be the benign case.** Two bugs earlier in this codebase hid behind fixtures where the arithmetic happened to land on whole numbers, and a green suite proved nothing. For the day boundary specifically that means testing:

- A timestamp at **18:30 UTC** — the exact moment IST rolls to the next day
- A timestamp at **23:59 IST** and **00:01 IST**, which must land on different days
- A timestamp at **00:00 UTC**, which is 05:30 IST the same day
- Macro bounds at exactly the limit and one over
- `PATCH` with a partial body — omitted fields must remain untouched, not reset to 0

That last one matters: a `PATCH` that nulls unspecified macros would silently zero a member's protein when they only meant to fix calories.

## Out of scope

- Backfilling the 18 historical rows.
- Deriving the day from `created_at` at read time. This would fix history without mutating anything, but cannot use the existing `logged_date` index. Worth revisiting if the two-era inconsistency ever becomes a real complaint.
- Editing workout logs. Same shape of problem, different subsystem.
- Undo for delete.
- Changing an entry's date or moving it between days.
