# Fitzo hosting migration

Prepared from deployed release `13da460b1d7d674ac28838a445edb941b59e3b52` in branch `codex/no-card-migration`. The primary workspace has unrelated changes for version 1.4.1; they are not included in this migration checkout.

## Current state

- Production Render API is suspended because shared free instance hours were exhausted.
- The configured Supabase database passed a read-only connection check during the incident investigation.
- `fitzoapp.in` already uses Cloudflare DNS and its website returns HTTP 200.
- The backend is live at `https://api.fitzoapp.in/api`. The apex website still returns HTTP 200.
- Oracle remains a Free Tier account; no paid upgrade was performed. Mumbai A1 capacity was unavailable. The user created the Always Free fallback `fitzo-api-prod`, `VM.Standard.E2.1.Micro`, Ubuntu 24.04 AMD64, 1 GB RAM, one 47 GB boot disk, and no additional block volumes. Public IPv4 is `130.210.3.149`; private IPv4 is `10.0.0.7`.
- Docker Engine 29.9.1 and Compose 5.6.0 were installed from Docker's official Ubuntu repository. Docker and firewall persistence are enabled at boot. A 1 GB swap file uses space on the existing boot disk. SSH ingress is restricted to the administrator's current `/32`; public web ingress is TCP 80/443. API port 3001 is bound only to host localhost; no database port is exposed.
- `/opt/fitzo` is a shallow, sparse checkout of tested backend revision `f721d4092e97ad66300558a667bd38fe942ebe6a`. Production settings were privately exported from Render, transferred over SSH, and verified byte for byte with mode 600. The production JWT key differed from the developer key; the exact production value was preserved.
- Cloudflare now has one explicit DNS-only A record for `api.fitzoapp.in`, TTL 60, record ID `19d1f64b5cfdb3d4cb05e3cd6a4524a2`. Previously the hostname inherited the wildcard Vercel CNAME. All eleven other DNS records, including website and mail records, were retained.

## Prepared changes

Mobile EAS build profiles and the API fallback now target `https://api.fitzoapp.in/api` in this isolated branch. The API health response accepts `APP_GIT_COMMIT` on another host and retains the existing Render revision fallback.

`deploy/oracle/` contains the Node 24 production image, a restricted build context,
Compose services, a Caddy HTTPS proxy, a private-environment template, and the
deployment/recovery runbook. The API starts on localhost first; the HTTPS proxy
requires a healthy API and is enabled separately after DNS is ready.

The uptime and AI cron workflows accept repository variable `FITZO_API_ORIGIN`,
with the existing Render origin as their fallback. Repository variable
`FITZO_API_ORIGIN` is now `https://api.fitzoapp.in`; a dedicated `CRON_SECRET`
matches the private API runtime. The workflows merged to the default branch and
the uptime verification run passed against the new API. Cron jobs validate their endpoint choice
and require a configured secret before sending the authenticated request.

Verification completed: 52 backend suites / 485 tests passed, Compose YAML parsed,
and `git diff --check` passed. A clean staging directory installed production-only
dependencies and started the actual API on Node 24 for Windows x64. Both protected
read routes returned `401 AUTH_REQUIRED`, the shared AI contract loaded, and the
packaged Supabase CA loaded with certificate verification enabled. This smoke
check used test-only credentials and a localhost database address.

Live verification: the production Docker image built on the AMD64 VM, and Caddy's
configuration validated. The deployment checker passed on localhost, through
public HTTPS from the container, and from the Windows workstation. Supabase TLS
was encrypted and its certificate verified. Public TLS verified for
`api.fitzoapp.in`, with a certificate expiring 2027-01-15; Caddy manages renewal.
A nonexistent cron path returned 401 without the secret and 404 with the correct
secret, testing authorization without running batches or sending notifications.
No setup scripts, migrations, seeds, or application data writes were performed.
ARM64 has not been exercised.

Observed idle memory was about 64 MiB for the API and 13 MiB for Caddy, with about
447 MiB available on the host. Three synthetic bcrypt checks took 208–216 ms.
These are smoke checks, not a production load-capacity guarantee. The API is
non-root, read-only, and limited to 512 MiB; Caddy is limited to 128 MiB.

Run the read-only deployment check against the replacement backend before changing DNS, then repeat it through the final API domain:

```sh
node backend/scripts/check_deployment.js https://test-api.example.test FULL_40_CHARACTER_COMMIT
node backend/scripts/check_deployment.js https://api.fitzoapp.in FULL_40_CHARACTER_COMMIT
```

It requires healthy API and database responses, the expected deployed revision, and authentication enforcement on two protected API routes. It makes no application data writes. It is not a replacement for a test-account login and workflow check.

## Preserve existing users

Retain the existing Supabase database, exact production `JWT_SECRET`, authentication code, user IDs, OAuth client IDs, and application package identifiers. Copy required runtime secrets privately from the active production configuration. Do not generate a replacement JWT secret during a hosting move.

Existing valid sessions should remain usable if the signing secret and user token versions are preserved. Expired or revoked sessions can still require login. Users do not need new accounts or a reinstall.

The deployed app configuration has no `expo-updates` dependency, update URL, or runtime version. Existing store builds cannot receive this API-address change over the air. Users need a normal store update; automatic store updates may install it for them. Older builds continue using the Render URL until they update. A DNS change on `fitzoapp.in` cannot redirect the provider-owned `fitzo.onrender.com` hostname.

EAS inventory shows completed production builds for 1.4.1 on 2026-10-15: iOS build
25 and Android build 28, associated with source commit
`0e7797922adc8edbc64129b9dcb3bd44e5df649f`. A hosting hotfix must retain that
release's app changes and use fresh build numbers. Publishing the older mobile
tree from the backend checkout would regress released features.

The main workspace's EAS profiles, API fallback, and ignored mobile environment
files now use the verified API domain. Its unrelated pending app changes were
preserved. The user selected a hosting-only hotfix from the last built 1.4.1
release. Signed 1.4.2 builds completed: Android 29 and iOS 26. Both binaries were
verified to contain the new API URL, and the hotfix merged after CI passed.
Both approved store uploads finished successfully. Android production build 29
is verified at 100% (`completed`, no user fraction), and Google reports it is in
review while build 28 remains published. The submission profile retains full
rollout. iOS build 26 was uploaded to App Store Connect/TestFlight; a public App
Store release has not been submitted. The old Render origin still returns HTTP
503, so installed old binaries remain affected until they update or Render lifts
the suspension. A real test-account login, OAuth, AI, email, and upload flow
remain release acceptance checks. See the
[final verification record](../reviews/2026-10-17-oracle-migration.md) for build
links and the separate FatSecret credential issue.

## Hosting acceptance gates

The deployed E2 micro has a 1/8 OCPU baseline with burst capacity. Monitor latency,
memory, and restarts under real traffic. Oracle may reclaim idle Always Free VMs;
this setup has no uptime guarantee. A larger Always Free A1 VM is an option only
when home-region capacity is available. Do not upgrade or create paid shapes.
Maintain HTTPS, restart behavior, OS updates, monitoring, and recovery instructions.

For a no-card alternative, verify the account actually permits deployment without payment details. Netlify Free is a candidate, with 300 monthly credits and service pausing at the limit. Before using it, adapt and test Express request handling, the 6 MB buffered payload limit, 60-second synchronous execution, background insight warming, and the 15-minute background jobs. The existing fire-and-forget jobs must not be deployed unchanged into a short-lived serverless handler.

## Cutover order

1. Verify the hosting plan, access, and resource estimate.
2. Deploy the tested backend revision with existing production secrets and the same database. Verify it on the VM's localhost interface first, then through the final HTTPS API domain. Do not run schema setup or seed scripts.
3. Verify read-only health/revision/authentication checks, then exercise login and an intended workflow using a designated test account.
4. Configure matching `CRON_SECRET` values privately in the backend and GitHub Actions; verify the scheduler target. Avoid duplicate scheduled executions.
5. Point only the API hostname to the verified backend. Keep the main website and email DNS records intact. Verify HTTPS and repeat deployment checks.
6. Update uptime and cron workflows to the final API origin. Add the new mobile API URL to the reconciled release and publish through normal store release procedures.
7. Preserve the previous release and recovery configuration. The currently suspended Render host is not a working rollback target until its suspension is lifted.

The replacement backend and DNS cutover are verified. Installed store binaries
still use Render until an app update is released and installed. Follow
[`deploy/oracle/README.md`](../../deploy/oracle/README.md) for operation and recovery;
never remove certificate volumes with `docker compose down -v`.
