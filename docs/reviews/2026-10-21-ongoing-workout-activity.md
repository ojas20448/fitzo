# Ongoing workout activity

## Behavior

- iOS 16.2 and later: ActivityKit Live Activity on the lock screen and Dynamic Island where supported. Shows the session title, native elapsed timer, completed/total sets, and next unfinished exercise. Tapping opens `fitzo://log/workout`, restoring the existing draft.
- Android 8 and later: one quiet ongoing notification, using the native chronometer and a fixed notification ID. It shows the same progress and opens the saved workout when tapped. Android 13+ notification permission is requested only in context while logging, never on startup or when backgrounded. Denial does not interrupt logging.
- Both: updates follow successful local draft writes. Restoring a draft reconciles the system card; finishing, confirmed discard, an empty workout, account switching, or signing out ends it. A successful server save explicitly ends the card even when local backup cleanup fails. Navigation away from the logging screen keeps the activity running. Discarding requires confirmation; a storage failure keeps the draft and activity.
- Elapsed time is rendered by the operating system from the original start timestamp. It needs no background JS timer, foreground service, backend polling, new push credentials, or Expo SDK upgrade.

## Implementation

The local Expo module in `mobile/modules/fitzo-workout-activity` is discovered by Expo autolinking on both platforms. `withWorkoutActivity` creates and embeds one WidgetKit target, copies its Swift UI and shared ActivityKit attributes, aligns extension/app versions, enables Live Activities, and declares the extension for EAS signing. ActivityKit is weak-linked so older supported iOS versions can continue using the app.

`WorkoutActivityLifecycle` remains mounted below the authentication provider. It subscribes to persisted draft changes, reconciles on startup/foreground, filters account ownership, and prevents delayed reads from replacing newer progress. Native updates run in order; completion/sign-out wins over an outstanding notification permission prompt. Existing binaries without the native module and web builds degrade safely.

## Validation and rollout

- Unit coverage: progress calculations, original timestamp, next exercise, permission acceptance/denial/background behavior, avoiding repeated prompts, finishing during a permission request, absent native modules, authentication cleanup, foreground reconciliation, stale-read protection, draft subscriptions, and backup-cleanup failure after successful completion.
- Native config tests verify extension embedding/dependency, Swift source registration, idempotence, build-number updates, and EAS extension declaration while retaining other extensions.
- Isolated iOS file-generation/config-plugin checks passed against Expo's SDK 54 template. The generated Xcode project has one embedded widget extension, both Swift sources, a valid WidgetKit plist, and `NSSupportsLiveActivities` on the host app.
- This Windows host cannot compile iOS or test ActivityKit on an iPhone. A signed native iOS build and physical-device checks remain required.
- Android native module compilation passed (`:fitzo-workout-activity:compileDebugKotlin`). The first attempt encountered missing generated Expo dependency outputs; regenerating the build outputs resolved it without changing dependency versions.
- Final checks: 55 mobile test suites / 436 tests passed, three native config tests passed, TypeScript passed, and scoped lint passed.

Requires new iOS and Android binaries; an over-the-air JavaScript update cannot add the native module or widget extension. No store build was submitted or published in this task.

OS behavior: users can disable Live Activities/notifications, dismiss ongoing notifications on recent Android versions, or force-stop an app. iOS limits Live Activity duration. These system controls are respected; the saved workout remains recoverable in the app.

References: [Apple ActivityKit](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities), [Android notification APIs](https://developer.android.com/reference/android/app/Notification.Builder), [Expo local modules](https://docs.expo.dev/modules/get-started/).
