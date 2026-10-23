# Workout recovery and UI follow-up

## Changes

- Active workouts now save locally after edits and when the app enters the background. Reopening restores exercises, sets, completed flags, weights, reps, RIR, side tracking, session name, start time, visibility, and rest duration before saved routines load.
- Drafts are scoped to the signed-in account, have no inactivity expiry, and clear only after the server accepts the workout. Writes and deletion run in order. A failed save keeps the draft; a failed local restore blocks template loading and offers retry.
- Home offers Resume workout for an unfinished session.
- Exercise descriptions open through an info button in both the catalogue and workout cards. When an exercise has a GIF or image, the same panel displays it above the guide; animated GIFs play automatically. Missing or failed previews leave the text guide usable. Side tracking moved into exercise details; the repeated side badge was removed while volume calculations stay intact. For one-sided exercises, the set table uses KG / SIDE and REPS / SIDE headings and the accessible field labels specify per-side values.
- Macro numbers use the existing protein blue, carbs gold, and fat pink consistently on Home, the macro chart, food details, meal totals, photo results, fitness profile, onboarding, recipes, weekly protein summary, activity details, and the health report. Contrast on the lightest shared dark surface (#1A1A1A) is 6.85:1, 10.43:1, and 6.57:1 respectively.
- Existing voice consent is already presented at the point of use. Its Agree and Not Now controls now stay visible below the scrolling explanation.

## Validation

Regression coverage includes destroying and recreating a workout with five logged exercises, ten minutes in the background followed by restart, failed and successful completion, retained duration and visibility, account isolation, write ordering, retry after storage read and write failures, empty drafts, malformed storage, Home resume, opening and closing exercise details, visible side-specific input headings, media previews, missing media, and failed-preview recovery. Mobile tests, type checking, changed-file lint, and whitespace checks are run before handoff.

Final checks: 53 mobile test suites / 421 tests passed; TypeScript passed; scoped lint and whitespace checks passed. The iOS production JavaScript bundle exported successfully (2,416 modules) before the media-preview addition. This validates packaging, not a physical-device test or store upload.

These are local source changes. They have not been published to the installed mobile app, and a physical-device background/relaunch check is still needed in the next build. Device storage cannot recover progress already lost by an older build.

Oracle work is deferred at the user's request.
