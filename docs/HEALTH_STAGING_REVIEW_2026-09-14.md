# Health importing and staging review — 14 September 2026

## Subsequent scope change

The user chose to skip staging. Development and preview builds now explicitly
use the existing production API, and the staging-only build guard was removed.
The staging investigation and preparation below are historical, not current
release requirements. No staging resources were created. Native device testing
is still required; test account activity uses the live database.

## Implemented locally

- Settings has explicit account import consent, Sync now, Import last 30 days,
  progress/results above the controls, empty/error explanations, and Turn off.
  Platform names distinguish Apple Health and Health Connect.
- History reads each requested device-local calendar day. Calendar arithmetic
  preserves day boundaries across daylight-saving changes. Missing metrics stay
  absent; an actual zero is uploaded. Daily upserts make manual retries safe.
- Sleep merges overlapping asleep stages and clamps them to the calendar day.
  Android queries also include sessions starting the previous day. This is
  calendar-day asleep time, which can differ from an app's overnight/wake-date
  display. Older readings need a manual re-import to use these semantics.
- Every import checks the signed-in account and current import preference before
  native reads and uploads. Uploads are pinned to the starting authentication
  token. Turning imports off stops subsequent uploads; an already accepted
  request can finish. Saved server readings are retained.
- Foreground resume refreshes recent readings. An optional background task
  imports today and yesterday, requests Android's separate background access,
  skips protected/locked Apple Health data, and checks opt-in again while running.
  Tasks are registered for opted-in accounts and unregistered after sign-out or
  disabling imports. Thirty-day backfill is an explicit foreground action.
- Added SDK 54-compatible Expo BackgroundTask/TaskManager dependencies and native
  configuration. A new native build is required; OTA JavaScript alone is not
  sufficient for these modules and permissions.

## Staging findings and preparation

Signed-in Brave dashboards showed:

- Render: one Production environment, one `fitzo` service, Singapore/free tier.
  Last successfully deployed commit: `61bf786f7d0bc5a0c1ca2e758130e93e3ef516db`.
- Supabase: the Fitzo project in the owning organization, with no separately
  identified Fitzo staging database. The New project page disabled creation
  because a member had reached the active free-project limit.

No resources were paused, deleted, upgraded, deployed, or repurposed. Production
data was not copied or used for synthetic write testing.

Prepared files:

- `backend/render.staging.yaml`: separate service, generated JWT secret,
  explicitly supplied database and CORS settings, health check, auto-deploy off.
- `backend/scripts/verify-staging.cjs`: read-only database-health, authentication,
  daily-health and 30-day-history checks. Requires `STAGING_API_URL` and
  `STAGING_TEST_TOKEN` for a synthetic account, supplied through the environment.
  It rejects the known production hostname and redirects.
- `mobile/eas.json` and `mobile/app.config.js`: development and preview builds
  require a separately supplied HTTPS API URL in their corresponding EAS
  environments. Missing URLs and the known production URL fail configuration.
  Production keeps its existing API URL. Local `.env.local` still points at
  production; it must be explicitly changed before authenticated local testing.

To complete staging:

1. Make a separate database available by resolving the Supabase free-project
   capacity limit or approving a paid project. Do not guess which existing
   project is disposable.
2. Verify the new database identity and initialize its empty schema using the
   guarded `backend/apply_migrations.js --bootstrap` runner. Its plan was checked
   with `--bootstrap --dry-run`; execution on a new database is still pending.
   See `MIGRATIONS.md`. No production data is needed for this bootstrap.
3. Deploy the staging blueprint from a reviewed source revision. Configure
   independent database/auth credentials and any integrations being tested.
4. Set `EXPO_PUBLIC_API_URL` to the actual staging API in EAS development and
   preview environments. Create synthetic accounts and run the read-only script,
   then authenticated import/retry/account-isolation write scenarios.
5. Build native internal apps and verify the device cases below.

## Verification

- Mobile: 23 suites, 227 tests pass.
- Backend: 38 suites, 374 tests pass.
- TypeScript passes; the final iOS, Android and web production exports complete.
  Targeted ESLint has zero errors and four native-module `require` style warnings.
- Build configuration rejects missing, production and insecure internal API URLs;
  it accepts a valid staging HTTPS API URL. `git diff --check` passes.
- Date/native-adapter tests also pass with `TZ=America/New_York`.
- Native introspection includes iOS `processing`, the Expo scheduler identifier,
  Android `READ_HEALTH_DATA_IN_BACKGROUND`, and preserves iOS build number 13.
- Browser check of the actual Settings component with synthetic native/network
  adapters at 320×640: enable, 30-day completion, background toggle, turn off,
  empty readings, and network error/retry availability. No horizontal overflow;
  action buttons measured 48px tall. Temporary fixtures were moved out of the
  application public/source directories after verification.
- No live staging checks were represented as passed. The prepared verification
  script has a syntax check; its authenticated remote checks remain unexecuted.

Artifacts: `output/health-review/`, `output/health-release-export.log`, and
`output/health-native-config.json` (local, ignored by Git).

## Remaining release checks

Physical iPhone and Android tests must compare imported metrics against device
health data, including partial/denied permissions, overnight sleep, late-arriving
readings, duplicates, account changes, off during import, locked-device behavior,
background permission denial, app suspension and relaunch. The OS controls when
background work runs; the configured interval is not an exact schedule. See
[Expo SDK 54 BackgroundTask](https://docs.expo.dev/versions/v54.0.0/sdk/background-task/).

This review covers the changed health flows and their interactions. It does not
certify every screen, native screen-reader behavior, or every previous audit
item. Manager features remain deferred. Offline write replay and the other
explicitly unfinished items in `FINAL_REVIEW_2026-09-14.md` remain open.
