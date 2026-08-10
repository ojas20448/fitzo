# Voice logging — design

**Status:** approved in principle, not built.
**Date:** 2026-08-10

Speak a workout or a meal, see it as an editable table, confirm, done. The
member never types a set or searches a food unless they want to.

---

## Why this is worth building

Logging is where fitness apps lose people. Eight taps to record one set, or a
search-and-scroll for every item in a thali, and by week three the log is empty.
Voice collapses that to one press and a sentence.

The differentiator is not "we have a mic" — several apps do. It is that **we
resolve what you said against a real Indian food catalogue rather than inventing
numbers**, and that you see and correct the interpretation before anything is
saved.

## What already exists

More than half the plumbing is in place. Confirmed by reading the code, not
assumed:

| Piece | Status |
|---|---|
| Mic permissions, iOS + Android | already declared in `app.json` |
| Audio capture | `expo-av` recording in `CalorieLogScreen` |
| `POST /api/ai/transcribe` | Gemini, behind `aiQuota` |
| AI rate limits | 6/min · 25/day · 150/month per user |
| `geminiService.analyzeFoodFromText()` | single food → nutrition |
| Food catalogue | 9,923 curated items + 5 external APIs |

**Where it stops:** the calorie voice flow transcribes and then calls
`setSearchQuery(text)`. It drops the transcript into the search box. It does not
split a sentence into items, does not show a confirmation, and does not log.
Workouts have no voice path at all.

So this project is not "add voice". It is **structured extraction → editable
confirmation → commit**, on transport that already works.

---

## The rule that governs everything

**The catalogue answers first. AI only fills gaps, and says so.**

Concretely:

1. **Match against the catalogue** → use its numbers. No AI, no prompt.
2. **No match** → AI estimates, the row is visibly labelled as an estimate, and
   it is saved to that member's **personal foods**, not the shared catalogue.
3. **Promotion to the shared catalogue** → only through a review queue a human
   approves.

### Why the shared catalogue is closed to AI

On 2026-08-09 we deleted 465 rows from `indian-foods.json` — a brand × dish
cross-product that had Parle, Kurkure and Starbucks all selling a misspelled
"Butter Panner Meal", each with different invented macros stated to one decimal
place. Someone logging one got 707 confident, wrong calories.

Letting AI estimates flow into the shared catalogue rebuilds exactly that, except
continuously and triggered by users instead of by a script.

The distinction that makes AI estimates safe:

| | Shared catalogue | Personal foods |
|---|---|---|
| Who sees it | everyone, forever | only you |
| Who chose it | nobody | you did |
| May be AI-estimated | **no** | yes, labelled |

"I logged an approximate protein shake" and "Lays sells a Butter Panner Meal"
are different kinds of claim. The first is a member's own approximation. The
second is the app lying to everybody.

**Provenance is permanent.** The source is stored on the log row, not just shown
on the confirmation screen — so a member reviewing last week can still see which
numbers were estimated. A number whose origin is forgotten is indistinguishable
from a fact.

---

## Prerequisite: the matcher must be trustworthy

Auto-matching cannot ship on the current scorer. Measured today:

```
"milk"  →  162  Milky Mist Paneer      ← wins
           135  Milk (Cow)
"curd"  →  135  Curd Rice              ← wins
           135  Curd (1 katori)
```

`name.startsWith("milk")` matches mid-word, so a brand called Milky Mist
outranks actual milk; and "curd" ties at 135, where the length tiebreak picks
"Curd Rice" — a different dish — over plain curd.

Today that is a mildly annoying search result the member can scroll past. Under
voice logging it becomes a **silent wrong entry**: you say "a glass of milk" and
get paneer. Ranking stops being UX and becomes correctness.

**Fixes, in `utils/foodSearch.js`:**

- Phrase bonuses require a token boundary — `name === q`, `startsWith(q + ' ')`,
  or `includes(' ' + q + ' ')`. Never a bare `startsWith` on the raw string.
- On a score tie, prefer the row whose **token count** is closest to the query's
  before falling back to string length. "Curd (1 katori)" beats "Curd Rice" for
  the query "curd" because it is the plainer form of that exact word.
- Generalise the module to `utils/textMatch.js`. Nothing in the scorer is
  food-specific, and exercise matching needs the same coverage-squared, bounded-
  fuzzy behaviour. One matcher, two callers.

This is task 1. Nothing else starts until "milk" returns milk.

---

## Architecture

### One AI call, not two

The obvious shape — transcribe, then parse the text — costs **two** AI calls per
log. At 25/day that is 12 logs before a member is locked out for the day, which
is not a daily driver.

Instead: **audio → structured JSON in a single Gemini call**, with a separate
cheaper **text → structured JSON** path.

```
                 ┌── voice ──►  POST /api/voice/workout  (audio, 1 AI call)
  press mic ─────┤
                 └── text  ──►  POST /api/voice/workout  (text,  1 AI call)
```

Keeping a text path is not a nicety. It means the feature works in a gym too
loud to dictate in, on a phone whose mic permission was denied, and in every
test we write — parsing can be tested without a single audio fixture.

### The pipeline

```
audio or text
      │
      ▼
[1] EXTRACT   Gemini → strict JSON. Names and quantities ONLY.
      │        Never nutrition. Never calories. The prompt says so and
      │        the schema has no field for it.
      ▼
[2] RESOLVE   Local. Each extracted name → textMatch against the
      │        catalogue / exercises table. Deterministic, no network.
      ▼
[3] ESTIMATE  Only for rows that resolved to nothing. A second, narrow
      │        AI call for nutrition — batched for all unmatched rows
      │        in one request, so it is at most one extra call.
      ▼
[4] CONFIRM   Editable table. Nothing has been written yet.
      │
      ▼
[5] COMMIT    Existing bulk endpoints. Provenance stored per row.
```

Step 1 producing no numbers is the load-bearing decision. An LLM asked for
calories will always return a plausible figure rather than admit ignorance, so
we do not ask. It extracts *"peanut butter, 100 g"* and the catalogue supplies
what 100 g of peanut butter is.

---

## API surface

### `POST /api/voice/workout`

```jsonc
// request
{ "text": "barbell bench press three sets, 100, 90 and 80 kilos, six reps each" }
// or { "audio": "<base64>", "mimeType": "audio/m4a" }

// response
{
  "transcript": "barbell bench press three sets, 100, 90 and 80 kilos, six reps each",
  "exercises": [{
    "spoken": "barbell bench press",
    "match": { "id": "…", "name": "Barbell Bench Press", "confidence": "high" },
    "sets": [
      { "weight_kg": 100, "reps": 6 },
      { "weight_kg": 90,  "reps": 6 },
      { "weight_kg": 80,  "reps": 6 }
    ]
  }],
  "unresolved": []
}
```

Understood forms: `3x8`, `three sets of eight`, `100kg`, `100 kilos`, `bodyweight`,
`each side` → sets the existing `is_unilateral` flag, `RIR 2` / `to failure` →
the existing `rir` column. Both already exist in `set_logs`; voice populates
them rather than inventing new state.

### `POST /api/voice/food`

```jsonc
{
  "transcript": "two rotis, a katori of dal and a yogabar peanut butter, 100 grams",
  "items": [
    { "spoken": "two rotis", "quantity": 2, "unit": "piece",
      "match": { "id": "…", "name": "Roti", "source": "catalogue", "confidence": "high" },
      "nutrition": { "calories": 120, "protein": 3, "carbs": 18, "fat": 3 } },

    { "spoken": "yogabar peanut butter, 100 grams", "quantity": 100, "unit": "g",
      "match": null, "source": "ai_estimate", "needs_confirmation": true,
      "nutrition": { "calories": 600, "protein": 25, "carbs": 20, "fat": 50 } }
  ]
}
```

`source` is `catalogue` | `user_food` | `ai_estimate`, and it travels all the way
to the stored row.

### Commit

Reuse what exists — `POST /api/nutrition/log-bulk` and the workout logging
endpoints — extended to accept and persist `source`. No new commit path.

---

## Data model

```sql
-- migration 013
CREATE TABLE user_foods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  serving_size  VARCHAR(60),
  calories      INTEGER NOT NULL,
  protein       NUMERIC(6,1) NOT NULL DEFAULT 0,
  carbs         NUMERIC(6,1) NOT NULL DEFAULT 0,
  fat           NUMERIC(6,1) NOT NULL DEFAULT 0,
  source        VARCHAR(16) NOT NULL CHECK (source IN ('ai_estimate','manual')),
  times_used    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX user_foods_user_name_key ON user_foods (user_id, lower(name));

-- migration 014
ALTER TABLE calorie_logs ADD COLUMN IF NOT EXISTS source VARCHAR(16)
  NOT NULL DEFAULT 'catalogue'
  CHECK (source IN ('catalogue','user_food','ai_estimate','manual'));
```

`NUMERIC(6,1)`, not `INTEGER`. Rounding macros to whole numbers is how a
previous pass in this repo collapsed distinct foods into identical totals; half
a serving of something with 9 g fat must stay 4.5 g.

`times_used` is the promotion signal. When many members independently add a food
with the same name, that is evidence it belongs in the shared catalogue — and a
human still approves it.

---

## The confirmation screen

One screen, reached identically from workout and food. It is the whole product
promise: *we heard this, is it right?*

- Rows are the extracted items. Quantity is a stepper; the row swipes away.
- **An estimated row is visibly estimated** — a muted `ESTIMATE` tag, not a
  colour cue alone. Present at confirmation *and* in the log afterwards.
- **Nothing is written until "Log all" is pressed.** Not on transcribe, not on
  parse. A misheard sentence costs a tap to discard, not an edit afterwards.
- The transcript is shown, small, above the table — when a row is wrong the
  member needs to see whether we misheard or mis-parsed.
- Low-confidence matches surface an alternatives picker rather than silently
  choosing the top hit.
- Zero rows extracted → show the transcript and offer manual entry. Never an
  empty table with no explanation.

It reuses `MealBuilderSheet`'s stepper and total patterns rather than inventing
a second editing idiom.

---

## Failure handling

| Case | Behaviour |
|---|---|
| Transcription unintelligible | show what was heard, offer retry or typing |
| AI returns malformed JSON | one retry, then fall back to the text path with the transcript prefilled |
| Zero items extracted | transcript + manual entry. Never a silent empty state |
| Quota exhausted | say so plainly, with when it resets; typed search still works |
| Offline | mic disabled with a reason; the existing offline queue is unaffected |
| Exercise not in the table | keep the spoken name as a free-text exercise; do not drop the sets |

The quota case matters: 25 AI calls/day is roughly 12–20 voice logs. That is
adequate for the common case and needs to fail in words, not a spinner.

---

## Scope

**In:**
1. `textMatch` extraction + the ranking fixes (task 1, blocking)
2. `POST /api/voice/food` — extract, resolve, estimate
3. Confirmation screen, shared
4. `user_foods` + `source` provenance
5. `POST /api/voice/workout`
6. Mic entry points on both log screens

**Explicitly out, for now:**
- Promotion review queue. Ships when `times_used` has data worth reviewing;
  until then personal foods stay personal and nothing is lost.
- Multi-language. Gemini handles Hinglish already; formal Hindi/Tamil support is
  a separate evaluation problem with its own test corpus.
- Voice editing ("no, make that three sets"). Text editing works; conversational
  correction is a much larger interaction model.
- Photo → meal. `analyze-photo` exists but is a different confirmation flow.

**Deliberately not doing:** letting AI write to the shared catalogue, storing a
nutrition figure without its source, or auto-committing anything without the
member seeing it.

---

## Testing

- **Pure, no network:** the extraction parser against a fixture corpus of ~40
  spoken sentences per domain — including "each side", "to failure", "3x8",
  "bodyweight", plurals, and Hinglish quantities like "do roti".
- **Matcher:** the ranking regressions above are cases, permanently. `"milk"`
  must return milk.
- **Live-data check:** run the resolver over the real 9,923-item catalogue, not
  fixtures. A fixture-only suite passed while the real data was broken earlier
  in this project; that lesson is cheap to reapply.
- **Provenance:** a committed `ai_estimate` row must still read as an estimate
  after a round trip through the API.
