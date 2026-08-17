-- Sign in with Apple.
--
-- Required by App Store Review Guideline 4.8: an app offering a third-party
-- sign-in (Fitzo offers Google) must also offer an equivalent privacy-
-- preserving option, and Sign in with Apple is the one Apple accepts.
--
-- Identity is keyed on Apple's `sub`, mirroring how google_id works, because
-- email is not a stable identifier. Apple makes this sharper than Google does:
-- a user can hide their real address behind a @privaterelay.appleid.com alias,
-- and can revoke the relay later. The alias must therefore never be the thing
-- we recognise them by.

ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255);

-- Partial index: only rows that have an apple_id participate. A plain UNIQUE
-- would be satisfiable by many NULLs in Postgres, but the partial form keeps
-- the index small and states the intent — one Apple account, one user row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id
    ON users (apple_id)
    WHERE apple_id IS NOT NULL;

-- Apple sends the user's full name ONLY on the very first authorisation, and
-- never again. If it is not captured then it is gone for good, so record
-- whether we ever got one. Without this flag the app cannot tell "user has no
-- name" from "we failed to store the name Apple sent once", and the only
-- remedy — asking the user to revoke the app in iOS Settings and sign in
-- again — is not something to guess at.
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_name_captured BOOLEAN DEFAULT false;
