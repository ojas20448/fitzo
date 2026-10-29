# Notifications and cardio OTA — October 26, 2026

Released source `9d5a59ff211af0466c7f32b01057fb82262ab0df` to the production
backend and existing Android/iOS OTA runtimes. Both updates reached 100% rollout.
No dependency change, native build or store submission was needed.

Notifications use compact dark cards, swipe dismissal, an independent close
button, and quiet feedback without stacked alerts. Cardio exercises use minutes
and optional effort from 1–10. Time and effort persist through workout storage,
history and routine updates; cardio is excluded from lifting volume and PRs.
Older cardio entries recorded as reps remain readable.

## Backend and database

Applied only `src/db/migrations/add_cardio_duration.sql` to production Supabase.
The additive migration adds nullable `set_logs.duration_seconds` with a positive
duration constraint capped at 86,400 seconds. It was applied with the existing
migration advisory lock and recorded in the application's migration ledger at
`2026-10-26T11:17:05.684753Z`. The normalized source checksum is
`4ff745667ab6314e66c5ae3f637dbe8111ecf48ff03d21baa82da393567e48fa`.

The backend was deployed before OTA publication. Internal and public checks
verified API/database health, authentication enforcement and the exact source
revision. Deployed-code smoke checks verified cardio log normalization, timed
routine validation and the duration column in the API's live database without
writing user records. Public health checks passed again after the rollout.
The proxy stayed running and production environment metadata was unchanged.

## OTA delivery

Published each platform at 10%, verified the downloaded Hermes bundle and all
219 asset hashes, then expanded to 100%. At **16:52 IST on October 26**,
production-channel requests returned the expected update IDs and bundle hashes.
The final channel verification timestamp was `2026-10-26T11:22:38.304Z`.

| Platform | Compatible runtime / build | Update ID | Group ID |
| --- | --- | --- | --- |
| Android | `74f8a38a9715cbcf5e8db7bf27d54ff5f3160d2f` / 33 | `01a177f1-63a2-7e01-b930-a2eb8953013b` | `ed9187b1-a7df-4c81-b107-f2a2db9762c8` |
| iOS | `9959efa4e5cc27c52444c51132f57715f133974b` / 30 | `01a177f1-ea1a-7526-9a28-b56b90ac8c53` | `1d546c1f-2511-4864-a975-ef12da7e175b` |

- Android bundle SHA-256: `39e278ff900af653f185fcb8f9d6ef50f4622c8791969fa12930a1b1db677dd7`
- iOS bundle SHA-256: `435e24704873ddc4204d6d5903f83cfe572c3ba9b9785c310580fe02499c76af`

All 18 changed mobile source modules matched the exported source maps.
Production-profile public values were used with dotenv loading disabled.
Android fingerprint calculation used the original iOS build-number metadata of
29, matching build 33; iOS used build-number metadata 30. The original app.json
was restored. Unrelated local environment and tooling edits were excluded.

## Validation and recovery

All 86 mobile suites / 706 tests and 64 backend suites / 547 tests passed.
TypeScript, scoped ESLint (zero errors), whitespace checks and Android/iOS/web
exports passed. Delivery is verified for compatible OTA-enabled binaries;
installation and behavior on a physical phone remain unverified.

The prior backend image remains available as
`fitzo-api:40641a798f3abb6ccfb50ac9288bef4fbb693a7e`. Prior OTA groups are
`6beb85b9-c793-45f5-8720-a344ecbe2784` for Android and
`5526f40a-faa0-43ef-bd66-1730cedd738b` for iOS. The nullable duration column can
remain if the application is rolled back.
