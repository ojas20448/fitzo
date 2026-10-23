# Render deployment investigation — 17 October 2026

## Diagnosis

Render suspended both free web services after the workspace exhausted its shared free instance-hour allowance. This is the immediate availability blocker. The latest production deployment succeeded; rolling back or rebuilding cannot reset that allowance.

Verified using the authenticated Render dashboard, live HTTP checks, deployed Git revisions, GitHub Actions logs, and a read-only database connection check. No billing, service configuration, credentials, application data, or application source were changed during this investigation.

| Component | Verified result |
| --- | --- |
| Production `fitzo` | HTTP 503 with Render's `Service Suspended` HTML page; dashboard says `Free usage limit reached`. |
| Production deployment | Last successful commit `13da460b1d7d674ac28838a445edb941b59e3b52`; successful deployment on the `master` branch. |
| Staging `fitzo-worker-staging` | Same suspension and HTTP 503; deployed commit `77f2e0c346b6afafef317cd86c44adf813011029` on `codex/antigravity-worker`. |
| Configured production Supabase database | TLS-verified connection and `SELECT 1` succeeded in approximately 234 ms. This checks connectivity, not a complete data integrity audit. |
| Render staging database | `fitzo-worker-staging-db` is available; dashboard explicitly warns it expires **1 November 2026**. |
| Workspace billing | Hobby plan; no payment card; $0 current unbilled charges. Bandwidth 228 MB / 5 GB; pipeline minutes 3 / 500. These were not the exhausted limits. |

The billing usage meter showed **725.73 / 750 hours** during inspection, while the email and both service pages reported exhausted free usage and suspension. Reporting delay is a possible explanation, but the exact discrepancy was not established. Treat the service suspension as authoritative for current availability; raise this discrepancy with Render support if needed.

## Why this happened

- Render grants **750 running hours per workspace per calendar month**, shared across free web services.
- Both deployed backend revisions enable an HTTPS self-ping every **14 minutes** when `NODE_ENV=production` and `RENDER_EXTERNAL_URL` are set. Render supplies the service URL automatically. See `backend/src/index.js:210` in the current checkout; staging has the same logic.
- Render's idle timeout is 15 minutes. These self-pings are designed to prevent idle sleep. A running staging copy consumes the same shared hours as production.
- Two services running continuously use **48 instance hours per day**: `750 / 48 = 15.625 days`. Actual exhaustion depends on when each service started and how long it slept.
- The production uptime workflow also requests `/api/health` every scheduled 30 minutes, touching the database. Actual GitHub schedule execution was delayed, so this is not a reliable exact-interval monitor.
- The laptop-worker README records that the worker was **retired on 2 October 2026**, while its Render staging service remained deployed. Disabling auto-deploy does not stop an already running service.

Production monitoring was healthy at **14:35 IST on 17 October** (09:05 UTC) and observed the suspension by **18:36 IST** (13:06 UTC). These checks bound the observed transition; they do not establish the exact start of the outage.

Render's Events page additionally records `Suspended by Free Tier Usage Exceeded`, displaying **17 October 2026 at 5:45 PM**. This is direct confirmation of the suspension reason; the dashboard timestamp is recorded here as displayed.

## Separate confirmed configuration problem

AI cron workflows were failing before the Render suspension:

- The 17 October run at 10:44 IST (05:14 UTC) successfully checked API and database health, then received HTTP 404 with `NOT_FOUND` from the cron endpoint.
- The deployed app mounts `/api/cron`. `backend/src/routes/cron.js:29` deliberately returns that same 404 when `CRON_SECRET` is absent.
- `CRON_SECRET` was absent from the production Render environment variable list. No environment groups were linked.
- `CRON_SECRET` was also absent from the GitHub repository secret list.
- The latest six AI cron runs all failed. The inspected run proves the missing-secret cause for that run; this investigation did not individually trace every older failure.

Restoring Render compute alone will not restore scheduled coach insights, weekly recaps, and quiet-hours alerts. They also need the same strong random `CRON_SECRET` configured privately in both Render and GitHub Actions.

## Recommended next moves, in order

1. **Restore production:** on the existing `fitzo` service, choose the smallest paid web-service compute plan: **`0.5c-512mb`, $7/month**, formerly Starter. Review the final displayed price and taxes before confirming. Compute is prorated; additional metered usage is separate. Keep the Hobby workspace plan unless another feature requires a different workspace plan. Upgrading the workspace plan alone does not remove free-service limits.
2. **Manually suspend the retired staging web service:** this prevents automatic resumption next month and avoids consuming future shared free hours. Keep it recoverable while deciding whether any staging data is needed. Do not delete its database as part of emergency recovery.
3. **Repair AI scheduling:** configure a matching `CRON_SECRET` in Render and GitHub repository Actions secrets, then deliberately run and verify the cron jobs after production is healthy. These jobs can generate insights and send push notifications, so their execution is an operational action, not a read-only check.
4. **Verify recovery:** require `/api/health` to return HTTP 200 with `status=ok`, database `ok`, and the expected deployed commit. Then verify sign-in, reading saved workouts, and one intended AI feature in the installed app. Do not make test writes to real user histories without an appropriate test account.
5. **Preserve any needed staging data before 1 November:** export it to a private backup or choose an appropriate retained database. The expiring Render staging database is separate from the configured production Supabase database.
6. **Prevent recurrence:** run staging locally or only when needed; make service self-pinging explicit and disabled for staging. Keep database-aware production monitoring. Match deployment documentation/blueprints to the actual paid configuration after the hosting decision.

### If the budget must remain $0

The documented free-hours recovery is the **1 November 2026** monthly reset. Manually suspend staging before that reset so it stays off. Suspending staging now does not restore hours already consumed. One continuously running production service can consume up to 744 hours in a 31-day month, leaving only six hours for any other free web service in that workspace. This is a narrow allowance for staging and has the other free-plan limitations.

The app's production URL is already `https://fitzo.onrender.com/api`. Upgrading the existing service keeps that URL; the compute-plan change itself does **not** require an APK or App Store rebuild. Avoid creating a replacement backend URL during emergency recovery unless a migration is intentional.

## Existing production settings checked

- Root directory: blank (repository root).
- Build command: `npm ci --prefix backend`.
- Start command: `node backend/src/index.js`.
- Health check path: `/api/health`.
- Production and preview mobile build profiles point to the existing production API URL.

The local `backend/render.yaml` still declares `plan: free`, uses the name `fitzo-backend`, and differs from these active root/build/start settings. It is not a faithful description of the currently deployed `fitzo` service; do not import it as a replacement during this incident.

## Evidence and references

- [Production Render service](https://dashboard.render.com/web/srv-d5lavfhr0fns73e6e8eg)
- [Production compute settings](https://dashboard.render.com/web/srv-d5lavfhr0fns73e6e8eg/compute)
- [Workspace billing](https://dashboard.render.com/w/tea-d5lanq14tr6s73bqvnq0/billing)
- [Staging Render service](https://dashboard.render.com/web/srv-davaki2d0e5s73f86580)
- [Staging database](https://dashboard.render.com/d/dpg-davaem17lnhs73blk420-a)
- [Last inspected successful production monitor](https://github.com/ojas20448/fitzo/actions/runs/39019767111)
- [Inspected failed production monitor](https://github.com/ojas20448/fitzo/actions/runs/39035184799)
- [Inspected AI cron failure](https://github.com/ojas20448/fitzo/actions/runs/39005553315)
- [Render free service rules](https://render.com/docs/free)
- [Render compute plans and legacy names](https://render.com/docs/compute-plans)
- [Render automatically supplied environment variables](https://render.com/docs/environment-variables)
- [Render pricing](https://render.com/pricing)

Remaining limitation: authenticated application recovery and cron execution cannot be verified until the production compute suspension is lifted. No paid upgrade was purchased during this investigation.
