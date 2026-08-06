# Learn Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the locked linear Learn path with a searchable, topic-tagged library where every lesson is reachable, and fix the defects an Impeccable critique scored at 16/40.

**Architecture:** One additive migration adds a topic vocabulary the schema never had. The lock is removed by *not rendering it* — it exists only as a client-side interpretation of `is_next`, never as data. Search is a pure function over an already-fetched list, so it is unit-testable and works offline.

**Tech Stack:** Node 20, Express 4, PostgreSQL (Supabase), Jest, Expo/React Native 0.81, TypeScript.

## Global Constraints

- **There is no lock in the database.** `learn.js` computes `is_next = !foundNext && !lesson.completed` by iteration order over `ORDER BY unit, order_index`. No lock column, no prerequisite table. Do not go looking for one to remove.
- **Questions have NO `explanation` field.** Verified against the live database and `migrate_learn_content.sql`: shape is exactly `{ question, options, correct }`, and `grep -c explanation` on the seed returns **0**. An earlier draft claimed otherwise; it was false. Build the plumbing (`explanation ?? null`) but expect it to render nothing. **Do not invent explanation content.**
- **Quizzes remain the completion criterion** — 70% to pass, unchanged. They lose their *gate*, not their weight. Existing attempts and XP stay valid.
- **All 22 lesson titles are unique** (verified: 22 rows, 22 distinct titles), which is what makes the tag map safe to apply by title. The tag `UPDATE` must **no-op on an unmatched title, never error** — a future retitle must not break deploys.
- **The offline store caches the OLD `units` shape** via `cacheUnits`/`getUnits` (`mobile/src/stores/offlineStore.ts:88,95`). Members have that shape on disk right now. **Add new `cacheLessons`/`getLessons` keys; do NOT repurpose `cacheUnits`.** Repurposing would render stale old-shape data as garbage.
- Migrations are numbered `.sql` files in `backend/data/migrations/`, applied with `node apply_migration.js data/migrations/<file>.sql`, and must be idempotent (`IF NOT EXISTS`).
- All routes use `authenticate` + `asyncHandler`; errors use `backend/src/utils/errors.js`.
- CommonJS backend, 4-space indent, JSDoc on exported functions. Mobile is TypeScript, 4-space indent.
- **Mobile styling uses tokens only.** `typography.caption`, `typography.body`, and `colors.text.tertiary` **do not exist**. Use `typography.sizes.*` + `typography.fontFamily.*` and `colors.text.muted`. The toast API takes **two** arguments.
- **Another session may commit to this repo concurrently.** Stage paths explicitly; never `git add -A`.

---

### Task 1: Migration 009 — topics, tags, read time

**Files:**
- Create: `backend/data/migrations/009_learn_library.sql`

**Interfaces:**
- Produces: `learn_lessons.topics TEXT[]`, `.connects_to VARCHAR(40)`, `.read_seconds INTEGER`, `users.learn_start_here_dismissed BOOLEAN`.

> **This writes to the live production database.** The owner has approved this pattern (migrations 006-008 applied the same way). Every statement must be additive and idempotent. Never `DROP`, `TRUNCATE`, or `DELETE`. If it errors partway, STOP and report BLOCKED with the exact error.

- [ ] **Step 1: Write the migration**

Create `backend/data/migrations/009_learn_library.sql`:

```sql
-- Learn becomes a library. The lock was never in the database — it was
-- iteration order in learn.js — so nothing is dropped here. These columns add
-- the vocabulary a browsable library needs and the schema never had.

ALTER TABLE learn_lessons
  ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS connects_to VARCHAR(40),
  ADD COLUMN IF NOT EXISTS read_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_lesson_topics ON learn_lessons USING GIN (topics);

-- Dismissal of the optional "Start here" strip, following the
-- users.share_logs_default pattern.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS learn_start_here_dismissed BOOLEAN NOT NULL DEFAULT false;

-- Read time derived once here rather than per request.
-- chars/5 ~= words, /200 wpm * 60 = seconds, floored at 30.
UPDATE learn_lessons
   SET read_seconds = GREATEST(30, ROUND(length(content) / 5.0 / 200.0 * 60))
 WHERE content IS NOT NULL AND read_seconds IS NULL;

-- Topic + connection map. Editorial assignments from the design spec.
-- Matched by title (all 22 are unique). An unmatched title updates zero rows,
-- which is a deliberate no-op so a future retitle cannot break a deploy.
UPDATE learn_lessons SET topics = '{nutrition,fat-loss}', connects_to = 'nutrition_targets' WHERE title = 'Energy Balance Equation';
UPDATE learn_lessons SET topics = '{nutrition,muscle}',   connects_to = 'food_log'           WHERE title = 'Protein: The Building Block';
UPDATE learn_lessons SET topics = '{nutrition,training}', connects_to = 'food_log'           WHERE title = 'Carbohydrates & Performance';
UPDATE learn_lessons SET topics = '{nutrition}',          connects_to = 'food_log'           WHERE title = 'Fats: The Essential Macro';
UPDATE learn_lessons SET topics = '{training,muscle}',    connects_to = 'volume'             WHERE title = 'Progressive Overload';
UPDATE learn_lessons SET topics = '{training}',           connects_to = 'rir'                WHERE title = 'Understanding RPE';
UPDATE learn_lessons SET topics = '{training,muscle}',    connects_to = 'volume'             WHERE title = 'Training Volume';
UPDATE learn_lessons SET topics = '{training,recovery}',  connects_to = 'rest_timer'         WHERE title = 'Rest Between Sets';
UPDATE learn_lessons SET topics = '{training,muscle}'   WHERE title = 'Hypertrophy 101';
UPDATE learn_lessons SET topics = '{training,muscle}'   WHERE title = 'Rep Ranges Explained';
UPDATE learn_lessons SET topics = '{training,muscle}'   WHERE title = 'Mind-Muscle Connection';
UPDATE learn_lessons SET topics = '{nutrition,fat-loss}', connects_to = 'nutrition_targets' WHERE title = 'Creating a Sustainable Deficit';
UPDATE learn_lessons SET topics = '{training,fat-loss}' WHERE title = 'Cardio: LISS vs HIIT';
UPDATE learn_lessons SET topics = '{nutrition,fat-loss}' WHERE title = 'Metabolic Adaptation';
UPDATE learn_lessons SET topics = '{supplements,nutrition}' WHERE title = 'What Actually Works';
UPDATE learn_lessons SET topics = '{supplements,nutrition}' WHERE title = 'What to Skip';
UPDATE learn_lessons SET topics = '{recovery}'          WHERE title = 'Sleep: The Natural Steroid';
UPDATE learn_lessons SET topics = '{recovery,training}' WHERE title = 'Active Recovery';
UPDATE learn_lessons SET topics = '{mindset}'           WHERE title = 'Building Unbreakable Habits';
UPDATE learn_lessons SET topics = '{mindset,training}'  WHERE title = 'Dealing with Plateaus';
UPDATE learn_lessons SET topics = '{training}'          WHERE title = 'Periodization Basics';
UPDATE learn_lessons SET topics = '{training,recovery}' WHERE title = 'Deload Weeks';
```

- [ ] **Step 2: Apply it**

Run: `cd backend && node apply_migration.js data/migrations/009_learn_library.sql`
Expected: `✅ Migration applied successfully!`

- [ ] **Step 3: Verify every lesson got tagged**

Run:
```bash
cd backend && node -e "
require('dotenv').config();
const {Client}=require('pg');
const c=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{
  await c.connect();
  const untagged=(await c.query(\"SELECT title FROM learn_lessons WHERE topics = '{}'\")).rows;
  console.log('lessons with NO topics:', untagged.length, '(must be 0)');
  untagged.forEach(u=>console.log('  UNTAGGED:', u.title));
  const t=(await c.query('SELECT unnest(topics) AS t, COUNT(*) n FROM learn_lessons GROUP BY 1 ORDER BY n DESC')).rows;
  console.log('\\ntopic distribution:');
  t.forEach(r=>console.log('  '+r.t.padEnd(12), r.n));
  const conn=(await c.query('SELECT COUNT(*) c FROM learn_lessons WHERE connects_to IS NOT NULL')).rows[0].c;
  console.log('\\nlessons with connects_to:', conn, '(expect 8)');
  const rs=(await c.query('SELECT MIN(read_seconds) lo, MAX(read_seconds) hi, COUNT(*) FILTER (WHERE read_seconds IS NULL) nulls FROM learn_lessons')).rows[0];
  console.log('read_seconds:', rs.lo, '-', rs.hi, '| nulls:', rs.nulls);
  await c.end();
})();
"
```
Expected: **0 untagged**, 7 distinct topics, 8 lessons with `connects_to`, no null `read_seconds`.

**If any lesson is untagged, a title in the map does not match the database.** Report BLOCKED with the untagged titles rather than guessing at a correction.

- [ ] **Step 4: Prove idempotency**

Apply the migration a second time. It must succeed with no error and no duplicate-column failure, and the Step 3 numbers must be unchanged.

- [ ] **Step 5: Commit**

```bash
git add backend/data/migrations/009_learn_library.sql
git commit -m "feat(learn): add topics, connections and read time

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Lesson filter (pure function)

**Files:**
- Create: `backend/src/utils/lessonFilter.js`
- Test: `backend/src/__tests__/lesson-filter.test.js`

**Interfaces:**
- Produces: `filterLessons(lessons, { query, topic })` → filtered array; `collectTopics(lessons)` → sorted unique topic array.

This lives in `backend/src/utils/` so it is testable without a React renderer, and is imported by the mobile screen via a small re-export in Task 5. It is pure and has no Node-only dependencies.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/lesson-filter.test.js`:

```js
/**
 * Lesson Filter Tests
 *
 * The search predicate behind the Learn library. Fixtures deliberately include
 * a lesson with ZERO questions and one with no topics — three defects earlier
 * in this codebase survived because the fixture happened to be the benign case.
 */

const { filterLessons, collectTopics } = require('../utils/lessonFilter');

const lessons = [
    { id: '1', title: 'Understanding RPE', description: 'Rate of perceived exertion', topics: ['training'], question_count: 4 },
    { id: '2', title: 'What Actually Works', description: 'Creatine and the rest', topics: ['supplements', 'nutrition'], question_count: 4 },
    { id: '3', title: 'Sleep: The Natural Steroid', description: 'Recovery happens at night', topics: ['recovery'], question_count: 0 },
    { id: '4', title: 'Untagged Lesson', description: 'No topics yet', topics: [], question_count: 4 },
];

describe('filterLessons', () => {
    it('returns everything for an empty query and no topic', () => {
        expect(filterLessons(lessons, {})).toHaveLength(4);
        expect(filterLessons(lessons, { query: '', topic: null })).toHaveLength(4);
    });

    it('returns everything for a whitespace-only query', () => {
        expect(filterLessons(lessons, { query: '   ' })).toHaveLength(4);
    });

    it('matches on title', () => {
        const r = filterLessons(lessons, { query: 'sleep' });
        expect(r.map((l) => l.id)).toEqual(['3']);
    });

    it('matches on description', () => {
        const r = filterLessons(lessons, { query: 'creatine' });
        expect(r.map((l) => l.id)).toEqual(['2']);
    });

    it('matches on topic text', () => {
        const r = filterLessons(lessons, { query: 'recovery' });
        expect(r.map((l) => l.id)).toEqual(['3']);
    });

    it('is case-insensitive', () => {
        expect(filterLessons(lessons, { query: 'RPE' })).toHaveLength(1);
        expect(filterLessons(lessons, { query: 'rpe' })).toHaveLength(1);
    });

    it('returns an empty array when nothing matches — not everything', () => {
        expect(filterLessons(lessons, { query: 'zzzznomatch' })).toEqual([]);
    });

    it('filters by topic', () => {
        const r = filterLessons(lessons, { topic: 'nutrition' });
        expect(r.map((l) => l.id)).toEqual(['2']);
    });

    it('combines query and topic with AND, not OR', () => {
        // 'training' topic contains only lesson 1; query 'sleep' matches only 3.
        // OR would return two; AND returns none.
        expect(filterLessons(lessons, { query: 'sleep', topic: 'training' })).toEqual([]);
        expect(filterLessons(lessons, { query: 'RPE', topic: 'training' })).toHaveLength(1);
    });

    it('handles a lesson with no topics without throwing', () => {
        expect(filterLessons(lessons, { query: 'untagged' })).toHaveLength(1);
        expect(filterLessons(lessons, { topic: 'training' }).map((l) => l.id)).toEqual(['1']);
    });

    it('survives malformed input', () => {
        expect(filterLessons(null, { query: 'x' })).toEqual([]);
        expect(filterLessons(undefined, {})).toEqual([]);
        expect(filterLessons(lessons, null)).toHaveLength(4);
    });
});

describe('collectTopics', () => {
    it('returns sorted unique topics and skips untagged lessons', () => {
        expect(collectTopics(lessons)).toEqual(['nutrition', 'recovery', 'supplements', 'training']);
    });

    it('returns an empty array for empty or malformed input', () => {
        expect(collectTopics([])).toEqual([]);
        expect(collectTopics(null)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest lesson-filter --verbose`
Expected: FAIL — `Cannot find module '../utils/lessonFilter'`

- [ ] **Step 3: Implement**

Create `backend/src/utils/lessonFilter.js`:

```js
/**
 * Lesson Search and Filtering
 *
 * Pure, so it is testable without a renderer and runs identically on the
 * client. Search is client-side by design: at 22 lessons a round trip is
 * slower than typing, and filtering a cached list keeps working with no signal
 * — which matters inside a gym building.
 */

/**
 * @param {Array<object>} lessons
 * @param {{query?: string, topic?: string|null}} opts
 * @returns {Array<object>}
 */
function filterLessons(lessons, opts) {
    const list = Array.isArray(lessons) ? lessons : [];
    const { query = '', topic = null } = opts || {};

    const q = typeof query === 'string' ? query.trim().toLowerCase() : '';

    return list.filter((l) => {
        if (!l) return false;

        // Topic and text combine with AND. A lesson must satisfy both.
        if (topic) {
            const topics = Array.isArray(l.topics) ? l.topics : [];
            if (!topics.includes(topic)) return false;
        }

        if (!q) return true;

        const haystack = [
            l.title,
            l.description,
            ...(Array.isArray(l.topics) ? l.topics : []),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return haystack.includes(q);
    });
}

/**
 * Every distinct topic across the given lessons, sorted. Derived from the data
 * rather than hardcoded so the chips can never drift from what exists.
 * @param {Array<object>} lessons
 * @returns {string[]}
 */
function collectTopics(lessons) {
    const list = Array.isArray(lessons) ? lessons : [];
    const seen = new Set();
    for (const l of list) {
        if (!l || !Array.isArray(l.topics)) continue;
        for (const t of l.topics) if (t) seen.add(t);
    }
    return [...seen].sort();
}

module.exports = { filterLessons, collectTopics };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest lesson-filter --verbose`
Expected: PASS — 13 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/lessonFilter.js backend/src/__tests__/lesson-filter.test.js
git commit -m "feat(learn): add pure lesson search and topic collection

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Rework the lessons endpoint

**Files:**
- Modify: `backend/src/routes/learn.js` (the `GET /lessons` handler, lines ~12-100)

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET /api/learn/lessons` → `{ lessons: [...], progress: {...}, suggested_next_id: string|null }`

- [ ] **Step 1: Replace the query and the grouping**

The handler currently selects a fixed column list, groups rows into `unitsMap`, and sets `is_next` on the first incomplete lesson. Replace the SELECT so it also returns the new columns and a **real** question count:

```js
        const lessonsResult = await query(
            `SELECT
                l.id,
                l.title,
                l.unit,
                l.unit_title,
                l.order_index,
                l.description,
                l.xp_reward,
                l.topics,
                l.connects_to,
                l.read_seconds,
                -- Real count. The client previously fell through
                -- `lesson.questions?.length || 5` to the literal 5 on every
                -- card, contradicting the reader one tap later.
                jsonb_array_length(l.questions)::int AS question_count,
                CASE WHEN la.completed THEN true ELSE false END as completed,
                la.score as last_score
             FROM learn_lessons l
             LEFT JOIN (
               SELECT DISTINCT ON (lesson_id) lesson_id, completed, score
               FROM learn_attempts
               WHERE user_id = $1
               ORDER BY lesson_id, attempted_at DESC
             ) la ON l.id = la.lesson_id
             ORDER BY l.unit, l.order_index`,
            [userId]
        );
```

Then replace the unit-grouping block entirely with a flat mapping. Keep `unit`/`unit_title`/`order_index` on each lesson — the ordering is what "Start here" uses:

```js
        // Flat list: every lesson is reachable. Ordering is preserved so the
        // optional "Start here" strip can suggest a sequence without gating.
        const lessons = lessonsResult.rows.map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description,
            unit: l.unit,
            unit_title: l.unit_title,
            order_index: l.order_index,
            topics: l.topics || [],
            connects_to: l.connects_to,
            read_seconds: l.read_seconds,
            question_count: l.question_count,
            completed: l.completed,
            last_score: l.last_score,
            xp_reward: l.xp_reward,
        }));

        // Suggestion, not a gate. Named to stop implying the rest are locked.
        const suggested = lessons.find((l) => !l.completed) || null;
```

- [ ] **Step 2: Update the response**

Replace the existing `res.json({ units, progress })` with:

```js
        res.json({
            lessons,
            progress: {
                total_xp: parseInt(progress.total_xp) || 0,
                lessons_completed: parseInt(progress.lessons_completed) || 0,
                total_lessons: lessons.length,
            },
            suggested_next_id: suggested ? suggested.id : null,
        });
```

Read the existing progress-building code before editing and preserve whatever defaulting it already does; only add `total_lessons`.

- [ ] **Step 3: Verify against the live database**

Run:
```bash
cd backend && node -e "
require('dotenv').config();
const {Client}=require('pg');
const c=new Client({connectionString:process.env.DATABASE_URL});
(async()=>{
  await c.connect();
  const r=(await c.query(\`SELECT title, topics, read_seconds,
      jsonb_array_length(questions)::int AS qc
    FROM learn_lessons ORDER BY unit, order_index LIMIT 4\`)).rows;
  r.forEach(l=>console.log(l.title.padEnd(32), 'topics='+JSON.stringify(l.topics).padEnd(28), 'q='+l.qc, 'read='+l.read_seconds+'s'));
  const zero=(await c.query('SELECT COUNT(*) c FROM learn_lessons WHERE jsonb_array_length(questions) = 0')).rows[0].c;
  console.log('\\nlessons with 0 questions:', zero, '- these must render WITHOUT a Take Quiz footer, not crash');
  await c.end();
})();
"
```
Expected: real per-lesson question counts (not all 5), populated topics, non-null read times.

- [ ] **Step 4: Run the suite and commit**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; full suite green.

```bash
git add backend/src/routes/learn.js
git commit -m "feat(learn): return a flat lesson library with topics and real counts

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Explanation plumbing and the settings endpoints

**Files:**
- Modify: `backend/src/routes/learn.js` (the `POST /attempt` handler, ~line 143)
- Modify: `backend/src/routes/settings.js`

**Interfaces:**
- Produces: `/attempt` also returns `explanations[]`; `GET`/`PATCH /api/settings/learn`.

- [ ] **Step 1: Add explanation plumbing to `/attempt`**

In the existing scoring loop, collect explanations alongside correct answers:

```js
    let correct = 0;
    const correctAnswers = [];
    const explanations = [];

    for (let i = 0; i < questions.length; i++) {
        correctAnswers.push(questions[i].correct);
        // Plumbing only. NO seeded question currently carries an explanation
        // (verified: 0 of 22). This stays null until content is authored, at
        // which point it appears with no further code change. Do not invent
        // explanation text here.
        explanations.push(questions[i].explanation ?? null);
        if (answers[i] === questions[i].correct) {
            correct++;
        }
    }
```

Add `explanations,` to the `res.json({...})` payload alongside `correct_answers`.

- [ ] **Step 2: Add the settings pair**

Add to `backend/src/routes/settings.js`, mirroring the existing `/workout` pair in the same file:

```js
/**
 * GET /api/settings/learn
 * Learn surface preferences.
 */
router.get('/learn', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT learn_start_here_dismissed FROM users WHERE id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({ start_here_dismissed: result.rows[0].learn_start_here_dismissed });
}));

/**
 * PATCH /api/settings/learn
 */
router.patch('/learn', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { start_here_dismissed } = req.body;

    if (typeof start_here_dismissed !== 'boolean') {
        throw new ValidationError('start_here_dismissed must be a boolean');
    }

    const result = await query(
        `UPDATE users
            SET learn_start_here_dismissed = $1
          WHERE id = $2
      RETURNING learn_start_here_dismissed`,
        [start_here_dismissed, userId]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('User not found');
    }

    res.json({ success: true, start_here_dismissed: result.rows[0].learn_start_here_dismissed });
}));
```

Check which requires already exist at the top of `settings.js` before adding any.

- [ ] **Step 3: Verify and commit**

Run: `cd backend && find src -name '*.js' -exec node --check {} + && npx jest`
Expected: syntax clean; suite green.

```bash
git add backend/src/routes/learn.js backend/src/routes/settings.js
git commit -m "feat(learn): explanation plumbing and start-here preference

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Mobile API client, types, and offline cache

**Files:**
- Modify: `mobile/src/services/api.ts` (`learnAPI`, ~line 405)
- Modify: `mobile/src/stores/offlineStore.ts`
- Create: `mobile/src/utils/lessonFilter.ts`

**Interfaces:**
- Produces: `Lesson` and `LearnLibrary` types; `learnAPI.getLessons()` returning the new shape; `settingsAPI.getLearnPreferences` / `updateLearnPreferences`; `offlineStore.cacheLessons` / `getLessons`; `filterLessons` / `collectTopics` for the client.

- [ ] **Step 1: Port the filter to TypeScript**

Create `mobile/src/utils/lessonFilter.ts` as a typed mirror of `backend/src/utils/lessonFilter.js`. Same behaviour, same function names. The backend copy is the one under test; this one exists because React Native cannot import from `backend/`.

Add a header comment stating that: `// Mirror of backend/src/utils/lessonFilter.js — keep behaviour in step. Tests live with the backend copy.`

- [ ] **Step 2: Add types and update `learnAPI`**

In `mobile/src/services/api.ts`:

```ts
export interface Lesson {
    id: string;
    title: string;
    description: string | null;
    unit: number;
    unit_title: string;
    order_index: number;
    topics: string[];
    connects_to: string | null;
    read_seconds: number | null;
    question_count: number;
    completed: boolean;
    last_score: number | null;
    xp_reward: number;
}

export interface LearnLibrary {
    lessons: Lesson[];
    progress: { total_xp: number; lessons_completed: number; total_lessons: number };
    suggested_next_id: string | null;
    offline?: boolean;
}
```

Rewrite `learnAPI.getLessons` to cache and read the **new** key. The existing offline fallback builds a `units`-shaped object — replace that with a `lessons`-shaped one:

```ts
    getLessons: async (): Promise<LearnLibrary> => {
        try {
            const response = await api.get('/learn/lessons');
            if (response.data?.lessons) {
                useOfflineStore.getState().cacheLessons(response.data.lessons);
            }
            return response.data;
        } catch (error: any) {
            if (error.code === 'NETWORK_ERROR') {
                const lessons = useOfflineStore.getState().getLessons();
                if (lessons.length > 0) {
                    // Always a fully-shaped progress object: a truthy `{}` used to
                    // defeat the screen's `|| {default}` and render "NaN%".
                    return {
                        lessons,
                        progress: { total_xp: 0, lessons_completed: 0, total_lessons: lessons.length },
                        suggested_next_id: lessons.find((l) => !l.completed)?.id ?? null,
                        offline: true,
                    };
                }
            }
            throw error;
        }
    },
```

- [ ] **Step 3: Add the new offline cache keys**

In `mobile/src/stores/offlineStore.ts`, add `lessons: Lesson[]` to the state, plus `cacheLessons` and `getLessons`, mirroring how `cacheUnits`/`getUnits` are written (~lines 88, 95, 205).

**Leave `cacheUnits`, `getUnits`, and the `units` state key exactly as they are.** Members have old-shape `units` data on disk right now; repurposing that key would render it as garbage. The old key simply goes unused and ages out.

Reuse the existing `lastLessonsUpdate` timestamp so `isLessonsStale()` keeps working for the new key.

- [ ] **Step 4: Add the settings client methods**

Add to `settingsAPI` in `api.ts`:

```ts
    getLearnPreferences: async (): Promise<{ start_here_dismissed: boolean }> => {
        const response = await api.get('/settings/learn');
        return response.data;
    },

    updateLearnPreferences: async (prefs: { start_here_dismissed: boolean }) => {
        const response = await api.patch('/settings/learn', prefs);
        return response.data;
    },
```

- [ ] **Step 5: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: errors ONLY in `LearnScreen.tsx`, which still consumes the old `units` shape. Task 6 resolves them. Do not commit yet if you prefer a green tree — otherwise commit and note the expected failure.

```bash
git add mobile/src/services/api.ts mobile/src/stores/offlineStore.ts mobile/src/utils/lessonFilter.ts
git commit -m "feat(learn): library types, client, and offline cache

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The Learn library screen

**Files:**
- Rewrite: `mobile/src/screens/member/LearnScreen.tsx`

**Interfaces:**
- Consumes: `learnAPI.getLessons`, `settingsAPI.getLearnPreferences`/`updateLearnPreferences`, `filterLessons`/`collectTopics`.

- [ ] **Step 1: Replace the timeline with the library**

Keep the screen's existing strengths — the shape-matched skeletons, the offline/error/empty branches, the stale banner, `useFocusEffect` reload — and replace only the body. Read the current file before editing; the loading and error handling is good and must survive.

New structure, top to bottom:

1. **Header** — `LEARN`, XP badge. Unchanged.
2. **Progress line** — `22 lessons · 7 topics` when `lessons_completed === 0`, otherwise `3 of 22 done`. **Never open with `0/22 — 0%`**; the feature must not greet a new member by measuring their deficit.
3. **Search input** — `value`/`onChangeText` into local state, no debounce.
4. **Topic chips** — horizontal `ScrollView`, from `collectTopics(lessons)`. Single-select; tapping the active chip clears it.
5. **"Start here" strip** — rendered when `!startHereDismissed && suggested_next_id && lessons_completed < total`. Shows the suggested lesson with a dismiss X.
6. **Lesson list** — `filterLessons(lessons, { query, topic })`. **Every row tappable — no `disabled`, no lock icon, no dimming.** Each row: title, description, `question_count` questions, read time, completion tick.
7. **Empty-search state** — when the filter returns `[]` but `lessons.length > 0`: `No lessons match "<query>"` plus a clear action. Distinct from the existing content-empty state.

The derived values and the body, concretely:

```tsx
const [query, setQuery] = useState('');
const [topic, setTopic] = useState<string | null>(null);
const [startHereDismissed, setStartHereDismissed] = useState(true); // assume dismissed until known, so it cannot flash

const topics = useMemo(() => collectTopics(lessons), [lessons]);
const visible = useMemo(() => filterLessons(lessons, { query, topic }), [lessons, query, topic]);
const suggested = useMemo(
    () => lessons.find((l) => l.id === suggestedNextId) ?? null,
    [lessons, suggestedNextId],
);

const dismissStartHere = useCallback(() => {
    setStartHereDismissed(true);
    // Fire-and-forget: a failed preference write must never block browsing.
    // Worst case the strip returns next launch.
    settingsAPI.updateLearnPreferences({ start_here_dismissed: true }).catch(() => {});
}, []);
```

```tsx
{/* Progress line — never opens with a deficit. */}
<Text style={styles.progressLine}>
    {progress.lessons_completed === 0
        ? `${progress.total_lessons} lessons · ${topics.length} topics`
        : `${progress.lessons_completed} of ${progress.total_lessons} done`}
</Text>

<TextInput
    style={styles.search}
    value={query}
    onChangeText={setQuery}
    placeholder="Search lessons"
    placeholderTextColor={colors.text.muted}
    accessibilityLabel="Search lessons"
    returnKeyType="search"
    autoCorrect={false}
/>

<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
    {topics.map((t) => (
        <Pressable
            key={t}
            onPress={() => setTopic(topic === t ? null : t)}
            style={[styles.chip, topic === t && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: topic === t }}
            accessibilityLabel={`Filter by ${t}`}
        >
            <Text style={[styles.chipText, topic === t && styles.chipTextActive]}>{t}</Text>
        </Pressable>
    ))}
</ScrollView>

{!startHereDismissed && suggested && (
    <View style={styles.startHere}>
        <Pressable
            style={styles.startHereMain}
            onPress={() => router.push(`/lesson/${suggested.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel={`Start here: ${suggested.title}`}
        >
            <Text style={styles.startHereLabel}>START HERE</Text>
            <Text style={styles.startHereTitle} numberOfLines={1}>{suggested.title}</Text>
        </Pressable>
        <Pressable
            onPress={dismissStartHere}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss start here suggestion"
        >
            <MaterialIcons name="close" size={18} color={colors.text.muted} />
        </Pressable>
    </View>
)}

{visible.length === 0 && lessons.length > 0 ? (
    <View style={styles.noMatch}>
        <Text style={styles.noMatchText}>No lessons match "{query}"</Text>
        <Pressable onPress={() => { setQuery(''); setTopic(null); }} accessibilityRole="button">
            <Text style={styles.noMatchClear}>CLEAR</Text>
        </Pressable>
    </View>
) : (
    visible.map((l) => (
        <Pressable
            key={l.id}
            style={styles.lessonRow}
            onPress={() => router.push(`/lesson/${l.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel={
                `${l.title}. ${l.question_count} questions. ` +
                `${Math.max(1, Math.round((l.read_seconds ?? 60) / 60))} minute read.` +
                (l.completed ? ' Completed.' : '')
            }
        >
            <View style={{ flex: 1 }}>
                <Text style={styles.lessonTitle} numberOfLines={1}>{l.title}</Text>
                {!!l.description && (
                    <Text style={styles.lessonDesc} numberOfLines={1}>{l.description}</Text>
                )}
                <Text style={styles.lessonMeta}>
                    {l.question_count} questions · {Math.max(1, Math.round((l.read_seconds ?? 60) / 60))} min
                </Text>
            </View>
            {l.completed && <MaterialIcons name="check" size={18} color={colors.success} />}
        </Pressable>
    ))
)}
```

**No row is ever `disabled`, dimmed, or given a lock icon.** That is the whole point of the task — if a lock survives anywhere in this file, the task is not done.

Load the dismissal flag alongside the lessons fetch rather than in a second effect:

```tsx
settingsAPI.getLearnPreferences()
    .then((p) => setStartHereDismissed(!!p.start_here_dismissed))
    .catch(() => setStartHereDismissed(true)); // fail closed — never flash a strip we cannot persist
```

- [ ] **Step 2: Accessibility on every interactive element**

The current file has **zero** `accessibilityRole`/`accessibilityLabel` in 618 lines. Every lesson row, chip, dismiss button, and the search field needs them:

```tsx
accessibilityRole="button"
accessibilityLabel={`${lesson.title}. ${lesson.question_count} questions. ${readMins} minute read.${lesson.completed ? ' Completed.' : ''}`}
```

Chips get `accessibilityRole="button"` and `accessibilityState={{ selected: topic === active }}`.

- [ ] **Step 3: Verify**

Run: `cd mobile && npx tsc --noEmit` — 0 errors.
Run: `cd backend && node scripts/wiring_audit.js` — `nav orphans=0, api orphans=0`.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/member/LearnScreen.tsx
git commit -m "feat(learn): replace locked timeline with searchable library

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Lesson screen defect fixes

**Files:**
- Modify: `mobile/app/lesson/[id].tsx`

**Interfaces:**
- Consumes: `explanations[]` from `/attempt` (Task 4).

- [ ] **Step 1: Hoist the header and add an error state**

The screen currently guards with `if (loading || !lesson)` and renders the header **inside** the success branch. A failed fetch therefore leaves `lesson` null forever — a permanent skeleton **with no way out**.

Add an `error` state set in `loadLesson`'s catch. Render the header (with its close X) **above** all three mode branches so it always exists. On error, show `EmptyState` with a retry.

```tsx
const [error, setError] = useState<string | null>(null);

const loadLesson = useCallback(async () => {
    setError(null);
    try {
        const res = await learnAPI.getLesson(String(id));
        setLesson(res.lesson ?? res);
    } catch (e: any) {
        // Was `console.error` only, which left `lesson` null forever while the
        // render guard `loading || !lesson` kept showing a skeleton — with the
        // close X trapped inside the success branch, so no way out at all.
        setError(e?.message || 'Could not load this lesson');
    } finally {
        setLoading(false);
    }
}, [id]);
```

The render becomes header-first, then a branch:

```tsx
return (
    <SafeAreaView style={styles.container} edges={['top']}>
        {/* Hoisted: the close X must exist in EVERY state, including failure. */}
        <View style={styles.header}>
            <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close lesson"
            >
                <MaterialIcons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
                {lesson?.title ?? 'Lesson'}
            </Text>
            <View style={{ width: 40 }} />
        </View>

        {loading ? (
            <SkeletonLesson />
        ) : error ? (
            <EmptyState variant="error" message={error} actionLabel="Retry" onAction={loadLesson} />
        ) : !lesson ? (
            <EmptyState variant="error" message="Lesson not found" actionLabel="Retry" onAction={loadLesson} />
        ) : (
            /* existing reading | quiz | result modes */
        )}
    </SafeAreaView>
);
```

`EmptyState`'s prop names are verified against `mobile/src/components/EmptyState.tsx:18-26`: it takes `variant`, `title`, `message`, `icon`, `actionLabel`, `onAction`, `secondaryActionLabel`, `onSecondaryAction`. **There is no `onRetry` prop** — retry is `actionLabel` + `onAction`, as written above.

- [ ] **Step 2: Fix the quiz soft-lock**

`finishQuiz` currently swallows submit failures, leaving the user on the last question. Pressing Finish again appends an **extra** answer, so `answers.length !== questions.length` and the backend rejects it permanently.

Retry from the immutable `finalAnswers` local that already exists; never re-append to `answers`. On failure show an inline `Couldn't submit · Retry` bar rather than silently returning to the quiz.

```tsx
const [submitError, setSubmitError] = useState(false);

// Takes the answer array explicitly so a retry replays the SAME payload.
// The old version read component state, and a second Finish press appended an
// extra entry — answers.length !== questions.length — which the backend
// rejects forever. That was a permanent soft-lock on the last question.
const submitAttempt = useCallback(async (finalAnswers: number[]) => {
    setSubmitting(true);
    setSubmitError(false);
    try {
        const res = await learnAPI.submitAttempt(String(id), finalAnswers);
        setResult(res);
        setMode('result');
    } catch {
        setSubmitError(true);   // stay on the quiz, keep the answers intact
    } finally {
        setSubmitting(false);
    }
}, [id]);
```

Keep the completed answer array in a ref or state so the retry button can call `submitAttempt(lastAnswersRef.current)` without rebuilding it from `currentQ`. Render the retry bar above the options whenever `submitError` is true.

- [ ] **Step 3: Guard the empty-questions crash**

Quiz mode indexes `lesson.questions[currentQ].question` with no length check. A lesson with an empty array crashes at render. Render the reader **without** a Take Quiz footer when `question_count === 0`, and guard quiz mode itself.

- [ ] **Step 4: Make quiz mode scrollable**

Quiz mode has **no `ScrollView`** — `optionsContainer` is `flex: 1`, so a long question with four long options compresses and can put the fourth option out of reach. Wrap it.

- [ ] **Step 5: Fix the ending**

- Delete the `"View Answers"` button — its handler is `() => {/* already showing */}`, a shipped no-op.
- Show real XP from the response: `+${xp_earned} XP`.
- Relabel the primary CTA to `Next: <title> →` when another incomplete lesson exists, routing straight into it. Fall back to `Done` when none remains.
- Render `explanations[i]` under each reviewed answer **only when non-null** (nothing renders today — see the plan's Global Constraints).

- [ ] **Step 6: Accessibility and touch targets**

- `accessibilityRole="radio"` + `accessibilityState={{ checked }}` on quiz options; `radiogroup` on the container.
- `accessibilityRole="button"` + label on the close X, and `hitSlop` to bring its **32×32pt** tap area to at least 44×44.
- `accessibilityRole="progressbar"` + `accessibilityValue` on the quiz progress bar.

- [ ] **Step 7: Remove dead code**

Delete the unused `Modal` and `Dimensions` imports, and the `questionAnim`, `xpEarned`, and `quizCompleted` state that is set but never read.

- [ ] **Step 8: Verify and commit**

Run: `cd mobile && npx tsc --noEmit` — 0 errors.

```bash
git add mobile/app/lesson/[id].tsx
git commit -m "fix(learn): error state, quiz soft-lock, a11y, and dead UI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Home card zero state

**Files:**
- Modify: `mobile/src/components/ProgressRing.tsx`
- Modify: `mobile/src/screens/member/HomeScreen.tsx` (the Continue Learning card, ~lines 693-752)

- [ ] **Step 1: Never render an empty ring**

At `progress <= 0` with `showLabel` false, `ProgressRing` renders a hollow circle containing nothing — the reported "black space". Add an `emptyIcon?: string` prop; when the computed percentage is 0 and `showLabel` is false, render a filled icon tile at the same `size` instead of the SVG.

Update the component's JSDoc — it currently claims it replaced a grey smudge, while its own zero state *is* one.

- [ ] **Step 2: Use it, and fix the progress mismatch**

In the Continue Learning card:

```tsx
<ProgressRing progress={learnPct} size={72} showLabel={learnStarted} emptyIcon="menu-book" />
```

Then fix the second bug: the ring shows **unit** progress while the tap opens a **lesson**, so "Training Essentials, 50% complete → RESUME" opens something 0% read. Read where `rawLearnProgress` comes from in `memberAPI.getHome` and make the card show lesson-level progress consistent with what it opens. If the home payload cannot supply that without a backend change, show **no** percentage rather than a misleading one, and say so in your report.

- [ ] **Step 3: Verify and commit**

Run: `cd mobile && npx tsc --noEmit` — 0 errors.
Run: `cd backend && npx jest && node scripts/wiring_audit.js`.

```bash
git add mobile/src/components/ProgressRing.tsx mobile/src/screens/member/HomeScreen.tsx
git commit -m "fix(learn): icon tile instead of an empty ring at zero progress

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Rollout Notes

- **Task 1 writes to the live database.** Additive and idempotent, same pattern as migrations 006-008. Nothing is dropped and no existing row loses data.
- **The lock disappears the moment Task 6 ships.** Every lesson becomes reachable. This is the point, not a regression.
- **Tasks 1-5 are invisible to members.** Stopping after Task 5 leaves the app as it is today, with the API returning a shape nothing reads yet.
- **Task 5 deliberately leaves the tree failing typecheck** until Task 6 rewrites the consumer. They must land together.
- **Old offline `units` data is orphaned, not migrated.** New keys are added alongside; the stale key ages out on its own.
- **Explanations render nothing.** The plumbing ships inert by design; content is a separate deliverable.
