# Workout photo share cards — 15 October 2026

Pinch, drag, and rotation now adjust the workout card over a fixed camera photo. The preview and export use the same composition, with normalized card placement and a snapshot of the latest gesture values when Share is tapped.

Improvements:

- Photo cards start at 70% size, leaving room for the photo. Size buttons and Reset complement the gestures.
- Placement bounds keep the card inside the story, accounting for rotation. Retaking a photo preserves the card placement.
- Receipt retains its paper appearance with transparent surroundings. Spec, Scoreboard, and Chalk use translucent panels for readable text over photos.
- The style picker scrolls horizontally, and photo controls fit more compactly on small screens.
- Sharing freezes the current placement and retains it when the share flow finishes, including when Share is tapped before a gesture finalizes.

Reviewed Receipt, Spec, Scoreboard, Anatomy, and Chalk using browser fixtures with long workout names, 12 exercises, and eight personal records. All five retained visible footers. Anatomy continues to use its dedicated heatmap background.

Validation: 375 mobile tests passed across 49 suites; TypeScript and lint passed for the changed files. The Android Metro production bundle compiled successfully. Browser checks at 390 × 844 and 320 × 568 confirmed the controls fit; resize and reset kept the photo transform unchanged and the preview/export card transforms identical.

Physical-device multitouch and the native share sheet still need a device smoke test. Browser visual fixtures and mocked camera tests do not validate those native interactions.
