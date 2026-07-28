-- Adds optional checkout so occupancy means "currently inside", not
-- "arrived in the last hour". Nullable: checkout is always optional and
-- unrecorded sessions auto-expire in application logic.

ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP WITH TIME ZONE;

-- Partial index: NOT currently used by the occupancy queries. Those filter
-- on COALESCE(checked_out_at, ...) > NOW(), a computed expression Postgres
-- cannot map back to this index's `checked_out_at IS NULL` predicate, so the
-- planner can't use it here. Retained for future queries that filter on open
-- sessions directly (`WHERE checked_out_at IS NULL`), which this would serve
-- well. Not dropped since it's already applied to the live database and
-- removing it needs its own migration.
CREATE INDEX IF NOT EXISTS idx_attendance_open_session
  ON attendances (gym_id, checked_in_at DESC)
  WHERE checked_out_at IS NULL;

-- Task 7 support: when this member was last sent a quiet-hours nudge.
-- Without it the 24h cooldown cannot be enforced and a manual cron
-- re-trigger double-notifies everyone.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS quiet_alert_sent_at TIMESTAMP WITH TIME ZONE;

-- Task 7 support: give quiet-hours alerts their own mute toggle, so a daily
-- push is something members can switch off like every other category.
UPDATE users
   SET notification_preferences =
       COALESCE(notification_preferences, '{}'::jsonb) || '{"quietHours": true}'::jsonb
 WHERE notification_preferences IS NULL
    OR NOT (notification_preferences ? 'quietHours');

ALTER TABLE users
  ALTER COLUMN notification_preferences
  SET DEFAULT '{"workoutReminders": true, "streakAlerts": true, "friendActivity": true, "classReminders": true, "achievements": true, "marketing": false, "quietHours": true}'::jsonb;
