# Workout logging and explicit routine updates

Implemented the three approved Hevy-inspired logging changes and the added routine-update request. Fitzo keeps its existing Lexend typography, monochrome colors, icons and navigation.

## Behavior

- Weight and reps are directly editable in each set row. Keyboard Next moves from weight to reps; reps proceeds to the next row or the optional RIR editor. The numbered set button opens the existing full editor, including wheel mode. Partial typing is kept in the account's existing workout draft. Editing a completed set to invalid values unchecks it; checking a missing/invalid set opens the editor for correction.
- A labelled **Last session** line shows actual weight/reps and date for the corresponding set. **Use** copies those two values only, preserving the need to complete the set explicitly. Completed rows and mismatched whole-movement/per-side logging modes cannot be overwritten with this shortcut. RIR is not copied from a previous workout.
- Exercise details has **Guide / History** tabs. History displays actual paired sets, dates, workout category, per-side mode and recorded RIR, including zero. Loading, empty history and retryable failure are separate states. Opening and closing details preserves the active workout.
- Structural changes to a loaded saved routine trigger a finish sheet with a specific changes list. **Save today only** leaves the routine untouched. **Update routine & save workout** updates that routine in place, preserving other training days and existing rep targets. New exercises need an entered rep target. **Back to workout** writes nothing. Weight/reps edits alone do not prompt a routine change.
- Routine update failure preserves the workout and offers retry or saving today only. If the routine update succeeds but workout saving fails, retrying saves the workout without applying the routine update twice. Duplicate save taps are guarded.

## Data and compatibility

The first three features use the existing `/workouts/history?limit=90` endpoint. This covers the last **90 logged days**, not necessarily 90 calendar days or all-time history. One account/token-bound request is shared between exercise cards and cached in memory for 30 seconds. Saving a workout invalidates the cache. Late responses from an old account cannot be shown for the current account. Exercise names match exactly after trimming/case normalization; similar names are not merged.

The backend history response now includes timestamps and orders workouts within a day. Older deployed servers still work. If multiple matching workouts on a day have no ordering timestamps, the UI shows their history but does not guess which values should populate the last-session shortcut.

Explicit routine updates use the new authenticated `PATCH /workout-sessions/splits/:id/plan`. The SQL update requires the same owner, active routine ID, expected original plan and training days. Stale, inactive and unowned targets return a conflict without overwriting the routine. The endpoint changes only the plan and update timestamp; it does not create/activate another split. Both starting-plan and custom-plan formats are validated. Starting plans are converted to a custom prescription when needed, preserving the other sessions' exercise IDs, targets and set counts. No database migration is required.

**Deployment:** the routine-saving endpoint and updated plan validation must be deployed to the API for that action to work against production. These changes have not been deployed. On an older server, an unavailable update keeps the workout and offers saving today only.

## Verification

- Mobile: 73 Jest suites / **574 tests** pass.
- Backend: 53 Jest suites / **485 tests** pass. Database-backed PGlite checks cover timestamp ordering, account scoping, real JSON plan updates, stale/unowned rejection and preservation of another day.
- TypeScript passes. Scoped ESLint has no errors; seven existing warnings remain.
- Expo web, iOS and Android JavaScript exports pass. These are not installed native builds.
- Four isolated browser scenarios pass: today-only save, routine-update failure/retry, history failure/retry, and optional RIR editing.
- Fourteen responsive captures at 320/390/430 pixels wide, including the routine sheet at 320 × 500. No horizontal page overflow; both routine-save actions remain visible. Inspected narrow-screen inline inputs, RIR layout, dated history and the changes sheet.
- Browser API calls were intercepted, using synthetic authentication and data. No real workout or routine was written. Each save scenario issued one intercepted workout save containing only the completed 42.5 kg × 9 set. Today-only issued no routine update. Routine retry preserved the other day and its original rep target.
- The isolated browser deliberately blocks external hosts, including the existing jsQR worker CDN. Its expected worker-load error is the only page error observed.

Results: [browser-results.json](browser-results.json). Captures: [inline entry](inline-logging-320x844.png), [with RIR](inline-with-rir-320x844.png), [history](exercise-history-390x844.png), [routine choice](routine-choice-320x500.png), [update retry](routine-update-error-320x844.png).

Physical iOS/Android keyboard positioning, input navigation and haptics still need device checks. No dependency, production-data or deployment changes were made.
