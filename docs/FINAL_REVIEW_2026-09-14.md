# Final review — 14 September 2026

The local changes pass the automated checks and the sharing/report UI scenarios
listed below. This is ready for device and staging validation, not a certification
that every feature is complete or that the deployed app has no issues.

Manager features remain deferred. The existing `mobile/app.json` build-number
change was preserved. No deployment, native build, store submission, production
data write, or migration execution was performed during this review.

## Additional fixes made in this pass

- **Health import status:** the report no longer always says “Active.” It shows
  whether readable data exists and explains missing readings. The browser no
  longer labels all saved data as Health Connect data.
- **Missing values:** unavailable active calories display a dash, while a recorded
  zero remains zero. Weekly averages also preserve zero readings. Empty averages
  and step-chart sections are omitted.
- **Report response mapping:** nutrition now uses the backend's `target_*` fields;
  PRs use `max_weight_kg`. Previously nutrition targets were hidden and PR weights
  could be blank. Decimal database strings are normalized, missing values remain
  null, and bodyweight PRs are labeled appropriately.
- **Failure recovery:** a failed report request produces a clear retry screen
  instead of an apparently empty report. The incomplete report cannot be shared.
  Browser image-sharing failures now have visible feedback and re-enable Share.
- **Report layout:** vital cards respond to available width, titles can wrap,
  icon buttons have accessible names and 44-point targets, and the report date
  is evaluated when the screen renders instead of when the module first loads.
- **Share controls:** close, photo and retake controls have 44-point targets;
  photo actions wrap on narrow screens so no action extends off-screen.

The earlier share-slip repairs are detailed in
[SHARE_SLIP_FIXES_2026-09-14.md](SHARE_SLIP_FIXES_2026-09-14.md).

## Verification

| Check | Result | Limit |
| --- | --- | --- |
| Mobile Jest | 20 suites, 208 tests passed | Includes two new report-contract regressions; no native UI renderer |
| Backend Jest | 38 suites, 374 tests passed | Local tests, not deployed end-to-end behavior |
| Mobile TypeScript | Passed | No type errors |
| Full mobile ESLint | 194 files, 0 errors, 247 warnings | Existing warning debt remains; the four files touched in this pass lint cleanly |
| Navigation wiring audit | 30 discovered targets resolve against 38 routes | Static scanner coverage, not every dynamic navigation state |
| API wiring audit | 152 discovered calls map to 170 backend routes | Checks paths and methods, not every response contract |
| Production export | iOS, Android and web passed after final source edits | JS/Hermes bundles; not signed native builds or device tests |
| Whitespace/diff check | Passed | Local working tree |

Local logs are in `output/share-audit/final-mobile-tests.txt`,
`final-backend-tests.txt`, `final-lint.json` and `final-bundle-check.txt`.
The final exported bundles are in `output/final-review/release-export`.
Temporary review entry points and public fixtures were moved out of the mobile
app into `output/share-audit` before the final export.

### UI scenarios inspected

The real screens were rendered with synthetic data in the local browser. The
photo case used a temporary copy of the composer with an initial local image
seeded in state; it did not exercise the camera or permission prompt.

- Health Report with no readings: no “Active” status, no false calorie zero,
  understandable import guidance, and no empty weekly sections.
- Health Report with partial data: steps, sleep and heart rate display while
  absent calories remain a dash.
- Recorded-zero fixture: active calories show `0 kcal`; recorded zero sleep in
  history shows `0.0h`, distinct from missing data.
- Populated report: `82.5 kg x 8 reps`, 2,200 calorie target and all three macro
  targets render using the actual backend response field names. Body measurements
  and the lower report sections fit at 320 pixels wide.
- Failed request: visible “Try again” action; retry restores the report.
- Browser Share: visible failure message and enabled retry button after failure.
- Compact composer: all controls remain on-screen at 320 × 640; Share ends at
  y=632. Additional PR selection updates the card and switches to Spec.
- Photo fixture: image loads, Share becomes enabled, all photo actions remain
  on-screen at 320 × 640. Switching to Anatomy explains that the photo is hidden;
  removing it removes the photo controls and hint. The 390 × 844 layout also fits.

These checks establish layout and interaction behavior for those scenarios.
They are not a usability study with first-time users or a VoiceOver/TalkBack audit.

### Read-only database verification

Using the configured backend database connection with certificate verification,
schema queries confirmed:

- `health_data.steps` and `active_calories` are nullable without defaults;
  `health_data.user_id` has `ON DELETE CASCADE`.
- `users.token_version` is non-null with default zero.
- `workout_sessions.source_workout_log_id` exists and cascades from `workout_logs`.
- `push_tokens` exists with the expected columns, a cascading user foreign key
  and a unique `(user_id, token)` constraint.

This confirms these schema effects, including the table needed by migration 019.
It does not establish which migration commands were run, migration checksum
history, or whether Render currently runs the local source revision. No personal
records were queried.

## Remaining work before a broad release sign-off

Update: the later [health/staging review](HEALTH_STAGING_REVIEW_2026-09-14.md)
implements local backfill/background support and isolates internal build
configuration. Its newer findings supersede the implementation/configuration
status in items 2–3 below; native and live staging verification remain pending.

1. **Native checks:** camera permissions/capture, photo gestures, share sheet,
   exported image dimensions, large text and screen readers on iOS and Android.
2. **Health accuracy on devices:** compare allowed, denied, empty and partial
   imports against Apple Health/Health Connect readings. Historical backfill and
   background delivery remain unfinished; current import is foreground daily sync.
3. **Staging:** all three EAS profiles still use the production API. The earlier
   staging investigation did not identify a separate verified backend/database.
   A complete authenticated write-flow test has not been run on staging.
4. **Existing unfinished scope:** full offline write replay, consistent calendar
   day semantics between workouts and attendance, and trainer nudge behavior.
   See [AUDIT_FIXES_2026-09-12.md](AUDIT_FIXES_2026-09-12.md).
5. **Deployment verification:** the local share/report fixes need to be included
   in a release and smoke-tested there. Earlier EAS build/submission status is not
   proof that these newer changes are installed on users' phones.

The current results support the tested sharing/report flows and the automated
checks. They do not close every historical audit item or certify all project UI.
