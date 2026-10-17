# Oracle migration and hosting hotfix

## Backend verified

The Node/Express API is live at <https://api.fitzoapp.in/api/health> on the
Always Free `fitzo-api-prod` E2 micro in Mumbai: Ubuntu 24.04 AMD64, 1 GB RAM,
47 GB boot disk, public IPv4 `130.210.3.149`. No paid account upgrade or extra
block volume was used. A 1 GB swap file uses the existing disk.

The running application is pinned to `f721d4092e97ad66300558a667bd38fe942ebe6a`.
Docker built the production image, and Caddy validated and obtained public TLS.
Localhost, container-to-public-HTTPS, and external-workstation acceptance checks
all passed: healthy API/database, expected revision, protected routes reject
unauthenticated requests. Database TLS encryption and certificate verification
were confirmed. The certificate expires 2027-01-15 and renews through Caddy.

Idle memory was about 64 MiB for the API and 13 MiB for Caddy, with about 447 MiB
available on the host. Three synthetic bcrypt checks took 208–216 ms. This is a
smoke check, not evidence of capacity for a particular number of active users.
The E2 micro has a 1/8 OCPU baseline; free instances can be reclaimed when idle.

Production Supabase, the exact Render JWT signing key, OAuth settings, and
integration keys were preserved. Private configuration is outside Git and the
image, transferred over SSH, verified byte for byte, and mode 600 on the VM.
No schema, seed, or application-data changes were used for verification.

Only an explicit DNS-only API A record was added; all eleven other Cloudflare
records were retained. The website still returns HTTP 200. SSH is restricted to
the administrator's current IP; public web ports are 80/443. The API binds only
to localhost port 3001. Docker and firewall persistence are enabled at boot.

[Migration PR #2](https://github.com/ojas20448/fitzo/pull/2) passed backend/mobile
CI and merged. The wiring audit now recognizes nested routers and resolves all
159 mobile API calls against 183 routes. The repository API origin and dedicated
cron secret match the new server. The
[uptime verification run](https://github.com/ojas20448/fitzo/actions/runs/39049881261)
completed successfully. Cron authentication was verified on a nonexistent path,
without running batches or sending notifications.

## App hotfix

The user selected a hosting-only hotfix from the latest built 1.4.1 release,
source `0e7797922adc8edbc64129b9dcb3bd44e5df649f`. Version 1.4.2 retains that
release's changes, updates the three EAS API URLs and runtime fallback, and uses
fresh native build numbers. TypeScript and the resolved production profile passed.
The Expo account was verified as Free with 7 of 30 builds used before these jobs.

- [Android 1.4.2 / 29](https://expo.dev/accounts/fiskerr/projects/fitzo/builds/eacba6f0-ed7c-4484-94cb-b642bd6981be)
- [iOS 1.4.2 / 26](https://expo.dev/accounts/fiskerr/projects/fitzo/builds/af55dd5c-8398-4702-bfa7-e2157904496a)

Both jobs were queued using the existing remote signing credentials. They have
not been submitted to stores. Store release and one existing-account acceptance
flow remain necessary before calling the end-user cutover complete. Keep the
existing app IDs and signing credentials. Suggested release note: “Restored app
connectivity and improved reliability.”

Installed apps still use Render and have no configured OTA update channel.
Users need a normal store update; they keep their accounts and data. Valid
sessions should remain usable; expired or revoked sessions can require login.
The stable API domain makes future server moves independent of app releases.

The primary workspace's unfinished app changes were excluded from this hotfix.
Its API configuration was updated while its other edits were preserved. Before
building that separate feature release, reconcile the new release commit and
advance its app/build numbers; its local 1.4.1 / 25 / 28 configuration is stale.

## Existing integration issue

Gemini's configured `gemini-3.1-flash-lite` model returned HTTP 200 and supports
content generation; API fallback is enabled. No generation request was made.
FatSecret token authentication returns HTTP 400 `invalid_client` using both the
original Render export on the PC and the same settings on Oracle. Its production
credentials need correction. This is separate from the hosting change.

Real-account login, OAuth, email, AI generation, and uploads still need an
authorized test-account acceptance run. No real user was impersonated and no
test emails or push notifications were sent.
