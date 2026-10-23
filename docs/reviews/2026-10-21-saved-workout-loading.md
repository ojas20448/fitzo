# Saved workouts in Log Workout

## Finding

The logger previously accepted only version 1 starter plans (catalog exercises,
at most five per day). It ignored version 2 custom routines containing named
exercises, rep ranges, tempo, and longer sessions. Log Workout also skipped the
saved-split lookup when opened without a workout intent.

## Changes

- Custom routines now populate the exercise cards in their saved order, with
  the prescribed number of sets, rep-range instructions, tempo, and per-side flags.
- Custom prescriptions take priority over old exercise selections. Matching
  history supplies previous weights and reps without changing prescribed set counts.
- All suggested sets remain unchecked; saved routines never count as performed work.
- Log Workout always retrieves the active split. Without a supplied day, it opens
  the first saved training day and shows the other training days for selection.
  This default does not claim to infer today's calendar position in the split.
- Switching days clears the previous draft, asks before discarding entered work,
  and rejects late responses for the previous day or account.
- Existing starter-template and repeat-last behavior is preserved.
- Schedule-only splits explain that exercises must be added or selected from a template.

## Production data audit

Read-only audit on October 21, 2026:

| Active split data | Users |
| --- | ---: |
| Starter exercise plans, version 1 | 24 |
| Custom exercise plans, version 2 | 1 |
| Training-day schedule without an exercise plan | 61 |
| Total users with an active split | 86 |

Of the 61 schedule-only users, 11 have completed workout logs that may supply
repeat-last exercises for a matching day. No published split currently contains
exercise data; published splits store day/focus labels. No routines were invented
for schedule-only users, and this fix makes no production database changes.

## Verification

- Regression tests failed for custom routines, generic entry, and saved-day
  selection before the implementation, then passed with the fix.
- Mobile test suite: 51 suites, 403 tests passed.
- TypeScript: `tsc --noEmit` passed.
- Whitespace check passed for the changed tracked files.
- Read the current account plan from production and passed it through the new
  loader: all four training days, 26 exercise rows, and 52 unchecked working sets
  matched the stored prescription, including the latest exercise names.

## Delivery

Implemented and verified locally. Installed apps need a new mobile build/release.
The project has no `expo-updates`, update URL, or runtime version configured, so
this client change cannot be delivered through a database update or an OTA publish.
No store build or release was submitted in this task.
