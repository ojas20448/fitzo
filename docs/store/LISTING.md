# Store Listing Copy

Ready to paste. Character counts are noted where the store enforces a limit.

Positioning: Fitzo is the tracker that **understands Indian food and Indian gym
life**. That is the wedge against MyFitnessPal and Hevy, and it should stay
visible in the first two lines of every listing — the fold on a Play listing is
roughly 80 characters.

---

## Google Play

### App name (30 max)
```
Fitzo: Gym & Nutrition Coach
```
28 characters. Leads with the brand, then the two things it does.

### Short description (80 max)
```
Log workouts by voice, track Indian meals, and train with an AI coach.
```
69 characters. This is the only copy most users read — it names the three
differentiators and skips adjectives entirely.

### Full description (4000 max)
```
Fitzo is a gym and nutrition tracker built for how people actually train in India.

Log a set in two taps. Say what you ate. Get a coach that knows your history.

━━━━━━━━━━━━━━━━━━━━━━
LOG BY VOICE
━━━━━━━━━━━━━━━━━━━━━━
Say "four sets of bench at eighty kilos" or "two rotis and paneer bhurji" and Fitzo logs it. No scrolling through menus mid-set. No hunting for a food that does not exist in the database.

━━━━━━━━━━━━━━━━━━━━━━
FOOD THAT ACTUALLY EXISTS HERE
━━━━━━━━━━━━━━━━━━━━━━
Rajma chawal. Poha. Masala dosa. Paneer tikka. Fitzo is built on IFCT 2017, India's official food composition database, alongside global sources. Point your camera at a plate and get an instant macro estimate.

━━━━━━━━━━━━━━━━━━━━━━
A WORKOUT LOGGER THAT KEEPS UP
━━━━━━━━━━━━━━━━━━━━━━
• 160+ exercises with form videos
• Last session's numbers shown as you lift, so you know what to beat
• Automatic personal record detection
• Plate calculator — no mental arithmetic at the rack
• Rest timer and dynamic warm-ups
• PPL, Upper/Lower, Arnold and more presets, or build your own

━━━━━━━━━━━━━━━━━━━━━━
AN AI COACH WITH CONTEXT
━━━━━━━━━━━━━━━━━━━━━━
Ask "what should I train today?" and get an answer based on what you actually lifted this week, what you ate, and how you slept. Not generic advice — your data.

━━━━━━━━━━━━━━━━━━━━━━
SEE THE WHOLE PICTURE
━━━━━━━━━━━━━━━━━━━━━━
• Muscle volume heatmap — see what you are neglecting
• Weekly reports on training load, calories and consistency
• Weight and body measurement trends
• Recovery readiness from sleep and heart rate

━━━━━━━━━━━━━━━━━━━━━━
BUILT FOR GYM LIFE
━━━━━━━━━━━━━━━━━━━━━━
• QR check-in
• See how busy your gym is before you leave home
• Gym buddies and a leaderboard
• 30 lessons on training, nutrition and recovery

━━━━━━━━━━━━━━━━━━━━━━
YOUR DATA
━━━━━━━━━━━━━━━━━━━━━━
Stored in India. Never sold. No ads, ever. Voice recordings and food photos are analysed and immediately discarded — never stored. Delete your account and everything in it at any time, from inside the app.

Health Connect access is entirely optional. Fitzo works fully without it.

Privacy policy: https://www.fitzoapp.in/privacy-policy
Delete your account: https://www.fitzoapp.in/delete-account

Fitzo provides general fitness and nutrition information. It is not a medical device and does not diagnose or treat any condition. Talk to a doctor before starting a new training or nutrition programme.
```

---

## Apple App Store

### App name (30 max)
```
Fitzo: Gym & Nutrition Coach
```

### Subtitle (30 max)
```
Voice logging & AI coaching
```
26 characters.

### Promotional text (170 max, updatable without review)
```
Onboarding is now two screens instead of six. Enter your height in feet and inches or centimetres — whichever you actually think in.
```
Use this slot for what changed recently; it can be edited without resubmitting.

### Keywords (100 max, comma-separated, no spaces)
```
gym,workout,fitness,nutrition,calorie,macro,indian,food,tracker,lifting,strength,coach,diet,protein
```
99 characters. No spaces after commas — a space burns a character and Apple
splits on commas anyway. Do not repeat words already in the name or subtitle;
Apple indexes those separately.

### Description
Reuse the Play full description above, but delete the box-drawing rules —
Apple's renderer handles them poorly on narrow layouts. Replace with plain
headings in caps.

---

## Screenshots

Generated from the live app against the seeded reviewer account, so every number
shown is real app output. Regenerate with:

```bash
node "C:/Users/PC/Documents/Code/Fitzo web/fitzo/capture-store-screenshots.mjs"
```

| Store | Size | Location |
|---|---|---|
| Apple 6.9" (iPhone 17 Pro Max class) | 1320 × 2868 | `mobile/store-screenshots/app-store/` |
| Google Play phone | 1080 × 2160 | `mobile/store-screenshots/google-play/` |

**Why two sets.** Google Play caps screenshot aspect ratio at 2:1. Apple's 6.9"
slot is 1320×2868, which is 2.17:1 — over Play's limit. One set cannot serve
both, so the Play set is rendered at exactly 2:1.

For Apple, uploading the 6.9" set alone is sufficient; App Store Connect scales
it down to every smaller iPhone size automatically.

### Order, and why

Store screenshots are scanned, not read. The first two carry almost all the
weight, so they lead with the differentiator rather than the dashboard.

| # | Screen | Caption to overlay |
|---|---|---|
| 1 | Home | Your day, in one screen |
| 2 | Nutrition | Indian food, actually in the database |
| 3 | Logger | Beat last week's numbers |
| 4 | Coach | An AI coach that knows your history |
| 5 | Stats | See what you are neglecting |
| 6 | Learn | 30 lessons, not 30 opinions |
| 7 | Profile | Streaks that mean something |
| 8 | Buddies | Train with your gym |

Captions are **not yet burned into the images** — the raw captures are clean app
screens. Add them in Figma or Canva before upload; plain screenshots convert
noticeably worse than captioned ones.

### Feature graphic (Play, required)

`Fitzo web/fitzo/feature-graphic.png` — already 1024×500, the exact required
size. Verify it still reflects current branding before upload.

---

## Category and contact

| Field | Value |
|---|---|
| Play category | Health & Fitness |
| Apple primary category | Health & Fitness |
| Apple secondary category | Sports |
| Content rating | Everyone / 4+ |
| Support URL | `https://www.fitzoapp.in` |
| Marketing URL | `https://www.fitzoapp.in` |
| Privacy policy | `https://www.fitzoapp.in/privacy-policy` |
| Support email | `support@fitzoapp.in` — **must be a real, monitored inbox** |

> ⚠️ The old privacy policy listed `support@fitzo.app`, on a domain that is not
> the site. Everything now points at `fitzoapp.in`. Confirm that
> `support@fitzoapp.in` actually receives mail before submitting — both stores
> email this address, and an undeliverable support address is a rejection.
