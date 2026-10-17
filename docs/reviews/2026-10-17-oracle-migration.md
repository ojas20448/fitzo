# Oracle migration and hosting hotfix

## Backend verified

The Node/Express API is live at <https://api.fitzoapp.in/api/health> on the
Always Free `fitzo-api-prod` E2 micro in Mumbai: Ubuntu 24.04 AMD64, 1 GB RAM,
47 GB boot disk, public IPv4 `130.210.3.149`. No paid account upgrade or extra
block volume was used. A 1 GB swap file uses the existing disk.

The initial migration ran `f721d4092e97ad66300558a667bd38fe942ebe6a`; after the
live acceptance fixes below, the API now runs
`caba87b2f556a32b992fc36abddcb7988ea3b454`.
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
All 45 mobile suites / 349 tests passed locally and CI passed type checking,
lint, tests, wiring audit, and web export. CI runs the tests serially to avoid
repeatable five-second timeouts caused by parallel workers; assertions and their
timeouts were retained. [Hotfix PR #3](https://github.com/ojas20448/fitzo/pull/3)
merged after its checks passed.
The Expo account was verified as Free with 7 of 30 builds used before these jobs.

- [Android 1.4.2 / 29](https://expo.dev/accounts/fiskerr/projects/fitzo/builds/eacba6f0-ed7c-4484-94cb-b642bd6981be)
- [iOS 1.4.2 / 26](https://expo.dev/accounts/fiskerr/projects/fitzo/builds/af55dd5c-8398-4702-bfa7-e2157904496a)

Both signed builds finished using the existing remote signing credentials. The
IPA identifies version 1.4.2 / 26 and `in.fitzoapp.fitzo`; the AAB identifies
version 1.4.2 and `com.fitzo.app`, with build 29 confirmed by EAS. Both compiled
JavaScript bundles contain the new API URL and omit the old Render API URL.
Android JAR signature verification passed. Private local artifact copies and
verification receipts are retained outside Git.

Both store uploads finished successfully after the user's approval:

- [Android submission](https://expo.dev/accounts/fiskerr/projects/fitzo/submissions/289523c7-5cc8-4985-b39c-832b95a4ba68)
- [iOS submission](https://expo.dev/accounts/fiskerr/projects/fitzo/submissions/cf397730-096b-461f-b471-e694eb12bc82)

The user subsequently requested Android at 100%. Direct Android Publisher API
readback on 2026-10-17 confirmed production release 1.4.2 / 29 has status
`completed`, with no `userFraction` (full rollout). It was already in this state
when checked, so no duplicate upload or track mutation was necessary. The EAS
submission profile now retains full rollout for future Android submissions.
The separate publication-state API reports build 29 `IN_REVIEW`; build 28 / 1.4.1
remains `PUBLISHED`. Full rollout configuration does not mean review has finished
or that users have installed the update.

iOS 1.4.2 / 26 was uploaded to App Store Connect/TestFlight, and the user then
submitted the public App Store update. Direct App Store Connect inspection
confirmed 1.4.2 is **Waiting for Review**, with build 26 selected, the required
release notes saved, **Automatically release this version** selected, and
**Release update to all users immediately** selected. Version 1.4.1 remains
Ready for Distribution. No additional manual release action is currently needed
if Apple approves the submission without issues.

Direct Google Play Publishing overview inspection confirmed **Changes in review**
contains **1.4.2 — Start full rollout** and **Managed publishing off**. The update
is set to publish automatically after approval, within the existing 12-country
availability. No extra upload or manual publish action is currently needed.

Installed apps still use Render and have no configured OTA update channel.
Users need a normal store update; they keep their accounts and data. Valid
sessions should remain usable; expired or revoked sessions can require login.
The stable API domain makes future server moves independent of app releases.

Outage check on 2026-10-17 at 17:55 UTC: the installed-app origin
`https://fitzo.onrender.com/api/health` returns HTTP 503 / “Service Suspended.”
The replacement API returns HTTP 200 with database and API healthy, and the
website returns HTTP 200. Existing binaries cannot be remotely pointed at the new
server or given a maintenance screen because they have no OTA update channel.
Restoring the old provider-owned URL requires Render to lift the suspension;
DNS for `fitzoapp.in` cannot change it. No paid Render upgrade was authorized.

The primary workspace's unfinished app changes were excluded from this hotfix.
Its API configuration was updated while its other edits were preserved. Before
building that separate feature release, reconcile the new release commit and
advance its app/build numbers; its local 1.4.1 / 25 / 28 configuration is stale.

## Existing integration issue

Gemini's configured `gemini-3.1-flash-lite` model returned HTTP 200 and supports
content generation; API fallback is enabled. Groq's configured `whisper-large-v3`
model was available with HTTP 200, and USDA food search returned HTTP 200 and a
food result from the VM. No AI generation or transcription request was made.
FatSecret token authentication returns HTTP 400 `invalid_client` using both the
original Render export on the PC and the same settings on Oracle. Its production
credentials need correction. This is separate from the hosting change.

## Live feature acceptance

The designated store-review account successfully signed in against the new API.
Authenticated checks covered home, workout history/splits/sessions, exercise
search, food logs/history, nutrition totals/profile/week, Indian/global food
search, recipes, measurements, PRs/volume, readiness/health, lessons, classes,
settings, notifications configuration, and AI context/history/quota. An initial
training-preferences 404 came from the test's incorrect URL; the application uses
the nested `/api/workout-sessions/training-preferences` route.

An isolated synthetic account successfully registered, signed in, saved/read a
private **Chest + Back** workout intent, saved a completed workout with structured
sets/history, logged/deleted private food, reflected nutrition totals, analyzed
food text, extracted a workout from text, and received an AI coach answer. Only
test-created data was removed; deleting the disposable account invalidated its
token. No real user was impersonated, and no test emails or push notifications
were sent. The review account's temporary intent was cleared after verification.

The app's production-source web export reached the login screen in the browser.
This does not establish native iOS/Android behavior. The user had not yet installed
TestFlight 1.4.2 / 26 when reporting “Failed to set intent.” The new API accepted
both short and longer day labels, with no corresponding intent errors in server
logs; the older installed binary still targets suspended Render.

Acceptance exposed two existing server issues: usernames generated from long
email local parts exceeded `VARCHAR(30)`, and a rate-limited ExerciseDB catalog
returned 500. The follow-up bounds generated usernames including collision
suffixes, and uses the existing database exercise catalog for paginated browsing
and detail lookup when the upstream is unavailable. No database migration is
required. Six real-SQL regression cases reproduced four failures before the fix
and passed afterward; the full backend suite passed 53 suites / 486 Jest tests.
The [acceptance fixes PR #4](https://github.com/ojas20448/fitzo/pull/4) passed
GitHub checks and merged. Its tested revision
`caba87b2f556a32b992fc36abddcb7988ea3b454` was built on the VM and deployed without
changing production credentials or the database schema. The previous tested
image is retained for rollback. Container and public-HTTPS checks confirm the
new revision, healthy API/database, enforced authentication, and zero restarts.
API memory after the AI/media tests was 145.6 MiB of the 512 MiB limit.

The final authenticated API pass completed **41/41 checks** successfully. The
post-deployment synthetic-account run verified the long-email signup fix, catalog
browsing/detail fallback, correct training-preferences route, private workout
intent/log/structured sets/history, food/nutrition updates, and AI text/coach flows.
The disposable account and its test records were removed, and its token then
returned 401. No store-review credentials or existing user records were changed.

Voice transcription of synthetic speech passed through Groq. Food-photo analysis
of Google's public scones sample returned four food items and aggregate nutrition
totals. The initial rapid test burst hit the expected three-per-minute AI limit;
media checks passed separately without changing any quota. The photo check was
corrected to validate the endpoint's actual `items` / `total` response, rather
than the single `food` field used by text analysis.

Final store-console readback still showed Apple **Waiting for Review** with
automatic release to all users, and Google **Changes in review — Start full
rollout**, with managed publishing off. Publication remains pending review.

Native camera, microphone permissions, Apple Health, OAuth account selection,
push delivery, and real-device startup still require phone acceptance. Provider
configuration and backend checks do not establish those device flows.
