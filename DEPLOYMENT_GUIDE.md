# Buddy Activity Feed - Deployment Guide

## Pre-Deployment Checklist

- [ ] All code committed (commit: a8da604)
- [ ] Tests passing on CI/CD
- [ ] Database backup taken
- [ ] Rollback plan ready
- [ ] Slack notification prepared

## Step 1: Deploy Database Migration

### Option A: Manual Migration
```bash
cd backend
psql -U postgres -d fitzo < src/db/migrations/add_buddy_sharing_preferences.sql
```

### Option B: Migration Tool (if using)
```bash
npm run migrate -- add_buddy_sharing_preferences.sql
```

**Verification**:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('share_logs_default', 'share_logs_updated_at');
-- Should return 2 rows
```

**Rollback** (if needed):
```sql
ALTER TABLE users DROP COLUMN share_logs_updated_at;
ALTER TABLE users DROP COLUMN share_logs_default;
DROP INDEX idx_users_share_logs_default;
```

## Step 2: Deploy Backend

### Via Git Push
```bash
cd backend
git push origin master
# CI/CD pipeline triggers automatically
```

### Manual Deployment
```bash
cd backend
npm install
npm run build (if applicable)
npm start
```

**Verification Endpoints**:
```bash
# Test settings endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/settings/sharing

# Test buddy activity endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/buddy-activity/FRIEND_ID
```

**Expected Responses**:
- 200 OK for existing endpoints
- 401 Unauthorized if token invalid
- 403 Forbidden if not friends
- 404 if friend not found

### Health Check
```bash
curl http://localhost:3001/api/health
```

Should return database status: "ok"

## Step 3: Deploy Mobile App

### Prepare Build
```bash
cd mobile
npm install
npm run build:ios  # or android
```

### Via EAS (Recommended)
```bash
eas build --platform ios
eas build --platform android
```

### Submit to App Store
- iOS: Use Xcode or App Store Connect
- Android: Use Google Play Console

### Deploy to Beta (Optional)
```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

## Step 4: Monitor Deployment

### Backend Logs
```bash
# Check if routes are loaded
grep "app.use('/api/settings" backend/src/index.js
grep "app.use('/api/buddy-activity" backend/src/index.js
```

### Mobile App
- Check for compilation errors
- Verify routes load in dev client
- Test navigation: Friends list → Activity screen

### Database
```sql
-- Verify column exists
\d users
-- Should show share_logs_default BOOLEAN

-- Check sample user
SELECT id, share_logs_default FROM users LIMIT 1;
-- Should return true for share_logs_default
```

## Step 5: User Communication

### In-App Message
"Discover what your gym buddies are up to! View their workouts, meals, and training plans. New: Privacy controls let you decide who sees your logs."

### Email Template
```
Subject: New Feature: See Your Gym Buddy's Progress

Hi {{name}},

We've added a new feature to Fitzo: Buddy Activity Feed!

Now you can see your gym buddies' workouts, nutrition, and training plans in one place.

Privacy First:
- Control who sees your logs in Settings
- Choose per log if needed
- Your choice, always

How to Use:
1. Go to Settings > Privacy & Sharing
2. Toggle "Share with Gym Buddies"
3. Tap on any buddy in your list to see their activity

Learn More: [Help Article]
```

## Step 6: Post-Deployment Monitoring

### Key Metrics
```sql
-- Users with sharing enabled
SELECT COUNT(*) FROM users WHERE share_logs_default = true;

-- Sample logs by visibility
SELECT visibility, COUNT(*) FROM calorie_logs GROUP BY visibility;
SELECT visibility, COUNT(*) FROM workout_logs GROUP BY visibility;

-- Activity endpoint usage
-- Check logs for GET /api/buddy-activity/:id hits
```

### Error Monitoring
- Monitor 403 responses (access denied)
- Monitor 404 responses (user not found)
- Monitor 500 responses (server errors)

### Performance Monitoring
- Track /api/buddy-activity/:id response times
- Monitor database query times
- Track API error rates

## Step 7: Rollback Plan

### If Issues Found

#### Backend Rollback
```bash
# Revert to previous commit
git revert a8da604
git push origin master
# Deploy will automatically trigger
```

#### Database Rollback
```bash
# Drop new columns
ALTER TABLE users DROP COLUMN share_logs_updated_at;
ALTER TABLE users DROP COLUMN share_logs_default;
```

#### Mobile Rollback
- Revert to previous app version
- Remove from app store/play store
- Notify users of issue

### Communication Template
```
We've temporarily rolled back the Buddy Activity feature due to [reason].
We're working on a fix and will re-deploy soon.
Your data is safe and unchanged.
Thank you for your patience!
```

## Step 8: Post-Deployment Tasks

- [ ] Monitor error logs for 24 hours
- [ ] Check user feedback in support channels
- [ ] Verify feature adoption metrics
- [ ] Document any issues encountered
- [ ] Schedule follow-up retrospective

## Verification Checklist

### Backend
- [ ] Settings endpoints respond correctly
- [ ] Buddy activity endpoint filters by privacy rules
- [ ] Friends endpoint includes shares_logs field
- [ ] All routes return proper error codes
- [ ] Database migration completed successfully

### Mobile
- [ ] App builds without errors
- [ ] Settings screen shows toggle
- [ ] Logging screens show visibility pickers
- [ ] Friends list is tappable
- [ ] Activity screen loads and displays data
- [ ] Error messages show appropriately

### Privacy
- [ ] Private logs not visible in activity
- [ ] Friends-only logs respect share_logs_default
- [ ] Non-friends get 403 forbidden
- [ ] Check-in and intent always visible
- [ ] SQL filters working correctly

### User Experience
- [ ] Toggle works smoothly
- [ ] Navigation feels responsive
- [ ] Data loads without delay
- [ ] Error messages are clear
- [ ] Privacy defaults are sensible

## Support & Troubleshooting

### Issue: "Logs are Private" always showing

**Diagnosis**:
```sql
SELECT id, share_logs_default FROM users WHERE id = 'USER_ID';
SELECT visibility FROM workout_logs WHERE user_id = 'USER_ID' LIMIT 5;
```

**Solution**:
1. Check user's share_logs_default is true
2. Check logs have visibility = 'friends' or 'public'
3. Verify users are accepted friends

### Issue: Activity endpoint returns 403

**Diagnosis**:
```sql
SELECT status FROM friendships
WHERE (user_id = 'USER_A' AND friend_id = 'USER_B')
OR (user_id = 'USER_B' AND friend_id = 'USER_A');
```

**Solution**:
1. Verify friendship status is 'accepted'
2. Check both user IDs exist
3. Check friendship is symmetric

### Issue: Mobile app crashes on activity screen

**Diagnosis**:
- Check React Native console for errors
- Check Network tab for API errors
- Verify token is being sent

**Solution**:
1. Clear app cache
2. Reinstall app
3. Check backend is running
4. Verify network connectivity

## Rollout Timeline

| Phase | Timeline | Actions |
|-------|----------|---------|
| Pre-Deployment | T-1 day | Final testing, backups, notifications |
| Database | T+0 | Run migration, verify column exists |
| Backend | T+30 min | Deploy code, test endpoints |
| Mobile | T+1 hour | Submit builds to stores |
| Monitoring | T+1-24 hours | Monitor errors and metrics |
| Communication | T+2 hours | Send user communication |

## Success Criteria

- [ ] 0 deployment errors
- [ ] 99.9% API uptime
- [ ] <100ms response time for buddy activity
- [ ] <5% of logs set to private (healthy engagement)
- [ ] >50% of users toggle privacy setting within 7 days
- [ ] 0 privacy violations reported
- [ ] Positive user feedback on feature

## Contact & Escalation

**Issues During Deployment**:
- Slack: #fitzo-deployments
- On-call: [Name] - [Phone]
- Escalation: [Manager] - [Phone]

**Post-Deployment Issues**:
- Create GitHub issue with `deployment` label
- Tag: @team-backend or @team-mobile
- Link: Deployment guide section

---

**Deployment Date**: [To Be Scheduled]
**Deployed By**: [Name]
**Verified By**: [Name]
**Status**: ✅ Ready for Deployment
