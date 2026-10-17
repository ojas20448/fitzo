# Fitzo API on Oracle Always Free

Preparation only: no server, DNS change, app release, or production cutover has
been performed. This package keeps the existing Express API and Supabase
database. It never runs database setup, seeds, or migrations.

## Server prerequisites

- Verify the console shows a Free Tier account and the instance is Always Free
  eligible in the tenancy's home region (Mumbai for this signup).
- Prefer Ubuntu 24.04 on `VM.Standard.A1.Flex`, at most 2 OCPUs and 12 GB RAM
  **combined across the tenancy**, and a 50 GB boot disk. Stay within 200 GB
  combined boot/block storage. Do not choose a paid shape if capacity is absent.
- Review the account's resource limits and recurring cost estimate before
  creating anything. Trial credit is not evidence a resource is Always Free.
- Install Docker Engine from its official Ubuntu repository, with Docker Compose
  2.30 or later. Both the Node and Caddy images support ARM64 and AMD64.
- Restrict SSH ingress to the administrator's public IP. Allow public TCP ports
  80 and 443 only when enabling HTTPS. Do not expose ports 3001 or 5432.
- Retain normal host security updates. Do not disable the Oracle image firewall
  wholesale; add only the required rules. Docker publishes directly through
  host packet filtering, so check OCI security lists and actual host rules.

The local workstation currently has no Docker installation. An actual container
build, ARM runtime, and Caddy configuration validation remain required on the VM.

## Private configuration

On the VM, check out the tested migration commit. Create
`deploy/oracle/production.env` with owner-only permissions (`chmod 600`). Fill it
privately with the exact existing production values, using the example as a
key-name guide. Confirm the database points to production Supabase, not the
expiring staging database. Preserve the exact Render production `JWT_SECRET`,
OAuth settings, and app identifiers so existing accounts and valid sessions work.

Do not blindly copy a developer `.env`: compare it privately with Render's active
production configuration first. `format: raw` prevents Compose from expanding
`$` characters in secrets; wrapping quotes would become part of the value.
Keep all secrets out of Git, images, shell history, logs, screenshots, and chat.
Do not set `DB_SSL_CA_FILE` to a workstation path. The image includes the existing
Supabase CA, and Compose forces certificate verification.

## Start and verify the API before changing DNS

Run from the repository root on the VM, replacing the placeholder with the full
40-character revision that passed tests. The source checkout must match it and
have no uncommitted application changes.

```sh
export APP_GIT_COMMIT=FULL_TESTED_40_CHARACTER_GIT_REVISION
test "$(git rev-parse HEAD)" = "$APP_GIT_COMMIT"
test -z "$(git status --porcelain)"
docker compose -f deploy/oracle/compose.yaml config --quiet
docker compose -f deploy/oracle/compose.yaml build --pull api
docker compose -f deploy/oracle/compose.yaml up -d --wait api
docker compose -f deploy/oracle/compose.yaml exec -T api node scripts/check_deployment.js http://127.0.0.1:3001 "$APP_GIT_COMMIT"
docker compose -f deploy/oracle/compose.yaml run --rm --no-deps proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

The first phase binds the API only to localhost. The check verifies the exact
revision, database health, and authentication on two protected read routes.
It does not register accounts or write user data. Inspect bounded container logs
privately if a check fails; do not change DNS or release the mobile app.

## Enable HTTPS and cut over

After API and runtime checks pass, replace only the Cloudflare DNS record for
`api.fitzoapp.in`: the existing Vercel CNAME becomes an A record for the VM's
public IPv4. Keep it DNS-only initially so Caddy can obtain a public certificate.
Do not alter the apex website, `www`, nameservers, email, or unrelated records.
Do not add an AAAA record unless IPv6 routing and firewall rules were tested.

```sh
docker compose -f deploy/oracle/compose.yaml --profile https up -d --wait
docker compose -f deploy/oracle/compose.yaml exec -T api node scripts/check_deployment.js https://api.fitzoapp.in "$APP_GIT_COMMIT"
```

Then validate one real existing-account login and read flow, OAuth, email, AI,
uploads, and scheduled jobs using authorized test accounts. Enable scheduled
workflows by setting GitHub repository variable `FITZO_API_ORIGIN` to
`https://api.fitzoapp.in` and the matching `CRON_SECRET` only after this
verification. Until set, the prepared workflows retain the old Render origin.

The mobile API URL changes are prepared separately. Existing store binaries
still call Render and have no configured OTA update channel; they need a store
update. Reconcile the main workspace's pending release before building. Keep the
same app IDs, database, JWT signing secret, and token versions. Users keep their
accounts/data; expired or revoked sessions can still need a login.

## Recovery and limits

For an application regression, deploy the previous tested image/revision against
the same database. Record its revision before updates and retain its image. Do
not run `docker compose down -v`, which removes certificate storage. Render is
currently suspended, so its old DNS target is not a working rollback service.

Docker restarts an exited process after a host reboot. An `unhealthy` status is a
monitoring signal; Docker does not automatically restart a still-running unhealthy
container. Keep uptime monitoring pointed at the new health URL after cutover.
Back up deployment configuration and keep Supabase's data recovery plan separate.
Oracle may reclaim idle Always Free VMs; this setup provides no uptime guarantee.

References: [Always Free limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm),
[Docker on Ubuntu](https://docs.docker.com/engine/install/ubuntu/),
[Compose raw env files](https://docs.docker.com/reference/compose-file/services/#format).
