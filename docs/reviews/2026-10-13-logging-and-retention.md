# Food logging, workout input and retention measurement

Implemented locally on 13 October 2026. These app/backend changes have not been deployed or submitted as a new store release.

## Food logging

- Quick Add returns the most recent saved entry for each food name, including its actual calories/macros, portion, meal category and estimate flag. Frequency still determines ordering. Timestamp ties use entry ID for deterministic results. Nothing is averaged.
- The first repeat uses exactly that saved portion. Scaling stores the new total gram weight when known. An old entry without a weight can be repeated as a portion; it cannot be treated as 100g.
- A manual save closes the food detail sheet and leaves the food screen open with **Add another food** and **Done**. The chosen category carries into the next manual food. Opening a historical repeat restores that entry's category, which can be changed before saving.
- Breakfast, lunch, dinner and snack are available as a compact, accessible selector. The backend validates the category. Old clients can still omit it and receive their existing snack default.
- Failed saves retain the portion and category. A synchronous guard prevents rapid taps from starting duplicate concurrent submissions. This does not guarantee idempotency after an ambiguous network timeout; existing non-idempotent writes are not automatically retried.
- Food drafts and shortcut storage are scoped to the account. Old unowned `custom_quick_adds` data is left intact but is not assigned to a new account, since its owner cannot be established. Members can recreate those shortcuts under their own account.
- The nutrition write pins its auth token and rejects a save if its account provider unmounted while waiting for the token.
- The detail summary is more compact. At 320px all four meal choices fit in one row, the save action remains accessible, and the search controls no longer overflow. Ordinary serving choices use **Serving type** instead of a cooking question.

## Workout numbers

Choosing **Type a number** or **Use wheel** remembers the choice for that signed-in account on that device. Weight, reps and RIR open in the chosen mode on subsequent visits. Delayed storage reads cannot replace a new choice; rapid toggles persist in order. Switching back to the wheel keeps the typed value.

## Internal measurement

Run from `backend` using the existing, securely configured database connection:

```powershell
npm run metrics:logging -- --from=2026-10-01T00:00:00Z --to=2026-11-01T00:00:00Z
```

Optional arguments: `--as-of=2026-10-13T00:00:00Z` for a historical cutoff, and `--exclude=uuid,uuid` to omit known reviewer/developer accounts. Future cutoffs are rejected. `from` is inclusive and `to` is exclusive. Dates must be UTC ISO timestamps.

The report queries existing saved records in a read-only, consistent transaction with a 30-second query limit. No analytics SDK, third-party telemetry or new database migration is required. Output contains aggregate counts only.

- **Signup:** member account creation. Manager/trainer accounts are excluded.
- **First saved log:** first food entry or completed workout saved after signup. An imported health reading, incomplete workout or linked smart-log mirror does not create an extra activity.
- **Seven-day activation:** first save before signup + 7 days. Rate denominator includes only members with seven complete days of observation; younger members are pending.
- **Week-two return logging:** another save from first log + 7 days inclusive to first log + 14 days exclusive. Rate denominator includes only members with 14 complete days of observation after the first log. Younger loggers are pending.
- **Signup cohorts:** Monday weeks in Asia/Kolkata. Observation windows are rolling 24-hour days.
- Rates are `null` when nobody is yet eligible, rather than a misleading zero.

This is a report on current saved history. Deleting logs can change earlier measurements; account deletion removes the member from reports. It does not retain a separate permanent event ledger. Campaign attribution is not yet included. Known review/test member accounts must be excluded explicitly before treating this as acquisition performance.

The first production baseline was saved locally at `.codex/logging-metrics/2026-10-13-baseline.json`, outside Git and app build archives. It covers signup dates from 1 September 2026 through the report cutoff on 13 October. No accounts were excluded: 58 signups, 14 first-log users; 11/55 eligible accounts activated within seven days (20%). Three accounts are still activation-pending. Eight loggers have a complete week-two observation window, with zero observed returns; six are pending. This small historical sample does not establish the retention of the newly released UI.

## Verification

- Full mobile suite: **45 suites, 353 tests passed**, including changing a previous 250g portion to 100g and verifying the saved calories/macros scale against 250g.
- Full backend suite: **52 suites, 481 tests passed**, including a real PostgreSQL-compatible query run in PGlite for repeat portions, timestamp ties, account isolation, cohort maturity, cutoff boundaries and mirror exclusion.
- Mobile TypeScript passed. Changed-source lint has no errors; existing warnings remain in the large screens/API file.
- Browser fixture review at **320×568** and **390×844**: correct previous portion, four meal choices, checked state, save confirmation, continued entry and carried meal category. No horizontal page overflow at either size.
- Screenshots and the aggregate baseline are in `.codex/logging-metrics/`. Preview captures use local fixture meals and do not write to production.
- Physical iPhone/Android keyboard, safe-area and screen-reader behavior still need native device checks before the app update ships.

## Rollout

Deploy the compatible backend first, then release the mobile update. Until the new frequent-food payload is available, the updated app hides old averaged history entries rather than displaying them as actual previous portions. Manual search and account-owned shortcuts remain available. Store build numbers are unchanged in this change set; no EAS build, store submission or production deployment was initiated.
