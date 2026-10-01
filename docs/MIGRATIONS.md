# Database setup and upgrades

The normal runner never runs `src/db/schema.sql`: that legacy file drops tables
and types. Never execute it directly against an existing database.

Run commands from `backend`, with `DATABASE_URL` set explicitly to the intended
database. `--dry-run` reads the plan without connecting or loading `.env`.

```sh
node apply_migrations.js --dry-run
node apply_migrations.js --bootstrap --dry-run
```

For a new, empty database only:

```sh
node apply_migrations.js --bootstrap
```

Bootstrap checks that the public schema has no existing relations, enums or domains before running
the base schema. Subsequent upgrades use:

```sh
node apply_migrations.js
```

Each successful file and its SHA-256 checksum are recorded in
`fitzo_schema_migrations` in the same transaction as its changes. Recorded files
are skipped only when their checksum matches. Line-ending differences do not
change the checksum. Do not edit recorded migration files; add a new migration.
The runner holds a database advisory lock while applying the plan.

## Existing databases without migration history

The runner does **not** infer successful application from duplicate tables,
columns or constraints. A failed file rolls back and stops the run. Earlier
successfully committed files remain recorded. Resolve the failing migration
against a staging copy before retrying; do not mark a partially applied file as
complete or delete existing objects just to make it pass.

For a known pending additive migration, select its exact label:

```sh
node apply_migrations.js --only data/migrations/019_push_tokens.sql --dry-run
node apply_migrations.js --only data/migrations/019_push_tokens.sql
```

This does not baseline or validate all older migrations. Dependencies must
already exist. It allows upgrading a manually maintained database without
replaying all legacy files. Migration 019 must exist before deploying the code
that removes notification-route startup DDL.

Keep transaction boundaries at the file level. Existing whole-file BEGIN/COMMIT
wrappers are removed by the runner so the history record commits atomically.
Do not add intermediate transaction-control statements or concurrent index
creation to files handled by this runner. Seed/demo data and RLS enablement are
excluded by default; RLS still requires explicit `--with-rls`.

## Connection configuration

The backend and this runner use the same connection options. `DATABASE_URL` is
used as configured; no Supabase host or region is guessed. For IPv4-only hosts,
copy the correct pooler URL from your project's connection settings.

- Remote hosts default to TLS with certificate verification.
- Recognized Supabase database/pooler hosts use the bundled public Supabase CA;
  see `backend/certs/README.md` for provenance and expiry.
- Loopback development databases default to plaintext.
- `DB_SSL_MODE=verify-full` explicitly enables verified TLS.
- `DB_SSL_CA_FILE` points to the provider's trusted PEM CA file, or `DB_SSL_CA`
  supplies its contents. Do not commit private credentials or CA environment
  configuration to source control.
- `DB_SSL_MODE=disable` is available for explicitly trusted private-network
  connections. It disables transport encryption.

SSL query options in the URL cannot weaken the configured verification policy.
Move URL certificate parameters to the explicit CA setting. This avoids the
[node-postgres SSL option replacement behavior](https://node-postgres.com/features/ssl).
The configured Supabase pooler passed a certificate-verified, read-only SELECT 1
with the bundled CA during this repair. Recheck connectivity in the deployment
environment before rollout; no backend deployment was performed here.
