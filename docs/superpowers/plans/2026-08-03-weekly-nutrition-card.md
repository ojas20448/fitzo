# Weekly Nutrition Summary Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A compact card in Profile answering "how was my week" — average calories and protein, days logged, and how often targets were hit — tapping through to the nutrition detail screen that already exists.

**Architecture:** One pure function derives the summary; the existing `GET /nutrition/weekly` returns it alongside its current `history` payload, so there is no new endpoint and no extra round trip. The card is presentational.

**Tech Stack:** Node 20, Express 4, PostgreSQL (Supabase), Jest, Expo/React Native 0.81, TypeScript.

## Global Constraints

- **`SUM(calories)` and `SUM(protein)` come back as STRINGS.** Verified against the live database: `SUM` over an `INTEGER` column returns `bigint`, which node-pg yields as `"2333"`, not `2333`. Adding two of them concatenates — `"2333" + "200"` is `"2333200"`. **Every numeric read in the summary must go through `Number()`.** This is not defensive coding; it is required for correctness.
- **Averages are over DAYS LOGGED, not over 7.** Logging 3 days at 2000 kcal gives an average of 2000, not 857. Dividing by 7 would make a partially-logged week look like starvation. `daysLogged` is returned alongside so the pair tells the truth.
- **Calories are a band, protein is a floor.** A calorie day counts as on-target when within **±10%** of target. A protein day counts when **at or above** target. Treating both the same would be wrong nutrition — 40% over on calories is not success, 6% over on protein is.
- **Zero logged days must not produce `NaN`.** Return zeros with `daysLogged: 0` and let the card render an empty state.
- **Do not derive dates by round-tripping through `new Date(...).toISOString()`.** `logged_date` arrives from node-pg as a JS `Date` at *local* midnight (observed: `2026-08-01T18:30:00.000Z` for Aug 2 on an IST host), so re-serialising shifts the day. The summary does not need dates at all — it only counts and averages — so simply do not touch them.
- **Targets come from `nutrition_profiles`**, falling back to `target_calories: 2000, target_protein: 150` when the row is absent. Copy the exact pattern at `backend/src/routes/nutrition.js:219-230`.
- **`GET /nutrition/weekly` already has a consumer** — `mobile/src/screens/member/StatsScreen.tsx:69`. Adding a `summary` field is additive; do not change the shape or meaning of `history`.
- CommonJS backend, 4-space indent, JSDoc on exported functions. Mobile is TypeScript, 4-space indent.
- **Mobile styling uses tokens only.** `typography.caption`, `typography.body`, and `colors.text.tertiary` **do not exist** — use `typography.sizes.*` + `typography.fontFamily.*` and `colors.text.muted`.
- **Another session commits to this repo concurrently.** Stage paths explicitly; never `git add -A`.

---

### Task 1: Week summary (pure function)

**Files:**
- Create: `backend/src/utils/weekSummary.js`
- Test: `backend/src/__tests__/week-summary.test.js`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `CALORIE_BAND` (0.10), `summariseWeek(history, targets)` → `{ daysLogged, avgCalories, avgProtein, calorieTargetDays, proteinTargetDays, targetCalories, targetProtein }`
  - `history`: `Array<{ calories, protein }>` — values may be strings or numbers
  - `targets`: `{ target_calories, target_protein }`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/week-summary.test.js`:

```js
/**
 * Week Summary Tests
 *
 * Two things these fixtures deliberately do NOT do: land on clean arithmetic,
 * and use numbers. SUM() over an INTEGER column comes back from node-pg as a
 * STRING, so a summary that adds without coercing concatenates — "2333" + "200"
 * is "2333200". Earlier bugs in this codebase survived precisely because the
 * fixture was the benign case.
 */

const { summariseWeek, CALORIE_BAND } = require('../utils/weekSummary');

const targets = { target_calories: 2000, target_protein: 150 };

describe('summariseWeek', () => {
    it('coerces string sums rather than concatenating them', () => {
        const r = summariseWeek(
            [{ calories: '2333', protein: '100' }, { calories: '200', protein: '50' }],
            targets,
        );
        // Concatenation would give 2333200 / 2 — a nonsense number.
        expect(r.avgCalories).toBe(1267); // (2333 + 200) / 2 = 1266.5 -> 1267
        expect(r.avgProtein).toBe(75);
    });

    it('averages over days logged, not over seven', () => {
        const r = summariseWeek(
            [{ calories: 2000, protein: 150 }, { calories: 2000, protein: 150 }, { calories: 2000, protein: 150 }],
            targets,
        );
        expect(r.daysLogged).toBe(3);
        expect(r.avgCalories).toBe(2000); // NOT 857 (6000/7)
    });

    it('counts a calorie day on target only within the band', () => {
        const within = 2000 * (1 + CALORIE_BAND);   // 2200, inclusive
        const over = within + 1;
        const r = summariseWeek(
            [{ calories: 2000, protein: 0 }, { calories: within, protein: 0 }, { calories: over, protein: 0 }],
            targets,
        );
        expect(r.calorieTargetDays).toBe(2);
    });

    it('counts under-eating as off target too — it is a band, not a ceiling', () => {
        const r = summariseWeek([{ calories: 900, protein: 0 }], targets);
        expect(r.calorieTargetDays).toBe(0);
    });

    it('treats protein as a floor, so over target still counts', () => {
        const r = summariseWeek(
            [{ calories: 0, protein: 150 }, { calories: 0, protein: 220 }, { calories: 0, protein: 149 }],
            targets,
        );
        expect(r.proteinTargetDays).toBe(2);
    });

    it('returns zeros rather than NaN for an empty week', () => {
        const r = summariseWeek([], targets);
        expect(r).toMatchObject({
            daysLogged: 0, avgCalories: 0, avgProtein: 0,
            calorieTargetDays: 0, proteinTargetDays: 0,
        });
        expect(Number.isNaN(r.avgCalories)).toBe(false);
    });

    it('survives a null or malformed history', () => {
        expect(summariseWeek(null, targets).daysLogged).toBe(0);
        expect(summariseWeek(undefined, targets).daysLogged).toBe(0);
    });

    it('counts a zero-calorie day as logged — the row exists', () => {
        const r = summariseWeek([{ calories: 0, protein: 0 }], targets);
        expect(r.daysLogged).toBe(1);
        expect(r.avgCalories).toBe(0);
    });

    it('skips malformed rows without dragging the average down', () => {
        const r = summariseWeek(
            [{ calories: 2000, protein: 150 }, null, { calories: 'abc', protein: 'xyz' }],
            targets,
        );
        expect(r.daysLogged).toBe(2); // the null is dropped; 'abc' coerces to 0
        expect(r.avgCalories).toBe(1000);
    });

    it('falls back to sane targets when none are supplied', () => {
        const r = summariseWeek([{ calories: 2000, protein: 150 }], null);
        expect(r.targetCalories).toBe(2000);
        expect(r.targetProtein).toBe(150);
    });

    it('echoes the targets it used so the card need not fetch them', () => {
        const r = summariseWeek([], { target_calories: 2146, target_protein: 188 });
        expect(r.targetCalories).toBe(2146);
        expect(r.targetProtein).toBe(188);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest week-summary --verbose`
Expected: FAIL — `Cannot find module '../utils/weekSummary'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/utils/weekSummary.js`:

```js
/**
 * Weekly Nutrition Summary
 *
 * Answers "how was my week" rather than "what did each day look like" — the
 * per-day chart already exists in NutritionInsights.
 *
 * Two rules worth stating outright:
 *
 * 1. Averages divide by DAYS LOGGED, not by 7. Logging three days at 2000 kcal
 *    is a 2000 kcal average, not 857. `daysLogged` is returned alongside, so a
 *    partially-logged week reads as incomplete rather than as starvation.
 *
 * 2. Calories are a BAND and protein is a FLOOR. Landing 40% over your calorie
 *    target is not hitting it; landing 6% over your protein target is. Treating
 *    both the same would be wrong nutrition.
 *
 * Every numeric goes through Number(): SUM() over an INTEGER column returns
 * bigint, which node-pg yields as a STRING, and "2333" + "200" is "2333200".
 */

/** A calorie day counts as on-target within +/- this fraction of the target. */
const CALORIE_BAND = 0.10;

const DEFAULT_TARGET_CALORIES = 2000;
const DEFAULT_TARGET_PROTEIN = 150;

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * @param {Array<{calories: number|string, protein: number|string}>} history
 * @param {{target_calories?: number|string, target_protein?: number|string}} targets
 */
function summariseWeek(history, targets) {
    const targetCalories = num(targets?.target_calories) || DEFAULT_TARGET_CALORIES;
    const targetProtein = num(targets?.target_protein) || DEFAULT_TARGET_PROTEIN;

    const days = (Array.isArray(history) ? history : []).filter(
        (d) => d && typeof d === 'object',
    );

    const empty = {
        daysLogged: 0,
        avgCalories: 0,
        avgProtein: 0,
        calorieTargetDays: 0,
        proteinTargetDays: 0,
        targetCalories,
        targetProtein,
    };

    if (days.length === 0) return empty;

    let totalCalories = 0;
    let totalProtein = 0;
    let calorieTargetDays = 0;
    let proteinTargetDays = 0;

    const lower = targetCalories * (1 - CALORIE_BAND);
    const upper = targetCalories * (1 + CALORIE_BAND);

    for (const d of days) {
        const calories = num(d.calories);
        const protein = num(d.protein);

        totalCalories += calories;
        totalProtein += protein;

        // Band, not ceiling: under-eating misses the target as surely as over.
        if (calories >= lower && calories <= upper) calorieTargetDays += 1;
        // Floor: at or above counts.
        if (protein >= targetProtein) proteinTargetDays += 1;
    }

    return {
        daysLogged: days.length,
        avgCalories: Math.round(totalCalories / days.length),
        avgProtein: Math.round(totalProtein / days.length),
        calorieTargetDays,
        proteinTargetDays,
        targetCalories,
        targetProtein,
    };
}

module.exports = {
    summariseWeek,
    CALORIE_BAND,
    DEFAULT_TARGET_CALORIES,
    DEFAULT_TARGET_PROTEIN,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest week-summary --verbose`
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/weekSummary.js backend/src/__tests__/week-summary.test.js
git commit -m "feat(nutrition): add weekly summary derivation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Return the summary from the weekly endpoint

**Files:**
- Modify: `backend/src/routes/nutrition.js` (the `GET /weekly` handler, ~line 327)

**Interfaces:**
- Consumes: `summariseWeek` from Task 1.
- Produces: `GET /api/nutrition/weekly` → `{ history, summary }`. **`history` is unchanged.**

- [ ] **Step 1: Add the require**

At the top of `backend/src/routes/nutrition.js`:

```js
const { summariseWeek } = require('../utils/weekSummary');
```

- [ ] **Step 2: Load targets and attach the summary**

The handler currently ends by returning `{ history: result.rows }`. Load the member's targets using the exact pattern already in this file at lines 219-230, then attach the summary. Run both queries concurrently — they are independent:

```js
    const [result, profileResult] = await Promise.all([
        query(
            `SELECT
                logged_date as date,
                SUM(calories) as calories,
                SUM(protein) as protein,
                SUM(carbs) as carbs,
                SUM(fat) as fat
             FROM calorie_logs
             WHERE user_id = $1
               AND logged_date > ${IST_TODAY_SQL} - INTERVAL '7 days'
             GROUP BY logged_date
             ORDER BY date ASC`,
            [userId]
        ),
        query(
            `SELECT target_calories, target_protein
             FROM nutrition_profiles WHERE user_id = $1`,
            [userId]
        ),
    ]);

    // `history` keeps its existing shape and meaning — StatsScreen consumes it.
    res.json({
        history: result.rows,
        summary: summariseWeek(result.rows, profileResult.rows[0]),
    });
```

`summariseWeek` applies its own defaults when `profileResult.rows[0]` is undefined, so no fallback object is needed here.

- [ ] **Step 3: Verify the endpoint against the live database**

Run:
```bash
cd backend && node -e "
require('dotenv').config();
const {Client}=require('pg');
const {IST_TODAY_SQL}=require('./src/utils/dayBoundary');
const {summariseWeek}=require('./src/utils/weekSummary');
const c=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{
  await c.connect();
  const u=(await c.query('SELECT user_id FROM calorie_logs GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1')).rows[0];
  if(!u){ console.log('no logged users to sample'); await c.end(); return; }
  const h=(await c.query(\`SELECT logged_date as date, SUM(calories) as calories, SUM(protein) as protein
      FROM calorie_logs WHERE user_id=\$1 GROUP BY logged_date ORDER BY date ASC\`,[u.user_id])).rows;
  const t=(await c.query('SELECT target_calories, target_protein FROM nutrition_profiles WHERE user_id=\$1',[u.user_id])).rows[0];
  console.log('raw calories typeof:', typeof h[0]?.calories, JSON.stringify(h[0]?.calories));
  console.log('summary:', JSON.stringify(summariseWeek(h,t),null,1));
  await c.end();
})();
"
```
Expected: `typeof` prints `string` — confirming the coercion matters — and the summary shows plausible whole numbers, **not** a concatenated monster like `2333200`.

- [ ] **Step 4: Run the suite and commit**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; full suite green.

```bash
git add backend/src/routes/nutrition.js
git commit -m "feat(nutrition): return weekly summary alongside history

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The card in Profile

**Files:**
- Modify: `mobile/src/services/api.ts` (add `nutritionAPI.getWeekly`)
- Create: `mobile/src/components/WeeklyNutritionCard.tsx`
- Modify: `mobile/app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `GET /api/nutrition/weekly` from Task 2.
- Produces:
  - `nutritionAPI.getWeekly()` → `Promise<{ history: any[]; summary: WeekSummary }>`
  - `WeekSummary` interface, exported
  - `<WeeklyNutritionCard summary={WeekSummary | null} onPress={() => void} />`

- [ ] **Step 1: Add the type and API method**

In `mobile/src/services/api.ts`:

```ts
export interface WeekSummary {
    daysLogged: number;
    avgCalories: number;
    avgProtein: number;
    calorieTargetDays: number;
    proteinTargetDays: number;
    targetCalories: number;
    targetProtein: number;
}
```

Add to the existing `nutritionAPI` object:

```ts
    getWeekly: async (): Promise<{ history: any[]; summary: WeekSummary }> => {
        const response = await api.get('/nutrition/weekly');
        return response.data;
    },
```

- [ ] **Step 2: Build the card**

Create `mobile/src/components/WeeklyNutritionCard.tsx`:

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import { WeekSummary } from '../services/api';
import { colors, typography, spacing } from '../styles/theme';

interface WeeklyNutritionCardProps {
    summary: WeekSummary | null;
    onPress: () => void;
}

const WeeklyNutritionCard: React.FC<WeeklyNutritionCardProps> = ({ summary, onPress }) => {
    const logged = summary?.daysLogged ?? 0;

    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Weekly nutrition, tap for detail">
            <GlassCard padding="lg">
                <View style={styles.header}>
                    <Text style={styles.title}>THIS WEEK</Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                </View>

                {logged === 0 ? (
                    <Text style={styles.empty}>No food logged in the last 7 days.</Text>
                ) : (
                    <>
                        <View style={styles.row}>
                            <View style={styles.stat}>
                                <Text style={styles.value}>{summary!.avgCalories}</Text>
                                <Text style={styles.label}>avg kcal</Text>
                                <Text style={styles.sub}>target {summary!.targetCalories}</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.value}>{summary!.avgProtein}g</Text>
                                <Text style={styles.label}>avg protein</Text>
                                <Text style={styles.sub}>target {summary!.targetProtein}g</Text>
                            </View>
                        </View>

                        {/* "of N logged" not "of 7" — the averages above are over
                            logged days, and saying 7 here would imply otherwise. */}
                        <Text style={styles.footer}>
                            {logged} of 7 days logged · {summary!.calorieTargetDays} on calories · {summary!.proteinTargetDays} on protein
                        </Text>
                    </>
                )}
            </GlassCard>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
        letterSpacing: 1.2,
    },
    empty: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    row: { flexDirection: 'row' },
    stat: { flex: 1 },
    value: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    label: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginTop: 2,
    },
    sub: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    footer: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.md,
    },
});

export default WeeklyNutritionCard;
```

Verify every token exists in `mobile/src/styles/theme.ts` before finishing — particularly `typography.sizes['2xl']` and `typography.fontFamily.bold`. Substitute the nearest existing token if absent and record it in your report.

- [ ] **Step 3: Mount it in Profile**

`caloriesAPI` and `nutritionAPI` are already imported at `profile.tsx:18`; extend that line with `WeekSummary` rather than adding a second import. Add:

```tsx
import WeeklyNutritionCard from '../../src/components/WeeklyNutritionCard';
```

Add state beside the existing `dayView`/`openEntry` state:

```tsx
const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
```

`loadData` already batches its fetches. The current call is:

```tsx
            const [homeRes, caloriesRes, profileRes, measurementsRes, calHistoryRes] = await Promise.all([
                memberAPI.getHome(),
                caloriesAPI.getToday().catch(() => ({ totals: { calories: 0, entry_count: 0 } })),
                nutritionAPI.getProfile().catch(() => ({ profile: null })),
                measurementsAPI.getLatest().catch(() => ({ measurement: null })),
                caloriesAPI.getHistory(30).catch(() => ({ history: [] }))
            ]);
```

Add a sixth entry rather than issuing a separate request, matching how its neighbours degrade with `.catch()`:

```tsx
            const [homeRes, caloriesRes, profileRes, measurementsRes, calHistoryRes, weeklyRes] = await Promise.all([
                memberAPI.getHome(),
                caloriesAPI.getToday().catch(() => ({ totals: { calories: 0, entry_count: 0 } })),
                nutritionAPI.getProfile().catch(() => ({ profile: null })),
                measurementsAPI.getLatest().catch(() => ({ measurement: null })),
                caloriesAPI.getHistory(30).catch(() => ({ history: [] })),
                nutritionAPI.getWeekly().catch(() => ({ history: [], summary: null }))
            ]);
```

Then set the state alongside the existing `setStats(...)` call in the same block:

```tsx
            setWeekSummary(weeklyRes.summary ?? null);
```

The `?? null` matters: on the `.catch()` path `summary` is already `null`, but a malformed success response could omit the field entirely, and the card's prop is `WeekSummary | null`.

Render the card immediately **above** `<WorkoutCalendar ... />` (currently at `profile.tsx:266`), so nutrition and the food calendar sit together:

```tsx
<WeeklyNutritionCard
    summary={weekSummary}
    onPress={() => router.push('/member/nutrition-insights' as any)}
/>
```

`router` is already imported at `profile.tsx:16`.

- [ ] **Step 4: Verify**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

Run: `cd backend && node scripts/wiring_audit.js`
Expected: `nav orphans=0, api orphans=0`. This confirms both that the card is genuinely mounted and that `/member/nutrition-insights` resolves to a real route.

Run: `cd backend && npx jest`
Expected: full suite green.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/services/api.ts mobile/src/components/WeeklyNutritionCard.tsx "mobile/app/(tabs)/profile.tsx"
git commit -m "feat(nutrition): add weekly summary card to profile

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Rollout Notes

- **No migration, no schema change, no new endpoint.** `GET /nutrition/weekly` gains a field; `history` is untouched, so `StatsScreen` is unaffected.
- **Nothing is user-visible until Task 3.** Stopping after Task 2 leaves the app exactly as it is.
- **The card deliberately duplicates nothing.** The per-day bar chart already exists in `NutritionInsights` (`WeeklyCharts`, which self-fetches); this card answers a different question and links there rather than repeating it.
- **The `NutritionInsights` screen previously had a single entry point** (HomeScreen:687). This card becomes its second.
