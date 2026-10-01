# Fitzo laptop worker

This branch prepares local/private testing. It has not been deployed to the existing Fitzo backend. The repository's mobile default URL is `https://fitzo.onrender.com/api`; a new migration, backend release and dedicated worker credential are required before a worker can connect there. Use a staging backend/database first. The laptop never accepts inbound connections.

## AI feature coverage

| Feature | Laptop worker | API fallback when enabled |
| --- | --- | --- |
| Food photo scanning | Verified real image + schema; asynchronous mobile jobs | Gemini API |
| Coach | Verified schema-wrapped text | Gemini API |
| Workout plans, nutrition advice, form advice | Routed through queue; mocked contract tests | Gemini API |
| Food text analysis, food extraction, workout extraction | Routed through queue; mocked contract tests | Gemini API |
| Daily insights, weekly recaps | Routed through queue with explicit user ownership | Gemini API |
| Voice transcription | Audio interface unverified; no text approximation | Existing Gemini/Groq router and `TRANSCRIPTION_PROVIDER` preference |

All ten text/photo feature routes share one worker queue and account quota. `AI_WORKER_API_FALLBACK=true` explicitly allows configured Gemini API fallback and retains the existing Groq/Gemini voice behavior. It does not provision keys, enable billing, buy credits or change provider-account limits. `false` is subscription-only; voice then returns an actionable unavailable response. No fake coaching or nutrition output is returned when worker mode fails.

## Backend preparation

Run in `backend/` against a **separate staging database** with the existing Fitzo schema. Do not run `db:setup` against an existing database; that script drops tables.

```powershell
npm ci
node scripts/migrate-ai-worker.js
node scripts/worker-admin.js issue C:\private\fitzo-worker.token
```

The migration adds tables without modifying existing meal data. The backend role must own these tables or have appropriate privileged service access; RLS intentionally gives mobile/direct database clients no access. Keep the token file outside Git and restrict its ACL to the worker OS user. Credentials expire in 90 days and can be revoked using the printed credential ID. Never copy a database credential, JWT secret, or Gemini/Groq API key to the laptop worker.

Backend environment:

```text
AI_PROVIDER=laptop-worker
AI_QUEUE_LIMIT=30
AI_WORKER_WAIT_MS=45000
AI_WORKER_API_FALLBACK=false
```

To retain configured API fallbacks, set `AI_WORKER_API_FALLBACK=true`, and keep the existing `GEMINI_API_KEY`, `GROQ_API_KEY`, `GEMINI_MODEL`, `GEMINI_FAST_MODEL` and `TRANSCRIPTION_PROVIDER` settings on the backend. Those credentials remain on the backend. Existing per-user quotas still apply. Photo retries using the same idempotency key do not consume quota again after the first stored submission.

`backend/render.staging.yaml` describes a staging service on `codex/antigravity-worker`. In Render, leave Root Directory blank, set Build Command to `npm ci --prefix backend`, and Start Command to `node backend/src/index.js`. Render excludes files outside a configured root directory, so `backend` cannot be the root: the backend needs sibling `ai-worker/contracts.js`. See https://render.com/docs/monorepo-support . Production deployment and production migration require the owner's explicit approval.

Render free web services have no Shell/SSH access (https://render.com/docs/ssh). Run migration and credential issuance from a trusted development/admin machine, in `backend/`, using the database provider's externally reachable connection settings in a private, ignored `.env` file. Use a separate staging database for the first test. Transfer only the resulting worker token file to the worker laptop; database credentials stay on the admin machine. Paid services can run the scripts through their dashboard Shell, with a private token file securely transferred afterward.

## Laptop setup

Node 22+ and the official Antigravity CLI are required. On this inspected Windows laptop, Node 24.15.0 and `C:\Users\Ojas\AppData\Local\agy\bin\agy.exe` are installed. `agy` need not be on PATH when `agyPath` is configured. Sign in using the official interactive `agy` flow; this laptop's existing cached sign-in worked. API-key CLI mode is deliberately rejected.

Use a dedicated Windows OS account for sustained worker operation, sign into Antigravity there through its official flow, and keep that account's personal files empty. Windows CLI permission controls were used for local tests; native OS isolation of Antigravity is not independently verified here. No permission bypass flag is used. The worker verifies **effective** settings with the official `agy -p /config` command because the CLI removes default-valued entries from its JSON file.

Set the following in that worker account's `~/.gemini/antigravity-cli/settings.json`, preserving unrelated settings:

```json
{
  "useG1Credits": false,
  "allowNonWorkspaceAccess": false,
  "toolPermission": "request-review",
  "permissions": {
    "deny": ["command(*)", "write_file(*)", "read_url(*)", "execute_url(*)", "mcp(*)"]
  }
}
```

These permission rules affect that account's other Antigravity sessions too. Existing user settings were backed up locally before tightening them during verification. Credit fallback is confirmed disabled through `/config`; purchase/overage settings in the Google account portal were not independently inspected. No purchases or billing changes were made.

Copy `config.example.json` to `config.json`, supply the staging HTTPS API URL, the private worker token-file path and the actual CLI path. `config.json` and runtime files are ignored by Git. No npm dependencies are needed in the worker package.

```powershell
cd ai-worker
Copy-Item config.example.json config.json
# Edit config.json with your staging URL and paths.
node worker.js diagnose
node worker.js
```

Foreground stop: Ctrl+C. Windows management commands from `ai-worker/`:

```powershell
.\manage.ps1 start
.\manage.ps1 status
.\manage.ps1 diagnose
.\manage.ps1 stop
.\manage.ps1 install-startup
.\manage.ps1 remove-startup
```

Startup uses a Scheduled Task at user logon with three crash restarts. Registration may require an administrator session depending on Windows policy. It has not been registered on this laptop because no staging credential exists yet. Crash recovery removes stale locks only after confirming the recorded PID no longer exists. A PID reused by another process requires manual inspection before deleting the lock.

Graceful stop is checked between jobs and can take up to the 60-second provider timeout plus the bounded backend requests. `status.json` includes its timestamp: stale status means the worker may be offline. Health is sent while idle, and job heartbeats extend the lease every 15 seconds. Logs contain job IDs, state and timings, without prompt/photo content, credentials or raw provider errors. Logs rotate at 1 MB, retaining one previous file. Each CLI run has an isolated working directory; its image, schema and diagnostic log are removed on completion and stale directories are cleaned after crashes. Antigravity can retain its own conversation artifacts outside those temporary directories and Google can retain interactions under account terms; cleanup does not establish zero provider retention.

Prevent sleep while plugged in through Windows Settings → System → Power & battery → Screen, sleep & hibernate timeouts. Alternatively, after reviewing your current setting, `powercfg /change standby-timeout-ac 0` disables AC sleep. This setting was not changed automatically. Laptop/network availability remains necessary even if the main PC is off.

## Pause and diagnostics

Backend commands, using backend-side database access only:

```powershell
node scripts/worker-admin.js status
node scripts/worker-admin.js pause
node scripts/worker-admin.js resume
node scripts/worker-admin.js revoke WORKER_CREDENTIAL_ID
```

Quota/auth/permission failure pauses provider claims for 24 hours. Resume after checking quota/auth rather than repeatedly retrying provider calls. The pause is intentionally conservative: live exhausted-quota and expired-auth scenarios were not forced on the account, and exact CLI errors may vary. Unknown failures get at most three attempts; expired leases cannot complete reassigned jobs. Completed responses must match on duplicate completion. A periodic backend sweep expires pending jobs and removes their photo payload, even with an offline laptop; it also deletes retained jobs one day after expiry. Pending jobs expire after 10 minutes; leases last 90 seconds; global concurrency is one.

Check account quota:

```powershell
& "$env:LOCALAPPDATA\agy\bin\agy.exe" -p /usage --output-format json --print-timeout 20s
& "$env:LOCALAPPDATA\agy\bin\agy.exe" -p /config --output-format json --print-timeout 20s
```

Text features currently preserve their synchronous mobile contracts and wait at most 45 seconds for a queued result. Long queue waits return unavailable or use the explicitly enabled API fallback. They are wired, but have not all been exercised live with real fitness profiles. Photo scanning uses the asynchronous contract, with polling backoff to 10 seconds, pause while backgrounded, request-ID/job-ID recovery, duplicate prevention and review before meal logging. Device camera/background behavior still needs a real-phone staging check.

## Mobile rollout

After backend migration/release and successful worker diagnostics, build mobile with:

```text
EXPO_PUBLIC_API_URL=https://YOUR-STAGING-BACKEND.example/api
EXPO_PUBLIC_FOOD_JOB_MODE=true
```

The flag also selects a new AI consent key so users review the changed provider/retention description. Update the published privacy policy to describe actual Antigravity/Gemini/Groq processing before a public rollout. Old builds keep `/food/analyze-photo`. For API fallback while queued scanning is enabled, the backend returns a clearly identified fallback response and mobile invokes the retained synchronous endpoint when a photo is still available. Recovered failed scans without a local photo require recapture.

## Verification and limits

Focused queue tests run on an embedded PostgreSQL engine with serialized test connections; they validate real SQL but do not simulate independent production PostgreSQL connections. Claims additionally take a singleton state row lock in production to serialize concurrent backend transactions. Run a staging test with two workers/backend instances before public rollout.

```powershell
cd backend
npm run test:worker
npx jest --runInBand src/__tests__/daily-insight.test.js src/__tests__/weekly-recap.test.js src/__tests__/geminiQuota.test.js src/__tests__/transcribe.test.js
cd ..\ai-worker
npm test
cd ..\mobile
npm run typecheck
```

Verified on 1 October 2026: 5 queue/route/provider-contract groups, 2 worker tests, 47 existing compatibility tests and mobile TypeScript checking. Live text response: provider 2.73s; schema object: 4.82s. Three food runs total, all using the public-domain ZooFari banana fixture: first CLI run 9.08s provider time; strict schema adapter 25.97s wall time; full local authenticated API → persistent queue → actual worker → Antigravity → validated result 50.81s wall time. Coach adapter with wrapped object schema: 20.99s wall time. Single-fixture success does not establish meal accuracy or daily capacity. Queue waiting, startup, account limits and laptop uptime must be measured separately. Multiple sessions share account quota.

Google's current consumer terms section 6 raises a Fitzo-use restriction. The owner states they have permission; this branch does not independently establish that exception. Keep local/private testing until the permission and public-use data handling are verified. Official docs: https://antigravity.google/docs/cli/headless/ , https://antigravity.google/docs/cli/credits/ , https://antigravity.google/terms . The SDK quickstart uses API/Cloud credentials, so it was not used to silently replace subscription access.

## Stop and revert

Stop/remove the laptop task. Pause the backend queue. Set `AI_PROVIDER=gemini` to restore the existing API implementation, retaining the existing Groq transcription preference. Rebuild mobile with `EXPO_PUBLIC_FOOD_JOB_MODE=false` to return to synchronous photo scanning. Revoke the dedicated worker credential. The additive job tables can remain; do not drop tables until pending jobs are settled and any needed diagnostics are retained. Production food logs were never changed during this work.
