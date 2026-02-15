# 🔔 Push Notifications Setup Guide

This guide explains how to configure push notifications for Fitzo on iOS (APNs) and Android (FCM).

## Overview

Fitzo uses **Expo Push Notifications** which handles the complexity of APNs and FCM for you. The flow is:

```
Mobile App → Expo Push Service → APNs/FCM → Device
```

## Prerequisites

1. Expo account (free at expo.dev)
2. Apple Developer account (for iOS - $99/year)
3. Google Cloud/Firebase account (for Android - free)

---

## 📱 Step 1: Configure Expo Project

### 1.1 Verify Project ID

Your project ID is already configured in `app.json`:

```json
{
  "extra": {
    "eas": {
      "projectId": "30c3c5e6-e055-4640-9daa-ae04f9c32ac8"
    }
  }
}
```

### 1.2 Link to Expo

```bash
cd mobile
eas init
```

---

## 🍎 Step 2: iOS Setup (APNs)

### 2.1 Apple Developer Configuration

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select your App ID (com.fitzo.app)
4. Enable **Push Notifications** capability

### 2.2 Create APNs Key (Recommended)

1. Go to **Keys** in Apple Developer Portal
2. Click **+** to create a new key
3. Enter name: "Fitzo Push Key"
4. Check **Apple Push Notifications service (APNs)**
5. Click **Continue** and **Register**
6. **Download the .p8 file** (you can only download once!)
7. Note your **Key ID** and **Team ID**

### 2.3 Upload to Expo

```bash
eas credentials

# Select iOS
# Select "production" 
# Choose "Push Key"
# Upload your .p8 file
# Enter Key ID and Team ID
```

Or upload via Expo Dashboard:
1. Go to https://expo.dev
2. Select your project
3. Go to **Credentials** → **iOS**
4. Upload APNs Key

### 2.4 Enable Background Modes (already configured)

In `app.json`, this is already set:

```json
{
  "ios": {
    "infoPlist": {
      "UIBackgroundModes": ["remote-notification"]
    }
  }
}
```

---

## 🤖 Step 3: Android Setup (FCM)

### 3.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add Project**
3. Name it "Fitzo" 
4. Disable Google Analytics (optional)
5. Click **Create Project**

### 3.2 Add Android App

1. In Firebase Console, click **Add App** → **Android**
2. Package name: `com.fitzo.app`
3. App nickname: "Fitzo"
4. Click **Register App**
5. Download `google-services.json`

### 3.3 Place google-services.json

Copy the downloaded file to your mobile directory:

```
mobile/
├── google-services.json  ← Place here
├── app.json
└── ...
```

This is already referenced in `app.json`:

```json
{
  "android": {
    "googleServicesFile": "./google-services.json"
  }
}
```

### 3.4 Upload FCM Server Key to Expo

1. In Firebase Console, go to **Project Settings** → **Cloud Messaging**
2. Under **Cloud Messaging API (Legacy)**, enable if needed
3. Copy the **Server Key**

Upload to Expo:
```bash
eas credentials

# Select Android
# Select "production"
# Choose "FCM Server Key"
# Paste your server key
```

Or via Expo Dashboard:
1. Go to https://expo.dev → Your Project
2. **Credentials** → **Android**
3. Add FCM Server Key

---

## 🗄️ Step 4: Database Migration

Run the migration to add notification columns:

```bash
cd backend

# Using the migration script
node scripts/run_sql.js data/migrations/005_push_notifications.sql

# Or manually via psql
psql $DATABASE_URL -f data/migrations/005_push_notifications.sql
```

---

## 🧪 Step 5: Test Notifications

### Test from Mobile App

After logging in, the app automatically registers for push notifications. To test:

```typescript
// In your app, call:
import { notificationService } from '@/services/notifications';
await notificationService.registerForPushNotificationsAsync();
```

### Test from Backend

Send a test notification via API:

```bash
# Replace TOKEN with your auth token
curl -X POST http://localhost:3001/api/notifications/test \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

### Test via Expo Push Tool

1. Go to https://expo.dev/notifications
2. Enter an Expo Push Token
3. Send a test message

---

## 📝 Notification Channels (Android)

The app creates these notification channels:

| Channel ID | Name | Use Case |
|------------|------|----------|
| `default` | Default | General notifications |
| `workout-reminders` | Workout Reminders | Scheduled workout alerts |
| `streak-alerts` | Streak Alerts | Streak maintenance warnings |
| `social` | Social Activity | Friend activities |
| `class-reminders` | Class Reminders | Upcoming class alerts |

Users can configure these independently in Android settings.

---

## 🔧 Backend Integration

### Send notification to a user

```javascript
const pushNotifications = require('./services/pushNotifications');

// Send to specific user
await pushNotifications.sendToUser(userId, {
    type: 'workout_reminder',
    title: '🏋️ Workout Time!',
    body: 'Your leg day workout is ready'
});

// Send to multiple users
await pushNotifications.sendToUsers([userId1, userId2], {
    title: 'New Feature!',
    body: 'Check out our new workout tracker'
});

// Broadcast to all users
await pushNotifications.sendBroadcast({
    title: '🎉 Happy New Year!',
    body: 'Start the year strong with Fitzo'
});
```

### Available notification types

```javascript
const { NotificationType } = require('./services/pushNotifications');

NotificationType.WORKOUT_REMINDER  // 'workout_reminder'
NotificationType.STREAK_ALERT      // 'streak_alert'
NotificationType.FRIEND_ACTIVITY   // 'friend_activity'
NotificationType.CLASS_REMINDER    // 'class_reminder'
NotificationType.ACHIEVEMENT       // 'achievement'
NotificationType.GENERAL           // 'general'
```

---

## ⚠️ Troubleshooting

### Notifications not received

1. **Check token registration**: Look for `push_token` in users table
2. **Verify credentials**: Run `eas credentials` to check
3. **Test with Expo tool**: https://expo.dev/notifications
4. **Check device settings**: Ensure notifications are enabled

### Invalid token errors

The backend automatically removes invalid tokens. If a device uninstalls the app, the token becomes invalid.

### iOS Sandbox vs Production

- Development builds use APNs Sandbox
- Production builds use APNs Production
- Expo handles this automatically based on build profile

### FCM not working

1. Verify `google-services.json` is in place
2. Check FCM Server Key is uploaded to Expo
3. Rebuild the app: `eas build --platform android`

---

## 📚 Resources

- [Expo Push Notifications Docs](https://docs.expo.dev/push-notifications/overview/)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Expo Push Tool](https://expo.dev/notifications)
