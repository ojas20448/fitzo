# Audit fixes and health import verification

This implements the first non-manager repair batch from PROJECT_AUDIT_2026-09-10.md. Manager access, manager creation and manager broadcasting remain deferred as requested. Changes are local; no deployment or production migration was performed.

## Implemented

- All three workout/calorie feeds honor share_logs_default for friends-only entries. The dedicated buddy endpoint remains covered, and the 17 empty privacy tests were replaced with actual route checks.
- Password reset atomically consumes its code and increments a token version. Existing JWTs carry implicit version zero. Authentication reads current database security state, rejecting revoked tokens and deleted accounts instead of trusting a stale Redis principal. Token creation also rejects a password proof invalidated by a concurrent reset.
- The health table's account foreign key now cascades on account deletion through migration 016. Runtime creation of this table was moved to that migration.
- Mobile logout/account changes clear account-sensitive caches, recap/share state and nutrition-provider state. Home-cache reads require a matching account. Requests/responses from a previous session are rejected. Offline writes are partitioned by account, and failed writes are retained instead of silently deleted.
- Network/time-out retry is limited to safe HTTP methods. A timed-out meal or other mutation is not automatically replayed.
- Push registration transfers a device token away from previous accounts under a transaction; unregister removes both active and stored registrations. Logout attempts unregister before clearing local credentials. Offline logout cannot immediately update a remote push registration; next successful registration transfers it.
- Saving a split uses one checked-out database client for the whole transaction. Class booking locks its class row, checks gym and future schedule, and checks capacity before inserting.
- Flat workout logs and structured analytics records now commit/roll back together. New structured records link to their source log; deleting the source cascades through session/exercise/set records. Migration 018 backfills historical links only when unambiguous, preserving uncertain historical records for review.

## Apple Health and Health Connect

The old import was not correct. The following changes address the source-to-report path:

| Concern | Current implementation |
| --- | --- |
| Apple API compatibility | Typed against the installed @kingstinct/react-native-healthkit exports. Uses string identifiers, `{ toRead }`, actual query filters, limits and explicit units. |
| Daily steps and active energy | Uses native statistics/aggregation rather than summing raw device records. Apple requests count/kcal units; Android uses COUNT_TOTAL and ACTIVE_CALORIES_TOTAL. |
| Resting heart rate | Reads the newest resting-heart-rate record. Android no longer labels an arbitrary HeartRate sample as resting. Manifest and permission request use READ_RESTING_HEART_RATE. |
| Sleep | Uses asleep stages only; excludes awake/in-bed time; merges overlaps, clips to the preceding 24 hours and follows Android pagination. Android records without stages are left unknown rather than treating all session time as asleep. |
| Missing/denied readings | Missing readings remain null. A partial sync omits unknown fields and preserves previously stored measurements. Real corrected totals can decrease. |
| Dates | Device sends its local calendar date. Today/history requests use that same date; invalid calendar dates are rejected and history windows are bounded. Legacy clients without a date retain an IST server fallback. |
| Permission wording | iOS authorization completion is not presented as proof of read permission. Empty results prompt the user to check data/access, rather than reporting fabricated measurements. |
| Account ownership | Automatic import requires the account's explicit Settings → Health connection preference, separate from the device-wide OS permission. A newly signed-in account does not automatically inherit another account's import preference. Existing users need to connect once in Settings after this update. |
| Reporting | Health Report now consumes the actual `health` and `daily` API envelopes, converts PostgreSQL numeric strings, computes averages over available readings, and displays missing values as a dash. |
| Disclosure | The report explains that readings are imported into the Fitzo account for the report/coach. The iOS usage description no longer claims the app writes workouts to Apple Health. |

This remains a foreground daily-summary integration. It does not implement historical HealthKit backfill, continuous background delivery, or writing workouts to Apple Health. Platform availability, user permissions and source data still determine which measurements can be read.

Primary references checked alongside the installed package declarations:

- [Apple: authorizing access to health data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data) — apps cannot determine whether read permission was granted merely from request completion.
- [Android: reading raw data](https://developer.android.com/health-and-fitness/health-connect/read-data) and [aggregating data](https://developer.android.com/health-and-fitness/health-connect/aggregate-data) — use aggregation for cumulative totals and available platform deduplication.
- [Android: data types](https://developer.android.com/health-and-fitness/health-connect/data-types) — resting heart rate has its own record and permission.

## Verification

The existing and new Jest suites cover health adapter calls, missing metrics, report response mapping, account-specific import preference, retry/cache behavior, token revocation, privacy SQL contracts, class/split transactions, workout mirroring and push-account cleanup.

An additional disposable PGlite PostgreSQL check lives in `output/audit-postgres/verify.cjs`, with results in `output/audit-postgres/results.txt`. It loads no .env and contacts no production server. It verifies:

1. Migrations 016–018 apply and reapply to the old health schema.
2. Actual health routes store partial imports, preserve unknown values and accept corrected lower totals.
3. Actual workout-feed SQL respects the sharing toggle.
4. Actual workout deletion removes linked sessions/exercises/sets.
5. Actual password reset invalidates old JWTs; account deletion removes health rows and invalidates access.

This uses a minimal schema fixture and real PostgreSQL SQL execution, not the complete production schema. It does not validate multi-connection load behavior or Supabase-specific configuration.

Reproduction:

```powershell
npm install --prefix output/audit-postgres --no-save --ignore-scripts --no-audit --no-fund @electric-sql/pglite
node output/audit-postgres/verify.cjs
```

Final verification results:

- Backend Jest: 35 suites, 360 tests passed.
- Mobile Jest: 17 suites, 183 tests passed.
- Mobile TypeScript: passed.
- Mobile ESLint: zero errors, 256 warnings remain.
- Expo web export: passed; artifacts are under `output/audit-web-export-2026-09-11`, outside the mobile lint source tree.
- Disposable PostgreSQL integration checks: all five groups above passed.
- Navigation/API wiring checks: no orphan targets found.
- `git diff --check`: passed.

These checks verify the local checkout, including concurrent UI edits, and do not replace the native device checks below. Mobile test and export logs are in `mobile/audit-test-results.txt` and `mobile/audit-export-results.txt`.

## Before deploying

Apply these migrations in order **before** deploying the backend changes:

1. `backend/data/migrations/016_health_import_integrity.sql`
2. `backend/data/migrations/017_session_revocation.sql`
3. `backend/data/migrations/018_workout_source_link.sql`

Use a native rebuild for the Android resting-heart-rate permission and the updated iOS usage descriptions. An OTA JavaScript update alone does not change native permission configuration.

On an iPhone and Android device, compare a known day's readings with the source health app, including overlapping sleep stages and partial permission grants. Check an import around local midnight, switching Fitzo accounts, and deleting an account with imported data. Native device checks remain outstanding; web export and mocks cannot establish them.

## Remaining audit work

- Manager/staff authorization and management features were deliberately left for their release work.
- Automatic offline write replay remains unconnected. The queue has ownership/retention safeguards, but enabling it still needs server-side idempotency, original log-date semantics, a recovery UI and integration into the real logging screens. No claim of complete offline logging is made.
- Historical workout mirrors whose source cannot be identified unambiguously remain preserved, not automatically deleted or reassigned.
- The broader migration-runner partial-upgrade problem, unified workout/attendance calendar-day migration, staging environment separation, SSL configuration and documentation refresh remain follow-ups.
- Concurrent AI-consent/UI edits were present in this checkout during verification. They were preserved; two small integration errors (a spacing token and a missing JSX conditional separator) were corrected so combined checks could proceed.
