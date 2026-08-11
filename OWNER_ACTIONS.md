# Owner Actions Checklist
## 1. Supabase
- [ ] Log into the Supabase dashboard.
- [ ] Reset the password for user `postgres.pieyjxokfjvsnfygblmv` (do not use the previously leaked database password).
- [ ] Update `DATABASE_URL` in Render to use the new password.

## 2. Render (Missing Env Vars)
- [ ] Go to the fitzo backend in render.com.
- [ ] Add `YOUTUBE_API_KEY` (create a Google Cloud API key for YouTube Data V3).
- [ ] Add `API_NINJAS_KEY`.
- [ ] Add missing mobile Client IDs using the values from `mobile/.env`:
  - `GOOGLE_CLIENT_ID_IOS`
  - `GOOGLE_CLIENT_ID_ANDROID`
  - `GOOGLE_CLIENT_ID_ANDROID_DEBUG`
- [ ] Add a secure hex string for `CRON_SECRET`.

## 3. GitHub Actions
- [ ] Set `CRON_SECRET` in repository Settings > Secrets to exactly match the value in Render.

## 4. Rotate Leaked API Keys
Log into the following services to revoke the leaked keys, generate new ones, and paste the new keys into Render:
- [ ] Gemini
- [ ] FatSecret
- [ ] USDA
- [ ] RapidAPI
- [ ] Resend

## 5. JWT
- [ ] Update `JWT_SECRET` in Render to a long, random hexadecimal string (replacing the leaked JWT secret).

## 6. Google OAuth Configuration
- [ ] Add test users in the Google Cloud Console before publishing.
- [ ] Ensure the iOS bundle ID and Android package is exactly `com.fitzo.app`.
- [ ] Register the appropriate SHA-1 hashes for the two Android client IDs.
- [ ] Download the `google-services-key.json` and save it to `mobile/`.
