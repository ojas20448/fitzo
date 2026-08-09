-- Key Google identity on `sub`, not on the email address.
--
-- POST /api/auth/google destructured Google's `sub` claim and then threw it
-- away, matching accounts purely by email. Email is the wrong key:
--
--   * A Google Workspace address can be RENAMED. The same person returns with
--     a different email, matches nothing, and silently gets a second account
--     with none of their history.
--   * A Workspace address can be RELEASED and reassigned to a new employee.
--     That new person then signs in and inherits the previous holder's Fitzo
--     account — their logs, their weight history, their friends.
--
-- `sub` is stable for the lifetime of a Google account and is never reused, so
-- it is the identifier Google itself tells you to key on.
--
-- ON BACKFILL: there isn't one, and there cannot be. `sub` was never stored,
-- and it is not derivable from anything in this database. The column stays NULL
-- for every existing row and is CLAIMED on each Google user's next sign-in,
-- where the route still falls back to an email match and writes the sub it just
-- verified. Nobody is locked out by this migration; at the time of writing 36
-- of 37 accounts are password-based and 1 looks like a Google sign-in.
--
-- NULLable is deliberate: password accounts have no Google identity, and in
-- PostgreSQL multiple NULLs do not collide under a UNIQUE constraint.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key
  ON users (google_id)
  WHERE google_id IS NOT NULL;
