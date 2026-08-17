# Store Privacy Form Answers

Copy-paste answers for the four questionnaires that gate publication. Every
answer is derived from [`DATA_MAP.md`](./DATA_MAP.md) — if you change what the
app collects, change the data map first, then regenerate these.

Both stores treat a form that contradicts the binary as a **policy violation**,
not a typo. Reviewers do check: Google runs static analysis against declared data
types, and Apple compares your labels to observed network traffic.

---

## A. Google Play — Data safety form

`Play Console → Monitor & Improve → Policy → App content → Data safety`

### A.1 Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — HTTPS/TLS everywhere; the API is HTTPS-only on Render |
| Do you provide a way for users to request that their data be deleted? | **Yes** |
| Account deletion URL | `https://www.fitzoapp.in/delete-account` |
| Does your app have a way for users to delete their account in-app? | **Yes** — Settings → Delete Account |

### A.2 Data types

Legend — **Collected**: leaves the device. **Shared**: transferred to a third
party that is *not* acting as our service provider. **Ephemeral**: held in memory
for the request only, never persisted.

| Data type | Collected | Shared | Ephemeral | Optional? | Purposes |
|---|---|---|---|---|---|
| **Name** | Yes | No | No | Required | App functionality; Account management |
| **Email address** | Yes | No | No | Required | App functionality; Account management |
| **User IDs** | Yes | No | No | Required | App functionality; Account management |
| **Health info** (weight, height, body measurements, heart rate, sleep) | Yes | No | No | Optional | App functionality; Personalisation |
| **Fitness info** (workouts, steps, calories, nutrition logs) | Yes | No | No | Optional | App functionality; Personalisation |
| **Photos** (food photos for macro scanning) | **Yes** | No | **Yes** | Optional | App functionality |
| **Voice or sound recordings** (voice logging) | **Yes** | No | **Yes** | Optional | App functionality |
| **Crash logs** | Yes | No | No | Required | Diagnostics |
| **Diagnostics** | Yes | No | No | Required | Diagnostics |
| **App interactions** | Yes | No | No | Required | Analytics; App functionality |

**Not collected — answer No to all of these:** Approximate location, Precise
location, Physical address, Phone number, Race/ethnicity, Political or religious
beliefs, Sexual orientation, Other personal info, Financial info, Payment info,
Purchase history, Credit score, Messages (SMS/email/in-app), Contacts, Calendar,
Files and docs, Music/audio files, Videos, Web browsing history, Installed apps,
Device or other IDs, Advertising ID.

### A.3 Two judgement calls, explained

**Why Photos and Voice are declared "Collected" but "Ephemeral".**
Google lets you skip a declaration when data is *only* processed ephemerally.
Both qualify — Fitzo never writes either to disk or database (verified: no image
or audio insert exists in `routes/food.js` or `routes/ai.js`). But both leave the
device to reach Gemini, so the conservative reading is to **declare collection
and tick Ephemeral**. Declaring more than the minimum is safe here. Silently
omitting a data type the app demonstrably uploads is what gets apps pulled.

**Why "Shared" is No everywhere — and the one condition that makes it true.**
Google excludes transfers to a *service provider* processing on your behalf.
Two things must hold:

1. Food/nutrition APIs (FatSecret, USDA, Open Food Facts, API Ninjas, ExerciseDB,
   YouTube) receive **search strings with no user identifier** — "paneer tikka"
   with nothing attached. Not personal data, so not sharing. ✅ True today.
2. Gemini must be acting purely as a processor. **On the Gemini free tier this
   is not true** — Google may use submitted content to improve its products,
   which is processing for Google's own purposes, i.e. sharing.

> ⚠️ **"Shared: No" is only accurate once Gemini API billing is enabled.**
> Until then the honest answer for Health info, Fitness info, Photos and Voice is
> *Shared: Yes*. Enabling billing is the cheaper fix and is a launch blocker in
> [`STORE_LAUNCH.md`](../STORE_LAUNCH.md).

---

## B. Google Play — Health apps declaration

`App content → Health apps declaration`. Mandatory for anything in the Health &
Fitness category; incomplete forms **block all future update reviews**, not just
this one.

| Field | Answer |
|---|---|
| Does your app provide health features? | Yes |
| Category | **Fitness and wellness** — *not* a medical device, *not* clinical |
| Does it provide medical device functionality? | **No** |
| Does it make diagnostic or treatment claims? | **No** |
| Does it access Health Connect? | **Yes** |
| Does it handle personal and sensitive health data? | Yes |
| Privacy policy URL | `https://www.fitzoapp.in/privacy-policy` |

### Health Connect data justification

Since January 2026 Google requires a **per-permission justification** and rejects
data collection beyond the app's core function. Keep these tight and specific —
"to improve the experience" gets rejected.

| Permission | Justification |
|---|---|
| `READ_STEPS` | Daily step count is combined with logged workouts to compute the user's active energy expenditure, which sets their daily calorie and macro targets. |
| `READ_ACTIVE_CALORIES_BURNED` | Used directly in the energy-balance calculation so calorie targets reflect actual activity rather than an assumed activity multiplier. |
| `READ_HEART_RATE` | Feeds the readiness score that recommends whether to train hard or deload on a given day. |
| `READ_SLEEP` | Sleep duration is the second input to the same readiness score; recovery cannot be estimated from training load alone. |

Every one of the four is consumed by a feature that ships. If a feature is ever
cut, drop the permission in the same release — an unused health permission is a
straightforward policy violation.

---

## C. Google Play — Content rating (IARC)

`App content → Content rating`

| Question | Answer |
|---|---|
| Category | Utility, Productivity, Communication or Other |
| Violence / sexual content / profanity / controlled substances | No to all |
| User-generated content shared with others | **See note** |
| Does the app share the user's location? | No |
| Does it allow purchases? | No |
| Does it contain ads? | No |

**UGC note.** Free-text posting and commenting were removed (commit `a902775`).
What remains is the squad feed: buddies see each other's *workout summaries* —
exercise names, set counts, volume — and only when sharing is enabled. Structured
records, not free-form user content. Declare **No** for UGC, but say exactly this
in the review notes so the answer is on the record rather than looking like an
oversight. Expected rating: **Everyone / PEGI 3**.

---

## D. Google Play — remaining App content declarations

| Declaration | Answer |
|---|---|
| Ads | **No ads** |
| App access | **All functionality restricted** — reviewer credentials required (§F) |
| Target audience | **18+**. See the age note below |
| News app | No |
| COVID-19 contact tracing | No |
| Data safety | §A |
| Government app | No |
| Financial features | None |

**Age rating — pick 18+, deliberately.** The old policy said 13+. Three reasons
to raise it:

1. India's **DPDP Act 2023** treats anyone under 18 as a child and requires
   verifiable parental consent — Fitzo's primary market is India (Mumbai
   database, Indian food database, INR pricing).
2. Declaring under-18 audiences pulls the app into Google's **Families policy**,
   which brings a much stricter review.
3. Calorie targets and deficit recommendations for minors are a genuine safety
   question, not a paperwork one.

---

## E. Apple — App Privacy labels

`App Store Connect → App Privacy`

**Data used to track you:** *None.* No ad SDK, no ad identifier, no data broker.

**Data linked to you:**

| Category | Types | Purpose |
|---|---|---|
| Contact Info | Name, Email Address | App Functionality |
| Health & Fitness | Health, Fitness | App Functionality |
| Identifiers | User ID | App Functionality |
| User Content | Photos or Videos, Audio Data | App Functionality |
| Usage Data | Product Interaction | Analytics, App Functionality |
| Diagnostics | Crash Data, Performance Data | App Functionality |

**Data not linked to you:** None.

### HealthKit rules that are easy to trip over

Apple enforces these more aggressively than the equivalent Play policies:

- HealthKit data **must not** be used for advertising or marketing. (Fitzo shows
  no ads — compliant by construction.)
- HealthKit data **must not** be shared with third parties for advertising, data
  mining, or resale. **The Gemini free tier is the risk here too** — see §A.3.
- The app **must** have a privacy policy. ✅
- You must not write to HealthKit values the user didn't enter or the app didn't
  measure. Fitzo currently only reads. `NSHealthUpdateUsageDescription` is
  declared in `app.json` but nothing writes — either wire up workout export or
  drop the string, because a declared purpose with no matching behaviour reads as
  sloppy to reviewers.

---

## F. Reviewer access — both stores

Both stores reject apps they can't get into. Everything behind the login is
invisible to a reviewer without working credentials.

```
Email:    review@fitzo.app          ← create this; must survive review
Password: <set a stable one, never rotate it during a review>
```

**The account must be pre-seeded with data.** A reviewer landing on empty
dashboards cannot evaluate the app and may reject it as incomplete. Seed it with:

- 3+ weeks of logged workouts (so charts, PRs and the heatmap have shape)
- 2+ weeks of nutrition logs
- A completed onboarding, so the reviewer lands on the home screen
- A gym membership, so gym features are reachable

**Review notes to paste into both consoles:**

```
Fitzo is a fitness and nutrition tracker for gym members.

SIGN IN
Use the demo account above (email + password). Google Sign-In also works
but requires a Google account.

HEALTH DATA
Health Connect (Android) / HealthKit (iOS) access is optional. The app is
fully functional if you decline. We read four categories — steps, heart
rate, sleep, active calories — to compute daily calorie targets and a
recovery readiness score.

MICROPHONE
Used only for voice logging ("I did 5 sets of bench at 80 kilos"). Audio is
transcribed and discarded; it is never stored.

CAMERA
Two uses: scanning a gym QR code for check-in, and photographing a meal for
macro estimation. Food photos are sent for analysis and never stored.

NO ADS, NO PURCHASES
The app contains no advertising and no in-app purchases.
```

---

## Keeping this file honest

When app behaviour changes, the order is always: update `DATA_MAP.md` → update
this file → update the live privacy policy → resubmit the forms. Skipping
straight to the console is how the three drift apart, and drift is exactly what
reviewers penalise.
