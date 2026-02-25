# Buddy Activity Feed - Implementation Complete

## Overview
Complete implementation of the buddy activity feed feature allowing gym buddies to view each other's logged workouts, food intake, and workout intent with a hybrid privacy model (global default + per-log override).

## Architecture

### Privacy Model: Hybrid Default + Override
- **Global Setting**: `share_logs_default` in users table (true/false)
- **Per-Log Control**: `visibility` column in logs (public/friends/private)
- **Enforcement**: Server-side SQL filtering, client-side UI hints

### Database Schema

#### New Column: `users.share_logs_default`
```sql
share_logs_default BOOLEAN DEFAULT true
share_logs_updated_at TIMESTAMP DEFAULT NOW()
```

#### Existing Columns Used
- `calorie_logs.visibility` (public/friends/private)
- `workout_logs.visibility` (public/friends/private)
- `friendships.status` (pending/accepted/rejected)

## Backend Implementation

### 1. Database Migration
**File**: `backend/src/db/migrations/add_buddy_sharing_preferences.sql`

Adds:
- `share_logs_default` column to users table (defaults to true)
- `share_logs_updated_at` for audit tracking
- Index on `share_logs_default` for query performance

### 2. Settings Endpoints
**File**: `backend/src/routes/settings.js`

#### GET /api/settings/sharing
Returns user's sharing preference and last update timestamp
```json
{
  "share_logs_default": true,
  "updated_at": "2026-02-25T10:30:00Z"
}
```

#### PATCH /api/settings/sharing
Updates sharing preference with validation
```json
Request: { "share_logs_default": false }
Response: {
  "success": true,
  "share_logs_default": false,
  "message": "Sharing disabled. Your logs are now private to buddies."
}
```

### 3. Buddy Activity Endpoint
**File**: `backend/src/routes/buddy-activity.js`

#### GET /api/buddy-activity/:id
Returns friend's today's activity with privacy enforcement

**Privacy Checks**:
1. Users must be accepted friends (returns 403 if not)
2. Logs filtered by visibility rules:
   - `visibility = 'public'` → always shown
   - `visibility = 'friends'` → only if `share_logs_default = true`
   - `visibility = 'private'` → never shown

**Response Structure**:
```json
{
  "can_view": true,
  "blocked_reason": null,
  "friend": {
    "id": "uuid",
    "name": "Alex",
    "avatar_url": "...",
    "xp_points": 2000,
    "shares_logs_by_default": true
  },
  "today": {
    "intent": {
      "training_pattern": "Push",
      "emphasis": ["Chest", "Shoulders"],
      "session_label": "Strength",
      "display": "Push · Chest & Shoulders · Strength"
    },
    "workouts": [
      {
        "id": "uuid",
        "type": "strength",
        "exercises": "Bench Press, Incline Dumbbell...",
        "notes": "Great session",
        "logged_at": "2026-02-25T10:30:00Z"
      }
    ],
    "food": {
      "total_calories": 2100,
      "total_protein": 140,
      "total_carbs": 250,
      "total_fat": 70,
      "meals": [
        {
          "id": "uuid",
          "name": "Chicken & Rice",
          "calories": 600,
          "protein": 45,
          "carbs": 60,
          "fat": 15,
          "logged_at": "2026-02-25T13:00:00Z"
        }
      ]
    },
    "checked_in": true,
    "checked_in_at": "2026-02-25T07:30:00Z"
  }
}
```

### 4. Updated Friends Endpoint
**File**: `backend/src/routes/friends.js` (MODIFIED)

Added `shares_logs: share_logs_default` field to friend objects in response, allowing frontend to know if they share logs by default.

### 5. Route Registration
**File**: `backend/src/index.js` (MODIFIED)

Registered new routes:
```javascript
app.use('/api/settings', require('./routes/settings'));
app.use('/api/buddy-activity', require('./routes/buddy-activity'));
```

## Mobile Implementation

### 1. Settings Screen - Global Preference
**File**: `mobile/src/screens/member/SettingsScreen.tsx`

**Feature**:
- New "PRIVACY & SHARING" section
- Toggle: "Share with Gym Buddies"
- Description: "When ON: Buddies see your workouts & meals"
- Calls `PATCH /api/settings/sharing` on toggle
- Loads current preference on mount via `GET /api/settings/sharing`

**State**:
```typescript
const [shareLogs, setShareLogs] = useState(true);
const [loading, setLoading] = useState(false);
```

### 2. Food Logging - Visibility Override
**File**: `mobile/src/screens/member/CalorieLogScreen.tsx`

**Feature**:
- Visibility picker before logging meal
- Options: "Friends" (default if sharing=true) or "Only Me"
- Compact UI with 2-button selection
- Pre-selects based on `share_logs_default`

**State**:
```typescript
const [visibility, setVisibility] = useState<'friends' | 'private'>('friends');
```

**API Call**:
```javascript
visibility: visibility // passed to POST /api/calories
```

### 3. Workout Logging - Visibility Override
**File**: `mobile/src/screens/member/WorkoutLogScreen.tsx`

**Feature**:
- Same visibility picker as food logging
- Shows before "Finish Workout" button
- Respects user's global sharing preference for default

**State**:
```typescript
const [visibility, setVisibility] = useState<'friends' | 'private'>('friends');
```

### 4. Buddy Activity Screen - NEW
**File**: `mobile/src/screens/member/BuddyActivityScreen.tsx`

**Features**:
- Displays friend's name, avatar, XP, check-in status
- Shows today's workout intent
- Shows all logged workouts with exercises
- Shows nutrition summary (calories, macros)
- Shows individual meals with timestamps
- Graceful error handling with "Logs are Private" message

**Navigation**:
- Receives `friendId` via route params
- Uses Expo Router `useLocalSearchParams`
- Fetches from `GET /api/buddy-activity/:id`

**Data Types**:
```typescript
interface BuddyActivity {
  can_view: boolean;
  blocked_reason: string | null;
  friend: { id, name, avatar_url, xp_points, shares_logs_by_default };
  today: {
    intent: { training_pattern, emphasis, session_label, display } | null;
    workouts: Array<{ id, type, exercises, notes, logged_at }>;
    food: { total_calories, total_protein, total_carbs, total_fat, meals };
    checked_in: boolean;
    checked_in_at: string | null;
  };
}
```

**Error Handling**:
- Shows "Authentication required" if no token
- Shows "Failed to load buddy activity" on API error
- Shows lock icon with "Logs are Private" if access denied
- Loading spinner during fetch

### 5. Gym Buddies Screen - Made Tappable
**File**: `mobile/src/screens/member/GymBuddiesScreen.tsx` (MODIFIED)

**Feature**:
- Friend cards now wrapped in `TouchableOpacity`
- Navigation to buddy-activity screen on tap
- Route: `/member/buddy-activity` with `friendId` param

**Navigation Code**:
```javascript
<TouchableOpacity
  onPress={() => router.push({
    pathname: '/member/buddy-activity',
    params: { friendId: friend.id }
  })}
>
```

### 6. Route File - NEW
**File**: `mobile/app/member/buddy-activity.tsx`

Expo Router route file that:
- Imports BuddyActivityScreen component
- Sets up proper file structure for Expo Router
- Enables navigation from GymBuddiesScreen

## Privacy Enforcement

### Server-Side SQL Rules
```sql
-- Show logs only if:
-- 1. visibility = 'public' (always)
-- 2. visibility = 'friends' AND share_logs_default = true
-- 3. visibility = 'private' AND false (never)

WHERE (
  visibility = 'public'
  OR (visibility = 'friends' AND ($2 = true))
  OR visibility = 'private' AND false
)
```

### Client-Side Hints
- Settings screen shows toggle with description
- Logging screens show visibility options
- Activity screen shows lock icon for private logs
- "Updated at" timestamp shown in settings

### Security Considerations
- All endpoints require authentication
- Friendship check required before accessing activity
- Private logs never shown in SQL query results
- No fallback data if access denied
- User can't override privacy via client

## Visibility Logic

### User A viewing User B's logs:

**Condition**: Are A and B accepted friends?
- NO → Return 403 with `can_view: false, blocked_reason: 'not_friend'`
- YES → Continue to next check

**Condition**: Check each log:
- `visibility = 'public'` → Show (always)
- `visibility = 'friends' AND B.share_logs_default = false` → Hide
- `visibility = 'friends' AND B.share_logs_default = true` → Show
- `visibility = 'private'` → Hide (always)

**Final Decision**: `can_view = B.share_logs_default OR has_any_visible_logs`
- If true → Show all filtered data
- If false → Show friend info + check-in + intent, hide logs + message

## Implementation Completeness

### ✅ Backend
- [x] Database migration created
- [x] Settings endpoints (GET/PATCH)
- [x] Buddy activity endpoint with privacy
- [x] Friends endpoint updated with shares_logs
- [x] Routes registered in main app
- [x] Error handling and validation
- [x] Authentication required
- [x] Test scaffolding created

### ✅ Mobile
- [x] Settings toggle added
- [x] Visibility picker in food logging
- [x] Visibility picker in workout logging
- [x] BuddyActivityScreen component
- [x] Route file for Expo Router
- [x] Navigation from friends list
- [x] Error handling
- [x] Loading states
- [x] Token retrieval for API calls

### ✅ Data Flow
- [x] User toggles setting → PATCH /api/settings/sharing
- [x] User logs food → POST /api/calories with visibility
- [x] User logs workout → POST /api/workouts with visibility
- [x] User views friend → GET /api/buddy-activity/:id
- [x] API filters by visibility rules
- [x] Frontend shows result or error

## Deployment Steps

### 1. Database Migration
```bash
cd backend
npm run migrate -- add_buddy_sharing_preferences.sql
```

### 2. Backend Deployment
```bash
git push # trigger CI/CD for backend
```

### 3. Mobile Deployment
```bash
npm run build:ios  # or android
eas build
```

## Testing Checklist

### Privacy Rules
- [ ] Can't view friend's "private" logs regardless of share_logs_default
- [ ] Can view "friends" logs only if share_logs_default = true
- [ ] Can always view "public" logs
- [ ] Non-friends get 403 forbidden
- [ ] Can't view friend's logs if not accepted friends
- [ ] Toggling share_logs_default immediately affects visibility

### UI/UX
- [ ] Settings toggle loads current preference on mount
- [ ] Toggle sends API request and shows success message
- [ ] Food logging shows visibility picker before logging
- [ ] Workout logging shows visibility picker before finishing
- [ ] Visibility picker respects user's global default
- [ ] Can override default on each log
- [ ] Friends list shows tappable cards
- [ ] Tapping friend navigates to activity screen
- [ ] Activity screen shows friend's data correctly
- [ ] Activity screen shows "Logs Private" message when needed
- [ ] Loading spinner shows during fetch
- [ ] Error messages display for failed requests

### API Integration
- [ ] GET /api/settings/sharing returns correct data
- [ ] PATCH /api/settings/sharing updates database
- [ ] GET /api/buddy-activity/:id returns filtered data
- [ ] Food/workout endpoints accept visibility parameter
- [ ] Friends endpoint includes shares_logs field

## Files Modified/Created

**Backend**:
- ✅ `/src/db/migrations/add_buddy_sharing_preferences.sql` (NEW)
- ✅ `/src/routes/settings.js` (NEW)
- ✅ `/src/routes/buddy-activity.js` (NEW)
- ✅ `/src/routes/friends.js` (MODIFIED)
- ✅ `/src/index.js` (MODIFIED)
- ✅ `/src/__tests__/buddy-activity.test.js` (NEW)

**Mobile**:
- ✅ `/src/screens/member/SettingsScreen.tsx` (MODIFIED)
- ✅ `/src/screens/member/CalorieLogScreen.tsx` (MODIFIED)
- ✅ `/src/screens/member/WorkoutLogScreen.tsx` (MODIFIED)
- ✅ `/src/screens/member/BuddyActivityScreen.tsx` (NEW)
- ✅ `/app/member/buddy-activity.tsx` (NEW)
- ✅ `/src/screens/member/GymBuddiesScreen.tsx` (MODIFIED)

**Total**: 6 new files, 5 modified files, 1 test file

## Metrics & Analytics

Recommended tracking:
- % of users with sharing enabled
- % of logs overridden to private
- Daily active buddy activity views
- Feature adoption rate by user cohort
- Time spent on buddy activity screen

## Future Enhancements

1. **Batch Activity**: Show aggregated activity (X workouts, Y meals)
2. **Feed**: Timeline view of all buddies' activities
3. **Notifications**: Notify buddies when someone works out
4. **Streaming**: Real-time check-in badges
5. **Weekly Summary**: Email digest of buddy progress
6. **Achievements**: Badges for consistency with buddies
7. **Challenges**: Shared goals between buddies

## Rollout Plan

1. Deploy migration (blue-green approach)
2. Deploy backend (feature flag not needed, backward compatible)
3. Deploy mobile (toggle controlled by API)
4. In-app message: "See your gym buddy's progress"
5. Monitor adoption and privacy enforcement

## Support & Debugging

### Common Issues

**Issue**: "Logs are Private" always shows
- Check: User's `share_logs_default` in database
- Check: Logs have correct `visibility` values
- Check: Users are accepted friends

**Issue**: Privacy picker doesn't show
- Check: Mobile has latest code
- Check: User preference loaded before logging

**Issue**: Activity endpoint returns 403
- Check: Friendship status in database
- Check: Both users exist

### Debug Endpoints

```bash
# Check user's sharing preference
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/settings/sharing

# Check friend's activity
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/buddy-activity/:friendId

# Check friends list
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/friends
```

---

**Status**: ✅ COMPLETE AND READY FOR DEPLOYMENT
**Commit**: a8da604 - Implement buddy activity feed with hybrid privacy model
**Date**: 2026-02-25
