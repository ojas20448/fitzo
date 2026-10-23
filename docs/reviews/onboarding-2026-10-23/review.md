# Signup and onboarding refinement — 23 October 2026

This pass preserves Fitzo’s Lexend typography, dark surfaces, white actions and existing outline icon family. No dependencies were added.

## Changes

- Signup starts with name and email. The optional gym code expands on request; avatar selection stays available in Profile.
- Two labelled steps replace unexplained progress dots. A compact brand header, 56px fields, clear focus borders and wrapping content match the updated login screen.
- The password step reviews the entered identity and gym code with an Edit action. Returning to details preserves the password and other answers.
- Password requirements update while typing. A labelled visibility button applies to both password fields; keyboard Next/Done actions and autofill hints support the form.
- Errors remain beside the relevant fields. Server failures preserve answers and allow retry; a synchronous submission guard prevents repeated account creation while a request is pending. Email validation and submission both trim surrounding spaces.
- Hardware Back returns from password to details, and a direct signup visit can return to login. Navigation and fields are locked while account creation is pending.
- Onboarding session length is a direct three-option choice. Experience and equipment retain their descriptions after selection, and narrow layouts use two balanced rows of training days.
- Routine validation identifies the specific missing answer. The plan review now shows the chosen goal with Edit, preserving routine and optional food answers.
- Training stays the default three-screen path. Food targets remain optional, and skipping them does not submit a nutrition profile. Metric/imperial height conversion remains intact.

## Verification

- Jest: **67 suites / 509 tests passed**. Added registration tests cover validation, normalization, optional gym membership, editing without data loss, server retry, password visibility, keyboard submission and duplicate submission protection. Onboarding tests cover revising a goal and precise missing-answer errors.
- TypeScript and scoped ESLint passed.
- Web, iOS and Android JavaScript exports passed. These are bundle checks, not native device builds.
- An isolated Chromium context completed signup with an intercepted failure and retry, selected a routine, revised a goal, checked the 182.5cm unit round trip, skipped food targets and reached Workout.
- **24 layout captures** cover 320, 390, 430 and 844px widths across signup and onboarding. No horizontal page overflow was found.
- All API writes were intercepted: two synthetic registration attempts, one split save and one training-preference save. Credentials in the result file are redacted. No real account or plan was created.
- The browser harness blocks third-party requests. Its recorded jsQR worker import error comes from that block; no additional application page errors were recorded.

## Captures

- [Signup details](./signup-details-390.png)
- [Password setup at 320px](./signup-password-320.png)
- [Recoverable registration error](./signup-retry-390.png)
- [Routine choices](./onboarding-routine-390.png)
- [Narrow routine choices](./onboarding-routine-320.png)
- [Plan review](./onboarding-plan-390.png)
- [Browser results](./browser-results.json)

Native keyboard behavior, password-manager behavior, larger accessibility font sizes and screen readers still need device verification. The browser harness lives at `C:/Users/PC/AppData/Local/Temp/fitzo-onboarding-review.cjs`; Metro is running at `http://localhost:8081`.

## Default profile picture follow-up

Replaced the shared question-mark/initials fallback with a neutral gray person silhouette on a circular dark surface. Selected preset images and photo URLs continue to use the existing image overlay. The picker now calls the fallback “Default profile picture”.

Six avatar regression cases and the existing signup/profile cases passed: **3 suites / 14 tests**. TypeScript and scoped lint passed. An isolated browser check confirmed the default picture on Profile at 320px and 390px, with no question mark, horizontal overflow or API writes. [Profile capture](./default-profile-390.png). Native visual verification remains outstanding.
