# Owner Actions — Secret Rotation & Restore

> **Why this is mandatory, not optional.** `RENDER_ENV_SETUP.md` was committed to
> GitHub with 11 real values in it. Redacting the file did **not** remove them —
> anyone can run `git log -p -- RENDER_ENV_SETUP.md` on the repo and read every
> one. Treat all of them as public. Rotating is the only fix.
>
> Two places to paste each new value:
> **(A) Render** → fitzo-backend → Environment → Environment Variables
> **(B) `backend/.env`** locally (this file is gitignored — safe, and currently
> full of `<REDACTED>` placeholders, which is why local dev is down).

---

## 1. ROTATE — leaked, real secrets

Do these in order. Each: revoke/regenerate at the source, then paste into **both**
Render and `backend/.env`.

| # | Variable | Where to get a new one | Notes |
|---|----------|------------------------|-------|
| 1 | `DATABASE_URL` | [Supabase](https://supabase.com/dashboard) → your project → Settings → Database → **Reset database password** | Most critical — this is full read/write on all user data. Use the **Session Pooler** URI (IPv4), same shape as before. |
| 2 | `JWT_SECRET` | Generate yourself (below) | Equally critical: with the old one, anyone can forge a login token for **any** user, including managers. Rotating logs everyone out — fine at your current size. |
| 3 | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) → delete old key, create new | Billable. Powers coach, voice logging, photo food scan. |
| 4 | `FATSECRET_CLIENT_ID` + `FATSECRET_CLIENT_SECRET` | [FatSecret Platform](https://platform.fatsecret.com/api) → Manage Apps → regenerate | Rotate as a pair. |
| 5 | `RAPIDAPI_KEY` | [RapidAPI](https://rapidapi.com/developer/security) → regenerate | Billable. ExerciseDB. |
| 6 | `USDA_API_KEY` | [USDA FoodData](https://fdc.nal.usda.gov/api-key-signup.html) → request new | Free tier, but it leaked — replace it. |

Generate the JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 2. DO **NOT** rotate — these leaked but are not secrets

`GOOGLE_CLIENT_ID_WEB`, `GOOGLE_CLIENT_ID_IOS`, `GOOGLE_CLIENT_ID_ANDROID`

OAuth **client IDs are public identifiers** — they ship inside every copy of your
app binary and are visible to anyone who downloads it. They are not credentials.
Rotating them would break every installed build for no security gain.

(A Google *client **secret*** would be sensitive — you don't use one. This app uses
the native sign-in flow, which has no client secret.)

Also not secrets, ignore: `CORS_ORIGIN`, `NODE_ENV`, `PORT`.

---

## 3. RESTORE — not leaked, but wiped from your local `.env`

The cleanup script scrubbed these locally even though they never reached GitHub.
Copy the existing values **out of Render** back into `backend/.env` — no rotation
needed:

- `RESEND_API_KEY` — password-reset + invite emails
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — caching (app works
  without them, just slower and with a stale-streak bug window)
- `SENTRY_DSN` — error tracking

---

## 4. ADD — referenced by code, never configured

| Variable | Where to get it | What breaks without it |
|----------|----------------|------------------------|
| `CRON_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` | Morning coach insights + Monday recaps never fire. **Also paste into GitHub → Settings → Secrets → Actions** as `CRON_SECRET` — the two must match exactly. |
| `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → enable **YouTube Data API v3** → create API key | Workout form videos silently serve mock data. |
| `API_NINJAS_KEY` | [API Ninjas](https://api-ninjas.com/profile) | One nutrition fallback source is skipped. |
| `GOOGLE_CLIENT_ID_ANDROID_DEBUG` | Google Cloud Console → Credentials → your Android OAuth client (debug SHA-1) | Google sign-in fails on local debug builds only. |

---

## 5. AFTER pasting — run these

```bash
# 1. Local dev works again + creates the missing user_foods table
cd backend
node apply_migrations.js
npm run dev

# 2. Confirm production came back up after the Render redeploy
curl https://fitzo.onrender.com/api/health
# expect: {"status":"ok", ... "database":"ok"}
```

Then rebuild the mobile dev client — `expo-audio` is a **new native module**, so a
JS reload will not pick it up:

```bash
cd mobile
eas build --profile development --platform android
```

---

## 6. Google OAuth — the remaining piece

Backend audiences and the `eas.json` client IDs are fixed in code. If sign-in still
fails on Android with `DEVELOPER_ERROR`, the SHA-1 isn't registered:

```bash
cd mobile && eas credentials       # → Android → show the SHA-1 fingerprint
```

Paste that fingerprint into [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
→ your **Android** OAuth client. EAS signs with its own keystore, so its SHA-1 is
different from your local debug key — both need to be registered.

---

## 7. Stop it happening again

- [ ] `RENDER_ENV_SETUP.md` is now gitignored, but **still tracked**. Untrack it:
      `git rm --cached RENDER_ENV_SETUP.md && git commit -m "chore: untrack env setup doc"`
- [ ] Never paste a real value into a `.md` file. Document the **names** only;
      values live in Render and `backend/.env`.
- [ ] Optional: enable GitHub → Settings → Code security → **Secret scanning +
      push protection** — it blocks commits containing credentials.
