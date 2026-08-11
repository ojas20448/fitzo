# Fitzo Backend Environment Variables for Render

⚠️ **IMPORTANT**: Your APK food search won't work until these are set on Render!

## 📋 Copy These to Your Render Dashboard

Go to: https://dashboard.render.com → Select 'fitzo' backend → Environment tab

### Essential Variables

```
DATABASE_URL=<REDACTED>
JWT_SECRET=<REDACTED>
NODE_ENV=production
PORT=3001
CORS_ORIGIN=*
```

### API Keys (Required for Food Search & AI)

```
GEMINI_API_KEY=<REDACTED>
FATSECRET_CLIENT_ID=<REDACTED>
FATSECRET_CLIENT_SECRET=<REDACTED>
USDA_API_KEY=<REDACTED>
RAPIDAPI_KEY=<REDACTED>
```

### Google OAuth (Required for Google Sign-In on iOS TestFlight / Android / Web)

```
GOOGLE_CLIENT_ID_WEB=<REDACTED>
GOOGLE_CLIENT_ID_IOS=<REDACTED>
GOOGLE_CLIENT_ID_ANDROID=<REDACTED>
```

---

## 🔧 How to Apply on Render:

1. **Login**: Go to https://dashboard.render.com
2. **Select Service**: Click on your 'fitzo' backend service
3. **Go to Environment**: Click the 'Environment' tab in the left sidebar
4. **Add Variables**: 
   - Click 'Add Environment Variable' button
   - Add each variable name and value from above
   - OR paste all at once if there's a bulk import option
5. **Save**: Click 'Save Changes' button
6. **Wait**: Render will automatically redeploy (takes 2-3 minutes)

---

## ✅ Test Your Backend:

After deployment completes, test with:

```bash
curl https://fitzo.onrender.com/api/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2026-02-17T...","database":"connected"}
```

**Test food search:**
```bash
curl "https://fitzo.onrender.com/api/food/search?q=apple"
```

**Test AI analysis:**
```bash
curl -X POST https://fitzo.onrender.com/api/food/analyze-text \
  -H "Content-Type: application/json" \
  -d '{"text":"2 eggs and toast"}'
```

---

## 🐛 Why Your APK Food Search Didn't Work:

1. **Missing API Keys**: Render backend doesn't have food API keys configured
2. **Cold Start**: Free tier Render apps sleep after 15 min inactivity (first request takes 30s)
3. **Missing CORS**: Need `CORS_ORIGIN=*` for mobile apps

**After setting these variables, rebuild your APK:**
```bash
cd mobile
eas build --platform android --profile preview
```

The new APK will connect to the properly configured Render backend! 🎉
