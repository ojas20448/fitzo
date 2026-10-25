# Diary and exercise settings — October 25, 2026

Implemented the five requested improvements in the local working tree.

- Saved food entries can move to another diary date in one PATCH. The same row,
  nutrition and ownership are retained. Explicit moves pin legacy timezone data
  so travel cannot reinterpret the selected date. Failed saves retain edits.
- Food saves show the actual date and meal, with a View diary action. This also
  covers voice, meal ideas, recipe saves and saved-entry edits. A meal category
  changed inside the meal builder is returned to the confirmation correctly.
- Tapping the diary date opens a month calendar. It handles leap days and year
  boundaries, highlights selection, blocks future dates, and provides Today and
  Cancel actions. The same calendar is reused in the entry editor.
- The add-food log refreshes on focus, including returning from recipes or the
  scanner. Editing/moving entries also refreshes today's shared totals.
- Exercise cards expose Notes & rest. Reminders and per-exercise rest settings
  are private account settings, stored on the backend and reloaded when opened.
  Default inherits the workout setting; Off disables automatic rest for that
  exercise; a selected time enables its timer. Inline and full set editors use
  the same precedence. Failed edits stay open for retry. Account changes discard
  old responses and close the previous account's editor.

## Backend and rollout

Apply `backend/data/migrations/026_exercise_preferences.sql` before deploying
the backend and publishing a compatible OTA. It creates one private table with
row-level security, an account/exercise primary key, bounded note/rest values,
and cascading account deletion. Its idempotence was tested against isolated
PostgreSQL-compatible storage. No production migration or deployment was run.

The authenticated GET and PATCH `/api/settings/exercises` endpoints scope every
read/write to the current account. Existing workout records and shared history
do not contain these private reminders. No native dependency was added.

## Checks

- Full mobile suite: 84 suites, 666 tests passed; affected workout tests also
  passed after the final account isolation changes.
- Full backend suite: 63 suites, 538 tests passed. Storage tests cover migration
  replay, account isolation, validation, deletion and moving existing food rows.
- TypeScript, scoped ESLint and whitespace checks passed.
- Android and iOS Hermes exports compiled successfully.

The existing midnight gym-visit test used SQL's fixed clock alongside JavaScript's
real clock. The fixture now mocks Date.now for that test; production gym behavior
was not changed.

Automatic approval review rejected the local browser preview launches with
“blocked by policy.” The temporary review route was removed. Browser layout,
native keyboard and physical-phone acceptance remain unverified.
