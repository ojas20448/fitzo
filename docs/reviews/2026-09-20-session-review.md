# Fitzo session review — 20 September 2026

Follow-up: local corrections and their validation are recorded in [2026-09-20-fixes.md](C:/Users/PC/Documents/Code/Fitzo/docs/reviews/2026-09-20-fixes.md). The findings below describe the original reviewed commits.

Verdict: changes need correction before they can be considered complete. Passing unit tests did not cover several broken integration paths. This was a review; no application code, production data, or deployment was changed.

Reviewed main-repository commits `be1a3d3`, `bfe4fc2`, `726c343`, and `fd6b4bb`, plus website commit `ff0ee1a` in `C:/Users/PC/Documents/Code/Fitzo web/fitzo`.

## Verification results

| Check | Result |
| --- | --- |
| Backend Jest, all suites | 40 suites / 399 tests passed |
| Mobile Jest, all suites | 24 suites / 234 tests passed |
| Mobile TypeScript | Passed |
| Website TypeScript | Passed |
| Targeted mobile ESLint | Failed: conditional hook in ShareComposerScreen |
| Website production build | Failed: JSX lint errors in the new buddy page |
| Public buddy URL, with and without test invite parameters | HTTP 404 |
| Public Android association file, both configured hosts | HTTP 404 |
| Public Apple association file on www host | HTTP 404 |

Backend is JavaScript; there is no backend TypeScript-check script. Unit tests use mocked services/database paths and do not establish production database correctness or native gesture performance. No physical iPhone/Android interaction was performed.

## Findings requiring fixes

### 1. P1 — Share composer introduces a hook-order error

[ShareComposerScreen.tsx:300](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/ShareComposerScreen.tsx:300)

The new `useMemo` runs after early returns at lines 158 and 222. `theme` starts as null, so the first render skips this hook; the effect sets the theme and the next render calls an additional hook. Opening/closing the camera also changes whether it runs. This violates React's hook order and can break the composer before photo gestures can be used. Targeted ESLint independently reports this exact error.

Move the memo above every early return, or use a plain context-value object without introducing a conditional hook. Regression coverage should include entering the composer and opening/closing its camera. [React hook rules](https://react.dev/reference/rules/rules-of-hooks) explicitly require hooks before early returns.

### 2. P1 — Website production build fails on the new invite page

[page.tsx:79](<C:/Users/PC/Documents/Code/Fitzo web/fitzo/app/buddy/page.tsx:79>)

The raw quotation marks around Open in Fitzo App fail `react/no-unescaped-entities` during `next build`. Compilation succeeds initially, then the production build exits with code 1 during linting. The earlier TypeScript result is therefore insufficient to call this deployable. Escape the JSX text and rerun the production build.

### 3. P1 — Default protein still contradicts the requested reduction

[nutritionTargets.js:40](C:/Users/PC/Documents/Code/Fitzo/backend/src/utils/nutritionTargets.js:40) and [mobile calculator](C:/Users/PC/Documents/Code/Fitzo/mobile/src/utils/nutritionTargets.ts:61)

Both calculators use the larger of `weight × 1.6` and `30% of calories ÷ 4`. Thus 1.6 g/kg is only a minimum, not the requested weight-based default. Executing the current function for 70 kg and 2,800 kcal returns **210 g protein, 315 g carbs, 78 g fat**. Neither the earlier 112 g weight-based example nor the reported approximately 170 g personal target is the default result.

The tests explicitly expect 210 g, so they pass while preserving the original complaint. Fitness Profile also tells users that saving uses 1.6 g/kg, which does not accurately describe this formula. Implement the agreed default separately from personal overrides and test the actual requirement. Do not turn one person's 170 g preference into a universal target.

### 4. P1 — Custom macros bypass final calorie validation

[nutritionTargets.js:115](C:/Users/PC/Documents/Code/Fitzo/backend/src/utils/nutritionTargets.js:115)

Calories are validated at line 102, then overwritten from custom macros afterward without revalidation. I executed `resolveTargets` with valid adult measurements, automatic calories, custom macros, and all three macros set to zero: it returned a valid-looking profile with **target_calories: 0**. Excessive macro values can similarly exceed the earlier upper bound. Negative inputs are silently clamped to zero.

Validate the final combined result after all overrides. Reject invalid macro values instead of silently converting them. Define whether custom calories or macro-derived calories take precedence and enforce consistency.

### 5. P2 — Preview dragging and exported photo use different coordinates

[ShareComposerScreen.tsx:77](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/ShareComposerScreen.tsx:77)

The animated transform now applies screen-pixel translations directly inside a `CARD_W × CARD_H` view that is subsequently scaled by `heroScale`. The export still converts those same values into normalized offsets using the visible hero dimensions. Example: at a 360-wide preview and 1080-wide card, a 90-pixel drag displays only 30 pixels of preview movement, while the export moves the photo 270 design pixels, equivalent to 90 preview pixels. The final framing differs from what the user saw.

Convert gesture deltas into the card's coordinate system for the animated preview, or drive both trees from the same normalized representation. Test preview/export parity after dragging, pinch-and-drag, rotation, and layout changes. Moving work to the UI thread is a sound direction, but 60 fps was not measured.

### 6. P2 — Completing a workout does not close an existing gym check-in

[workouts.js:209](C:/Users/PC/Documents/Code/Fitzo/backend/src/routes/workouts.js:209) and [workout-sessions.js:334](C:/Users/PC/Documents/Code/Fitzo/backend/src/routes/workout-sessions.js:334)

Both completion paths insert a checked-out attendance row with `ON CONFLICT (user_id, check_date) DO NOTHING`. If someone scanned into their gym earlier, the existing attendance wins and `checked_out_at` remains null. They continue to appear at the gym until the 90-minute window expires. This is not the reported auto-checkout behavior.

Update the active attendance explicitly or handle the conflict by closing it, while preventing duplicate check-in XP. Also keep synthetic workout/streak attendance distinct from actual visits: currently a member's assigned gym is copied onto synthetic attendance, which can make a later genuine QR check-in report Already checked in today.

### 7. P2 — Invite status handling uses the wrong API value

[buddy.tsx:45](C:/Users/PC/Documents/Code/Fitzo/mobile/app/buddy.tsx:45), compared with [friends.js:431](C:/Users/PC/Documents/Code/Fitzo/backend/src/routes/friends.js:431)

The invite screen checks for `accepted`, but the status endpoint returns `friend`. Existing friends therefore see Add as Gym Buddy and receive a conflict instead of the Already Gym Buddies screen. Pending and blocked statuses are also treated as ready; network failures fall back to ready as well. An incoming pending request can become accepted on submission, but the screen always announces Request Sent.

Use the actual status contract, distinguish pending/blocked/error states, and handle the request endpoint's accepted response. Add tests covering each state rather than just a new friendship.

### 8. P2 — Signing in discards a buddy invite

[buddy.tsx:26](C:/Users/PC/Documents/Code/Fitzo/mobile/app/buddy.tsx:26) and [login.tsx:76](C:/Users/PC/Documents/Code/Fitzo/mobile/app/login.tsx:76)

A signed-out recipient is replaced with `/login` without preserving the invite ID or a return destination. Login then navigates to `/`, so the intended buddy is lost. Preserve a validated pending invite through login and onboarding and consume it after authentication. Test cold-start links while signed in and signed out.

### 9. P2 — The invite landing page lacks an iPhone installation path

[page.tsx:69](<C:/Users/PC/Documents/Code/Fitzo web/fitzo/app/buddy/page.tsx:69>)

The only download option is Google Play. An iPhone recipient without Fitzo cannot use the app-opening link and has no App Store button. Add the verified Fitzo App Store URL, with appropriate platform handling or both clearly labelled store options.

### 10. P2 — Private workout activity remains visible in the buddy list

[friends.js:54](C:/Users/PC/Documents/Code/Fitzo/backend/src/routes/friends.js:54) and [friends.js:85](C:/Users/PC/Documents/Code/Fitzo/backend/src/routes/friends.js:85)

This is an existing issue left unresolved by the new filtering, rather than a wholly new regression. `workout_logs` now respects visibility when calculating worked_out_today, but its OR branch checks completed `workout_sessions` without visibility filtering. Smart logs are mirrored into those sessions with their visibility preserved, so a private workout can still cause Worked out today to appear. The last-workout lookup also returns private log dates/types without a visibility condition.

Apply the same visibility policy to every representation and metadata lookup. Verify that a private smart log and its structured mirror cannot reveal activity or workout type to a friend.

## Deployment and completion gaps

- **Public invite links currently fail:** read-only HTTP requests to `https://www.fitzoapp.in/buddy`, including a synthetic invite query, returned 404 during this review. The page exists locally but is not available at the advertised public URL. Fix the build, deploy through the normal release process, and verify the exact shared URL afterward.
- **Verified web-to-app links are incomplete:** Android `autoVerify` is configured, but `/.well-known/assetlinks.json` returned 404 on both configured hosts. The website repository contains no association file. iOS has no associated-domains configuration and the www Apple association endpoint also returned 404. A browser page using a custom `fitzo://` link is a fallback, not verified universal linking. [Expo's Android linking requirements](https://docs.expo.dev/linking/android-app-links/) require both app configuration and website association.
- **Existing nutrition targets are not automatically migrated:** migration 020 adds metadata columns and a default, but explicitly leaves stored targets untouched. Reads return stored values; recalculation requires profile save or the separate manager endpoint. This review did not verify production migration state or any previous bulk recalculation. The migration comment references a repair script that is not included in this change.

## What is supported by the reviewed code

- Friend search now strips a leading @, searches username/name/ID globally, retains same-gym ordering priority, and uses parameterized SQL. The new tests cover request construction, although they mock the database rather than execute the search against PostgreSQL.
- Food logging no longer creates attendance. Presence queries now use an actual gym, open checkout state, and a recent check-in, with IST date boundaries. The completion conflict described above still needs correction.
- Display-name formatting avoids rendering email-shaped names on the changed screens. This is presentation formatting, not removal of raw names from API responses.
- Workout JSON is rendered as exercise/set rows for the normal structured format. New structured workout writes already filter incomplete sets in the backend. A native visual check is still needed for long exercise names and larger text settings.
- QR generation, image sharing, profile navigation entry point, and a custom-scheme invite route exist. The complete acquisition/invite journey is not yet working as claimed.

## Recommended verification after fixes

1. Rerun unit tests, mobile TypeScript, targeted lint, and the website production build.
2. Add regressions for the specific failures above, especially hook transitions, target requirements/final validation, existing attendance checkout, invitation API states, and private workout mirrors.
3. On real iOS and Android builds, open a shared invite while signed out, already friends, pending, and blocked; scan a QR; test a recipient without the app.
4. Compare the visible photo crop to the exported image after combined gestures. Measure gesture performance before claiming 60 fps.
5. Verify the deployed landing page and association endpoints. Separately verify how existing nutrition profiles will receive corrected defaults without replacing deliberate personal targets.
