# Fitzo App Store refresh · September 2026

Open [the visual preview](refresh-2026-09/preview.html) or [the contact sheet](refresh-2026-09/contact-sheet.png). Proposed listing copy is in [en-US.md](en-US.md).

## What changed

The previous eight panels repeated the same dark gradient, used long headlines and hid key app content behind first-run dialogs. The live Indian listing, inspected via Apple's public lookup on 19 September 2026, began with coach, nutrition and lessons; the workout logger appeared sixth. The saved metadata also advertised deferred manager features.

The new sequence puts workout tracking, nutrition and the muscle map first. Short headlines are the primary reading layer. All eight panels use the same warm-white background to give the black app UI clear separation. A single lime ribbon runs through the complete eight-panel canvas; each screenshot shows its own slice, with matching positions and tangents at every join. Supporting text is 34px bold in dark charcoal at the 1080px design width, up from 28px regular gray. The headline still carries the message at small search-card sizes. Generic screen frames have a small tilt and restrained depth, without invented Apple hardware. New logger, coach and friends captures show actual app components with fictional data and no first-use overlays.

## Files and folder structure

The store listing assets are organized into three canonical folders ready for upload, plus the generator tools:

| Location | Contents | Specifications |
|---|---|---|
| `app-store-6.9/` | 8 panels (`01-workouts.png` – `08-buddies.png`) | 1320 × 2868 px, 24-bit PNG, no alpha |
| `app-store-6.5/` | 8 panels (`01-workouts.png` – `08-buddies.png`) | 1284 × 2778 px, 24-bit PNG, no alpha |
| `google-play/` | 8 panels (`01-workouts.png` – `08-buddies.png`) | 1080 × 2160 px (2:1 max aspect ratio), 24-bit PNG, no alpha |
| `refresh-2026-09/` | Staged refresh archive & web previews | Includes `preview.html`, contact sheets, manifests, split pair |
| `tools/` | Artwork compositor & capture scripts | Node.js + Playwright + Sharp pipeline |

The redundant `app-store/` folder has been removed, and canonical folders (`app-store-6.5`, `app-store-6.9`, `google-play`) are automatically synced with the refreshed designs on every render.

## Recommended order

1. Make every rep count — workout logger.
2. Your food. Your way — voice, photo and Indian food logging.
3. See what you trained — muscle volume map.
4. A coach with your context — Spotter conversation detail.
5. Small steps. Real progress — personal progress.
6. Your day. All together — home overview.
7. Train with understanding — lessons.
8. Better with buddies — shared activity.

The optional split pair replaces images 1–2, rather than being appended. It is intentionally a continuous close-up. Each marketing headline stays within its own image, but app content crosses the seam. The main sequence is the recommendation because its app features remain clearer when images appear individually or with different gaps. The split pair is a design option to compare, not a proven conversion improvement. It currently has 6.9-inch exports only.

## Research and design decisions

- **Lead with what the app does.** Apple's [product-page guidance](https://developer.apple.com/app-store/product-page/) says the first one to three screenshots can appear in search results. It recommends actual app UI and one principal benefit per later screenshot. That supports the workout → food → muscle-map opening.
- **Keep the product visible.** Apple's [asset best practices](https://developer.apple.com/app-store/asset-best-practices/) emphasize an in-use experience over general accolades or calls to action. These panels use genuine app-rendered images; no invented app UI, ratings or testimonials.
- **Device mockups have constraints.** Apple's [marketing guidelines](https://developer.apple.com/app-store/marketing/guidelines/) restrict cropping/tilting its supplied product images and distinguish generic devices from Apple-specific hardware. This campaign uses generic screen frames without a Dynamic Island, Apple logo or physical controls. For a realistic iPhone treatment, obtain official bezels and use them within their terms. A real hand-held photograph of the app is another option, but it can reduce the space available for readable UI.
- **Technical requirements.** Apple's [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) accept 1320 × 2868 for the 6.9-inch class and 1284 × 2778 for 6.5-inch, and disallow transparency. Every recommended export is checked for its dimensions and absence of an alpha channel.
- **Category positioning.** [Hevy](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350) leads its listing with workout tracking, while [Strong](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577) stresses easy workout logging. Fitzo's own differentiator is combining that job with Indian-food nutrition, voice logging and contextual coaching. These are positioning references, not evidence of their screenshot conversion performance.
- **Test rather than promise uplift.** Apple's [product page optimization](https://developer.apple.com/app-store/product-page-optimization/) can compare screenshot treatments. Hold other variables stable and compare the main first two images against the split pair. Use App Analytics' available conversion and confidence results. No account analytics were accessed, and no conversion-rate or keyword-volume claim is made here.

## Capture provenance and remaining check

These are **Expo web renders**, not fresh native iPhone screenshots. Five existing raw captures were reused unchanged (home, nutrition, map, profile and learn). Logger, Spotter and buddies were captured from the current exported app with an isolated local API fixture. All external requests were intercepted or blocked; no live records were created or modified. Sample people and conversation text are fictional. The Spotter panel is labelled as an example conversation; actual AI responses vary.

The compositor scales images proportionally; it does not redraw the app. The muscle-map and Spotter panels are cropped details. Before submission, compare the imagery and marketed features against the live iPhone app. Web font rendering and safe areas can differ; if they do, replace the corresponding source PNGs with native captures at the same dimensions. Five existing captures also show older dates/content. The files are visually reviewed design deliverables, not certification of native parity or App Review acceptance.

No new app binary is needed to render this artwork. Upload/edit availability depends on the version and asset workflow in App Store Connect; consult Apple's [upload instructions](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots). Nothing has been uploaded or published by this task.

## Regenerate

In `mobile/store-listing/tools`:

```powershell
npm install
npx playwright install chromium
npm run render
```

The dependencies are kept out of the mobile runtime. If an existing installation already supplies the pinned Playwright and Sharp versions, set `FITZO_ARTWORK_DEPENDENCIES` to that directory before running the renderer. No absolute machine paths are embedded in the source.

To recreate the three offline demo captures, first export the current app from `mobile`:

```powershell
npx expo export --platform web --output-dir ../output/store-refresh/app-export
```

Then run `npm run capture` in `mobile/store-listing/tools`, followed by `npm run render`. The capture script starts a loopback-only static server and closes it on completion. It never logs into production. It writes only to `mobile/store-screenshots/store-refresh/`; the earlier raw captures remain intact.
