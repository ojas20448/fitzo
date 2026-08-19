# Fitzo — Store Launch Status

Everything standing between Fitzo and being live on both stores. Written
2026-08-17 from a code audit plus the current Play Console and App Store rules.

Companion documents:
- [`store/DATA_MAP.md`](./store/DATA_MAP.md) — where data actually lives
- [`store/DATA_SAFETY.md`](./store/DATA_SAFETY.md) — copy-paste answers for every console form

---

## Where things stand

| | Google Play | Apple App Store |
|---|---|---|
| Developer account | ✅ | ❓ needed |
| App uploaded | ✅ internal track, versionCode 10 | ❌ never built for iOS |
| Automated submission | ✅ `--auto-submit` wired | ❌ |
| Closed testing | 🔄 **in progress** (12 testers × 14 days) | n/a |
| Privacy policy | ✅ live and rewritten | ✅ same URL |
| Account deletion URL | ✅ **added this session** | n/a |
| Sign in with Apple | ✅ **added this session** | ✅ required, now present |
| Screenshots | ✅ **real captures, both sizes** | ✅ |
| Data safety form | 📝 answers ready, needs filling in | 📝 answers ready |
| Health declaration | 📝 answers ready, needs filling in | n/a |

---

## 1. The Gemini decision — you asked what happens if you don't upgrade

**The situation.** Google's Gemini API has two tiers with materially different
data terms. On the **free tier**, submitted content may be used to improve
Google's products and may be reviewed by humans. On the **paid tier**, it is
not used for training. Fitzo sends voice recordings, food photos, and a health
summary to Gemini — so on the free tier, user health data is in scope for that.

**You do not have to upgrade.** Here are the four real options, honestly rated.

### Option A — Disclose it plainly and keep the free tier ✅ *done, currently in force*

The privacy policy now says outright that content sent to the AI features may
be used by Google to improve its products, and tells the user they can simply
not use those three features. Every other feature works untouched.

- **Cost:** ₹0
- **Store risk:** low. Neither store forbids this; both require that you
  *disclose* it. What gets apps rejected is a policy that claims data is never
  used for training while the free tier is in force.
- **Consequence:** on the Data safety form, Health info / Fitness info / Photos
  / Voice must be declared **Shared: Yes**, because Google is processing for its
  own purposes and not purely as your service provider.
- **Honest downside:** "Shared: Yes" on health data is visible to users on your
  store listing, and it is a genuine competitive disadvantage against apps that
  can answer No.

### Option B — Upgrade billing 💰 *recommended when revenue allows*

Enabling billing on the Gemini API key flips the terms. The policy's AI section
can then be tightened, and Data safety becomes **Shared: No** across the board.

- **Cost:** pay-as-you-go. At Fitzo's current volume this is small, but it is
  not zero and it scales with users.
- This is the only option that makes "we don't share your health data" true
  without removing features.

### Option C — Send less to the AI 🔧 *cheap, worth doing regardless*

The free-tier exposure is proportional to what you send. Right now the coach
context pack includes training history, nutrition, readiness and wearable
metrics. You could:

- strip the context pack down to aggregates ("3 sessions this week, 15% under
  protein target") instead of row-level history
- keep voice and photo — those are unavoidable for the feature — but drop the
  health context from the coach prompt

This reduces what leaves the system without removing a single feature, and it
is worth doing even on the paid tier as basic data minimisation.

### Option D — Make AI features explicitly opt-in 🔧 *strongest consent position*

Add a one-time consent sheet before first use of coach / voice / photo, stating
what is sent and to whom. Nothing reaches Gemini until the user agrees.

- Converts a passive disclosure into active consent, which is what DPDP and
  GDPR actually prefer.
- Costs one screen of work and pairs well with Option A.

**My recommendation:** ship on **A + C** now (already disclosed; minimise the
context pack), add **D** before you have meaningful user numbers, and move to
**B** the moment there is revenue. Nothing here blocks launch.

---

## 2. Blocked on you

| # | Item | Why it matters |
|---|---|---|
| 1 | **Create `support@fitzoapp.in`** | Cited in the privacy policy, the deletion page, and both store listings. Reviewers do email it. A bouncing address is a rejection. |
| 2 | **Create `review@fitzo.app`**, or tell me another address | Currently the reviewer account's login. If the domain doesn't exist the account still works (login is by our own DB), but a reachable address is better. |
| 3 | **Fill the Data safety form** | Answers ready in `store/DATA_SAFETY.md` §A. |
| 4 | **Fill the Health apps declaration** | Answers ready in §B, including the per-permission justifications Google now demands. |
| 5 | **Content rating questionnaire** | Answers in §C. |
| 6 | **Finish closed testing** | 12 testers, 14 continuous days. You said this has started — the clock is the gate. |
| 7 | **Apple Developer Program** ($99/yr) | Nothing iOS can proceed without it. |
| 8 | **Register the Apple Services ID + enable Sign in with Apple capability** | The code is done; the Apple Developer portal side is not. |
| 9 | **Google OAuth SHA-1** | `cd mobile && eas credentials` → Android → register the fingerprint. |
| 10 | **Decide on Gemini billing** | See §1. Not a blocker either way. |

---

## 3. Done this session

**Store compliance**
- Account deletion page at `/delete-account` — Play requires deletion to be
  startable without installing the app. This was missing entirely.
- Privacy policy: added the explicit AI/Gemini disclosure and Apple as a
  processor. Corrected earlier over-disclosure — Fitzo has no `bio` field, no
  progress-photo upload, and no mobile crash reporting, all of which the old
  policy claimed.
- `store/DATA_MAP.md` and `store/DATA_SAFETY.md` written from a code audit.

**Sign in with Apple** — required by Guideline 4.8 wherever Google sign-in is
offered. Backend verifies Apple's RS256 token against the live JWKS with issuer
and audience both checked; `apple_id` migration added; iOS-only button wired.
Two details that are easy to get wrong and are handled: Apple sends the user's
name **only on the first authorisation ever**, so it is captured then or lost;
and private-relay aliases are never used to claim an existing account.

**Reviewer account** — `review@fitzo.app` / `FitzoReview2026!`, seeded with 18
sessions, 282 sets, 56 meals, a 14-day streak, an active PPL split and a gym.
Both stores reject apps they cannot sign into, and reject accounts that look
empty. Re-runnable via `node backend/scripts/seed_review_account.js`.

**Real screenshots** — captured from the running app against that account, at
both required sizes. Not mock-ups.

**Three bugs you flagged, plus one found on the way**
- *Custom exercises missing from the muscle heatmap* — the primary logging path
  never wrote `exercise_logs.muscle_group`, so custom exercises landed in an
  `other` bucket the client silently discards. Verified against production: the
  API was returning `"other": 7940` of volume that never rendered. Added a
  tested classifier (45 tests), wired it into the write path, backfilled 19
  historical rows.
- *Weekly goal* — was hardcoded to 4 and stored only on-device, so a user on the
  PPL 6-day split saw "0 / 4 workouts" and hit "goal crushed" two sessions
  early. Now derives from the active split, with an explicit override still
  winning.
- *Schema drift* — see below; the real finding was much worse than the one
  reported.

---

## 4. ⚠️ The migration runner — read this one

`apply_migrations.js` ran **5** of the 18 files in `src/db/`, and **none** of the
7 in `src/db/migrations/`. Twenty files were unreachable, including
`migrate_workout_logging.sql`, which creates `workout_sessions`,
`exercise_logs`, `set_logs` and `user_splits`.

Production has those tables because they were applied by hand long ago. **The
repository could not rebuild its own database.** If the Supabase project were
ever lost, a restore from source would have come up without the core
workout-logging schema, and the failure would have surfaced later as
`42P01 relation does not exist`.

The runner now sweeps all three locations in dependency order — 34 files instead
of 14 — with `--dry-run` to inspect the plan. `enable_rls.sql` is deliberately
excluded from the automatic sweep: enabling row-level security against untested
policies would lock the API out of its own tables. It is opt-in via `--with-rls`.

**Not yet verified end to end.** Proving the repo can rebuild the database
requires applying it to an empty scratch database, which needs a database I
should not create without asking. Until that is done, treat "the repo can
rebuild prod" as *probable, not proven*.

`scripts/check_schema_drift.js` now guards the other direction — columns that
exist in production but in no repo SQL file. It currently reports exactly one:
`users.subscription_tier`, which is referenced nowhere in the codebase and was
presumably added by hand and abandoned.

---

## 5. Store listing copy

**Title (30 chars max):** `Fitzo: Gym & Nutrition Coach`

**Short description (80 chars max):**
`Track lifts, log meals by voice, and train with an AI coach that knows you.`

**Full description:**

```
Fitzo is a training and nutrition tracker built for people who actually go
to the gym.

LOG A SET IN SECONDS
Previous-set ghosting shows what you lifted last time, so you just confirm
and move on. A plate calculator tells you what to load on the bar. Rest
timer optional.

LOG A MEAL BY TALKING
Say "two rotis, dal, and a bowl of curd" and it becomes macros. Or
photograph the plate. Built on an Indian food database, so it knows what
a paneer bhurji actually contains.

AN AI COACH WITH CONTEXT
Not a chatbot with a fitness prompt. It sees your recent training, your
recovery, and your nutrition, and answers accordingly.

SEE WHAT YOU ARE ACTUALLY TRAINING
A muscle-volume heatmap shows which muscles got worked this week and which
you keep skipping. Progressive overload tracked per exercise.

TRAIN WITH YOUR GYM
Check in by QR, see how busy your gym is before you go, and keep a streak
with your gym buddies.

CONNECTS TO YOUR HEALTH DATA
Optionally reads steps, heart rate, sleep and active calories from Health
Connect or Apple Health to set your daily targets from what you actually
did — not an assumed average.

No ads. No in-app purchases. Your data lives in India and is never sold.
```

**Category:** Health & Fitness · **Ads:** none · **IAP:** none

---

## 6. Screenshots

Captured from the live app signed in as the reviewer account.

| Store | Size | Location |
|---|---|---|
| Apple 6.9" (iPhone 17 Pro Max class) | 1320 × 2868 (ratio 2.173) | `mobile/store-listing/app-store/` |
| Google Play | 1080 × 2160 (ratio 2.000) | `mobile/store-listing/google-play/` |

**Upload from `store-listing/`, not `store-screenshots/`.** The latter holds the
raw app captures, which are the *input*. Raw captures alone read as cramped in
a store listing: the screen renders small, nothing frames it, and nothing tells
a browsing user what they are looking at.

`store-listing/` holds the finished marketing panels — accent glow, eyebrow,
headline, and the device bleeding off the bottom edge so the screen shows large
rather than being shrunk whole into frame.

Eight panels each: home, stats, coach, logger, nutrition, profile, learn,
buddies.

Regenerate:

```bash
# 1. seed the reviewer account
cd backend && node scripts/seed_review_account.js

# 2. serve the app POINTED AT PRODUCTION (see the trap below)
cd ../mobile && EXPO_PUBLIC_API_URL=https://fitzo.onrender.com/api \
  npx expo start --web --port 8100

# 3. from the website project (Playwright lives in its node_modules)
FITZO_WEB_URL=http://localhost:8100 node scripts/capture-store-screenshots.mjs

# 4. compose the raw captures into marketing panels
node scripts/compose-store-panels.mjs
```

> **The trap.** `mobile/.env.local` points `EXPO_PUBLIC_API_URL` at
> `http://localhost:3001/api` and **overrides** `mobile/.env`. With no local
> backend running, every request fails with `ERR_CONNECTION_REFUSED`, the login
> never completes, and the capture used to silently emit a full set of
> logged-out screenshots — plausible-looking, showing "0 sessions" and an
> untrained muscle map. The script now waits for a real post-login signal and
> aborts loudly instead, but the env override is the actual fix.

> **Caveat worth knowing:** these are captured from the Expo **web** build, so
> they are the real UI with real data but rendered by the browser. Fonts and
> shadows can differ very slightly from native. They are honest and shippable;
> if you want pixel-exact native captures, take them on-device once the dev
> build lands and drop them in the same folders.

---

## 7. Ordered path to live

**Play (closest):**
1. Finish the 14-day closed test ← *the gate, already running*
2. Fill Data safety + Health declaration + content rating (§2)
3. Create `support@fitzoapp.in`
4. Apply for production access
5. `cd mobile && eas build --profile production --platform android --auto-submit`

**Apple:**
1. Join the Apple Developer Program
2. Register the Services ID and enable the Sign in with Apple capability
3. Build for iOS — this has never been done, so budget time for first-build issues
4. Fill App Privacy labels (§E of `DATA_SAFETY.md`)
5. Submit with the reviewer account and the review notes from §F

---

## Change log

| Date | Change |
|---|---|
| 2026-08-17 | Written. Added Sign in with Apple, deletion page, reviewer account, real screenshots; fixed the muscle-heatmap and weekly-goal bugs; found and fixed the migration runner covering 20 unreachable files. |
