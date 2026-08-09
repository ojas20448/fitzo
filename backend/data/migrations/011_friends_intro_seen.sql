-- One-time disclosure on first Friends open: what an accepted buddy can
-- actually see. Stored per-account rather than per-device (AsyncStorage) so a
-- member who has already read it does not get it again on a new phone, and so
-- the acknowledgement survives a reinstall.
--
-- Same shape as users.learn_start_here_dismissed, which this follows.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS friends_intro_seen BOOLEAN NOT NULL DEFAULT false;
