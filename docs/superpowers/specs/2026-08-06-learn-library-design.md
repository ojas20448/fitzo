# Learn: Library, Not a Locked Path — Design

**Date:** 2026-08-06
**Status:** Approved (amended 2026-08-06 — see "Correction" under API)

## Problem

An Impeccable critique scored the Learn feature **16/40 (Poor)** across Nielsen's heuristics, run as two isolated assessments — a design review and a mechanical/detector pass. Three findings drive this redesign.

**It is category-interchangeable.** Rebrand it for corporate compliance training and nobody would notice. Unit 1 (Nutrition Fundamentals) and Unit 8 (Advanced Topics) render as byte-identical card stacks. The entire feature contains two moments of authored personality: the string *"Knowledge is gains."* and a `menu-book` icon.

**It is an island.** Across 1,072 lines of seeded curriculum there are two India-relevant food references, one of which offers **salmon** as an omega-3 source in an India-first app. No lesson links to the 10,388-item Indian food database, the volume rule, the rest timer, or anything else only Fitzo knows.

**The locked path serves nobody.** 22 lesson cards are visible and scannable; exactly one is tappable. A member with a specific question right now — *"is creatine worth ₹1,200?"* — must scroll past 19 locked cards and cannot open the answer. Tapping a locked card does nothing at all: no toast, no reason.

Usage confirms it: **28 attempts across 6 users**.

## What the code actually revealed

Three facts changed the shape of this design and are worth stating, because each one removes work:

**There is no lock in the database.** `learn.js` computes `is_next = !foundNext && !lesson.completed` — pure iteration order over `ORDER BY unit, order_index`. No lock column, no prerequisite table. The lock exists only as a client-side rendering decision. **Unlocking is a UI change, not a migration.**

**Lessons are ~800 characters.** Roughly 150 words. The current design attaches a 4-question test to a paragraph.

**Low usage is permission.** 28 attempts means there is almost no member progress to preserve, so the structure can change freely.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Sequence | **Library + optional "Start here" track** | Serves the member with a question *now* and the completionist both; keeps `order_index` meaningful rather than dead |
| Quizzes | **Remain the completion criterion** (70% to pass) | They lose their *gate*, not their weight. Existing 28 attempts and XP stay valid. |
| Search | **Client-side** | At 22 lessons a round-trip is slower than typing, and it keeps working on the cached list with no signal |
| Tag storage | **`TEXT[]` on `learn_lessons`** | 22 rows and a small vocabulary don't justify a join table |
| Tagging | **Assigned in this spec** (see map below) | Editorial calls on real content belong in a reviewable document, not buried in a migration |
| Bug fixes | **Folded into this work** | These screens are being rewritten anyway; two passes over the same files would be waste |
| Content rewrite | **Out of scope**, separate reviewable deliverable | It is authorship, not engineering, and carries health-claim consequences |

## Architecture

### 1. Data model — one additive migration

```sql
ALTER TABLE learn_lessons
  ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS connects_to VARCHAR(40),
  ADD COLUMN IF NOT EXISTS read_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_lesson_topics ON learn_lessons USING GIN (topics);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS learn_start_here_dismissed BOOLEAN NOT NULL DEFAULT false;
```

Nothing is dropped. `unit`, `unit_title`, and `order_index` all survive and become the "Start here" ordering.

`read_seconds` is derived once at migration time rather than per-request:

```sql
UPDATE learn_lessons
   SET read_seconds = GREATEST(30, ROUND(length(content) / 5.0 / 200.0 * 60))
 WHERE content IS NOT NULL AND read_seconds IS NULL;
```

Characters ÷ 5 ≈ words, ÷ 200 wpm × 60 = seconds, floored at 30. At the current ~800-char lessons every lesson lands near 48 seconds and displays as "1 min" — honest, and it differentiates once content grows.

`connects_to` is stored but **nothing consumes it in this scope**. It costs one nullable column now and makes contextual surfacing nearly free later.

### 2. Topic vocabulary

Seven flat topics. Deliberately flat: it mixes subject (`nutrition`, `training`, `recovery`, `supplements`, `mindset`) with goal (`muscle`, `fat-loss`), which is slightly impure taxonomy but is how members actually think and search. A two-facet model would be cleaner on paper and worse to use at this size.

Display labels: **Nutrition · Training · Muscle · Fat Loss · Recovery · Supplements · Mindset**

### 3. Tag map — all 22 lessons

These are editorial calls, listed in full so they are reviewable.

| Unit | Lesson | `topics` | `connects_to` |
|---|---|---|---|
| 1 | Energy Balance Equation | `nutrition, fat-loss` | `nutrition_targets` |
| 1 | Protein: The Building Block | `nutrition, muscle` | `food_log` |
| 1 | Carbohydrates & Performance | `nutrition, training` | `food_log` |
| 1 | Fats: The Essential Macro | `nutrition` | `food_log` |
| 2 | Progressive Overload | `training, muscle` | `volume` |
| 2 | Understanding RPE | `training` | `rir` |
| 2 | Training Volume | `training, muscle` | `volume` |
| 2 | Rest Between Sets | `training, recovery` | `rest_timer` |
| 3 | Hypertrophy 101 | `training, muscle` | — |
| 3 | Rep Ranges Explained | `training, muscle` | — |
| 3 | Mind-Muscle Connection | `training, muscle` | — |
| 4 | Creating a Sustainable Deficit | `nutrition, fat-loss` | `nutrition_targets` |
| 4 | Cardio: LISS vs HIIT | `training, fat-loss` | — |
| 4 | Metabolic Adaptation | `nutrition, fat-loss` | — |
| 5 | What Actually Works | `supplements, nutrition` | — |
| 5 | What to Skip | `supplements, nutrition` | — |
| 6 | Sleep: The Natural Steroid | `recovery` | — |
| 6 | Active Recovery | `recovery, training` | — |
| 7 | Building Unbreakable Habits | `mindset` | — |
| 7 | Dealing with Plateaus | `mindset, training` | — |
| 8 | Periodization Basics | `training` | — |
| 8 | Deload Weeks | `training, recovery` | — |

Tags are matched by lesson `title`, which is `VARCHAR(100)` and currently unique across all 22 rows. The migration must be written so an unmatched title is a **no-op, not an error** — a future retitle should not break deployment.

### 4. API

| Endpoint | Change |
|---|---|
| `GET /api/learn/lessons` | Returns `topics`, `read_seconds`, and a **real** `question_count` via `jsonb_array_length(l.questions)`. Drops `is_next` in favour of `suggested_next` (see below). |
| `GET /api/learn/lessons/:id` | Unchanged shape; still strips `correct` |
| `POST /api/learn/attempt` | Returns `explanations[]` alongside `correct_answers` — **plumbing only, see below** |
| `GET /api/settings/learn` | **New.** `{ start_here_dismissed: boolean }` |
| `PATCH /api/settings/learn` | **New.** Sets it |

`suggested_next` replaces `is_next`: same computation (first incomplete lesson by `unit, order_index`), but the name stops implying that anything else is unavailable. Only the "Start here" strip reads it.

### Correction: the "discarded explanations" P0 was a false finding

An earlier draft of this spec carried a P0 stating that every seeded question holds an `explanation` string which the API strips and throws away, fixable in two backend lines. **That was verified against the live database and the seed file and is false.**

- Question shape is exactly `{ question, options, correct }` — no `explanation` key.
- `grep -c explanation backend/src/db/migrate_learn_content.sql` returns **0**.
- **0 of 22 lessons** have any question carrying the field.

The example strings quoted in that draft do not exist anywhere in the repository. The design-review assessor fabricated them, and the claim was propagated into this spec without being checked against the data.

**The underlying observation survives:** after a wrong answer the quiz tells you the correct letter and nothing else, which is the weakest moment in a learning product. But the fix is to *write* 88 explanation strings (22 lessons × 4 questions) — authorship, belonging to the content deliverable, not a backend change.

**What this scope does instead:** build the plumbing so the content drops in without touching code again. `/attempt` maps `questions[i].explanation ?? null` into an `explanations[]` array; the result screen renders one only when non-null. Today every entry is null and nothing renders. The moment explanations are authored they appear with no further work.

This is recorded rather than quietly deleted because the false claim reached the user as a headline finding, and the record of *how* it got through is worth more than a clean-looking document.

The dismissal flag is stored as **`users.learn_start_here_dismissed BOOLEAN NOT NULL DEFAULT false`**, added by the same migration as the `learn_lessons` columns. This follows the existing `users.share_logs_default` pattern — a direct boolean column exposed via `GET`/`PATCH /api/settings/<topic>` — matching `/api/settings/workout` shipped earlier. The `PATCH` must use the `COALESCE($1, column)` shape from that endpoint so a partial body cannot reset an unrelated field.

### 5. The Learn screen

Replaces the timeline entirely. Top to bottom:

- **Search field.** Instant client-side filter over title + description + topics. No debounce needed at this size.
- **Topic chips.** Horizontal scroll, single-select, derived from the union of `topics` across loaded lessons so they can never drift from the data.
- **"Start here" strip.** Dismissible; shows `suggested_next`. Hidden once dismissed or once every lesson is complete.
- **Lesson list.** *Every* lesson tappable. Each row: title, description, `question_count` questions, read time, completion tick.

**Progress framing changes.** Today a new member is greeted with **"0/22 Lessons — 0%"** — the feature opens by measuring their deficit. It becomes `22 lessons · 7 topics` at zero, switching to `3 of 22 done` once there is something real to report.

**Empty search results** get their own state — "No lessons match 'creatine'" with a clear-search action — distinct from the existing content-empty state.

### 6. Folded-in defect fixes

| Fix | Severity |
|---|---|
| Hoist the lesson header out of the success branch so the close-X always exists; add an error state with retry. Currently `if (loading \|\| !lesson)` leaves a failed fetch on a **permanent skeleton with no exit**. | P0 |
| **Explanation plumbing only** — `/attempt` returns `explanations[]` (an array of `question.explanation ?? null`), the result screen renders one under an answer *when non-null*. **This renders nothing today** — see the correction note below. | P2 |
| `finishQuiz` retries from the immutable `finalAnswers` local, never re-appending to `answers` — kills the duplicate-append permanent soft-lock | P0 |
| Real `question_count` — the list currently falls through `lesson.questions?.length \|\| 5` to the literal **5 on all 22 cards**, contradicting the reader one tap later | P1 |
| `accessibilityRole` / `accessibilityLabel` / `accessibilityState` on every card, quiz radio, and progress bar. Currently **zero** across 1,285 lines. | P1 |
| Raise locked-style text off `text.subtle` inside a `0.6` container (~2:1 contrast, against WCAG AA 4.5:1) — largely resolved by unlocking, but the completed style must not repeat it | P1 |
| Lesson close button is **32×32pt** with no `hitSlop`, and is the only exit from the screen | P2 |
| Guard the empty-`questions` crash (`lesson.questions[0].question` on an empty array); wrap quiz mode in a `ScrollView` — it currently has none, so a long question with four long options can make the fourth unreachable | P2 |
| Delete the inert "View Answers" button (`onPress={() => {/* already showing */}}`); show real `xp_earned`; primary CTA becomes **"Next: <lesson> →"** | P2 |
| Remove dead imports (`Modal`, `Dimensions`) and dead refs (`questionAnim`, `xpEarned`, `quizCompleted`) | P3 |

### 7. Home card zero state

At `progress === 0`, render a solid `menu-book` icon tile instead of the ring. The ring currently renders a **hollow 72×72 circle with nothing inside** — arc fully offset, label suppressed by `showLabel={learnStarted}` — which is the reported "black space", and it hits exactly the new users the card was un-gated to reach.

**Second bug fixed at the same time:** the ring shows *unit* progress while the tap opens a *lesson*, so "Training Essentials, 50% complete → RESUME" opens a lesson that is 0% read. The card must show lesson-level progress to match what it opens.

## Error handling

- Lesson fetch failure → error state with retry, and the close-X is always present.
- Quiz submit failure → inline "Couldn't submit · Retry" over the quiz, retrying from `finalAnswers`. Never silently discard a completed quiz.
- Empty `questions` array → the reader renders without a "Take Quiz" footer rather than crashing.
- Invalid or unknown topic filter → falls back to showing everything, never an empty screen.
- `PATCH /api/settings/learn` failure → fire-and-forget; the strip reappears next launch. Mildly annoying, harmless, no retry logic.

## Testing

Pure functions get real tests, and **the fixtures must not be the benign case** — three defects earlier in this codebase survived precisely because the fixture happened to be the value where the arithmetic worked out.

- `filterLessons(lessons, query, topic)` — the search/filter predicate, extracted so it is testable without a component. Cases: empty query returns all; query matches title, description, *and* topic; case-insensitive; whitespace-only query returns all; a query matching nothing returns `[]` rather than everything; topic filter and text query combine with AND, not OR.
- `read_seconds` derivation — 0-length content, null content, and a value that rounds to under the 30s floor.
- `question_count` — a lesson with an **empty** questions array must return `0`, not fall back to a default. This is the exact bug being fixed; a test that uses a lesson with 4 questions would pass against the broken code.

## Out of scope

- **Contextual surfacing** (piece C) — lessons appearing in the rest timer, food log, or on enabling RIR. `connects_to` is stored; nothing reads it yet.
- **Content rewrite** (piece D) — India-relevant curriculum, drafted separately for review, never written straight to the database.
- Learning streaks (`learn.js:88` hardcodes `current_streak: 0` with a TODO), certificates, and any completion reward. Today, finishing all 22 lessons makes the Home card **silently vanish** — noted, not fixed here.
- Server-side search. Revisit past roughly 200 lessons.
- The unused `/learn/progress` endpoint (`learn.js:208`) with its `LEFT JOIN ... ON true` cross-join. No screen calls it.
