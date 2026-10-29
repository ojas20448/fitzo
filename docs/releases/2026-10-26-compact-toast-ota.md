# Compact notification OTA — October 26, 2026

Released `de1b8c9be81dbdc8734e9d779a8a61fcb3221e08` to Android and iOS production
at 100% rollout. This is a mobile-only change; no backend deployment, migration,
dependency change, native build or store submission was required.

The notification removes the separate View diary text row. A round icon button
occupies the previous close-button position and opens the diary. Reduced padding
and a smaller status icon shorten the card while preserving readable text and
a 44-point action target. Swipe dismissal, automatic expiry and accessibility
dismissal remain available. Notifications without actions keep their close button.

## Verification

- TypeScript and 13 affected tests passed in a clean release checkout; scoped
  ESLint passed. Tests cover the icon action, swipe dismissal without navigation,
  expiry, duplicate suppression and food-entry editing.
- Native Hermes exports used production-profile public values with dotenv
  disabled. All 226 bundled application modules on each platform matched the
  committed source, excluding unrelated ongoing local food changes.
- Publication used the established native configuration. Both fingerprints
  matched the compatible production binaries; the original app.json was restored.
- Updates were published at 10%, their downloaded bundles and all 219 asset
  hashes per platform verified, then expanded to 100%. Production-channel checks
  passed at **17:12 IST**, `2026-10-26T11:42:26.372Z`.

| Platform | Runtime / build | Update ID | Group ID |
| --- | --- | --- | --- |
| Android | `74f8a38a9715cbcf5e8db7bf27d54ff5f3160d2f` / 33 | `01a17803-40e9-7841-8319-260fd427dc18` | `b1efe777-b379-4e80-b76b-b4fbde18f305` |
| iOS | `9959efa4e5cc27c52444c51132f57715f133974b` / 30 | `01a17803-d2f1-70c9-857b-e8db686f62ad` | `0e56b4ca-0917-40f5-a729-5fd84496e0f0` |

Bundle SHA-256:

- Android: `c558fac9e58cf2de63f82eb5a09ea34ae0e1ba96d3cc48fd5f3dacf457984ea1`
- iOS: `050152e22ae120a7499c99675a2ceec3c080cfae86318ebb3afce2efc6a0286a`

Previous groups remain available for recovery: Android
`ed9187b1-a7df-4c81-b107-f2a2db9762c8`, iOS
`1d546c1f-2511-4864-a975-ef12da7e175b`. Delivery is verified for compatible
OTA-enabled binaries; physical-phone appearance and installation remain unverified.
