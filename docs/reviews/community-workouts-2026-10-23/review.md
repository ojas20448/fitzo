# Fitzo and Community Workouts

Implemented on 23 October 2026, preserving Fitzo’s Lexend type, monochrome surfaces and existing outline icon library.

## Finding and choosing plans

- My plan and Change plan both expose Fitzo Workouts and Community Workouts. The active plan’s day selection remains ahead of discovery in My plan.
- The library separates official and community plans. Most liked is the default order; Newest and Most used are also available.
- Search matches the plan name, description, author and tags. Training days (1–7) and experience level combine with search, collection and sort. Active criteria are visible; Clear all removes search/day/level filters while retaining the selected collection and sort.
- Rest days do not count as training days. Empty results explain how to reset filters. Load failures and pagination failures have retry controls. Late responses cannot replace a newer collection/filter request.
- Pages contain 24 plans and duplicate IDs are removed when appending. Ordering has a deterministic ID tie-breaker.
- Preview includes the schedule and available exercise prescriptions before adoption. Schedule-only plans are explicitly labelled. Adopting retains the previous plan as an inactive saved plan and copies the published exercise prescription into the new active plan.

## Hearts and publishing

- Hearts are authenticated, persistent and unique per account/plan. PUT sets a desired boolean state, so network retries cannot create extra hearts. Unheart affects only that account’s reaction.
- The UI waits for confirmation before changing the saved count/state, blocks duplicate pending writes, and preserves the current sort if it changes during a heart request.
- Publish chooses an owned saved plan, collects a public title, description, level and up to five tags, and shows what will become public. Failed submissions preserve the form.
- The backend takes the schedule/exercise snapshot from the owned saved plan rather than trusting client-supplied plan content. Lifted weights and workout logs are never part of this snapshot. Official status cannot be supplied by members.
- Publishing the same saved plan twice returns a conflict instead of creating duplicates. Later private edits do not modify the public snapshot. After publishing, the library opens Community / Newest to make the new entry easy to find.

## Verification

- Mobile regression suite: 77 suites / 599 tests passed, including combined filters, stale requests, pagination retry/deduplication, pending-heart sort changes, exercise preview/adoption, publishing validation/retry, and token-bound API writes.
- Backend regression suite: 55 suites / 496 tests passed. The new PostgreSQL/PGlite integration script additionally exercises six scenarios against actual SQL, including repeatable migration, owned snapshots, unique reactions, all filters/sorts, literal wildcard search, deterministic paging, adoption and schedule-only plans with rest days.
- TypeScript passed. Scoped lint has no errors; 11 warnings remain, including existing workout-screen warnings and intentional request-generation cleanup refs.
- Web, iOS and Android JavaScript exports passed. These are bundle checks, not signed native release builds.
- Browser review passed 15 layouts at widths 320, 390 and 430 px, including 600 px height sheets, from both plan entry points through filter/search, heart failure/retry, preview retry, publishing failure/retry and adoption. See [browser-results.json](./browser-results.json). All API writes used intercepted synthetic fixtures; no real user plans were published or adopted. The QR worker CDN was deliberately blocked by the harness; there were no other page errors.
- Interim failure captures are retained; the final pass is recorded in browser-results.json.

## Release requirements

Apply the additive `backend/data/migrations/023_community_workouts.sql`, then release the backend and mobile changes together. The migration adds ownership/snapshot fields and a reaction table; its primary key enforces unique hearts, and RLS prevents direct access to the voter table. It was tested locally and has **not** been applied to the live database. No deployment or store submission was performed.

Native keyboard, safe-area and screen-reader behavior still needs a real-device check. Existing published schedule-only plans remain schedule-only; no exercise prescriptions or ratings are fabricated.
