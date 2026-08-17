# Fitzo — Path to the Stores

Everything standing between Fitzo and a public listing, in the order it has to
happen. Researched and assembled 2026-08-17 against current Play Console and App
Store Connect rules.

**Where things stand:** Android is already building and shipping to the Play
**internal** track (`versionCode 10`). Nothing has been done for iOS. The gating
work is no longer engineering — it is the compliance paperwork, and one
production account decision.

Supporting documents:

- [`store/DATA_MAP.md`](./store/DATA_MAP.md) — where data lives, who processes it
- [`store/DATA_SAFETY.md`](./store/DATA_SAFETY.md) — field-by-field form answers
- [`store/LISTING.md`](./store/LISTING.md) — listing copy, screenshots, keywords

---

## 🔴 Blockers — nothing ships until these are done

### 1. Enable billing on the Gemini API key

The single most important item, and the least obvious.

Fitzo sends **voice recordings, food photos, and a health-data context pack** to
Gemini. On the **free tier**, Google may use submitted content to improve its
products and may have it human-reviewed. On the **paid tier** it may not.

That difference decides three things at once:

- Whether the privacy policy's claims are true
- Whether the Data safety form can honestly answer **Shared: No** (free tier ⇒
  the honest answer is *Yes*, because Google is processing for its own purposes)
- Whether the app satisfies Play's Health apps policy and Apple's HealthKit
  terms, both of which restrict onward use of health data

Enabling billing is far cheaper than the alternatives. → Google AI Studio → the
Fitzo project → enable billing.

### 2. Closed testing: 12 testers, 14 continuous days

Personal Play developer accounts created after 13 Nov 2023 cannot reach
production until they have run a closed test with **12 testers opted in
continuously for 14 days**. "Opted in" means each tester accepted the invite and
installed the build under the matching Google account.

- Start **now** — it is a 14-day wall clock, and nothing else shortens it
- Losing testers below 12 mid-window restarts the count
- Everything else on this page can proceed in parallel

*(If the account is an organisation account rather than personal, this does not
apply — verify which it is before assuming a 2-week delay.)*

### 3. Confirm `support@fitzoapp.in` receives mail

Both stores email this address, and the old policy pointed at
`support@fitzo.app` — a different domain from the actual site. Everything now
points at `fitzoapp.in`. An undeliverable support address is a rejection.

### 4. Health apps declaration

Mandatory for Health & Fitness apps. Until it is submitted, **all future app
updates are blocked from review**, not just this one. Answers are pre-written in
[`DATA_SAFETY.md` §B](./store/DATA_SAFETY.md), including the per-permission
Health Connect justifications that Google began requiring in January 2026.

---

## ✅ Done in this pass

| Item | Where |
|---|---|
| Data-flow audit from source | `docs/store/DATA_MAP.md` |
| Privacy policy rewritten to match reality | `fitzoapp.in/privacy-policy` |
| Web account-deletion page (a Play requirement) | `fitzoapp.in/delete-account` |
| Play Data safety answers | `DATA_SAFETY.md` §A |
| Health apps declaration answers | `DATA_SAFETY.md` §B |
| Content rating answers | `DATA_SAFETY.md` §C |
| Apple App Privacy labels | `DATA_SAFETY.md` §E |
| Reviewer account, seeded with real history | `backend/scripts/seed_review_account.js` |
| Review notes for both consoles | `DATA_SAFETY.md` §F |
| Store listing copy, both stores | `store/LISTING.md` |
| Screenshots, Apple 1320×2868 | `mobile/store-screenshots/app-store/` |
| Screenshots, Play 1080×2160 | `mobile/store-screenshots/google-play/` |
| Feature graphic 1024×500 | `Fitzo web/fitzo/feature-graphic.png` |

### What the privacy policy rewrite actually changed

The previous policy was not merely thin — it was **wrong in both directions**,
which is the worst position to be in with a reviewer:

**Claimed data we never touch** (over-disclosure invites scrutiny and forces
inaccurate Data safety answers):
- A user `bio` — no such column exists
- Progress photo uploads — no upload path exists; avatars are 9 bundled presets
- Mobile crash reporting — there is no Sentry dependency in the mobile app

**Omitted things we genuinely do** (under-disclosure is a policy violation):
- Health Connect / HealthKit data, which Google and Apple both require be
  disclosed explicitly and per-category
- Voice recordings leaving the device for transcription
- Food photos leaving the device for macro analysis
- That a health-data context pack is sent to a third-party AI
- Where data physically lives (Mumbai, `ap-south-1`)
- Any named processor list, any retention period

It also raised the age floor from 13 to **18** — India's DPDP Act treats under-18s
as children requiring verifiable parental consent, and declaring an under-18
audience would pull the app into Google's much stricter Families policy.

---

## 📋 Play Console — remaining steps

1. **App content** — complete every declaration in `DATA_SAFETY.md` §A–D
2. **Store listing** — paste from `LISTING.md`; upload the `google-play/` screenshots
   and the feature graphic
3. **Testers** — recruit 12, keep them opted in for 14 days
4. **Production access** — apply on the Play Console dashboard once the window
   closes
5. **Release** —
   ```bash
   cd mobile && eas build --profile production --platform android --auto-submit
   ```
   Automated submission is already wired up (service account, key, and the Play
   Android Developer API are all enabled). Builds land on the internal track;
   promote from the console.

---

## 🍎 App Store — not started

Nothing here exists yet. Ordered by lead time:

1. **Apple Developer Program membership** — $99/year, and identity verification
   can take days. Start first.
2. **App Store Connect record** — bundle ID `com.fitzo.app` (already reserved in
   `app.json`).
3. **iOS build** —
   ```bash
   cd mobile && eas build --profile production --platform ios
   ```
   EAS can manage signing; expect first-run certificate setup.
4. **App Privacy labels** — `DATA_SAFETY.md` §E.
5. **Screenshots** — upload the `app-store/` set (1320×2868). That single size covers
   every smaller iPhone.
6. **Review notes and demo account** — `DATA_SAFETY.md` §F.

### iOS-specific risks

- **HealthKit.** Apple scrutinises health apps harder than Google. Blocker #1
  (Gemini billing) matters more here: Apple explicitly prohibits sharing
  HealthKit data with third parties for data mining.
- **`NSHealthUpdateUsageDescription` is declared but nothing writes to
  HealthKit.** Either implement workout export or remove the string — a declared
  purpose with no matching behaviour reads as careless.
- **Guideline 4.2 (minimum functionality).** Not a real risk; Fitzo is
  substantial.
- **Sign in with Apple.** Offering Google Sign-In means Apple requires Sign in
  with Apple as an equivalent option. **This is currently not implemented and
  will cause rejection.** Budget engineering time, or drop Google Sign-In on iOS.

---

## 🐛 Found while doing this work

Real defects surfaced by seeding and screenshotting a realistic account. None
block launch, but the first two are user-visible.

### 1. Custom exercises count as zero in the Muscle Volume heatmap

The heatmap resolves muscle groups through `exercise_logs.exercise_id`. A log
with only `custom_exercise_name` set — which is what you get for any exercise not
in the 164-row catalogue — contributes **nothing** to any muscle group.

Seeding 282 sets produced a heatmap reading "UNTRAINED" across every group.
Anyone who logs custom exercises sees a blank heatmap and no explanation.

*Fix:* let custom exercises carry a muscle group, or fall back to the parent
session's `workout_type`.

### 2. Gym occupancy card layout collision — **fixed in this pass**

`CrowdIndicator`'s root sets `flex: 1`, so inside the gym card it claimed half
the row and pushed the gym name into the percentage — "Iron Paradise" rendered
on top of "0%". Fixed in `HomeScreen.tsx` by wrapping the indicator and giving
the text block `flex: 1; minWidth: 0`.

### 3. Schema drift: `users.username`

`username` is **NOT NULL in production** but absent from
`backend/src/db/schema.sql`. Anyone rebuilding a database from the repo gets a
schema that silently disagrees with production. Found because the seed script
failed against prod.

*Fix:* add the column to `schema.sql`, or drop the NOT NULL in a migration.

### 4. Two vocabularies for one concept

`fitness_goal` is `deficit | maintenance | surplus`; `nutrition_goal` is
`fat_loss | maintenance | muscle_gain`. Both describe the same user intent, and
`fitness_profiles` / `nutrition_profiles` store it twice. Worth collapsing.

### 5. Weekly workout goal ignores the chosen split, and is device-local

`weeklyWorkoutGoal` defaults to `4` and is only ever changed by hand on the
Fitness Profile screen. Selecting **PPL (6 Day)** does not update it, so a user
on a 6-day split sees "0 / 4 workouts" — a target contradicting the plan the app
itself assigned them.

It is also persisted to **AsyncStorage keyed by user id, not to the server**, so
it silently resets to 4 on reinstall or on a second device.

*Fix:* default it from the active split's `days_per_week`, and move it to
`nutrition_profiles` so it syncs.

---

## Ongoing: keeping the three artifacts in sync

Whenever data handling changes, the order is always:

```
DATA_MAP.md  →  DATA_SAFETY.md  →  live privacy policy  →  console forms
```

Editing the console directly is how the four drift apart, and drift between a
store form and the shipped binary is treated as a policy violation rather than
an oversight.
