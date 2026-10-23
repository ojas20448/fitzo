# Fitzo member navigation implementation

22 October 2026 · Local feature branch `codex/navigation-liquid-glass`

## Result

The member destinations are **Workout · Food · Gym · Friends · Profile**. The user clarified that the initial image was a layout sample and requested subtle glass, existing fonts and the current app's design. Following hands-on testing, they requested cleaner icons and more space. Member navigation, training shortcuts, diary/gym actions and exercise controls now use consistent Ionicons outlines from the existing Expo icon package. Lexend, Onyx & Snow tokens, ScreenBackdrop, GlassCard and existing buttons remain the foundation.

The capsule is 64 logical pixels high at normal text scale, with a translucent inset selection, restrained edge reflections, a black drop shadow and a short damped spring with 6% transient stretch. Its height adapts to font scale. Native glass is guarded by module/component/API checks; older iOS uses regular blur where available; Android uses the tinted fallback until native performance acceptance. Reduce Transparency produces the opaque treatment and Reduce Motion removes selection movement. Screen content reserves measured bar/banner space and safe area once. See [the refinement review](./refinement.md) for the latest user feedback and captures.

## Implemented workflows

- Workout reuses the current Home training UI in a focused mode, keeps saved suggestions and recovery check-in, and exposes My plan, Exercises, Workouts and History directly. Food/gym/learning/social previews are removed from this destination rather than restyled into new cards.
- A user without a routine can start empty. The picker is unrestricted. The current backend accepts six workout-focus categories, so a generic session asks for its primary focus at completion instead of silently recording Chest. Choosing focus preserves every entered/completed set and the draft. This requires no server schema change.
- Existing planned sessions can choose Show all muscles while adding exercises. Previous values, optional RIR, input mode, rest timer, unilateral tracking and completed-set validation retain their existing behaviour.
- Exercise discovery and the logger share the existing exercise-details modal. Viewing a guide does not create a draft. Explicit Add to workout passes a validated exercise ID; the logger restores an account draft before adding that exercise once. A missing GIF retains the guide.
- Food opens a date-based diary, groups saved meals and keeps unassigned legacy entries visible. Targets remain optional. Entry editing supports portion scaling, portion description, meal assignment and manual macro correction in one update. Failed edits retain input; duplicate saves are guarded. Deletion retains explicit confirmation rather than claiming an unreliable Undo.
- Adding food from a historical diary explicitly says Add food for today and returns to today's diary; the existing logger still records today's meals. Historical saved entries can be edited directly.
- Gym uses the existing join-by-code, membership, QR check-in, checkout, recorded attendance, busy-times and classes features. Optional attendance failures do not erase membership. Attendance is labelled latest recorded app check-ins rather than an exact physical headcount. Tab selection does not join, book or scan anything.
- Profile exposes Progress, Learn and Your gym. Learn opens its existing lesson path with a back affordance. Stats remains a hidden compatible route, keeps Profile selected and allows return through the Profile tab.
- Coach shortcuts prefill a bounded, editable workout/food question. They never submit a chat message automatically or bypass the existing consent source.
- Active workout updates use the existing draft subscription, account keys and serialized writes. Other primary tabs show Resume; stale reads from another account cannot populate the banner. No polling or second draft persistence format was introduced.

## Compatibility and scope

Existing root, logger, lesson, invitation, QR and class routes remain. Legacy Learn redirects to `/member/learn`; scan and Stats remain hidden. The + action menu is removed. Only `expo-blur ~15.0.8` and `expo-glass-effect ~0.1.10` were added to dependencies; no broad Expo update was performed.

Gym discovery, verified equipment inventories, 2D/3D maps, shared live workouts and autonomous AI writes remain the separately scoped projects described in the design specification. No placeholder gym inventory or map is presented as real data.

## Browser evidence

These are captures of the running Expo application with intercepted synthetic API fixtures, not the earlier HTML study and not real member/gym data. API writes in the review were intercepted; no production account or records were changed.

- [Workout, 390 px](./workout-390.png)
- [Food diary, 390 px](./food-390.png)
- [Food portion editor, 390 px](./food-edit-390.png)
- [Food with resumable workout](./food-resume-390.png)
- [Gym hub, 390 px](./gym-390.png)

Browser interaction checks verified diary → portion multiplier 2 → Dinner → one PATCH carrying scaled macros and the chosen meal; exercise discovery → guide → Add to workout; leaving the logger and resuming from Food; Profile → Learn → Back; and five stable tabs at 320, 390, 430 and 844 pixels. No horizontal overflow or clipped tab label was observed; the smallest measured tab width was 57.19 pixels. The browser harness blocked an existing QR worker CDN request, producing a jsQR worker error unrelated to this navigation change; QR camera behaviour was not certified.

## Automated verification

- Full mobile suite after refinement: 61 suites, 470 tests passed.
- TypeScript: passed.
- Expo JavaScript export: iOS, Android and web bundles generated successfully. This is bundle compilation, not a signed native application build or device certification.
- New implementation modules: ESLint passed with no warnings or errors. Scoped modified legacy-source lint passed with no errors and retains warnings in those older modules.
- Windows-aware scoped `git diff --check`: passed.
- Before implementation: 55 suites/436 tests and TypeScript passed; see [baseline](./native-baseline.md).

## Native/release gates still open

Physical-device native material/keyboard checks, large system text, VoiceOver, TalkBack, Reduce Transparency/contrast, lock-screen interaction and native frame pacing remain unverified on this Windows executor. Native development/release builds containing the added modules are required. No EAS cloud build, publication, deployment, merge or release was performed.

`expo install --check` reports 13 existing SDK-54 patch-version recommendations, including Expo 54.0.33 → ~54.0.37 and Expo Router 6.0.23 → ~6.0.24. The repository's original dependency versions match these older values; this feature did not create that drift. The new blur/glass versions are compatible with the installed SDK's module map. Patch maintenance should be reviewed before release; it was not silently bundled into this UI change.
