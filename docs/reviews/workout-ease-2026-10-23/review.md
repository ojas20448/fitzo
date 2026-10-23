# Easier workout logging — 23 October 2026

## What was confusing

An Upper session mapped internally to Chest and opened its picker with Chest selected. A separate “Show all muscles” control then competed with the picker’s own muscle filters. Every added exercise closed the picker, repeated taps could duplicate movements, and empty search results could offer a custom exercise even when a different muscle filter was hiding the existing exercise. Missing remote media could leave a spinner or an unexplained placeholder.

## Changes

- All workout pickers now start with **All muscles**, regardless of session name. There is one filter row. Empty filtered searches offer **Search all muscles**, preserving the typed name; custom creation is offered only after a global search.
- Add exercises in one visit, see **Added** on selected movements, then tap **Done**. Stable IDs and exact names prevent duplicate additions. Replacement has an explicit Replace action and still protects entered sets.
- A blank workout has a clear Add exercises action and short logging instructions. Exercise cards label the completion column **Done**; tapping the name or thumbnail opens its demo and guide.
- Empty sessions show Workout rather than a misleading Chest title. The template browser opens without an automatic Chest filter. The existing backend focus categories remain compatible; choosing a free workout’s focus now saves it immediately and is guarded against duplicate writes.
- Built-in movements appear before extra online results in the picker. Duplicate entries already present in the starting catalog are merged as well as later API results.
- Rows distinguish **View demo**, **View photo & guide** and **View guide**. The guide’s Add/Replace action stays visible in a footer.
- **125 existing photos are bundled** (7,918,335 bytes, about 7.6 MiB), with **123 exact-source technique guides**. Photos load without the external image host. The source is [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), released under the [Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md). Source paths, hashes and licenses are recorded in `mobile/assets/exercise-photos/SOURCES.json`.
- The six existing licensed GIFs remain available. A known bundled animation takes priority over an expired provider URL. Thumbnails use stills; opening the guide plays the GIF, with pause/play and reduced-motion support. Full GIF coverage is still partial; photos are labelled as photos.
- Missing media has an explicit message and retry action. A stalled request falls through after 12 seconds. Matching remains based on stable IDs or exact normalized names, avoiding an unrelated demonstration for a specialized or custom exercise.

## Verification

- **69 Jest suites / 535 tests passed**, including duplicate prevention, batch addition, unrestricted Upper sessions, preserving search text, replacement, image fallbacks, stalled-image recovery, preview playback and single-submit workout completion.
- TypeScript passed. Scoped lint has no errors; eight existing warnings remain across the older logger and exercise-card files.
- Web, iOS and Android JavaScript exports passed. These are bundle checks, not native device builds.
- An isolated Chromium context completed: empty workout → add two exercises → photo preview → GIF preview/pause/play → enter 40kg × 8 → check the set → finish → focus → recap. Exactly one intercepted workout write contained only the completed exercise and set.
- External media hosts were blocked. The bundled chest-press photo and Push Up GIF loaded from the local app; successive GIF frame captures differed, confirming visible animation. The guide also opened from the exercise card while logging.
- **11 layout captures** cover 320, 390, 430 and 844px widths. No horizontal page overflow was found. Browser results include five successful media-load checks. Recorded jsQR worker import errors result from the harness blocking its third-party URL; no other application page errors were recorded.

## Evidence

- [Empty workout](./empty-workout-390.png)
- [Choose several exercises](./choose-exercises-390.png)
- [Bundled photo and guide](./bundled-photo-390.png)
- [Playing GIF](./animated-demo-390.png)
- [Logging a set at 320px](./logging-set-320.png)
- [Browser results](./browser-results.json)

Native keyboard, modal presentation, screen readers and physical-device performance still need device verification. The harness and final builds are in `D:/CodexFitzoScratch-01a15fb1-20261023/`; Metro remains at `http://localhost:8081`.

During verification C: reached zero free space. The affected source file was restored, then the full checks above passed. Earlier generated scratch exports were preserved on D:, and subsequent builds/test caches use D:. C: still has only about 200MB free.
