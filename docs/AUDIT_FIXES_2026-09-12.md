# Follow-up audit repairs — 12 September 2026

These changes are local and have not been deployed. The user reported that
migrations 016–018 and the earlier release steps were completed. This follow-up
adds migration 019; it has only been applied to a disposable local database here.
The pre-existing mobile/app.json build-number edit was preserved.

## Repairs

- The old full migration runner executed schema.sql first, including destructive
  DROP TABLE CASCADE statements. Normal runs now exclude it. Explicit bootstrap
  checks for existing public relations, enums and domains before executing it.
- Migration files commit together with checksum history. A duplicate-object error
  now rolls back the file and stops the run, rather than falsely marking the
  entire file applied. Missing files and changed recorded checksums are errors.
  A database advisory lock serializes cooperating runners.
- An exact `--only` label permits applying a known pending migration to a legacy
  database without replaying every older file. It does not automatically baseline
  or reconcile unknown historical schema drift.
- Push-token table creation moved out of route loading into migration 019.
  Startup no longer silently swallows errors from that asynchronous DDL.
- Preset split adoption increments downloads using the resolved UUID, fixing
  aliases such as `ppl_6` being passed to a UUID query.
- The API and migration runner share database connection configuration. No
  Supabase region/host rewriting occurs. Remote TLS verifies the certificate and
  hostname, with a provider CA for recognized Supabase hosts. CA overrides remain
  available for other deployments. Plaintext requires a loopback host or explicit
  `DB_SSL_MODE=disable` configuration.
- README now documents native development builds, full schema setup, session
  revocation, the default token lifetime and manager feature deferral.

See [migration instructions](MIGRATIONS.md) for commands and legacy-upgrade limits.
The bundled public CA's provenance and expiry are in `backend/certs/README.md`.

## Verification

- Full backend Jest suite: 38 suites, 372 tests passed.
- Disposable PGlite PostgreSQL: all 41 migration files build from an empty schema;
  tracked rerun skips matching files; bootstrap refuses an existing database.
- Partial-upgrade regression: a duplicate column rolls back earlier statements,
  leaves existing data intact and records no success. Retrying the repaired,
  unrecorded fixture applies its remaining changes and index.
- The default database configuration passed a read-only SELECT 1 against the
  configured Supabase pooler with certificate and hostname verification enabled.
  The initial check without the provider CA failed, confirming why it is needed.
- No mobile runtime code changed in this batch; earlier mobile test/device limits
  still apply. These checks do not validate deployed backend behavior.

Jest log: `backend/audit-test-results-2026-09-12.txt`.
Disposable integration reproduction: `node output/audit-postgres/bootstrap.cjs`
using the PGlite dependency installed for the previous audit.

## Staging investigation

- The connected Supabase account lists one active Fitzo project and no development
  branches for it. No separately named Fitzo staging project was found.
- Development, preview and production EAS profiles point to the production API.
  The three local mobile environment files also point to that API.
- Render's dashboard required sign-in in the available browser session, so its
  service inventory could not be checked. There was no Render connector or local
  Render CLI available. A staging backend cannot be ruled out in that dashboard.

No staging URL was invented or provisioned, and build targets were not changed
to an unverified endpoint. Staging setup still needs a separately verified backend
and database. Creating paid cloud resources requires reviewing their concrete
cost and configuration first.

## Deployment and remaining work

1. Apply `data/migrations/019_push_tokens.sql` before deploying this backend batch.
2. Include `backend/certs/supabase-prod-ca-2021.crt` in the deployment artifact and
   verify connectivity in the deployment environment. This batch does not require
   a mobile native rebuild.
3. Establish staging before running mutation-based end-to-end checks there.

Manager release work remains deferred. Unified workout/attendance calendar-day
semantics, complete offline write replay, historical health backfill/background
delivery and real-device health comparisons remain unfinished. Trainer nudges
also still use the previously audited placeholder. This is not a claim that all
audit findings or all product features are complete.
