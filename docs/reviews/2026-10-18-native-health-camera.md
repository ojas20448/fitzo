# Native Health sync and food camera follow-up

The user reported Apple Health sync without an error message and failed food
camera analysis in TestFlight 1.4.2 / 26. Voice logging subsequently worked.
They asked for independent checks rather than further questions.

## Evidence and limits

- The actual signed 1.4.2 / 26 IPA has camera and Health privacy descriptions,
  signed HealthKit and background-delivery entitlements, and matching provisioning
  capability. This establishes configuration, not device read authorization.
- A disposable account passed five production checks: registration, Health upload
  with the current India date, partial update preserving omitted readings,
  readback, and removal of only the test account and its synthetic readings.
- Current food-photo analysis accepted a 394,671-byte public JPEG with a data-URI
  prefix, returned HTTP 200 in about 2.2 seconds, and recognized four food items.
  No private user photo or real Health readings were accessed for this test.
- No matching recent server errors were found. These observations do not identify
  the exact cause of the user's phone failure or establish native hardware success.

## App defects reproduced and fixed

The scanner set its preview before image processing and base64 preparation
finished. Analyze Photo was then available with no uploadable image. Processing
failure left that preview in place, and analysis silently returned. The updated
screen waits for prepared image data before showing the preview, blocks duplicate
captures while preparing, and restores a usable camera after preparation failure.
Existing API-error retries retain the prepared image.

Health Report discarded manual sync results. A successful check with no readable
data, a partial read failure, and a successful import all finished without explicit
completion feedback. The screen now reports those distinct outcomes, with read
access guidance when data is empty or unreadable. Settings provide the same
guidance for an empty import. Apple Health read permissions remain controlled by
the phone; no permission, quota, or data-sharing requirement was bypassed.

Five screen test failures reproduced before the fixes. All 46 mobile suites /
356 tests, TypeScript, and GitHub mobile CI pass afterward. Lint has no errors;
existing repository warnings remain. Voice logging and backend code were retained.

## Candidate build

The isolated release tree excludes the primary workspace's unfinished app changes.
EAS queued [iOS 1.4.2 / 27](https://expo.dev/accounts/fiskerr/projects/fitzo/builds/91810f8b-783b-40b3-abcb-4a5b131c67d2)
from tested application source `221b4888909cacdc6383b219f4f78a7bb53bbe1d`, using
the existing signing credentials and frozen credential configuration. EAS's normal
local auto-increment advanced only the iOS build number from 26 to 27.

The signed build finished successfully. Its IPA is 26,195,105 bytes, SHA-256
`8fa0c125bbf5b716d609972e305c93531972de2204299921e480c338c133d06f`.
Artifact checks confirmed version 1.4.2 / 27, the existing app identifier,
camera/Health descriptions, the production API URL, absence of the old Render API
URL, and compiled photo-retry/progress and Health-result messages. The actual
signed HealthKit and background-delivery entitlements were also retained.

The [TestFlight upload](https://expo.dev/accounts/fiskerr/projects/fitzo/submissions/3828170d-9f6c-44e9-bb6a-34176bdd8a10)
finished successfully with no EAS submission error. App Store Connect initially
showed build 27 Processing, then completed processing and automatically assigned
it to the existing internal group. Final group readback confirmed **1.4.2 (27) —
Testing**, available to the existing tester. The tester's previously installed
version was confirmed as build 26; no tester was added and no new audience was
created.

The public 1.4.2 submission remained Waiting for Review, and this upload did not
replace its selected build. The currently installed build 26 cannot receive these
UI fixes over the air. Update to the now-available build 27 through TestFlight to
exercise the camera and Health sync feedback on the actual phone. This check did
not establish physical-camera or real HealthKit read success.
