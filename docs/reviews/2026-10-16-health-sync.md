# Health sync investigation and fixes — 16 October 2026

The reported discrepancy was on an iPhone. No simultaneous Fitzo/Apple Health totals or device logs were supplied, so the original numerical discrepancy has not been reproduced on a physical device. The following defects were reproduced from the code and regression tests.

## Findings and changes

- The Health Report abbreviated 13,457 steps as `13.5k`. It now displays the full step count.
- The app only ran automatic foreground imports on a transition back to the active state. It now also checks on cold launch and every 30 seconds while active. iOS additionally subscribes to HealthKit changes for steps, active energy, resting heart rate and sleep.
- An already open report did not reload its values when another import finished. It now listens for account sync updates and reloads saved readings without a full-screen loading indicator. A failed automatic reload keeps the displayed report and shows a retry message.
- Foreground work is coalesced, stops on backgrounding or account change, and checks account import preferences before reads/uploads. Native observers are removed when foreground work stops. Existing background scheduling and opt-in remain separate.
- Installed `react-native-health-connect` is version 3.5.0. Its bundled Expo plugin only added an older Android rationale intent; it did not register `HealthConnectPermissionDelegate`. The generated MainActivity had no registration. A local Expo plugin now registers the delegate and generates the pre-14 rationale activity and Android 14+ permission usage alias. Both privacy entry points open the existing store-listed privacy policy.
- Android setup errors now explain when Health Connect needs installing/updating. Revoked read permissions produce a sync failure rather than a successful empty check.
- Settings explain that Android step tracking apps must share their recordings with Health Connect and that new readings must reach the health store before Fitzo imports them.

## Verification

- Mobile Jest suite: **50 suites, 385 tests passed**.
- Native plugin tests: **3 passed**, including repeated application of the transformations.
- Backend health import tests: **3 passed**, covering partial imports, valid dates and explicit device dates.
- TypeScript: `tsc --noEmit` passed.
- ESLint on changed mobile source/tests and the plugin: no errors; four existing warnings about native `require()` loading and a test mock's display name.
- Android Expo prebuild passed in an isolated temporary project using the full current app configuration. Generated output contains one permission delegate registration, one legacy rationale intent, one Android 14+ alias, the privacy activity and configured health read permissions.
- Whitespace checks passed for the changed health files.

## Release and device verification still required

These are local code changes. No store build was submitted or deployed. The Android native changes require a new native build; a JavaScript update cannot add its permission handler. The generated native project was checked, but no APK compilation or device sync was performed. No Android device was connected, and this Windows workspace cannot run an iPhone HealthKit session.

1. On a fresh Android build, connect Health Connect, allow steps, and confirm the permission prompt completes. Verify that Google Fit/Samsung Health has exported a known day of steps into Health Connect, then compare that day with Fitzo. Check both Android 13 and Android 14+ privacy entry points.
2. On iPhone, allow steps and compare the full same-day Apple Health total with Fitzo after HealthKit has saved its readings. Keep the report open, walk, and check that a HealthKit update or the next foreground poll updates the displayed value. Repeat after backgrounding and reopening Fitzo.
3. Revoke read permissions, disable imports, switch accounts during a read, and disconnect the network. Confirm that errors remain visible, saved readings stay available, and no readings upload into another account.
4. Test around local midnight. Imports continue to use the existing device-local day window, native aggregate APIs and explicit units; this change does not synthesize sensor readings or add phone/watch totals manually.

## References

- [Installed Health Connect version's setup instructions](https://github.com/matinzd/react-native-health-connect/blob/v3.5.0/README.md).
- [Android's Health Connect manifest and privacy entry point requirements](https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started).

The current Health Connect documentation describes version 4's automatic Expo integration. The fix here is for the installed version 3.5.0 and does not upgrade that dependency.
