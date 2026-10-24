# Selected food diary date OTA — October 25, 2026

Released source `c44acf7a0df188b2f1f22b2c89d2be0ddd419076` to the production
backend and existing Android/iOS OTA runtimes. No native build or store submission
was created.

Adding food from a historical diary now preserves the selected date across
search, repeat/quick add, voice review, camera results, meal ideas and saved
recipes. Returning to the diary retains that date. Backdated single-food saves
do not alter today's optimistic totals or trigger today's goal celebration.

All three food-write endpoints accept a validated optional `logged_date` and
retain the member's current day when omitted. Invalid explicit dates return a
validation error. New records retain their original timezone during travel.

## Verification

- All 81 mobile suites / 651 tests passed, including the selected-Friday
  regression, camera/voice/preset routing and today's pending-save totals.
- All 62 backend suites / 536 tests passed. Isolated PostgreSQL-compatible tests
  verify single, bulk and recipe writes land on Friday, today's totals stay zero,
  travel preserves the selected date, and invalid dates cannot create entries.
- TypeScript, scoped lint and whitespace checks passed.
- Both native exports contain the reviewed changes. Their fingerprints match
  the compatible store binaries, and all 219 referenced asset hashes match the
  published manifests on each platform.

## Backend

The existing Oracle API was deployed before publishing OTA updates. Internal
and public read-only deployment checks confirmed healthy API/database services,
authentication enforcement and the exact tested revision. The proxy stayed
running; the production environment file retained mode 600, its size and its
original modification time. No migration or application data repair was run.

The prior `fitzo-api:6d7e74910286a44c027e5dbfd88512fca934c3c4` image is retained
for recovery.

## OTA delivery

Both updates were published at 10%, verified, then expanded to 100%. At
**02:36 IST on October 25**, production-channel protocol requests returned the
expected update IDs. Downloaded Hermes bundles matched the local exports by
SHA-256, and every manifest asset hash matched its local artifact.

| Platform | Compatible runtime / build | Update ID | Group ID |
| --- | --- | --- | --- |
| Android | `74f8a38a9715cbcf5e8db7bf27d54ff5f3160d2f` / 33 | `01a16fb9-f182-7ebc-8211-618011230732` | `a1ba8e5c-5a4d-44e3-ae90-acc64a2f24d3` |
| iOS | `9959efa4e5cc27c52444c51132f57715f133974b` / 30 | `01a16fba-99aa-7379-aa0e-30a3dc5a138a` | `07b59416-516a-4dba-9aab-a74ea9e91748` |

Android used its original iOS build-number metadata of 29 when calculating its
fingerprint, as documented in the previous releases. The original app.json was
restored after export and publication. Its fingerprint policy and native build
numbers remain unchanged. Exports used the production profile's public values
with dotenv loading disabled; unrelated local configuration changes were not
included in the source commit.

For OTA recovery, the preceding Android group is
`1bf59b53-e9c9-4779-915d-12acfc44b88e`; the preceding iOS group is
`150523b5-132f-44ab-8ebf-50c2a3d1800e`.

These updates require the compatible OTA-enabled binaries. Older installations
need the existing store update first. Delivery is verified; installation and
physical-device behavior on the user's phone have not been verified.
