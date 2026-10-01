# Post-workout sharing fixes — 14 September 2026

The sharing changes are implemented locally. Automated tests and browser checks pass as described below. Native camera, export, and share-sheet verification are still required before release. No production deployment or store build was performed during this work.

## Changes

- **Simpler composer:** the card preview comes first. All five styles fit on one row at the checked 360- and 390-point widths. Highlights open in a bottom sheet with full exercise names and checkboxes. Share stays at the bottom of the screen. The hidden export canvas no longer expands or shifts the web page.
- **Completed sets only:** finishing a workout filters unchecked and invalid sets before saving and calculating the recap. Completed bodyweight sets count with zero external load. The backend applies the same validation before writing either the flat log or structured mirror. Older clients that omit the completion flag remain supported; an explicit unchecked set is excluded.
- **Accurate content:** workouts without a PR open on the session total. A selected exercise has its own name, volume, and set count, with duration labeled as session context. Fractional volume is preserved. Top-set ties use reps. Bodyweight sessions show completed sets instead of a zero-kilogram headline.
- **Personal records:** Spec displays selected record names, current values, and previous values. Long lists have a visible overflow count and a bounded row budget. Selecting several highlights switches Scoreboard to Spec; attempting Scoreboard with several highlights preserves the selection and explains the restriction.
- **Muscle maps:** catalog aliases such as pectorals, delts, and upper back map to the correct regions. The legend describes session set counts, avoiding weekly growth-target claims. Selecting Muscles opens Anatomy. Selected record/exercise highlights also appear below the map, with an overflow count when necessary.
- **Cards:** larger secondary text, wrapping names, explicit metric labels, bounded content, and transparent receipt illustrations improve readability. Weekly summaries retain their generic statistic rows in Spec. The export text size is fixed independently of system font scaling; the screen exposes a text description of the preview.
- **One photo workflow:** the recap opens the same composer used for style selection and sharing. Camera access is requested when adding a photo. Photos and their transforms stay within that composer visit. Anatomy offers no camera action when it cannot display a photo; an existing photo is retained for other styles and can be removed.
- **Capture handling:** the design is rendered inside a density-adjusted capture frame targeting 1080 × 1920 physical pixels. Sharing waits for the export tree's images, reports load failures, and supports retry. Old image callbacks cannot enable a new capture. Editing is locked and the payload is held while sharing. Temporary exported files are released after the native sharing promise settles.
- **Failures and recap identity:** native sharing failures offer an explicit text preview before text sharing. Browser image-sharing failures show a visible message. Text comes from the card payload. Recaps retain the completion timestamp, reject malformed routes, and cannot substitute a different saved workout merely because its totals match.

## Verification

| Check | Result |
| --- | --- |
| Mobile Jest suite | 20 suites, 206 tests passed |
| Backend Jest suite | 38 suites, 374 tests passed |
| TypeScript | Passed |
| ESLint on changed mobile source/tests | 0 errors; 14 warnings in the existing StatsScreen and WorkoutLogScreen code |
| Composer and capture/theme files | Targeted lint passed without warnings |

Browser checks used the real React Native Web components with synthetic fixtures, without logging a production workout:

- At **390 × 844**, document size stayed 390 × 844, preview was 324 × 576, and Share ended at y=836.
- At **360 × 640**, document size stayed 360 × 640, all style buttons occupied one row, and Share ended at y=632.
- The highlight sheet selected multiple PRs and switched to Spec. An incompatible Scoreboard choice retained both records and showed guidance. Choosing Muscles switched to Anatomy. Closing the sheet preserved the header position.
- A deliberately missing receipt image disabled Share and showed Retry. Making the image available and pressing Retry enabled Share. An unavailable browser share showed an error without losing the card.
- A Spec fixture with eight long record names showed four readable records, their previous values, and “+4 MORE”; measured text bounds stayed inside the card. Normal, multiple-record, long-name, sparse, and weekly fixtures were also inspected during this work.

Test logs and the reusable local fixture source are in `output/share-audit/`. Temporary files used to expose the fixture through Metro were removed from the app's public directory after verification.

## Remaining limits

- **Physical devices:** verify PNG dimensions, photo gestures, camera denial/retake, repeated exports and memory, actual iOS/Android share destinations, safe-area layout, large system text, and VoiceOver/TalkBack. Browser and helper tests do not certify these native behaviors.
- **Historical data:** existing incorrect totals are not retroactively rewritten. Recaps without a reliable timestamp cannot safely recover a workout, and browsing/re-sharing arbitrary older sessions remains outside this change.
- **Other project work:** manager features remain deferred. Historical HealthKit backfill, background health sync, full offline write replay, staging setup, and the remaining infrastructure audit were not completed by this sharing-focused work.

Original findings: [sharing audit](SHARE_SLIP_AUDIT_2026-09-13.md).
