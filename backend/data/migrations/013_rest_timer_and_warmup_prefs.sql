-- Workout logging preferences: rest timer + warm-up card.
--
-- rest_timer_enabled defaults to FALSE. The rest pill fired after every set and
-- floated over the log, which read as nagging during a session. Rest intervals
-- still matter for strength work, so the feature stays — it is just opt-in now
-- rather than opt-out.
--
-- warmup_card_enabled defaults to TRUE. A short dynamic warm-up is worth
-- suggesting by default, but it is dismissible and never blocks the workout.
--
-- Both live on users alongside log_rir_enabled (008) so one query fetches every
-- workout preference, and they follow the same COALESCE-partial-PATCH contract.

ALTER TABLE users ADD COLUMN IF NOT EXISTS rest_timer_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS warmup_card_enabled BOOLEAN NOT NULL DEFAULT TRUE;
