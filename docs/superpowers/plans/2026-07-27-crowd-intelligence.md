# Crowd Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Fitzo's inaccurate live crowd light into trustworthy crowd intelligence — a busy-by-hour heatmap built from check-in history, an honest live occupancy number, and a "your gym is quiet now" push.

**Architecture:** All derivation logic lives in pure, dependency-free functions under `backend/src/utils/` (following the existing `crowd.js` pattern) so it is unit-testable without a database. SQL does raw aggregation only; shaping, scoring, and thresholds happen in JS. The mobile app consumes three new endpoints and renders one new component.

**Tech Stack:** Node 20, Express 4, PostgreSQL (Supabase), Jest, Expo/React Native 0.81, TypeScript.

## Global Constraints

- **Timezone is `Asia/Kolkata` for all date/hour bucketing.** `checkin.js:42` already dedupes with `DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata')`. Any hour-of-week bucketing MUST use `AT TIME ZONE 'Asia/Kolkata'` or the heatmap will be shifted 5.5 hours.
- **`attendances.checked_in_at` is `TIMESTAMP WITH TIME ZONE`.** Never compare it to a bare `CURRENT_DATE` without an explicit zone conversion.
- **Pure logic goes in `backend/src/utils/`, is exported as named functions, and is tested in `backend/src/__tests__/<name>.test.js`.** Tests must not require a live database — pass rows in as arrays.
- **Caching pattern:** `cache.getOrSet(cache.keys.<name>(id), asyncFn, cache.TTL.<NAME>)`. New keys go in the `keys` object at `backend/src/services/cache.js:137`; new TTLs in the `TTL` object at `backend/src/services/cache.js:34`.
- **All routes require `authenticate`** and wrap handlers in `asyncHandler`. Errors use the classes in `backend/src/utils/errors.js` (`ValidationError`, `NotFoundError`, `ConflictError`, `AuthError`).
- **Tenancy:** never accept a gym id as authoritative from the client body. Validate any `:id` path param against `req.user.gym_id`.
- **Cron endpoints** live in `backend/src/routes/cron.js`, sit behind the existing `x-cron-secret` middleware, and MUST respond `202` immediately then run the batch in the background.
- **Migrations** are raw `.sql` files in `backend/data/migrations/`, numbered, applied with `node apply_migration.js data/migrations/<file>.sql`. They must be idempotent (`IF NOT EXISTS`).
- **Mobile styling uses tokens only** from `mobile/src/styles/theme.ts` (`colors.glass.*`, `colors.success/warning/error`, `colors.text.*`, `spacing`, `typography`, `borderRadius`). No hardcoded hex.
- **Privacy floor:** never render a busy-times grid derived from fewer than `MIN_TOTAL_SAMPLES = 20` check-ins. Return a `confidence` flag and let the client hide the chart.

---

### Task 1: Busy-times derivation (pure function)

Builds the 7×24 grid logic with zero database or Express involvement.

**Files:**
- Create: `backend/src/utils/busyTimes.js`
- Test: `backend/src/__tests__/busy-times.test.js`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `computeBusyTimes(rows)` → `{ grid, peak, quietest, totalSamples, confidence }`
    - `rows`: `Array<{ dow: number, hour: number, arrivals: number }>` where `dow` is 0–6 (0 = Sunday, matching Postgres `EXTRACT(DOW)`) and `hour` is 0–23.
    - `grid`: `number[7][24]` of relative busyness 0–100, or `null` when `confidence === 'none'`.
    - `peak` / `quietest`: `{ dow, hour, score }` or `null`.
    - `confidence`: `'none' | 'low' | 'good'`.
  - `MIN_TOTAL_SAMPLES` (number, 20), `GOOD_CONFIDENCE_SAMPLES` (number, 60).

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/busy-times.test.js`:

```js
/**
 * Busy Times Tests
 * 7x24 hour-of-week grid derived from check-in arrivals.
 */

const {
    computeBusyTimes,
    MIN_TOTAL_SAMPLES,
} = require('../utils/busyTimes');

// Helper: build `count` rows all on the same dow/hour
const row = (dow, hour, arrivals) => ({ dow, hour, arrivals });

describe('computeBusyTimes', () => {
    it('reports no confidence below the sample floor', () => {
        const result = computeBusyTimes([row(1, 7, 5)]);
        expect(result.confidence).toBe('none');
        expect(result.grid).toBeNull();
        expect(result.peak).toBeNull();
        expect(result.totalSamples).toBe(5);
    });

    it('builds a 7x24 grid once past the sample floor', () => {
        const rows = [row(1, 7, 30), row(1, 14, 10)];
        const result = computeBusyTimes(rows);
        expect(result.confidence).not.toBe('none');
        expect(result.grid).toHaveLength(7);
        expect(result.grid[0]).toHaveLength(24);
    });

    it('scores the busiest hour 100 and empty hours 0', () => {
        const rows = [row(1, 7, 30), row(1, 14, 15)];
        const result = computeBusyTimes(rows);
        expect(result.grid[1][7]).toBe(100);
        expect(result.grid[1][14]).toBe(50);
        expect(result.grid[3][3]).toBe(0);
    });

    it('identifies peak and quietest observed hours', () => {
        const rows = [row(2, 18, 40), row(2, 6, 25), row(2, 15, 5)];
        const result = computeBusyTimes(rows);
        expect(result.peak).toMatchObject({ dow: 2, hour: 18, score: 100 });
        expect(result.quietest).toMatchObject({ dow: 2, hour: 15 });
    });

    it('marks low confidence between the floor and the good threshold', () => {
        const result = computeBusyTimes([row(1, 7, MIN_TOTAL_SAMPLES)]);
        expect(result.confidence).toBe('low');
    });

    it('marks good confidence at 60+ samples', () => {
        const result = computeBusyTimes([row(1, 7, 60)]);
        expect(result.confidence).toBe('good');
    });

    it('ignores malformed rows instead of throwing', () => {
        const rows = [row(1, 7, 30), { dow: 9, hour: 99, arrivals: 5 }, { dow: 1 }];
        const result = computeBusyTimes(rows);
        expect(result.totalSamples).toBe(30);
        expect(result.grid[1][7]).toBe(100);
    });

    it('returns none for an empty history', () => {
        const result = computeBusyTimes([]);
        expect(result.confidence).toBe('none');
        expect(result.totalSamples).toBe(0);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest busy-times --verbose`
Expected: FAIL — `Cannot find module '../utils/busyTimes'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/utils/busyTimes.js`:

```js
/**
 * Busy Times Derivation
 *
 * Turns raw check-in arrival counts (already bucketed by IST day-of-week and
 * hour by SQL) into a normalised 7x24 busyness grid.
 *
 * Scores are RELATIVE to the gym's own busiest hour (0-100), not to capacity.
 * "Busy for this gym" is the useful signal; absolute occupancy is a separate
 * concern handled by crowd.js.
 *
 * Privacy: below MIN_TOTAL_SAMPLES check-ins the grid is suppressed entirely —
 * a sparse grid can deanonymise individual members' gym habits.
 */

const DAYS = 7;
const HOURS = 24;

const MIN_TOTAL_SAMPLES = 20;   // below this: show nothing
const GOOD_CONFIDENCE_SAMPLES = 60; // at/above this: trust the shape

function emptyGrid() {
    return Array.from({ length: DAYS }, () => new Array(HOURS).fill(0));
}

function isValidRow(r) {
    if (!r) return false;
    const dow = Number(r.dow);
    const hour = Number(r.hour);
    const arrivals = Number(r.arrivals);
    return (
        Number.isInteger(dow) && dow >= 0 && dow < DAYS &&
        Number.isInteger(hour) && hour >= 0 && hour < HOURS &&
        Number.isFinite(arrivals) && arrivals > 0
    );
}

/**
 * @param {Array<{dow:number,hour:number,arrivals:number}>} rows
 * @returns {{grid:number[][]|null, peak:object|null, quietest:object|null,
 *            totalSamples:number, confidence:'none'|'low'|'good'}}
 */
function computeBusyTimes(rows) {
    const valid = (Array.isArray(rows) ? rows : []).filter(isValidRow);
    const totalSamples = valid.reduce((sum, r) => sum + Number(r.arrivals), 0);

    if (totalSamples < MIN_TOTAL_SAMPLES) {
        return { grid: null, peak: null, quietest: null, totalSamples, confidence: 'none' };
    }

    // Raw counts into the grid
    const counts = emptyGrid();
    valid.forEach((r) => {
        counts[Number(r.dow)][Number(r.hour)] += Number(r.arrivals);
    });

    // Normalise against the single busiest cell
    let max = 0;
    counts.forEach((day) => day.forEach((c) => { if (c > max) max = c; }));

    const grid = counts.map((day) => day.map((c) => (max > 0 ? Math.round((c / max) * 100) : 0)));

    // Peak + quietest are drawn from OBSERVED hours only. An hour with zero
    // check-ins usually means "gym shut", not "gym pleasantly empty" — calling
    // 3am the quietest hour would be true and useless.
    let peak = null;
    let quietest = null;
    valid.forEach((r) => {
        const dow = Number(r.dow);
        const hour = Number(r.hour);
        const score = grid[dow][hour];
        if (!peak || score > peak.score) peak = { dow, hour, score };
        if (!quietest || score < quietest.score) quietest = { dow, hour, score };
    });

    const confidence = totalSamples >= GOOD_CONFIDENCE_SAMPLES ? 'good' : 'low';

    return { grid, peak, quietest, totalSamples, confidence };
}

module.exports = {
    computeBusyTimes,
    MIN_TOTAL_SAMPLES,
    GOOD_CONFIDENCE_SAMPLES,
    DAYS,
    HOURS,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest busy-times --verbose`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/busyTimes.js backend/src/__tests__/busy-times.test.js
git commit -m "feat(crowd): add busy-times grid derivation with privacy floor"
```

---

### Task 2: Busy-times endpoint

Wires the pure function to real check-in history behind a tenancy-guarded route.

**Files:**
- Create: `backend/src/routes/gyms.js`
- Modify: `backend/src/index.js` (register router next to the other `app.use('/api/...')` lines, ~line 138)
- Modify: `backend/src/services/cache.js` (add key at `:137`, TTL at `:34`)

**Interfaces:**
- Consumes: `computeBusyTimes` from Task 1.
- Produces: `GET /api/gyms/:id/busy-times` → `200 { success: true, busy_times: { grid, peak, quietest, totalSamples, confidence } }`. Returns `403` (via `ForbiddenError`) when `:id` is not the caller's gym.

- [ ] **Step 1: Add the cache key and TTL**

In `backend/src/services/cache.js`, add to the `TTL` object (line ~34):

```js
    BUSY_TIMES: 60 * 60 * 6,    // 6 hours — 8 weeks of history barely moves
```

Add to the `keys` object (line ~137):

```js
    busyTimes: (gymId) => `gym:${gymId}:busytimes`,
```

- [ ] **Step 2: Write the route**

Create `backend/src/routes/gyms.js`:

```js
/**
 * Gym Routes
 *
 * Gym-scoped aggregate data. Everything here is derived from members'
 * check-in history, so every endpoint is guarded to the caller's own gym.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ForbiddenError, ValidationError } = require('../utils/errors');
const { computeBusyTimes } = require('../utils/busyTimes');
const cache = require('../services/cache');

// UUID v4 shape — reject junk before it reaches Postgres
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/gyms/:id/busy-times
 * 7x24 hour-of-week busyness grid from the last 8 weeks of check-ins.
 *
 * Bucketing is done in Asia/Kolkata — check-in dedupe already uses IST, and
 * bucketing in UTC would shift every bar by 5.5 hours.
 */
router.get('/:id/busy-times', authenticate, asyncHandler(async (req, res) => {
    const gymId = req.params.id;

    if (!UUID_RE.test(gymId)) {
        throw new ValidationError('That gym link looks wrong');
    }

    // Tenancy: aggregate habits of a gym you don't belong to are not yours to read.
    // ForbiddenError -> 403 (AuthError would wrongly signal 401 "log in again").
    if (!req.user.gym_id || req.user.gym_id !== gymId) {
        throw new ForbiddenError('You can only view your own gym');
    }

    const busyTimes = await cache.getOrSet(
        cache.keys.busyTimes(gymId),
        async () => {
            const result = await query(
                `SELECT
                   EXTRACT(DOW  FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS dow,
                   EXTRACT(HOUR FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
                   COUNT(*)::int AS arrivals
                 FROM attendances
                 WHERE gym_id = $1
                   AND checked_in_at > NOW() - INTERVAL '8 weeks'
                 GROUP BY 1, 2`,
                [gymId]
            );
            return computeBusyTimes(result.rows);
        },
        cache.TTL.BUSY_TIMES
    ).catch((err) => {
        // Degrade gracefully, but never silently: without this log a broken
        // query is indistinguishable from "not enough check-ins yet" — same
        // 200, same empty grid, nothing in the logs. Matches the
        // log-then-fall-back pattern in services/cache.js.
        console.error('busy-times query failed:', err.message);
        return computeBusyTimes([]);
    });

    res.json({ success: true, busy_times: busyTimes });
}));

module.exports = router;
```

- [ ] **Step 3: Register the router**

In `backend/src/index.js`, add alongside the other route registrations (after the `/api/manager` line):

```js
app.use('/api/gyms', require('./routes/gyms'));
```

- [ ] **Step 4: Verify syntax and existing tests still pass**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; all suites PASS (53+ tests)

- [ ] **Step 5: Verify the route is mounted**

Run: `cd backend && NODE_ENV=test node -e "const app=require('./src/index'); const r=app._router.stack.filter(l=>l.regexp&&l.regexp.source.includes('gyms')); console.log(r.length?'gyms router mounted':'NOT MOUNTED')"`
Expected: `gyms router mounted`

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/gyms.js backend/src/index.js backend/src/services/cache.js
git commit -m "feat(crowd): add GET /api/gyms/:id/busy-times endpoint"
```

---

### Task 3: Busy-times mobile client + strip component

Renders today's row as a bar strip with a plain-language summary.

**Files:**
- Modify: `mobile/src/services/api.ts` (add `gymAPI` near `memberAPI`, ~line 171)
- Create: `mobile/src/components/BusyTimesStrip.tsx`

**Interfaces:**
- Consumes: `GET /api/gyms/:id/busy-times` from Task 2.
- Produces:
  - `gymAPI.getBusyTimes(gymId: string)` → `Promise<{ success: boolean; busy_times: BusyTimes }>`
  - `<BusyTimesStrip grid={number[][]} quietest={{dow,hour,score}|null} confidence={string} />`

- [ ] **Step 1: Add the API client**

In `mobile/src/services/api.ts`, add after the `memberAPI` export block:

```ts
export interface BusyTimes {
    grid: number[][] | null;
    peak: { dow: number; hour: number; score: number } | null;
    quietest: { dow: number; hour: number; score: number } | null;
    totalSamples: number;
    confidence: 'none' | 'low' | 'good';
}

export const gymAPI = {
    getBusyTimes: async (gymId: string): Promise<{ success: boolean; busy_times: BusyTimes }> => {
        const response = await api.get(`/gyms/${gymId}/busy-times`);
        return response.data;
    },
};
```

- [ ] **Step 2: Build the strip component**

Create `mobile/src/components/BusyTimesStrip.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface BusyTimesStripProps {
    grid: number[][] | null;
    quietest: { dow: number; hour: number; score: number } | null;
    confidence: 'none' | 'low' | 'good';
    /** 0 = Sunday, matching Postgres EXTRACT(DOW) */
    today?: number;
}

// Gyms are dead overnight; showing 12 empty bars wastes the strip.
const START_HOUR = 5;
const END_HOUR = 23;

function formatHour(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

const BusyTimesStrip: React.FC<BusyTimesStripProps> = ({
    grid,
    quietest,
    confidence,
    today = new Date().getDay(),
}) => {
    if (confidence === 'none' || !grid) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>USUALLY BUSY</Text>
                <Text style={styles.empty}>
                    Not enough check-ins yet. Check in for a few days to unlock your gym's busy hours.
                </Text>
            </View>
        );
    }

    const row = grid[today] ?? [];
    const hours = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) hours.push(h);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>USUALLY BUSY</Text>
                {confidence === 'low' && <Text style={styles.rough}>ROUGH</Text>}
            </View>

            <View style={styles.bars}>
                {hours.map((h) => {
                    const score = row[h] ?? 0;
                    return (
                        <View key={h} style={styles.barSlot}>
                            <View
                                style={[
                                    styles.bar,
                                    { height: Math.max(3, (score / 100) * 40) },
                                    score >= 75 && styles.barHigh,
                                    score >= 40 && score < 75 && styles.barMed,
                                ]}
                            />
                        </View>
                    );
                })}
            </View>

            <View style={styles.axis}>
                <Text style={styles.axisLabel}>{formatHour(START_HOUR)}</Text>
                <Text style={styles.axisLabel}>{formatHour(12)}</Text>
                <Text style={styles.axisLabel}>{formatHour(END_HOUR)}</Text>
            </View>

            {quietest && (
                <Text style={styles.caption}>
                    Quietest around {formatHour(quietest.hour)}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: {
        ...typography.caption,
        color: colors.text.secondary,
        letterSpacing: 1.2,
    },
    rough: { ...typography.caption, color: colors.text.tertiary, letterSpacing: 1 },
    bars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 44,
        marginTop: spacing.sm,
        gap: 2,
    },
    barSlot: { flex: 1, justifyContent: 'flex-end' },
    bar: {
        width: '100%',
        borderRadius: 2,
        backgroundColor: colors.glass.borderLight,
    },
    barMed: { backgroundColor: colors.warning },
    barHigh: { backgroundColor: colors.error },
    axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
    axisLabel: { ...typography.caption, color: colors.text.tertiary },
    caption: { ...typography.caption, color: colors.text.secondary, marginTop: spacing.sm },
    empty: { ...typography.body, color: colors.text.tertiary, marginTop: spacing.sm },
});

export default BusyTimesStrip;
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors. If `typography.caption`, `colors.text.tertiary`, or `spacing.xs` do not exist, open `mobile/src/styles/theme.ts` and substitute the nearest existing token — do not add hardcoded values.

- [ ] **Step 4: Verify no orphan is introduced**

Run: `cd backend && node scripts/wiring_audit.js`
Expected: `nav orphans=0, api orphans=0`. The component is not yet mounted — that happens in Task 4 — so do not commit it as dead code without completing Task 4 in the same session.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/services/api.ts mobile/src/components/BusyTimesStrip.tsx
git commit -m "feat(crowd): add busy-times API client and strip component"
```

---

### Task 4: Mount the strip on HomeScreen

Without this the component is dead code — exactly the orphaning failure `wiring_audit.js` exists to catch.

**Files:**
- Modify: `mobile/src/screens/member/HomeScreen.tsx`

**Interfaces:**
- Consumes: `gymAPI.getBusyTimes` and `BusyTimesStrip` from Task 3; `gym_id` from the existing home payload.
- Produces: nothing downstream.

- [ ] **Step 1: Import the component and API**

Add to the imports in `mobile/src/screens/member/HomeScreen.tsx`:

```tsx
import BusyTimesStrip from '../../components/BusyTimesStrip';
import { gymAPI, BusyTimes } from '../../services/api';
```

Note: `HomeScreen.tsx` is ~1,419 lines. Read the existing `useState`/`useEffect` data-loading block near the top of the component before inserting — match its style rather than adding a second pattern.

- [ ] **Step 2: Fetch busy times alongside the existing home load**

Add state next to the other `useState` declarations:

```tsx
const [busyTimes, setBusyTimes] = useState<BusyTimes | null>(null);
```

In the existing home-data effect, after home data resolves and `gym_id` is known, add a non-blocking fetch. It must never break the home screen if it fails:

```tsx
if (data?.gym_id) {
    gymAPI.getBusyTimes(data.gym_id)
        .then((r) => setBusyTimes(r.busy_times))
        .catch(() => setBusyTimes(null));
}
```

- [ ] **Step 3: Render the strip**

Place it directly below the existing crowd indicator block in the JSX:

```tsx
{busyTimes && (
    <View style={{ marginTop: spacing.md }}>
        <BusyTimesStrip
            grid={busyTimes.grid}
            quietest={busyTimes.quietest}
            confidence={busyTimes.confidence}
        />
    </View>
)}
```

- [ ] **Step 4: Typecheck and audit**

Run: `cd mobile && npx tsc --noEmit && cd ../backend && node scripts/wiring_audit.js`
Expected: 0 TS errors; `nav orphans=0, api orphans=0`

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/member/HomeScreen.tsx
git commit -m "feat(crowd): surface busy-times strip on home screen"
```

---

### Task 5: Honest occupancy — presence window (pure function)

Replaces "arrived in the last 60 minutes" with "session window contains now".

**Files:**
- Modify: `backend/src/utils/crowd.js`
- Modify: `backend/src/__tests__/crowd.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `presenceWindowEnd(checkedInAt: Date|string, checkedOutAt: Date|string|null, sessionMinutes?: number)` → `Date`
  - `isPresent(row, now, sessionMinutes?)` → `boolean`
  - `DEFAULT_SESSION_MINUTES` (number, 90)
  - Existing `computeCrowd`, `DEFAULT_CAPACITY`, `THRESHOLDS` exports are unchanged.

- [ ] **Step 1: Write the failing tests**

First, extend the **existing** require at the top of `backend/src/__tests__/crowd.test.js` (line 6) — do not add a second `require` for the same module:

```js
const {
    computeCrowd,
    DEFAULT_CAPACITY,
    presenceWindowEnd,
    isPresent,
    DEFAULT_SESSION_MINUTES,
} = require('../utils/crowd');
```

Then append these suites to the end of the file:

```js
describe('presenceWindowEnd', () => {
    it('uses the explicit checkout time when present', () => {
        const inAt = new Date('2026-07-27T06:00:00Z');
        const outAt = new Date('2026-07-27T07:15:00Z');
        expect(presenceWindowEnd(inAt, outAt).toISOString()).toBe(outAt.toISOString());
    });

    it('auto-expires after the default session length when no checkout', () => {
        const inAt = new Date('2026-07-27T06:00:00Z');
        const end = presenceWindowEnd(inAt, null);
        expect(end.toISOString()).toBe('2026-07-27T07:30:00Z');
        expect(DEFAULT_SESSION_MINUTES).toBe(90);
    });
});

describe('isPresent', () => {
    const inAt = new Date('2026-07-27T06:00:00Z');

    it('counts a member still inside their session window', () => {
        const now = new Date('2026-07-27T07:00:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, now)).toBe(true);
    });

    it('counts a member who arrived 80 min ago — the old 60 min rule missed this', () => {
        const now = new Date('2026-07-27T07:20:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, now)).toBe(true);
    });

    it('drops a member past the auto-expiry', () => {
        const now = new Date('2026-07-27T08:00:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, now)).toBe(false);
    });

    it('drops a member who explicitly checked out — the old rule still counted them', () => {
        const now = new Date('2026-07-27T06:40:00Z');
        const out = new Date('2026-07-27T06:30:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: out }, now)).toBe(false);
    });

    it('does not count a future check-in', () => {
        const now = new Date('2026-07-27T05:00:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, now)).toBe(false);
    });

    it('returns false for malformed rows instead of throwing', () => {
        const now = new Date('2026-07-27T07:00:00Z');
        expect(isPresent({ checked_in_at: null, checked_out_at: null }, now)).toBe(false);
        expect(isPresent(null, now)).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest crowd --verbose`
Expected: FAIL — `presenceWindowEnd is not a function`

- [ ] **Step 3: Implement**

Add to `backend/src/utils/crowd.js`, above `module.exports`:

```js
/**
 * Median gym session. Used to auto-expire a check-in when the member never
 * checked out — which is the common case, since checkout is optional.
 */
const DEFAULT_SESSION_MINUTES = 90;

/**
 * When does this member stop counting as present?
 * Explicit checkout wins; otherwise assume a standard session length.
 */
function presenceWindowEnd(checkedInAt, checkedOutAt, sessionMinutes = DEFAULT_SESSION_MINUTES) {
    if (checkedOutAt) return new Date(checkedOutAt);
    return new Date(new Date(checkedInAt).getTime() + sessionMinutes * 60 * 1000);
}

/**
 * Is this attendance row inside the gym right now?
 * Present == check-in has happened AND the session window has not closed.
 */
function isPresent(row, now = new Date(), sessionMinutes = DEFAULT_SESSION_MINUTES) {
    if (!row || !row.checked_in_at) return false;
    const start = new Date(row.checked_in_at);
    if (Number.isNaN(start.getTime())) return false;
    const end = presenceWindowEnd(start, row.checked_out_at, sessionMinutes);
    const t = new Date(now).getTime();
    return start.getTime() <= t && t < end.getTime();
}
```

Extend `module.exports`:

```js
module.exports = {
    computeCrowd,
    presenceWindowEnd,
    isPresent,
    DEFAULT_CAPACITY,
    DEFAULT_SESSION_MINUTES,
    THRESHOLDS,
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest crowd --verbose`
Expected: PASS — original crowd tests plus 8 new ones

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/crowd.js backend/src/__tests__/crowd.test.js
git commit -m "feat(crowd): add presence-window logic for honest occupancy"
```

---

### Task 6: Checkout column, endpoint, and corrected occupancy query

**Files:**
- Create: `backend/data/migrations/006_attendance_checkout.sql`
- Modify: `backend/src/routes/checkin.js`
- Modify: `backend/src/routes/member.js:93-101` (the crowd subquery)
- Modify: `backend/src/routes/manager.js:39` (the same 60-minute rule)

**Interfaces:**
- Consumes: `DEFAULT_SESSION_MINUTES` from Task 5.
- Produces: `POST /api/checkin/checkout` → `200 { success: true, checked_out_at }`.

- [ ] **Step 1: Write the migration**

Create `backend/data/migrations/006_attendance_checkout.sql`:

```sql
-- Adds optional checkout so occupancy means "currently inside", not
-- "arrived in the last hour". Nullable: checkout is always optional and
-- unrecorded sessions auto-expire in application logic.

ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP WITH TIME ZONE;

-- Partial index: the occupancy query only ever scans still-open sessions.
CREATE INDEX IF NOT EXISTS idx_attendance_open_session
  ON attendances (gym_id, checked_in_at DESC)
  WHERE checked_out_at IS NULL;

-- Task 7 support: when this member was last sent a quiet-hours nudge.
-- Without it the 24h cooldown cannot be enforced and a manual cron
-- re-trigger double-notifies everyone.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS quiet_alert_sent_at TIMESTAMP WITH TIME ZONE;

-- Task 7 support: give quiet-hours alerts their own mute toggle, so a daily
-- push is something members can switch off like every other category.
UPDATE users
   SET notification_preferences =
       COALESCE(notification_preferences, '{}'::jsonb) || '{"quietHours": true}'::jsonb
 WHERE notification_preferences IS NULL
    OR NOT (notification_preferences ? 'quietHours');

ALTER TABLE users
  ALTER COLUMN notification_preferences
  SET DEFAULT '{"workoutReminders": true, "streakAlerts": true, "friendActivity": true, "classReminders": true, "achievements": true, "marketing": false, "quietHours": true}'::jsonb;
```

- [ ] **Step 2: Apply the migration**

Run: `cd backend && node apply_migration.js data/migrations/006_attendance_checkout.sql`
Expected: `✅ Migration applied successfully!`

Verify: `cd backend && node -e "require('dotenv').config();const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='attendances' AND column_name='checked_out_at'\")).then(r=>{console.log(r.rows.length?'checked_out_at present':'MISSING');return c.end()})"`
Expected: `checked_out_at present`

- [ ] **Step 3: Add the checkout endpoint**

Add to `backend/src/routes/checkin.js`, before `module.exports`:

```js
/**
 * POST /api/checkin/checkout
 * Closes today's open session. Idempotent — checking out twice is not an error,
 * it just returns the existing checkout time.
 */
router.post('/checkout', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `UPDATE attendances
            SET checked_out_at = NOW()
          WHERE user_id = $1
            AND checked_out_at IS NULL
            AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
      RETURNING checked_out_at, gym_id`,
        [userId]
    );

    if (result.rows.length === 0) {
        const existing = await query(
            `SELECT checked_out_at FROM attendances
              WHERE user_id = $1
                AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
              LIMIT 1`,
            [userId]
        );
        if (existing.rows.length === 0) {
            throw new NotFoundError("You haven't checked in today");
        }
        return res.json({ success: true, checked_out_at: existing.rows[0].checked_out_at });
    }

    // Occupancy just changed — drop the cached crowd light
    await cache.del(cache.keys.crowdLevel(result.rows[0].gym_id));

    res.json({ success: true, checked_out_at: result.rows[0].checked_out_at });
}));
```

No new imports are needed — `checkin.js:5` already destructures `NotFoundError` and `asyncHandler` from `../utils/errors`, and `checkin.js:9` already requires `cache`. (Verified against the current file; if that has drifted, add them rather than duplicating.)

- [ ] **Step 4: Fix the occupancy query in member.js**

> **Constant coupling — read this.** `DEFAULT_SESSION_MINUTES` (Task 5, JS) and the `INTERVAL '90 minutes'` literal below express the *same* rule in two languages. Postgres cannot parameterise an `INTERVAL` from a bound value cleanly, so they must be kept in sync by hand. Add this comment directly above **both** SQL sites so the coupling is discoverable:
>
> ```js
> // Session length must match DEFAULT_SESSION_MINUTES in src/utils/crowd.js
> ```

In `backend/src/routes/member.js`, replace the count subquery (currently lines 93–95) with:

```sql
                           (SELECT COUNT(*) FROM attendances
                            WHERE gym_id = $1
                              AND checked_in_at <= NOW()
                              AND COALESCE(checked_out_at, checked_in_at + INTERVAL '90 minutes') > NOW()) AS count,
```

- [ ] **Step 5: Apply the same fix in manager.js**

In `backend/src/routes/manager.js`, replace the `INTERVAL '60 minutes'` condition on line 39 with the same `COALESCE(...)` predicate so the manager dashboard and the member app never disagree about how full the gym is.

- [ ] **Step 6: Verify**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; all suites PASS

- [ ] **Step 7: Commit**

```bash
git add backend/data/migrations/006_attendance_checkout.sql backend/src/routes/checkin.js backend/src/routes/member.js backend/src/routes/manager.js
git commit -m "feat(crowd): add checkout endpoint and correct occupancy to session windows"
```

---

### Task 7: Quiet-hours push notification

**Files:**
- Create: `backend/src/services/quietHours.js`
- Create: `backend/src/__tests__/quiet-hours.test.js`
- Modify: `backend/src/services/pushNotifications.js` (add the type + preference mapping)
- Modify: `backend/src/routes/cron.js`
- Modify: `.github/workflows/ai-cron.yml`

**Interfaces:**
- Consumes: `computeBusyTimes` (Task 1), `sendToUser` from `backend/src/services/pushNotifications.js`, and the `users.quiet_alert_sent_at` column added in Task 6.
- Produces:
  - `shouldAlertQuiet({ currentScore, confidence, alreadyCheckedIn, lastAlertHoursAgo })` → `boolean`
  - `runQuietAlerts()` → `Promise<{ sent: number, skipped: number }>`

> **Two corrections from the pre-flight scan — both are requirements, not suggestions:**
>
> 1. **The cooldown must be real.** `lastAlertHoursAgo` must be derived from `users.quiet_alert_sent_at`, and the column must be stamped after a successful send. Passing the constant `ALERT_COOLDOWN_HOURS` in makes the guard a no-op (`24 < 24` is false) — tested logic that never fires, and a manual `workflow_dispatch` would double-notify every member.
> 2. **The alert must be mutable.** `notification.type` is read at the **top level** by `sendToUser` — a `type` nested inside `data` is invisible to `isTypeAllowed`. Set `type: 'quiet_hours'` on the notification object itself and register it in `TYPE_TO_PREFERENCE`, or members get a daily push they cannot switch off.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/quiet-hours.test.js`:

```js
/**
 * Quiet Hours Tests
 * Decides whether a "your gym is quiet now" push is warranted.
 */

const { shouldAlertQuiet, QUIET_SCORE_THRESHOLD } = require('../services/quietHours');

const base = {
    currentScore: 20,
    confidence: 'good',
    alreadyCheckedIn: false,
    lastAlertHoursAgo: 48,
};

describe('shouldAlertQuiet', () => {
    it('alerts when the gym is quiet and the member has not been in', () => {
        expect(shouldAlertQuiet(base)).toBe(true);
    });

    it('stays silent when the gym is busy', () => {
        expect(shouldAlertQuiet({ ...base, currentScore: 80 })).toBe(false);
    });

    it('stays silent when the member already checked in today', () => {
        expect(shouldAlertQuiet({ ...base, alreadyCheckedIn: true })).toBe(false);
    });

    it('stays silent when confidence is too low to be trusted', () => {
        expect(shouldAlertQuiet({ ...base, confidence: 'none' })).toBe(false);
        expect(shouldAlertQuiet({ ...base, confidence: 'low' })).toBe(false);
    });

    it('does not nag — respects a 24h cooldown', () => {
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: 3 })).toBe(false);
    });

    it('treats "never alerted" (null) as cooldown satisfied', () => {
        // users.quiet_alert_sent_at is NULL until the first send — this must
        // read as eligible, not as "0 hours ago".
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: null })).toBe(true);
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: undefined })).toBe(true);
    });

    it('alerts again once the cooldown has fully elapsed', () => {
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: 23.9 })).toBe(false);
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: 24 })).toBe(true);
    });

    it('alerts exactly at the threshold boundary', () => {
        expect(shouldAlertQuiet({ ...base, currentScore: QUIET_SCORE_THRESHOLD })).toBe(true);
        expect(shouldAlertQuiet({ ...base, currentScore: QUIET_SCORE_THRESHOLD + 1 })).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest quiet-hours --verbose`
Expected: FAIL — `Cannot find module '../services/quietHours'`

- [ ] **Step 3: Register the notification type and its mute toggle**

In `backend/src/services/pushNotifications.js`, add to the `NotificationType` object (line 16):

```js
    QUIET_HOURS: 'quiet_hours',
```

And to the `TYPE_TO_PREFERENCE` map (line 29):

```js
    [NotificationType.QUIET_HOURS]: 'quietHours',
```

The matching `quietHours` preference key is added to every user's `notification_preferences` by the Task 6 migration.

- [ ] **Step 4: Implement the decision function and batch**

Create `backend/src/services/quietHours.js`:

```js
/**
 * Quiet Hours Alerts
 *
 * Pushes "your gym is quiet right now" when the current hour is historically
 * unbusy and the member hasn't trained today.
 *
 * This is the one notification no consumer fitness app can send — it requires
 * knowing the physical gym. Treat it as scarce: one per member per day, max,
 * and only when the history is trustworthy.
 */

const { query } = require('../config/database');
const { computeBusyTimes } = require('../utils/busyTimes');
const pushNotifications = require('./pushNotifications');

const QUIET_SCORE_THRESHOLD = 35;   // <=35% of peak counts as quiet
const ALERT_COOLDOWN_HOURS = 24;

/**
 * Pure decision — unit tested.
 */
function shouldAlertQuiet({ currentScore, confidence, alreadyCheckedIn, lastAlertHoursAgo }) {
    if (confidence !== 'good') return false;      // don't guess at people's evenings
    if (alreadyCheckedIn) return false;
    if (typeof currentScore !== 'number') return false;
    if (currentScore > QUIET_SCORE_THRESHOLD) return false;
    if (typeof lastAlertHoursAgo === 'number' && lastAlertHoursAgo < ALERT_COOLDOWN_HOURS) return false;
    return true;
}

/** Current IST day-of-week (0=Sun) and hour. */
function istNowParts(now = new Date()) {
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return { dow: ist.getUTCDay(), hour: ist.getUTCHours() };
}

/**
 * Batch: one pass per gym, then per member of that gym.
 */
async function runQuietAlerts() {
    let sent = 0;
    let skipped = 0;
    const { dow, hour } = istNowParts();

    const gyms = await query(`SELECT id FROM gyms`);

    for (const gym of gyms.rows) {
        const history = await query(
            `SELECT
               EXTRACT(DOW  FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS dow,
               EXTRACT(HOUR FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
               COUNT(*)::int AS arrivals
             FROM attendances
             WHERE gym_id = $1 AND checked_in_at > NOW() - INTERVAL '8 weeks'
             GROUP BY 1, 2`,
            [gym.id]
        );

        const busy = computeBusyTimes(history.rows);
        if (busy.confidence !== 'good' || !busy.grid) { skipped++; continue; }

        const currentScore = busy.grid[dow][hour];

        const members = await query(
            `SELECT u.id,
                    EXTRACT(EPOCH FROM (NOW() - u.quiet_alert_sent_at)) / 3600 AS hours_since_alert,
                    EXISTS (
                      SELECT 1 FROM attendances a
                       WHERE a.user_id = u.id
                         AND DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
                    ) AS checked_in_today
               FROM users u
              WHERE u.gym_id = $1 AND u.role = 'member'`,
            [gym.id]
        );

        for (const m of members.rows) {
            // NULL (never alerted) must read as "cooldown satisfied", not 0 hours.
            const lastAlertHoursAgo = m.hours_since_alert === null
                ? null
                : Number(m.hours_since_alert);

            const decision = shouldAlertQuiet({
                currentScore,
                confidence: busy.confidence,
                alreadyCheckedIn: m.checked_in_today,
                lastAlertHoursAgo,
            });
            if (!decision) { skipped++; continue; }

            try {
                const result = await pushNotifications.sendToUser(m.id, {
                    title: 'Your gym is quiet right now',
                    body: 'Good window for a session — fewer people than usual.',
                    // Top level: sendToUser reads notification.type to check the
                    // user's mute toggle. Nested in `data` it would be invisible.
                    type: 'quiet_hours',
                    data: { type: 'quiet_hours' },
                });

                // Only stamp the cooldown when something was actually delivered.
                // Stamping on a muted/tokenless user would suppress a future
                // alert they never received.
                if (result && result.success) {
                    await query(
                        `UPDATE users SET quiet_alert_sent_at = NOW() WHERE id = $1`,
                        [m.id]
                    );
                    sent++;
                } else {
                    skipped++;
                }
            } catch {
                skipped++;
            }
        }
    }

    return { sent, skipped };
}

module.exports = {
    shouldAlertQuiet,
    runQuietAlerts,
    QUIET_SCORE_THRESHOLD,
    ALERT_COOLDOWN_HOURS,
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && npx jest quiet-hours --verbose`
Expected: PASS — 8 tests

- [ ] **Step 6: Add the cron endpoint**

In `backend/src/routes/cron.js`, add the require at the top:

```js
const quietHoursService = require('../services/quietHours');
```

And the route before `module.exports`:

```js
/**
 * POST /api/cron/quiet-alerts
 * Push "your gym is quiet now" to members whose gym is historically unbusy.
 */
router.post('/quiet-alerts', asyncHandler(async (req, res) => {
    res.status(202).json({ success: true, message: 'Quiet-hours alerts batch started' });
    quietHoursService.runQuietAlerts()
        .catch(err => console.error('Quiet alerts batch failed:', err.message));
}));
```

- [ ] **Step 7: Schedule it**

In `.github/workflows/ai-cron.yml`, add a schedule entry and a matching branch in the endpoint-picker step, following the existing `daily-insights` / `weekly-recaps` pattern exactly:

```yaml
    - cron: "30 12 * * *"   # quiet-hours nudge — 18:00 IST, pre-evening rush
```

In the `steps.pick` script, add:

```bash
elif [ "${{ github.event.schedule }}" = "30 12 * * *" ]; then
  echo "endpoint=quiet-alerts" >> $GITHUB_OUTPUT
```

- [ ] **Step 8: Full verification**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest && node scripts/wiring_audit.js`
Expected: syntax clean; all suites PASS; `nav orphans=0, api orphans=0`

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/quietHours.js backend/src/__tests__/quiet-hours.test.js backend/src/services/pushNotifications.js backend/src/routes/cron.js .github/workflows/ai-cron.yml
git commit -m "feat(crowd): add quiet-hours push notification batch"
```

---

## Rollout Notes

- **Task 6 changes a live production number.** The occupancy count will shift when deployed — expect the crowd light to read *higher* than before during steady periods, because members training longer than 60 minutes now correctly count. This is the fix, not a regression.
- **Tasks 1–4 ship independently of 5–7.** If time runs short, stopping after Task 4 still delivers the highest-value feature with zero schema change.
- **Task 7 sends real pushes.** Before enabling the GitHub Actions schedule, trigger it manually once with `workflow_dispatch` against a gym with known history and confirm the `sent` count is sane.

## Deferred to the Food plan

B1 (cooking-medium variants), B2 (thali combo logging), B3 (category taxonomy cleanup), B4 (learned portion defaults) are a separate subsystem — different tables, routes, and screens. They will be planned in `docs/superpowers/plans/2026-07-27-indian-food-accuracy.md`.
