# Fitzo Data Map

**What this is.** The single source of truth for where Fitzo's data physically
lives, who else touches it, and how long it stays. Every other compliance
artifact — the privacy policy, the Play Data safety form, Apple's App Privacy
labels — must be derived from *this file*, not written from memory.

Derived by reading the code on 2026-08-17, not from the previous policy text.
Where the code could not answer a question, the row says **VERIFY** rather than
guessing. A Data safety form that contradicts the binary is a policy violation,
so guesses are worse than gaps.

Last verified against: `backend/src/`, `mobile/src/`, `mobile/app.json`,
`backend/package.json`.

AI processing and consent notes below updated on 2026-10-23. The owner reports
funding the paid Gemini API; the production project's billing and optional
data-sharing settings still need to be checked in Google AI Studio.

The production API moved from Render to Oracle Cloud on 2026-10-17; the public
API hostname currently resolves to the Oracle VM. Render references below
describe legacy hosting/configuration and must not be read as current deployment
verification.

---

## 1. Data at rest

| Store | Provider | Region | Contents | Encrypted |
|---|---|---|---|---|
| Primary database | Supabase Postgres | **AWS `ap-south-1` (Mumbai, India)** — confirmed by the pooler host `aws-1-ap-south-1.pooler.supabase.com` | Every account, profile, workout, meal, measurement, XP, friendship, gym link | At rest (Supabase default) + TLS in transit |
| Cache | Upstash Redis | **VERIFY** in Upstash console | Home-screen payloads, streak counters, user lookup cache. Derived data only — nothing lives here that isn't in Postgres | TLS |
| Auth token (device) | `expo-secure-store` | On device | JWT bearer token | iOS Keychain / Android Keystore |
| Preferences (device) | AsyncStorage | On device | Non-sensitive UI prefs | No (not needed) |

> **Cache caveat.** `UPSTASH_REDIS_REST_URL` / `_TOKEN` are still unset in Render,
> so the cache is currently inert and nothing is written there at all. It still
> belongs in the policy because the code path exists and will activate the moment
> those variables are set.

### What the `users` row actually holds

`email`, `password_hash` (bcrypt), `name`, `role`, `avatar_url`, `gym_id`,
`trainer_id`, `xp_points`, timestamps.

Two corrections to the **old** privacy policy, which over-disclosed:

- **No `bio` column exists.** The policy claimed to collect one.
- **No progress-photo upload exists.** The policy said "progress photos (if
  uploaded)". `avatar_url` points at one of the nine bundled preset avatars
  (`avatar_lion`, `avatar_zeus`, …), not a user-uploaded image.

Over-disclosure is not the safe default. Claiming to collect photos puts the app
into Google's Photo and Video Permissions policy and Apple's photo-data label for
data it never touches — inviting scrutiny, and a Data safety form that
contradicts the app's actual behaviour.

---

## 2. Data in transit — every third party

Anything the backend sends outward. Ordered by how sensitive the payload is.

| # | Processor | What we send | Contains health data? | Purpose |
|---|---|---|---|---|
| 1 | **Google Gemini** (`@google/generative-ai`) | Voice recordings (base64), food photos (base64), meal/workout text, and the **coach context pack** — training history, nutrition totals, readiness, wearable metrics | **Yes — the most sensitive flow in the app** | Voice logging, photo food scan, AI coach |
| 2 | **Google Identity** (`google-auth-library`) | Google ID token for signature/audience verification | No | Google Sign-In |
| 3 | **Expo Push** (`exp.host`) | Push token + notification body | Only if a body quotes a stat | Notifications |
| 4 | **Resend** | Email address + message body | No | Password reset, gym invites |
| 5 | **Sentry** (backend only) | Stack traces, request metadata | Incidental only | Crash/error tracking |
| 6 | **FatSecret** (`platform.fatsecret.com`) | Food search strings | No | Nutrition lookup |
| 7 | **USDA FoodData Central** | Food search strings | No | Nutrition lookup |
| 8 | **Open Food Facts** | Barcode numbers | No | Barcode scan |
| 9 | **API Ninjas** | Food strings, activity descriptions | No | Nutrition + calories-burned fallback |
| 10 | **RapidAPI / ExerciseDB** | Exercise names | No | Exercise catalogue |
| 11 | **YouTube Data API** | Exercise names | No | Form-check videos |
| 12 | **Groq** (when configured for transcription or fallback) | Voice recordings | May contain spoken fitness or health details | Voice transcription |
| 13 | **Google Antigravity / designated laptop** (optional worker mode) | Queued food photos and AI requests | Yes | Worker processing; separate account terms from the paid Gemini API |

Rows 6–11 receive **search strings only** — never a user identifier. "chicken
biryani" leaves the server with no way to tie it back to a person. That
distinction is what lets the Data safety form answer *not shared* for them, and
it is worth preserving in any future refactor.

### Paid Gemini API handling and shared consent

Google's Gemini API treats the two tiers very differently:

- **Free tier** — prompts and responses **may be used to improve Google's
  products**, and may be human-reviewed.
- **Paid tier** — Google excludes prompts and responses from product/model
  improvement under its paid API terms. This does not mean zero storage:
  safety and legal retention still apply, and authorized human review for
  policy enforcement is possible. Voluntary log/dataset sharing is separate.

Paid treatment applies to the Cloud project used by Fitzo's actual backend key,
not just any project with a prepaid balance. Keep voluntary data sharing off.
Groq and Antigravity have their own terms/settings; funding Gemini does not
change those services' handling.

The app asks once through the shared **Enable Fitzo AI** sheet, before first use
of coaching, insights, photo analysis, text food estimates or voice logging.
The existing stored permission is reused across features on that installation.
**Profile → Fitzo AI** changes that choice; manual logging stays available.
Worker-mode consent retains its separate existing storage key and disclosure.
Camera, microphone and connected-health permissions remain separate OS choices.

The server cannot verify this device-only permission for background batches.
The daily/weekly AI cron routes therefore skip processing until account-level
consent and revocation exist. Opted-in app requests still generate insights and
recaps on demand. This also pauses scheduled AI report push notifications.

Sources: [Gemini API terms](https://ai.google.dev/gemini-api/terms),
[abuse monitoring](https://ai.google.dev/gemini-api/docs/usage-policies),
[logging and sharing](https://ai.google.dev/gemini-api/docs/logs-policy),
[Groq data handling](https://console.groq.com/docs/your-data).

---

## 3. Data the app reads from the device

| Source | Permission | Data | Leaves the device? |
|---|---|---|---|
| Microphone | `RECORD_AUDIO` / `NSMicrophoneUsageDescription` | Temporary voice recording | **Yes** — to Gemini or Groq for transcription; provider retention applies |
| Camera | `CAMERA` / `NSCameraUsageDescription` | Gym QR frames; food photos | QR: **no**, decoded on device. Food photo: **yes** — to Gemini or the optional worker; provider retention applies |
| Health Connect (Android) | `health.READ_STEPS`, `READ_HEART_RATE`, `READ_SLEEP`, `READ_ACTIVE_CALORIES_BURNED` | Steps, HR, sleep, active calories | Yes — stored in Postgres, and included in the coach context pack |
| HealthKit (iOS) | `NSHealthShareUsageDescription` | Same four categories | Same |

The direct photo route sends base64 to the provider without creating a backend
photo archive. Camera/recording files can exist temporarily on the device.
Optional worker mode also stores queued photos and laptop artifacts until
completion or expiry. Local cleanup does not delete provider records, so do
not describe these flows as "never stored" or promise provider-wide ephemeral
processing.

---

## 4. Deletion

**In-app:** Settings → Delete Account → `DELETE /api/auth/account` →
`DELETE FROM users WHERE id = $1`.

The schema carries **15 `ON DELETE CASCADE`** foreign keys, so workouts,
nutrition logs, measurements, friendships and readiness rows go with the user
row. Two columns are deliberately `ON DELETE SET NULL` (`trainer_id`,
`gym_id`) so deleting a member doesn't cascade into other people's records.

**Gaps to close before launch:**

- ❌ **No web deletion route.** Google Play requires deletion to be initiable
  *without installing the app*. Fixed by adding `/delete-account` to the site.
- **VERIFY:** cache keys and Expo push tokens for a deleted user. Postgres
  cascades cleanly, but Redis entries are not in the FK graph and expire on TTL
  rather than on delete.

---

## 5. Retention

| Data | Retention |
|---|---|
| Account + all fitness history | Until the user deletes the account |
| Voice recordings | Temporary device recording and request processing; Google/Groq retention and account settings apply separately |
| Food photos | Temporary device file and request processing; optional worker queue/laptop copies until cleanup or expiry; Google retention applies separately |
| Cache entries | TTL-bounded, minutes to hours |
| Backend error traces | Sentry's retention (90 days default — **VERIFY** the plan) |
| Backups | Supabase automatic PITR — **VERIFY** window on the current plan |

---

## 6. Not collected

Stating these plainly is what makes the rest of the policy credible, and each is
a "No" on the Data safety form:

- ❌ Precise or coarse **location** — no location permission is declared
- ❌ **Advertising identifiers** — no ad SDK is present
- ❌ **Contacts, SMS, call logs, calendar**
- ❌ **Payment or financial data** — no IAP, no payment SDK
- ❌ **Third-party analytics** (no Firebase Analytics, no Amplitude, no Mixpanel).
  Mobile has **no** Sentry dependency either — crash reporting is backend-only,
  which means the old policy's "crash reports" claim overstated the mobile app.
- ❌ **Data selling or brokering** of any kind

---

## Change log

| Date | Change |
|---|---|
| 2026-08-17 | Written from a code audit. Corrected the bio / progress-photo / mobile-crash-reporting over-disclosures; flagged the Gemini free-tier training issue; recorded the missing web deletion route. |
