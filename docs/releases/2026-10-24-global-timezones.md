# Global timezone follow-up — October 24, 2026

Extends the nutrition timezone release to workout saves and summaries, check-ins,
streaks, Home progress, buddy activity, trainer views, health/readiness defaults,
weight summaries, weekly progress, daily insights and recaps. New activity stores
its origin timezone. Repeating a completed session preserves its original finish
and does not create another training day.

Gym classes, attendance dashboards, busy-hour buckets and quiet-hour decisions
use the physical gym's timezone. Mobile class times and busy-hour day selection
use that same zone. Personal charts retain calendar dates without converting
them through UTC, and Home rejects a previous day's offline cache.

## Validation

- Backend: 62 suites, 536 tests passed, including real PostgreSQL-compatible
  storage tests for both London DST transitions, travel, local month/week
  boundaries, duplicate check-ins, completion retries and privacy.
- Mobile: 81 suites, 639 tests passed; calendar chart tests also passed with the
  process timezone set to `America/New_York`.
- TypeScript and whitespace checks passed before rollout.
- Migration 025 was applied twice in isolated storage to verify idempotence.

## OTA compatibility

No native dependencies or app configuration were changed. The iOS runtime remains
`9959efa4e5cc27c52444c51132f57715f133974b` (build 30). Android's runtime remains
`74f8a38a9715cbcf5e8db7bf27d54ff5f3160d2f` (build 33).

Android was built before iOS's build number incremented from 29 to 30. Expo's
Android fingerprint includes that iOS metadata: comparison showed it was the
only differing input. Generating the Android update with iOS metadata 29 exactly
matches its packaged fingerprint; the original app.json must be restored before
generating the iOS update. Publish each platform separately and verify both
runtime hashes. Do not change the fingerprint policy or persist a manual runtime
override. Existing binaries without OTA support still require a store update.

## Rollout

The tested source revision is
`6d7e74910286a44c027e5dbfd88512fca934c3c4`, pushed to
`codex/release-1.5.0` and deployed to the existing Oracle API on October 24.
Migration 025 is recorded in `fitzo_schema_migrations`; all five added columns
were verified in production. Both internal and public deployment checks passed
for the exact revision, database health and authentication enforcement. All 14
authenticated reads passed using the designated App Review identity, including
Home, workouts, attendance, friends,
health/readiness, progress, classes and gym busy times. No AI generation or
notification was requested by these checks.

The reported London account's five confirmed meals (1,528 kcal) were corrected
from October 23 to October 22 and pinned to `Europe/London`. The guarded
transaction verified every entry and total before updating; the original values
were backed up privately. The account's current timezone was verified unchanged.
Other historical records were not rewritten.

The active `production` channel still points to the `production` branch. Both
updates use the tested source revision and were published at full availability:

| Platform | Update ID | Group ID |
| --- | --- | --- |
| Android | `01a16d93-e6ca-7962-9792-7207f5f736e9` | `22f9c436-14b7-4492-89fe-b767373cf0f8` |
| iOS | `01a16d95-4644-72e0-81d6-087aaa7729f2` | `92c3943b-0a3d-4f4d-8484-d8955b2d9eca` |

Production protocol requests with each platform, runtime and channel returned
HTTP 200 and the expected update IDs. Each launch bundle's SHA-256 matched the
locally verified Hermes export; all 219 referenced assets exist. The exports
contain the production API URL and timezone changes, with no old Render API URL.
The Android and iOS hashes remain those listed above. app.json was restored and
has no persistent changes. No additional native build was created.

For application recovery, the previous `fitzo-api:92f3df19a9b9df96f601fc33a2b4975ad520297d`
image is retained; migration 025 is additive and compatible with it. EAS can roll
each runtime back to its embedded store bundle. The production environment file
retains mode 600 and its original October 17 modification time; the proxy and
certificate storage were preserved.

OTA reaches the matching OTA-enabled store builds (Android 33 / iOS 30). Older
installs require that store update first. Physical-device acceptance has not
been performed; published and served updates do not prove installation on a
particular phone.
