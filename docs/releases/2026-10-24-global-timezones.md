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
- TypeScript and whitespace checks are required before rollout.
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

Prepared for the existing production deployment and production OTA channel.
Record the tested source revision, migration ledger result, exact deployed
revision, update identifiers and scoped historical correction after execution.
Physical-device acceptance has not been performed.
