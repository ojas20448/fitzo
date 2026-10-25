# Diary and exercise settings OTA — October 25, 2026

Released source `54787bb4f01614dde532cf28ffc61d7d30d91fff` to the production
backend and existing Android/iOS OTA runtimes. Both updates reached 100% rollout.
No native build or store submission was needed.

This release adds moving saved food to another date, save confirmations with the
actual date/meal and View diary, a calendar on the diary date, food-log refresh
when returning from recipes, and private exercise notes with individual rest
times. The earlier selected-date logging fix is included.

## Database and backend

Applied only `data/migrations/026_exercise_preferences.sql` using the existing
migration runner, its advisory lock and a transaction. The recorded SHA-256 is
`3888d636bfda185935b1844234265234ff27ad7ed3a5a3b111434a3d3c4b8f13`.
It was recorded at `2026-10-25T01:05:08.234Z`. Production checks confirmed all four
columns, the account/exercise primary key, cascading account deletion, three
validation constraints, row-level security and zero public policies. No existing
food entries were moved automatically.

The API was updated before OTA publication. Internal and public read-only checks
confirmed healthy API/database services, authentication enforcement and the exact
source revision. Public checks passed again after the OTA rollout. The proxy
stayed running. The production environment file retained mode 600, size 1,351
bytes and its original modification time.

The previous backend image remains available for rollback:
`fitzo-api:c44acf7a0df188b2f1f22b2c89d2be0ddd419076`. The new table is additive and
can remain if the API or mobile update is rolled back.

## OTA delivery

Updates were published at 10%. Before expanding to 100%, protocol requests to
each update permalink verified the runtime, bundle SHA-256 and all 219 asset
hashes per platform. At **06:40 IST on October 25**, production-channel requests
returned both expected update IDs and downloaded bundles matched the same hashes.

| Platform | Compatible runtime / build | Update ID | Group ID |
| --- | --- | --- | --- |
| Android | `74f8a38a9715cbcf5e8db7bf27d54ff5f3160d2f` / 33 | `01a1709a-8b40-7202-b0b9-4b501c444aa4` | `fc432fe1-ebc0-4a14-96ad-d82715cfcc01` |
| iOS | `9959efa4e5cc27c52444c51132f57715f133974b` / 30 | `01a1709b-2cb9-78b8-9fbb-c93c5cb86f6f` | `a80ac888-ef85-4776-baf0-525f0f949a24` |

Bundle SHA-256:

- Android: `4af0340f31d18d38caaba4d003c80c7cebc1ca307c4343350ef4e5a57ea118bf`
- iOS: `7efedda384908feb9f3221563d6e1676f6971bbc108569e58f5360ed9eb368db`

All 12 changed mobile source modules matched the exported source maps exactly.
Exports contain the production API URL and exclude the temporary review route.
Production-profile public values were used with dotenv loading disabled.
Unrelated local environment and tooling edits were excluded from the commit.

Android fingerprint calculation used its original iOS build-number metadata of
29, matching the existing build 33. iOS used build-number metadata 30. The
original app.json was restored; the fingerprint policy and native build numbers
were not changed in Git.

For OTA recovery, the preceding Android group is
`a1ba8e5c-5a4d-44e3-ae90-acc64a2f24d3`; the preceding iOS group is
`07b59416-516a-4dba-9aab-a74ea9e91748`.

## Validation and limits

The full mobile suite passed 84 suites / 666 tests, and the full backend suite
passed 63 suites / 538 tests. Affected tests passed again after final edits.
TypeScript, scoped ESLint, whitespace checks and Android/iOS Hermes exports
passed. See the implementation review for coverage and the blocked preview.

These updates require compatible OTA-enabled binaries. Older installations need
the existing store update. Delivery is verified; installation and behavior on a
physical phone have not been verified.
