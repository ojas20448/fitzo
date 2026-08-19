# Raw app captures

`device/` holds the raw screenshots captured from the running app — **the
input**, not the files to upload.

Upload from `mobile/store-listing/` instead. Those are the composed marketing
panels: accent glow, eyebrow, headline, device bleeding off the bottom edge.

## One capture set, at a real phone shape

There is deliberately only ONE set here, at 1320x2868 (ratio 2.173).

An earlier version captured twice, sizing each viewport to the destination
store's canvas — including 360x720, exactly 2.000, to respect Google Play's 2:1
screenshot cap. No phone is 2.000: a Pixel 8 is 2.221, a Galaxy S24 2.167, an
iPhone 17 Pro Max 2.173. Laying the app out in a 720pt-tall box crammed its
vertical rhythm and the panels looked squashed.

The device ratio and the panel ratio are independent — the device is just an
image placed on the panel — so one capture at a true phone shape feeds both
canvases. Do not reintroduce per-store capture sizes.

## Regenerate

```bash
cd backend && node scripts/seed_review_account.js
cd ../mobile && EXPO_PUBLIC_API_URL=https://fitzo.onrender.com/api \
  npx expo start --web --port 8100
# then, from the website project:
FITZO_WEB_URL=http://localhost:8100 node scripts/capture-store-screenshots.mjs
node scripts/compose-store-panels.mjs
```
