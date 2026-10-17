# Fitzo hosting migration preparation

Prepared from deployed release `13da460b1d7d674ac28838a445edb941b59e3b52` in branch `codex/no-card-migration`. The primary workspace has unrelated changes for version 1.4.1; they are not included in this migration checkout.

## Current state

- Production Render API is suspended because shared free instance hours were exhausted.
- The configured Supabase database passed a read-only connection check during the incident investigation.
- `fitzoapp.in` already uses Cloudflare DNS and its website returns HTTP 200.
- `api.fitzoapp.in` currently points to a missing Vercel deployment. Do not publish a mobile build using the new API address until its replacement backend is verified.
- The user authorized proceeding with the existing Oracle account. Its welcome email confirms Free Trial and Always Free access. The login reached mandatory MFA enrollment, which the account owner must complete. The console's plan, quotas, resource estimate, and capacity still need verification. No cloud server, replacement deployment, DNS change, store build, or production cutover has been performed.

## Prepared changes

Mobile EAS build profiles and the API fallback now target `https://api.fitzoapp.in/api` in this isolated branch. The API health response accepts `APP_GIT_COMMIT` on another host and retains the existing Render revision fallback.

`deploy/oracle/` contains the Node 24 production image, a restricted build context,
Compose services, a Caddy HTTPS proxy, a private-environment template, and the
deployment/recovery runbook. The API starts on localhost first; the HTTPS proxy
requires a healthy API and is enabled separately after DNS is ready.

The uptime and AI cron workflows accept repository variable `FITZO_API_ORIGIN`,
with the existing Render origin as their default until cutover. No repository
variable or secret has been changed. Cron jobs validate their endpoint choice
and require a configured secret before sending the authenticated request.

Verification completed: 52 backend suites / 485 tests passed, Compose YAML parsed,
and `git diff --check` passed. A clean staging directory installed production-only
dependencies and started the actual API on Node 24 for Windows x64. Both protected
read routes returned `401 AUTH_REQUIRED`, the shared AI contract loaded, and the
packaged Supabase CA loaded with certificate verification enabled. This smoke
check used test-only credentials and a localhost database address. Docker image,
Linux ARM64, live database, and HTTPS validation remain pending on the actual VM.

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

Reconcile the pending 1.4.1 changes and current store build numbers before producing the next signed release. This branch intentionally does not change version numbers or include unrelated unfinished features.

## Hosting acceptance gates

For Oracle, first confirm account creation and an Always Free eligible VM in the chosen home region with a zero recurring estimate. Do not upgrade the account or create paid shapes. Maintain HTTPS, restart behavior, OS updates, monitoring, and recovery instructions. Free VM capacity and availability are not guaranteed.

For a no-card alternative, verify the account actually permits deployment without payment details. Netlify Free is a candidate, with 300 monthly credits and service pausing at the limit. Before using it, adapt and test Express request handling, the 6 MB buffered payload limit, 60-second synchronous execution, background insight warming, and the 15-minute background jobs. The existing fire-and-forget jobs must not be deployed unchanged into a short-lived serverless handler.

## Cutover order

1. Verify the hosting plan, access, and resource estimate.
2. Deploy the tested backend revision with existing production secrets and the same database. Verify it on the VM's localhost interface first, then through the final HTTPS API domain. Do not run schema setup or seed scripts.
3. Verify read-only health/revision/authentication checks, then exercise login and an intended workflow using a designated test account.
4. Configure matching `CRON_SECRET` values privately in the backend and GitHub Actions; verify the scheduler target. Avoid duplicate scheduled executions.
5. Point only the API hostname to the verified backend. Keep the main website and email DNS records intact. Verify HTTPS and repeat deployment checks.
6. Update uptime and cron workflows to the final API origin. Add the new mobile API URL to the reconciled release and publish through normal store release procedures.
7. Preserve the previous release and recovery configuration. The currently suspended Render host is not a working rollback target until its suspension is lifted.

Oracle console access and the Always Free resource estimate must be verified before provisioning. App users are not affected by the preparation changes until a tested replacement is deployed and a store update is released.
