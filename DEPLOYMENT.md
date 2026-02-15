# 🏋️ Fitzo Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (or Supabase account)
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

---

## 🔧 Backend Deployment (Render)

### 1. Setup Environment Variables on Render

When deploying to Render, configure these environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Strong random string for JWT signing |
| `JWT_EXPIRES_IN` | Token expiration (default: `7d`) |
| `NODE_ENV` | Set to `production` |
| `CORS_ORIGIN` | Set to `*` or specific origins |
| `FATSECRET_CLIENT_ID` | FatSecret API credentials |
| `FATSECRET_CLIENT_SECRET` | FatSecret API credentials |
| `USDA_API_KEY` | USDA FoodData Central API key |
| `GEMINI_API_KEY` | Google Gemini AI key |
| `RAPIDAPI_KEY` | RapidAPI key for ExerciseDB |

### 2. Deploy via Render Dashboard

1. Connect your GitHub repository
2. Select the `backend` directory
3. Use these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
4. Add environment variables
5. Deploy!

### 3. Verify Deployment

```bash
curl https://your-app.onrender.com/api/health
```

---

## 📱 Mobile Deployment (Expo/EAS)

### 1. Configure Environment

Copy `.env.production` to `.env` and update:
```
EXPO_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

### 2. Login to EAS

```bash
eas login
```

### 3. Build for Android

```bash
# Preview build (APK for testing)
eas build --platform android --profile preview

# Production build (AAB for Play Store)
eas build --platform android --profile production
```

### 4. Build for iOS

```bash
# Preview build
eas build --platform ios --profile preview

# Production build
eas build --platform ios --profile production
```

### 5. Submit to Stores

```bash
# Android (requires service account key)
eas submit --platform android

# iOS (requires Apple credentials)
eas submit --platform ios
```

---

## 🧪 Pre-Deployment Checklist

### Backend
- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Health endpoint responding (`/api/health`)
- [ ] CORS configured correctly
- [ ] Rate limiting in place
- [ ] Logging configured for production

### Mobile
- [ ] Production API URL set
- [ ] Google OAuth client IDs configured
- [ ] App icons and splash screen set
- [ ] App version bumped
- [ ] Console logs disabled in production
- [ ] Error tracking configured (optional)

---

## 🔐 Security Checklist

- [ ] JWT_SECRET is a strong random string (32+ chars)
- [ ] API keys are not committed to git
- [ ] HTTPS enforced in production
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] Rate limiting enabled

---

## 📊 Monitoring

### Health Check Endpoints

- `GET /health` - Basic health
- `GET /api/health` - Detailed health with DB status

### Recommended Tools

- **Render Dashboard** - Server metrics
- **Supabase Dashboard** - Database monitoring
- **Sentry** - Error tracking (optional)
- **LogRocket** - Mobile analytics (optional)

---

## 🆘 Troubleshooting

### Common Issues

**Backend not starting:**
- Check DATABASE_URL is correct
- Verify all required env vars are set
- Check logs in Render dashboard

**Mobile can't connect to API:**
- Verify EXPO_PUBLIC_API_URL is correct
- Check CORS settings allow your app's origin
- Test API health endpoint directly

**Google Sign-In not working:**
- Verify OAuth client IDs are correct
- Check SHA-1 fingerprint for Android
- Ensure redirect URIs are configured

---

## 📞 Support

For issues, check:
1. Render logs for backend errors
2. Expo logs (`npx expo start --verbose`)
3. Browser/app console for frontend errors
