# Indian Food Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fitzo's nutrition numbers correct for how Indians actually eat — same dish, different kitchen — and make logging a full Indian meal one tap instead of five.

**Architecture:** The 10,388-item food dataset is **not** rewritten. Cooking-medium variance is applied at read time by a pure function that adjusts fat (and recomputes calories) and injects the result as extra entries in the existing `servings[]` array. This is the key leverage: `CalorieLogScreen.tsx:1089` already renders `selectedFood.servings.map(...)`, so the variant picker UI ships for free. Learned defaults and combo logging are additive tables.

**Tech Stack:** Node 20, Express 4, PostgreSQL (Supabase), Jest, Expo/React Native 0.81, TypeScript.

## Global Constraints

- **Never bulk-rewrite `backend/src/data/indian-foods.json` for variants.** It is 2.5 MB / 10,388 records and currently high quality (0 duplicate names, 0.9% macro-math error). Variants are derived at read time, not stored. Task 4 is the *only* task that edits the file, and it edits categories only.
- **Pure logic goes in `backend/src/utils/`, tested in `backend/src/__tests__/<name>.test.js`, with no database dependency.** Follow the `crowd.js` / `busyTimes.js` pattern.
- **The `servings[]` contract is load-bearing.** Every serving object MUST carry exactly these keys, because `CalorieLogScreen` reads them directly: `id`, `description`, `measurementDescription`, `calories`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, `sodium`, `saturatedFat`, `cholesterol`. Adding keys is safe; renaming or omitting any is a breaking change.
- **`servings[0]` is the default selection.** `CalorieLogScreen.tsx:564` and `:579` both do `setSelectedServing(details.servings[0])`. Ordering this array *is* the mechanism for B4 learned defaults — no new UI required.
- **Macro arithmetic rule:** adjusting a cooking medium changes **fat only**. Protein and carbs are held constant; calories are recomputed as `base_calories + 9 * (new_fat - base_fat)`. Never scale calories independently — it desynchronises from macros and breaks the 0.9% consistency the dataset currently has.
- **All routes require `authenticate`** and wrap handlers in `asyncHandler`. Errors use classes from `backend/src/utils/errors.js` (`ValidationError` → 400, `ForbiddenError` → 403, `NotFoundError` → 404, `ConflictError` → 409).
- **Migrations** are numbered `.sql` files in `backend/data/migrations/`, applied with `node apply_migration.js data/migrations/<file>.sql`, and must be idempotent (`IF NOT EXISTS`).
- **`calorie_logs` has no `food_id` foreign key** — only a denormalised `food_name VARCHAR(100)`. Any per-food user preference must therefore key on a **normalised food name**, not an id.
- **The canonical food-logging endpoint is `POST /api/nutrition/log` (`backend/src/routes/nutrition.js:347`), and its field is `food_name`.** `POST /api/calories` also exists and uses `meal_name`, but the mobile app does **not** use it for food logging — `CalorieLogScreen` → `logFoodOptimistic` (`mobile/src/context/NutritionContext.tsx:103`) → `nutritionAPI.logFood` → `/nutrition/log`. All logging work in this plan targets `nutrition.js`. Do not "fix" the two routes into one as a side quest.
- **Cooking-medium variants apply to ~1,901 of 10,388 foods (18%)** — the cooked-dish categories only. This is intended: packaged goods and drinks have fixed, label-printed nutrition. A food showing a single serving is correct behaviour, not a bug.
- **Mobile styling uses tokens only** from `mobile/src/styles/theme.ts`. No hardcoded hex.
- **`typography.caption`, `typography.body`, and `colors.text.tertiary` DO NOT EXIST.** This was confirmed against `theme.ts` while executing the crowd-intelligence plan. `typography` exports only `fontFamily`, `sizes`, `lineHeight`, and `letterSpacing`; `colors.text` is `primary | secondary | muted | subtle | dark`. Use these instead, matching the established pattern in `CrowdIndicator.tsx`:
  - a caption/label → `fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.medium`
  - body text → `fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.regular`
  - `colors.text.tertiary` → `colors.text.muted`
  `spacing.xs` (4) and `colors.text.secondary` do exist and are fine to use as written.
- **Multiplier values in Task 1 are estimates, not measurements.** They are isolated in one exported table specifically so they can be tuned. Do not scatter them.

---

### Task 1: Cooking-medium adjustment (pure function)

**Files:**
- Create: `backend/src/utils/cookingMedium.js`
- Test: `backend/src/__tests__/cooking-medium.test.js`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `MEDIUMS` — ordered array of `{ id, label, fatFactor }`.
  - `isMediumApplicable(category: string)` → `boolean`
  - `applyCookingMedium(serving: object, mediumId: string)` → new serving object (never mutates input)
  - `buildServingVariants(serving: object, category: string)` → `object[]` — `[base, ...variants]`, or `[base]` when not applicable.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/cooking-medium.test.js`:

```js
/**
 * Cooking Medium Tests
 *
 * Same dish, different kitchen. A home dal and a restaurant dal tadka differ
 * almost entirely in fat — this adjusts fat and recomputes calories from it.
 */

const {
    MEDIUMS,
    isMediumApplicable,
    applyCookingMedium,
    buildServingVariants,
} = require('../utils/cookingMedium');

const baseServing = {
    id: 'default',
    description: '1 cup (200g)',
    measurementDescription: '1 cup (200g)',
    calories: 180,
    protein: 9,
    carbs: 25,
    fat: 5,
    fiber: 4,
    sugar: 0,
    sodium: 0,
    saturatedFat: 0,
    cholesterol: 0,
};

describe('isMediumApplicable', () => {
    it('applies to cooked dishes', () => {
        expect(isMediumApplicable('Sabzi')).toBe(true);
        expect(isMediumApplicable('Home Cooking')).toBe(true);
        expect(isMediumApplicable('South Indian')).toBe(true);
        expect(isMediumApplicable('Street Food')).toBe(true);
    });

    it('does not apply to items with fixed nutrition', () => {
        expect(isMediumApplicable('Packaged')).toBe(false);
        expect(isMediumApplicable('Beverages')).toBe(false);
        expect(isMediumApplicable('Dairy')).toBe(false);
        expect(isMediumApplicable('Fast Food')).toBe(false);
    });

    it('is case-insensitive and safe on junk input', () => {
        expect(isMediumApplicable('sabzi')).toBe(true);
        expect(isMediumApplicable('')).toBe(false);
        expect(isMediumApplicable(null)).toBe(false);
        expect(isMediumApplicable(undefined)).toBe(false);
    });
});

describe('applyCookingMedium', () => {
    it('leaves the baseline medium untouched', () => {
        const out = applyCookingMedium(baseServing, 'home_light');
        expect(out.fat).toBe(5);
        expect(out.calories).toBe(180);
    });

    it('raises fat and recomputes calories for ghee', () => {
        const out = applyCookingMedium(baseServing, 'home_ghee');
        // fat 5 * 1.8 = 9; calories 180 + 9*(9-5) = 216
        expect(out.fat).toBe(9);
        expect(out.calories).toBe(216);
    });

    it('holds protein and carbs constant', () => {
        const out = applyCookingMedium(baseServing, 'restaurant');
        expect(out.protein).toBe(baseServing.protein);
        expect(out.carbs).toBe(baseServing.carbs);
    });

    it('never mutates the input serving', () => {
        const snapshot = JSON.stringify(baseServing);
        applyCookingMedium(baseServing, 'street');
        expect(JSON.stringify(baseServing)).toBe(snapshot);
    });

    it('preserves the full serving contract keys', () => {
        const out = applyCookingMedium(baseServing, 'home_ghee');
        Object.keys(baseServing).forEach((k) => {
            expect(out).toHaveProperty(k);
        });
    });

    it('returns an unchanged copy for an unknown medium', () => {
        const out = applyCookingMedium(baseServing, 'nonsense');
        expect(out.calories).toBe(180);
        expect(out.fat).toBe(5);
    });

    it('handles a zero-fat base without producing NaN', () => {
        const zero = { ...baseServing, fat: 0, calories: 136 };
        const out = applyCookingMedium(zero, 'restaurant');
        expect(out.fat).toBe(0);
        expect(out.calories).toBe(136);
    });
});

describe('buildServingVariants', () => {
    it('returns base plus one entry per medium for cooked dishes', () => {
        const variants = buildServingVariants(baseServing, 'Sabzi');
        expect(variants).toHaveLength(MEDIUMS.length);
        expect(variants[0].id).toBe('home_light');
    });

    it('labels each variant so the picker is readable', () => {
        const variants = buildServingVariants(baseServing, 'Sabzi');
        const labels = variants.map((v) => v.description);
        expect(labels.some((l) => /ghee/i.test(l))).toBe(true);
        expect(labels.some((l) => /restaurant/i.test(l))).toBe(true);
    });

    it('returns only the base serving when not applicable', () => {
        const variants = buildServingVariants(baseServing, 'Packaged');
        expect(variants).toHaveLength(1);
        expect(variants[0].id).toBe('default');
    });

    it('produces strictly increasing calories across mediums', () => {
        const variants = buildServingVariants(baseServing, 'Sabzi');
        const cals = variants.map((v) => v.calories);
        const sorted = [...cals].sort((a, b) => a - b);
        expect(cals).toEqual(sorted);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest cooking-medium --verbose`
Expected: FAIL — `Cannot find module '../utils/cookingMedium'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/utils/cookingMedium.js`:

```js
/**
 * Cooking Medium Adjustment
 *
 * The single biggest accuracy gap for Indian food logging: a home dal and a
 * restaurant dal tadka share a name and a portion but not a calorie count.
 * The difference is almost entirely added fat (ghee, oil, cream, butter).
 *
 * Rather than storing 4x variants for 10,388 foods, we derive them at read
 * time: scale fat, recompute calories from the fat delta, hold protein and
 * carbs constant.
 *
 * NOTE: fatFactor values are informed estimates, not lab measurements. They
 * live here, in one table, precisely so they can be tuned against real data
 * later without touching any call site.
 */

const MEDIUMS = [
    { id: 'home_light', label: 'Home (light oil)', fatFactor: 1.0 },
    { id: 'home_ghee', label: 'Home (ghee)', fatFactor: 1.8 },
    { id: 'restaurant', label: 'Restaurant', fatFactor: 2.4 },
    { id: 'street', label: 'Street / dhaba', fatFactor: 2.8 },
];

const MEDIUM_BY_ID = new Map(MEDIUMS.map((m) => [m.id, m]));

/**
 * Categories where a cooking medium is a real variable.
 * Packaged goods, drinks, and chain fast food have fixed, label-printed
 * nutrition — offering a "ghee" option there would be noise, not accuracy.
 */
const APPLICABLE_CATEGORIES = new Set([
    'sabzi',
    'home cooking',
    'south indian',
    'street food',
    'non-veg',
    'regional',
    'breakfast',
    'curry',
    'dal',
    'lentils',
]);

const KCAL_PER_GRAM_FAT = 9;

function isMediumApplicable(category) {
    if (!category || typeof category !== 'string') return false;
    return APPLICABLE_CATEGORIES.has(category.trim().toLowerCase());
}

/**
 * Adjust a serving for a cooking medium.
 * Fat only. Calories follow from the fat delta. Input is never mutated.
 */
function applyCookingMedium(serving, mediumId) {
    const medium = MEDIUM_BY_ID.get(mediumId);
    if (!serving) return serving;
    if (!medium) return { ...serving };

    const baseFat = Number(serving.fat) || 0;
    const baseCalories = Number(serving.calories) || 0;

    const newFat = Math.round(baseFat * medium.fatFactor);
    const newCalories = Math.round(baseCalories + KCAL_PER_GRAM_FAT * (newFat - baseFat));

    return {
        ...serving,
        fat: newFat,
        calories: newCalories,
    };
}

/**
 * Build the servings array for a food: base first, then one entry per medium.
 * The mobile picker (CalorieLogScreen) renders whatever is in this array and
 * pre-selects index 0 — so ordering here IS the default-selection mechanism.
 */
function buildServingVariants(serving, category) {
    if (!serving) return [];
    if (!isMediumApplicable(category)) return [{ ...serving }];

    return MEDIUMS.map((medium) => {
        const adjusted = applyCookingMedium(serving, medium.id);
        return {
            ...adjusted,
            id: medium.id,
            description: `${serving.description} · ${medium.label}`,
            measurementDescription: serving.measurementDescription,
            cookingMedium: medium.id,
        };
    });
}

module.exports = {
    MEDIUMS,
    APPLICABLE_CATEGORIES,
    isMediumApplicable,
    applyCookingMedium,
    buildServingVariants,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest cooking-medium --verbose`
Expected: PASS — 15 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/cookingMedium.js backend/src/__tests__/cooking-medium.test.js
git commit -m "feat(food): add cooking-medium adjustment for Indian dishes"
```

---

### Task 2: Serve variants from food detail, and remove dead duplicate routes

**Files:**
- Modify: `backend/src/services/indianFood.js` (the `getFoodDetails` function)
- Modify: `backend/src/routes/food.js` (delete the duplicated route block)

**Interfaces:**
- Consumes: `buildServingVariants` from Task 1.
- Produces: `GET /api/food/:id` returns `servings[]` with 1 entry (non-applicable) or 4 entries (applicable), each carrying a `cookingMedium` key.

- [ ] **Step 1: Inject variants into getFoodDetails**

In `backend/src/services/indianFood.js`, add the require at the top:

```js
const { buildServingVariants } = require('../utils/cookingMedium');
```

Replace the `return { ... }` block of `getFoodDetails` with:

```js
    const baseServing = {
        id: 'default',
        description: food.servingSize,
        measurementDescription: food.servingSize,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber || 0,
        sugar: 0,
        sodium: 0,
        saturatedFat: 0,
        cholesterol: 0,
    };

    return {
        id: food.id,
        name: food.name,
        brand: food.category,
        type: 'Indian',
        // For cooked dishes this expands to one entry per cooking medium.
        // CalorieLogScreen renders servings[] directly and pre-selects [0].
        servings: buildServingVariants(baseServing, food.category),
    };
```

- [ ] **Step 2: Delete the unreachable duplicate routes**

`backend/src/routes/food.js` defines `GET /categories/indian` twice (lines 212 and 278) and `GET /gym-foods` twice (lines 233 and 299). The bodies are byte-identical and Express only ever matches the first — the second pair is dead code.

Delete the **second** occurrence of each (the block starting at line 278 through the end of the second `/gym-foods` handler). Verify before deleting:

Run: `cd backend && grep -n "router.get('/categories/indian'\|router.get('/gym-foods'" src/routes/food.js`
Expected before: 4 lines (212, 233, 278, 299). Expected after: 2 lines.

- [ ] **Step 3: Verify behaviour with a direct call**

Run:
```bash
cd backend && node -e "
const svc = require('./src/services/indianFood');
const dal = svc.getFoodDetails('ind_3');
console.log(dal.name, '|', dal.brand);
dal.servings.forEach(s => console.log('  ', s.id, s.calories + 'kcal', s.fat + 'g fat', '|', s.description));
"
```
Expected: `Dal (Toor/Arhar)` with 4 servings whose calories increase monotonically. If it prints only 1 serving, the food's category is not in `APPLICABLE_CATEGORIES` — check the actual category string and add it rather than loosening the check.

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; all suites PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/indianFood.js backend/src/routes/food.js
git commit -m "feat(food): serve cooking-medium variants; remove duplicate dead routes"
```

---

### Task 3: Verify the variant picker renders on mobile

No new component — this task confirms the existing picker handles 4 servings and that nothing regressed.

**Files:**
- Modify: `mobile/src/screens/member/CalorieLogScreen.tsx` (label only, if needed)

**Interfaces:**
- Consumes: `GET /api/food/:id` from Task 2.
- Produces: nothing downstream.

- [ ] **Step 1: Read the existing picker**

Run: `cd mobile && sed -n '1080,1110p' src/screens/member/CalorieLogScreen.tsx`

Confirm it maps `selectedFood.servings` and renders `serving.description`. It already does as of this writing — the point of this step is to catch drift before assuming.

- [ ] **Step 2: Add a section label when variants are present**

Directly above the `selectedFood.servings.map(...)` block, add:

```tsx
{selectedFood.servings.length > 1 && (
    <Text style={styles.servingPickerLabel}>HOW WAS IT COOKED?</Text>
)}
```

Add the style to the existing `StyleSheet.create` block:

```tsx
    servingPickerLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        letterSpacing: 1.2,
        marginBottom: spacing.xs,
    },
```

These token paths are verified to exist. Do not introduce hardcoded values.

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/member/CalorieLogScreen.tsx
git commit -m "feat(food): label the cooking-medium picker"
```

---

### Task 4: Category taxonomy normalisation (B3)

**Files:**
- Create: `backend/src/utils/foodCategories.js`
- Create: `backend/src/__tests__/food-categories.test.js`
- Create: `backend/scripts/normalize_food_categories.js`
- Modify: `backend/src/data/indian-foods.json` (via the script — categories only)

**Interfaces:**
- Consumes: nothing.
- Produces: `canonicalCategory(raw: string)` → `string`; `CATEGORY_ALIASES` map.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/food-categories.test.js`:

```js
/**
 * Food Category Tests
 * The dataset grew organically and has singular/plural splits
 * (Snack/Snacks, Beverage/Beverages) that fragment search and filtering.
 */

const { canonicalCategory } = require('../utils/foodCategories');

describe('canonicalCategory', () => {
    it('collapses singular/plural duplicates', () => {
        expect(canonicalCategory('Snack')).toBe('Snacks');
        expect(canonicalCategory('Snacks')).toBe('Snacks');
        expect(canonicalCategory('Beverage')).toBe('Beverages');
        expect(canonicalCategory('Beverages')).toBe('Beverages');
    });

    it('is case- and whitespace-insensitive', () => {
        expect(canonicalCategory('  snack ')).toBe('Snacks');
        expect(canonicalCategory('BEVERAGE')).toBe('Beverages');
    });

    it('passes through categories that need no change', () => {
        expect(canonicalCategory('Sabzi')).toBe('Sabzi');
        expect(canonicalCategory('South Indian')).toBe('South Indian');
    });

    it('title-cases unknown categories rather than dropping them', () => {
        expect(canonicalCategory('mithai')).toBe('Mithai');
    });

    it('returns Uncategorised for empty or junk input', () => {
        expect(canonicalCategory('')).toBe('Uncategorised');
        expect(canonicalCategory(null)).toBe('Uncategorised');
        expect(canonicalCategory(undefined)).toBe('Uncategorised');
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest food-categories --verbose`
Expected: FAIL — `Cannot find module '../utils/foodCategories'`

- [ ] **Step 3: Implement**

Create `backend/src/utils/foodCategories.js`:

```js
/**
 * Food Category Canonicalisation
 *
 * indian-foods.json grew in batches, leaving singular/plural splits that
 * fragment both search scoring and category browsing:
 *   Snacks (353) + Snack (284), Beverages (324) + Beverage (255)
 */

const CATEGORY_ALIASES = new Map([
    ['snack', 'Snacks'],
    ['snacks', 'Snacks'],
    ['beverage', 'Beverages'],
    ['beverages', 'Beverages'],
    ['sweet', 'Sweets'],
    ['sweets', 'Sweets'],
    ['bread', 'Breads'],
    ['breads', 'Breads'],
    ['dessert', 'Desserts'],
    ['desserts', 'Desserts'],
]);

function titleCase(s) {
    return s
        .split(/\s+/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(' ');
}

function canonicalCategory(raw) {
    if (!raw || typeof raw !== 'string') return 'Uncategorised';
    const key = raw.trim().toLowerCase();
    if (!key) return 'Uncategorised';
    if (CATEGORY_ALIASES.has(key)) return CATEGORY_ALIASES.get(key);
    return titleCase(raw.trim());
}

module.exports = { canonicalCategory, CATEGORY_ALIASES };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest food-categories --verbose`
Expected: PASS — 5 tests

- [ ] **Step 5: Write the normalisation script**

Create `backend/scripts/normalize_food_categories.js`:

```js
/**
 * One-shot: rewrite `category` on every record in indian-foods.json
 * through canonicalCategory(). Categories only — no macro values are touched.
 *
 * Usage:
 *   node scripts/normalize_food_categories.js --dry
 *   node scripts/normalize_food_categories.js
 */

const fs = require('fs');
const path = require('path');
const { canonicalCategory } = require('../src/utils/foodCategories');

const DATA_PATH = path.resolve(__dirname, '../src/data/indian-foods.json');
const dryRun = process.argv.includes('--dry');

const foods = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const before = {};
const after = {};
let changed = 0;

foods.forEach((f) => {
    const from = f.category;
    const to = canonicalCategory(from);
    before[from] = (before[from] || 0) + 1;
    after[to] = (after[to] || 0) + 1;
    if (from !== to) {
        changed++;
        if (!dryRun) f.category = to;
    }
});

console.log(`records:            ${foods.length}`);
console.log(`categories before:  ${Object.keys(before).length}`);
console.log(`categories after:   ${Object.keys(after).length}`);
console.log(`records changed:    ${changed}`);

if (dryRun) {
    console.log('\n--dry: nothing written');
} else {
    fs.writeFileSync(DATA_PATH, JSON.stringify(foods, null, 2));
    console.log('\n✅ written');
}
```

- [ ] **Step 6: Dry-run, then apply**

Run: `cd backend && node scripts/normalize_food_categories.js --dry`
Expected: category count drops (e.g. ~120 → ~110); `records changed` is non-zero.

Then: `cd backend && node scripts/normalize_food_categories.js`
Expected: `✅ written`

- [ ] **Step 7: Verify no macro data was harmed**

Run:
```bash
cd backend && node -e "
const f=require('./src/data/indian-foods.json');
console.log('count:', f.length);
const dupes = f.length - new Set(f.map(x=>x.name.toLowerCase())).size;
console.log('duplicate names:', dupes);
let bad=0; f.forEach(x=>{const c=4*x.protein+4*x.carbs+9*x.fat; if(x.calories>0 && Math.abs(c-x.calories)/x.calories>0.30) bad++;});
console.log('macro mismatch >30%:', bad);
"
```
Expected: `count: 10388`, `duplicate names: 0`, `macro mismatch >30%: 90` — identical to the pre-change baseline. Any change here means the script damaged data; revert with `git checkout backend/src/data/indian-foods.json`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/utils/foodCategories.js backend/src/__tests__/food-categories.test.js backend/scripts/normalize_food_categories.js backend/src/data/indian-foods.json
git commit -m "feat(food): canonicalise category taxonomy across the dataset"
```

---

### Task 5: Remember the user's cooking medium (B4)

**Files:**
- Create: `backend/data/migrations/007_user_food_prefs.sql`
- Create: `backend/src/services/foodPrefs.js`
- Create: `backend/src/__tests__/food-prefs.test.js`

**Interfaces:**
- Consumes: `MEDIUMS` from Task 1.
- Produces:
  - `normaliseFoodKey(name: string)` → `string`
  - `recordMediumChoice(userId, foodName, mediumId)` → `Promise<void>`
  - `getPreferredMedium(userId, foodName)` → `Promise<string|null>`

- [ ] **Step 1: Write the migration**

Create `backend/data/migrations/007_user_food_prefs.sql`:

```sql
-- Remembers which cooking medium a member picks for a given dish, so the
-- app stops asking. Keyed on a normalised food NAME because calorie_logs
-- stores no food_id.

CREATE TABLE IF NOT EXISTS user_food_prefs (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_key     VARCHAR(120) NOT NULL,
  medium_id    VARCHAR(32)  NOT NULL,
  choice_count INTEGER      NOT NULL DEFAULT 1,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, food_key)
);

CREATE INDEX IF NOT EXISTS idx_user_food_prefs_user
  ON user_food_prefs (user_id);
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/__tests__/food-prefs.test.js`:

```js
/**
 * Food Preference Tests
 * Only the pure key-normalisation is unit tested here; the read/write
 * helpers touch Postgres and are covered by manual verification in Task 5.
 */

const { normaliseFoodKey } = require('../services/foodPrefs');

describe('normaliseFoodKey', () => {
    it('lowercases and trims', () => {
        expect(normaliseFoodKey('  Dal Tadka  ')).toBe('dal tadka');
    });

    it('collapses internal whitespace', () => {
        expect(normaliseFoodKey('Paneer   Butter  Masala')).toBe('paneer butter masala');
    });

    it('strips parenthetical qualifiers so variants share one key', () => {
        expect(normaliseFoodKey('Roti (Chapati)')).toBe('roti');
        expect(normaliseFoodKey('Dal (Toor/Arhar)')).toBe('dal');
    });

    it('truncates to the column width', () => {
        const key = normaliseFoodKey('x'.repeat(200));
        expect(key.length).toBeLessThanOrEqual(120);
    });

    it('returns empty string for junk input', () => {
        expect(normaliseFoodKey(null)).toBe('');
        expect(normaliseFoodKey(undefined)).toBe('');
        expect(normaliseFoodKey('')).toBe('');
    });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && npx jest food-prefs --verbose`
Expected: FAIL — `Cannot find module '../services/foodPrefs'`

- [ ] **Step 4: Implement**

Create `backend/src/services/foodPrefs.js`:

```js
/**
 * Per-user cooking-medium preferences.
 *
 * If someone always logs their dal as "Home (ghee)", asking every time is a
 * tax. This records the choice and lets the food detail endpoint pre-select it.
 *
 * Keyed on a normalised food NAME: calorie_logs has no food_id column, and
 * the same dish arrives from several upstream sources with different ids.
 */

const { query } = require('../config/database');

const MAX_KEY_LENGTH = 120;

function normaliseFoodKey(name) {
    if (!name || typeof name !== 'string') return '';
    return name
        .replace(/\([^)]*\)/g, ' ')   // drop "(Chapati)", "(Toor/Arhar)"
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .slice(0, MAX_KEY_LENGTH);
}

/**
 * Record a choice. Upsert — repeated picks strengthen the preference.
 * Never throws: a preference failing to save must not fail a food log.
 */
async function recordMediumChoice(userId, foodName, mediumId) {
    const key = normaliseFoodKey(foodName);
    if (!key || !mediumId) return;

    try {
        await query(
            `INSERT INTO user_food_prefs (user_id, food_key, medium_id, choice_count, updated_at)
             VALUES ($1, $2, $3, 1, NOW())
             ON CONFLICT (user_id, food_key) DO UPDATE
               SET medium_id    = EXCLUDED.medium_id,
                   choice_count = user_food_prefs.choice_count + 1,
                   updated_at   = NOW()`,
            [userId, key, mediumId]
        );
    } catch (err) {
        console.error('recordMediumChoice failed:', err.message);
    }
}

/**
 * @returns {Promise<string|null>} preferred medium id, or null if none
 */
async function getPreferredMedium(userId, foodName) {
    const key = normaliseFoodKey(foodName);
    if (!key) return null;

    try {
        const result = await query(
            `SELECT medium_id FROM user_food_prefs
              WHERE user_id = $1 AND food_key = $2
              LIMIT 1`,
            [userId, key]
        );
        return result.rows.length ? result.rows[0].medium_id : null;
    } catch (err) {
        console.error('getPreferredMedium failed:', err.message);
        return null;
    }
}

module.exports = {
    normaliseFoodKey,
    recordMediumChoice,
    getPreferredMedium,
    MAX_KEY_LENGTH,
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && npx jest food-prefs --verbose`
Expected: PASS — 5 tests

- [ ] **Step 6: Apply the migration**

Run: `cd backend && node apply_migration.js data/migrations/007_user_food_prefs.sql`
Expected: `✅ Migration applied successfully!`

- [ ] **Step 7: Commit**

```bash
git add backend/data/migrations/007_user_food_prefs.sql backend/src/services/foodPrefs.js backend/src/__tests__/food-prefs.test.js
git commit -m "feat(food): record per-user cooking-medium preferences"
```

---

### Task 6: Apply the learned default

Reordering `servings[]` is the whole mechanism — `CalorieLogScreen` pre-selects index 0.

**Files:**
- Modify: `backend/src/routes/food.js` (the `GET /:id` handler at line ~252)
- Modify: `backend/src/routes/nutrition.js` (the `POST /log` handler at line 347)
- Modify: `mobile/src/context/NutritionContext.tsx` (the `logFoodOptimistic` signature at line 103 and its interface at line 28)
- Modify: `mobile/src/services/api.ts` (the `nutritionAPI.logFood` type at line ~722)

**Interfaces:**
- Consumes: `getPreferredMedium`, `recordMediumChoice` from Task 5.
- Produces: `GET /api/food/:id` returns `servings[]` with the user's preferred medium at index 0. `POST /api/nutrition/log` accepts an optional `cooking_medium` field.

- [ ] **Step 1: Reorder servings by learned preference**

In `backend/src/routes/food.js`, add the require at the top:

```js
const foodPrefs = require('../services/foodPrefs');
```

In the `GET /:id` handler, after the food details are fetched and before `res.json(...)`:

```js
    // Put the member's usual choice first — CalorieLogScreen pre-selects [0].
    if (details && Array.isArray(details.servings) && details.servings.length > 1) {
        const preferred = await foodPrefs.getPreferredMedium(req.user.id, details.name);
        if (preferred) {
            const idx = details.servings.findIndex((s) => s.id === preferred);
            if (idx > 0) {
                const [chosen] = details.servings.splice(idx, 1);
                details.servings.unshift(chosen);
            }
        }
    }
```

- [ ] **Step 2: Record the choice when a food is logged**

This goes in `nutrition.js`, **not** `calories.js` — see Global Constraints. `POST /api/nutrition/log` is the endpoint the app actually calls.

In `backend/src/routes/nutrition.js`, add the require at the top:

```js
const foodPrefs = require('../services/foodPrefs');
```

Add the new field to the `POST /log` destructure (line ~349) — note the field is `food_name` here:

```js
    const {
        food_name,
        calories,
        protein,
        carbs,
        fat,
        serving_size,
        cooking_medium,
        meal_type = 'snack', // breakfast, lunch, dinner, snack
        visibility = 'friends'
    } = req.body;
```

After the successful `INSERT` and before `res.json(...)`, add:

```js
    // Fire-and-forget: a preference write must never fail a food log.
    if (cooking_medium) {
        foodPrefs.recordMediumChoice(userId, food_name, cooking_medium)
            .catch(() => {});
    }
```

- [ ] **Step 3: Thread the medium through the mobile logging path**

Logging flows `CalorieLogScreen` → `logFoodOptimistic` → `nutritionAPI.logFood`, so the optional field must be added at all three points or TypeScript will reject it.

In `mobile/src/services/api.ts`, add to the `logFood` parameter type (line ~722):

```ts
        cooking_medium?: string;
```

In `mobile/src/context/NutritionContext.tsx`, add the same optional field to **both** the interface declaration (line 28) and the `logFoodOptimistic` parameter type (line 103):

```ts
        cooking_medium?: string;
```

In `mobile/src/screens/member/CalorieLogScreen.tsx`, add to the `logFoodOptimistic({ ... })` call (around line 607, alongside `food_name` and `serving_size`):

```tsx
                cooking_medium: (selectedServing as any).cookingMedium ?? undefined,
```

- [ ] **Step 4: Verify**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest && cd ../mobile && npx tsc --noEmit`
Expected: syntax clean; all backend suites PASS; 0 TS errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/food.js backend/src/routes/nutrition.js mobile/src/services/api.ts mobile/src/context/NutritionContext.tsx mobile/src/screens/member/CalorieLogScreen.tsx
git commit -m "feat(food): pre-select the member's usual cooking medium"
```

---

### Task 7: Bulk meal logging (B2 backend)

**Files:**
- Modify: `backend/src/routes/nutrition.js`
- Create: `backend/src/__tests__/bulk-log.test.js`
- Create: `backend/src/utils/mealCombo.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `validateComboItems(items: any)` → `{ valid: boolean, error: string|null, items: object[] }`
  - `POST /api/nutrition/log-bulk` → `201 { success: true, logged: number, totals: {...} }`

> Bulk logging lives beside single logging in `nutrition.js`, not in `calories.js`. Splitting the two write paths across routers is how the `food_name` / `meal_name` divergence happened in the first place.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/bulk-log.test.js`:

```js
/**
 * Bulk Meal Log Tests
 * Nobody eats "1 roti" — they eat 2 roti + dal + sabzi + rice + curd.
 */

const { validateComboItems, MAX_COMBO_ITEMS } = require('../utils/mealCombo');

const item = (over = {}) => ({
    meal_name: 'Roti',
    calories: 120,
    protein: 3,
    carbs: 20,
    fat: 3,
    ...over,
});

describe('validateComboItems', () => {
    it('accepts a normal thali', () => {
        const result = validateComboItems([item(), item({ meal_name: 'Dal' })]);
        expect(result.valid).toBe(true);
        expect(result.items).toHaveLength(2);
    });

    it('rejects a non-array', () => {
        expect(validateComboItems(null).valid).toBe(false);
        expect(validateComboItems({}).valid).toBe(false);
    });

    it('rejects an empty combo', () => {
        expect(validateComboItems([]).valid).toBe(false);
    });

    it('rejects more than the item cap', () => {
        const many = Array.from({ length: MAX_COMBO_ITEMS + 1 }, () => item());
        expect(validateComboItems(many).valid).toBe(false);
    });

    it('rejects negative or absurd calories', () => {
        expect(validateComboItems([item({ calories: -5 })]).valid).toBe(false);
        expect(validateComboItems([item({ calories: 99999 })]).valid).toBe(false);
    });

    it('defaults missing macros to zero rather than failing', () => {
        const result = validateComboItems([{ meal_name: 'Curd', calories: 60 }]);
        expect(result.valid).toBe(true);
        expect(result.items[0]).toMatchObject({ protein: 0, carbs: 0, fat: 0 });
    });

    it('rejects an item with no name', () => {
        expect(validateComboItems([item({ meal_name: '' })]).valid).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest bulk-log --verbose`
Expected: FAIL — `Cannot find module '../utils/mealCombo'`

- [ ] **Step 3: Implement the validator**

Create `backend/src/utils/mealCombo.js`:

```js
/**
 * Meal Combo Validation
 *
 * A combo is a set of foods logged in one action — the Indian thali case.
 * Validation is pure so it can be tested without a database, and strict so a
 * malformed client payload can't write junk rows.
 */

const MAX_COMBO_ITEMS = 15;
const MAX_ITEM_CALORIES = 10000;

function toNonNegativeInt(value) {
    const n = Math.round(Number(value) || 0);
    return n < 0 ? 0 : n;
}

function validateComboItems(items) {
    if (!Array.isArray(items)) {
        return { valid: false, error: 'Expected a list of foods', items: [] };
    }
    if (items.length === 0) {
        return { valid: false, error: 'Add at least one food', items: [] };
    }
    if (items.length > MAX_COMBO_ITEMS) {
        return { valid: false, error: `That's more than ${MAX_COMBO_ITEMS} items`, items: [] };
    }

    const cleaned = [];
    for (const raw of items) {
        if (!raw || typeof raw !== 'object') {
            return { valid: false, error: 'One of the foods is malformed', items: [] };
        }
        const name = typeof raw.meal_name === 'string' ? raw.meal_name.trim() : '';
        if (!name) {
            return { valid: false, error: 'Every food needs a name', items: [] };
        }
        const calories = Number(raw.calories);
        if (!Number.isFinite(calories) || calories < 0 || calories > MAX_ITEM_CALORIES) {
            return { valid: false, error: `Calories for "${name}" look wrong`, items: [] };
        }
        cleaned.push({
            meal_name: name.slice(0, 100),
            calories: Math.round(calories),
            protein: toNonNegativeInt(raw.protein),
            carbs: toNonNegativeInt(raw.carbs),
            fat: toNonNegativeInt(raw.fat),
            cooking_medium: typeof raw.cooking_medium === 'string' ? raw.cooking_medium : null,
        });
    }

    return { valid: true, error: null, items: cleaned };
}

module.exports = { validateComboItems, MAX_COMBO_ITEMS, MAX_ITEM_CALORIES };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest bulk-log --verbose`
Expected: PASS — 7 tests

- [ ] **Step 5: Add the bulk endpoint**

In `backend/src/routes/nutrition.js`, add the require at the top:

```js
const { validateComboItems } = require('../utils/mealCombo');
```

Add the route before `module.exports`:

```js
/**
 * POST /api/nutrition/log-bulk
 * Log a whole meal in one action (the thali case).
 * All-or-nothing: a partially logged meal is worse than a failed one.
 */
router.post('/log-bulk', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { items, visibility = 'friends' } = req.body;

    const { valid, error, items: cleaned } = validateComboItems(items);
    if (!valid) throw new ValidationError(error);

    const validVisibility = ['public', 'friends', 'private'];
    if (!validVisibility.includes(visibility)) {
        throw new ValidationError('Invalid visibility option');
    }

    // Single multi-row INSERT — one round trip, atomic by definition.
    const values = [];
    const placeholders = cleaned.map((it, i) => {
        const b = i * 7;
        values.push(userId, it.calories, it.protein, it.carbs, it.fat, it.meal_name, visibility);
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
    });

    await query(
        `INSERT INTO calorie_logs (user_id, calories, protein, carbs, fat, food_name, visibility)
         VALUES ${placeholders.join(', ')}`,
        values
    );

    const totals = cleaned.reduce(
        (acc, it) => ({
            calories: acc.calories + it.calories,
            protein: acc.protein + it.protein,
            carbs: acc.carbs + it.carbs,
            fat: acc.fat + it.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    await cache.del(cache.keys.nutritionToday(userId));
    invalidateContextPack(userId).catch(() => {});

    res.status(201).json({ success: true, logged: cleaned.length, totals });
}));
```

Confirm `cache`, `authenticate`, `ValidationError`, and `invalidateContextPack` are already imported in `nutrition.js` (the `POST /log` handler above uses the latter three); add any that are missing.

- [ ] **Step 6: Verify**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; all suites PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/utils/mealCombo.js backend/src/__tests__/bulk-log.test.js backend/src/routes/nutrition.js
git commit -m "feat(food): add bulk meal logging endpoint"
```

---

### Task 8: Thali presets and one-tap logging (B2 mobile)

**Files:**
- Create: `backend/src/data/meal-presets.json`
- Modify: `backend/src/routes/nutrition.js` (preset list endpoint)
- Modify: `mobile/src/services/api.ts`
- Create: `mobile/src/components/ThaliPresets.tsx`
- Modify: `mobile/src/screens/member/CalorieLogScreen.tsx`

**Interfaces:**
- Consumes: `POST /api/nutrition/log-bulk` from Task 7.
- Produces:
  - `GET /api/nutrition/presets` → `{ presets: Array<{ id, name, emoji, items }> }`
  - `nutritionAPI.getPresets()`, `nutritionAPI.logBulk(items)`
  - `<ThaliPresets onLogged={(preset, kcal) => void} />`

- [ ] **Step 1: Create the preset data**

Create `backend/src/data/meal-presets.json`:

```json
[
  {
    "id": "north_veg_thali",
    "name": "North Indian Veg Thali",
    "emoji": "🍛",
    "items": [
      { "meal_name": "Roti", "calories": 240, "protein": 7, "carbs": 40, "fat": 6 },
      { "meal_name": "Dal", "calories": 180, "protein": 9, "carbs": 25, "fat": 5 },
      { "meal_name": "Sabzi", "calories": 150, "protein": 4, "carbs": 15, "fat": 8 },
      { "meal_name": "Rice (Cooked, White)", "calories": 200, "protein": 4, "carbs": 44, "fat": 1 },
      { "meal_name": "Curd", "calories": 60, "protein": 3, "carbs": 5, "fat": 3 }
    ]
  },
  {
    "id": "south_breakfast",
    "name": "South Indian Breakfast",
    "emoji": "🥞",
    "items": [
      { "meal_name": "Idli", "calories": 116, "protein": 4, "carbs": 24, "fat": 1 },
      { "meal_name": "Sambar", "calories": 130, "protein": 6, "carbs": 18, "fat": 4 },
      { "meal_name": "Coconut Chutney", "calories": 90, "protein": 2, "carbs": 4, "fat": 8 }
    ]
  },
  {
    "id": "gym_post_workout",
    "name": "Post-Workout Plate",
    "emoji": "💪",
    "items": [
      { "meal_name": "Grilled Chicken Breast", "calories": 165, "protein": 31, "carbs": 0, "fat": 4 },
      { "meal_name": "Rice (Cooked, White)", "calories": 200, "protein": 4, "carbs": 44, "fat": 1 },
      { "meal_name": "Curd", "calories": 60, "protein": 3, "carbs": 5, "fat": 3 }
    ]
  }
]
```

- [ ] **Step 2: Serve the presets**

In `backend/src/routes/nutrition.js`, add near the other requires:

```js
const mealPresets = require('../data/meal-presets.json');
```

Add the route before `module.exports`:

```js
/**
 * GET /api/nutrition/presets
 * Common Indian meal combos for one-tap logging.
 */
router.get('/presets', authenticate, asyncHandler(async (req, res) => {
    res.json({ presets: mealPresets });
}));
```

- [ ] **Step 3: Add the mobile API methods**

In `mobile/src/services/api.ts`, add to the existing `nutritionAPI` object:

```ts
    getPresets: async () => {
        const response = await api.get('/nutrition/presets');
        return response.data;
    },

    logBulk: async (items: Array<{
        meal_name: string;
        calories: number;
        protein?: number;
        carbs?: number;
        fat?: number;
    }>) => {
        const response = await api.post('/nutrition/log-bulk', { items });
        return response.data;
    },
```

- [ ] **Step 4: Build the presets component**

Create `mobile/src/components/ThaliPresets.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { nutritionAPI } from '../services/api';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface PresetItem {
    meal_name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
}

interface Preset {
    id: string;
    name: string;
    emoji: string;
    items: PresetItem[];
}

interface ThaliPresetsProps {
    onLogged?: (preset: Preset, totalCalories: number) => void;
}

const ThaliPresets: React.FC<ThaliPresetsProps> = ({ onLogged }) => {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [pending, setPending] = useState<string | null>(null);

    useEffect(() => {
        nutritionAPI.getPresets()
            .then((r) => setPresets(r.presets ?? []))
            .catch(() => setPresets([]));
    }, []);

    const logPreset = async (preset: Preset) => {
        if (pending) return;
        setPending(preset.id);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await nutritionAPI.logBulk(preset.items);
            onLogged?.(preset, result?.totals?.calories ?? 0);
        } catch {
            // Surfaced by the caller's toast; nothing useful to do here.
        } finally {
            setPending(null);
        }
    };

    if (presets.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>QUICK MEALS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {presets.map((preset) => {
                    const kcal = preset.items.reduce((s, i) => s + i.calories, 0);
                    return (
                        <Pressable
                            key={preset.id}
                            onPress={() => logPreset(preset)}
                            disabled={pending !== null}
                            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                            accessibilityRole="button"
                            accessibilityLabel={`Log ${preset.name}, ${kcal} calories`}
                        >
                            {pending === preset.id ? (
                                <ActivityIndicator color={colors.text.primary} />
                            ) : (
                                <>
                                    <Text style={styles.emoji}>{preset.emoji}</Text>
                                    <Text style={styles.name} numberOfLines={2}>{preset.name}</Text>
                                    <Text style={styles.meta}>{kcal} kcal · {preset.items.length} items</Text>
                                </>
                            )}
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginVertical: spacing.md },
    title: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        letterSpacing: 1.2,
        marginBottom: spacing.sm,
    },
    card: {
        width: 140,
        minHeight: 104,
        justifyContent: 'center',
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        marginRight: spacing.sm,
    },
    cardPressed: { backgroundColor: colors.glass.surfaceHover },
    emoji: { fontSize: 24, marginBottom: spacing.xs },
    name: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
    },
    meta: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
});

export default ThaliPresets;
```

- [ ] **Step 5: Mount it — do not leave it orphaned**

In `mobile/src/screens/member/CalorieLogScreen.tsx`, import and render it above the food search input:

```tsx
import ThaliPresets from '../../components/ThaliPresets';
```

```tsx
<ThaliPresets
    onLogged={(preset, kcal) => {
        toast.success('Logged!', `${preset.name} · ${kcal} kcal`);
        refreshToday();
    }}
/>
```

Two names verified against the current code — use them exactly:
- `toast` comes from `const toast = useToast()` at `CalorieLogScreen.tsx:110`. Its API is `toast.success(title, message)` / `toast.error(title, message)` — **two** arguments, not one. There is no `showToast`.
- `refreshToday` comes from `NutritionContext` and is what `logFoodOptimistic` already calls after a successful write. Destructure it from the same `useNutrition()` hook this screen already consumes; do **not** invent a `loadTodayLogs`.

- [ ] **Step 6: Full verification**

Run: `cd mobile && npx tsc --noEmit && cd ../backend && npx jest && node scripts/wiring_audit.js`
Expected: 0 TS errors; all suites PASS; `nav orphans=0, api orphans=0`

- [ ] **Step 7: Commit**

```bash
git add backend/src/data/meal-presets.json backend/src/routes/nutrition.js mobile/src/services/api.ts mobile/src/components/ThaliPresets.tsx mobile/src/screens/member/CalorieLogScreen.tsx
git commit -m "feat(food): add one-tap thali presets"
```

---

## Rollout Notes

- **Task 1's `fatFactor` values are estimates.** Before marketing accuracy, validate a handful of dishes against IFCT2017 (already a dependency) and tune the table. The design deliberately confines this to one exported array.
- **Task 2 changes an existing API response shape** — `servings[]` goes from 1 entry to 4 for cooked dishes. This is additive and the mobile picker already handles N entries, but any other consumer assuming `servings.length === 1` will need checking.
- **Task 4 rewrites `indian-foods.json`.** Step 7's verification is not optional: it proves the macro data survived untouched. Revert with `git checkout backend/src/data/indian-foods.json` if the numbers move.
- **Tasks 1–3 are shippable alone** and deliver the headline "we understand Indian food" moment. Tasks 4–6 are accuracy plumbing. Tasks 7–8 are the friction fix.

## Related plan

Crowd intelligence (A1–A3) is planned separately in `docs/superpowers/plans/2026-07-27-crowd-intelligence.md`.
