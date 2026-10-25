# Spacing, 90-minute sessions and Spotter formatting — October 25, 2026

Released source `40641a798f3abb6ccfb50ac9288bef4fbb693a7e` to the production API
and Android/iOS OTA runtimes. Both updates reached 100% rollout. No database
migration, dependency addition, native build or store submission was needed.

- The profile calendar uses seven equal columns with vertical spacing, keeping
  Sunday on the same row as the rest of the week.
- Health Report headings use the existing section-header spacing above cards.
- Session choices include 90 minutes in setup and training preferences. Draft
  restoration, saved-plan validation and both backend validators accept it.
  The existing bounded starter exercises remain editable in the logger.
- Spotter renders headings, emphasis and lists using the installed Markdown
  renderer. Remote images are disabled and links allow HTTP/HTTPS schemes.

## Validation

All 84 mobile suites / 671 tests and 63 backend suites / 539 tests passed. The
isolated PostgreSQL-compatible training storage suite passed all six tests,
including saving and reloading a 90-minute preference with its matching plan.
The nine Health Report tests passed again after the final spacing adjustment.
TypeScript and scoped ESLint passed; the existing typing-dots hook dependency
warning remains unchanged.

Android and iOS Hermes exports compiled. All seven changed mobile source modules
matched their exported source maps. Exports used the production-profile public
values with dotenv loading disabled. The original app.json was restored after
fingerprint checks and publication; no native configuration changed in Git.

## Live deployment

Internal and public checks confirmed healthy API/database services,
authentication enforcement and the exact source revision. The production
environment file retained its mode, size and modification time, and the proxy
stayed running.

Both OTA updates were published at 10%, verified, then expanded to 100%.
Production-channel verification completed at **17:07 IST on October 25**
(`2026-10-25T11:37:56.545Z`). Each platform served its expected update ID and
runtime. All 219 asset hashes per platform matched the local exports, and
downloaded bundles matched by SHA-256.

| Platform | Compatible runtime / build | Update ID | Group ID |
| --- | --- | --- | --- |
| Android | `74f8a38a9715cbcf5e8db7bf27d54ff5f3160d2f` / 33 | `01a172d9-0ad4-7a66-b783-531743090ac3` | `6beb85b9-c793-45f5-8720-a344ecbe2784` |
| iOS | `9959efa4e5cc27c52444c51132f57715f133974b` / 30 | `01a172d9-a730-7d91-911b-f6ff8bd5c603` | `5526f40a-faa0-43ef-bd66-1730cedd738b` |

- Android bundle SHA-256: `ca407d9aae2b1cb20c4b97730a4210b37f2a3d6d2c976fa26d6e1396bb2357b0`
- iOS bundle SHA-256: `05fdbcd95c2462de4614f6d2922526ab43525b3b9186b2f7cbde93723fde0e0a`

The previous API image remains available:
`fitzo-api:54787bb4f01614dde532cf28ffc61d7d30d91fff`. Previous OTA groups are
`fc432fe1-ebc0-4a14-96ad-d82715cfcc01` for Android and
`a80ac888-ef85-4776-baf0-525f0f949a24` for iOS.

Delivery is verified for compatible OTA-enabled binaries. Native layout and
installation on a physical phone remain unverified.
