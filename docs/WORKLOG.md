# Fitzo Work Log

> Running log of roadmap execution. Update after every working session.
> Roadmap: Stabilize (wk 0–2) → Differentiate (wk 2–8) → Monetize (wk 8–13)
> North star: **week-4 retention in one physical gym** (instrument: manager dashboard → Retention)

---

## Phase 1 — Stabilize ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| Production restored (Supabase unpaused) | ✅ | Root cause: Supabase free tier auto-paused — keep-alive pinged `/health` which never touched the DB |
| Keep-alive now DB-touching | ✅ | `index.js` pings `/api/health` (runs `SELECT 1`) so Supabase sees activity |
| Uptime alerting | ✅ | `.github/workflows/uptime.yml` — pings every 30 min, GitHub emails on failure |
| CI pipelines | ✅ | `backend-ci.yml`, `mobile-ci.yml` |
| Env hygiene | ✅ | `render.yaml` now lists RESEND, UPSTASH, AI_*, SENTRY, GOOGLE_CLIENT_ID_WEB, CRON_SECRET, RENDER_EXTERNAL_URL |
| Settings dead UI fixed | ✅ | Toggles wired, dynamic version |
| Manager settings + capacity editor | ✅ | Modal wired to `PATCH /api/manager/gym` |
| Member invites | ✅ | Resend email; temp password only returned in non-prod fallback |
| AI cost quotas | ✅ | Per-user minute/day/month limits (`aiQuota.js`) — future premium paywall lever |
| Gym pilot kit | ✅ | `scripts/create_gym.js` — gym + manager + printable QR poster; join-by-code in Settings |
| Capacity-based crowd light | ✅ | Green <40% / yellow 40–74% / red ≥75% of gym capacity; member home + manager dashboard |
| Retention + at-risk analytics | ✅ | `GET /api/manager/retention`, `GET /api/manager/at-risk` + dashboard UI |

## Phase 2 — Differentiate 🟡 IN PROGRESS

| Item | Status | Notes |
|------|--------|-------|
| Context pack (14-day user data → every AI call) | ✅ | `contextPack.js`, cached 15 min |
| Coach chat memory | ✅ | `coach_messages` table, last 10 turns sent to Gemini, history endpoint |
| Daily insight (morning coach note) | ✅ | Cached 1/day, home screen card, push notification |
| Weekly AI recap | ✅ | Stats screen + share card; covers the **previous completed week** |
| Cron scheduling for insights/recaps | ✅ | `POST /api/cron/*` (secret-protected) + `ai-cron.yml` (daily 06:30 IST; Mondays 07:00 IST) |
| Voice transcription (Gemini) | ✅ | `POST /api/ai/transcribe` |
| XP awards (workout +15, check-in +5) | ✅ | `xpService.js`, `xp_logs` table |
| Gym leaderboard + kudos | ✅ | Weekly XP ranks, fist-bumps (1/buddy/week), push notifications, confetti UI |
| UI polish pass (7 TODO_UIUX items) | ✅ | Crowd colors, QR frame, streak animation, exercise autocomplete, forgot-password inputs, custom quick-add, pull-to-refresh |
| Photo-first food logging as default flow | ✅ | Installed camera banner entry point + base64 bugfix + portion sliders |
| Duo streaks | ⬜ | Phase 2/3 boundary |
| Monthly gym challenge | ⬜ | |
| Onboarding flow for first-time users (LGN_001) | ✅ | Fully built multi-step OnboardingWizard with TDEE/Macro blueprints |
| Biometric login (LGN_004) | ⬜ | |
| Screen transition animations (ANI_001) | ⬜ | |

## Phase 3 — Monetize ⬜ ON HOLD (per decision)

| Item | Status |
|------|--------|
| Razorpay subscriptions | ⬜ |
| Quota-gated free/premium tiers | ⬜ (infra ready — `aiQuota.js` limits are env-configurable) |
| Second pilot gym | ⬜ |

---

## Fixes from code review (July 15, 2026)

| Bug | Severity | Fix |
|-----|----------|-----|
| Keep-alive pinged `/health` (no DB touch) → Supabase auto-paused → 89-day silent prod outage | Critical | Ping `/api/health`; uptime workflow alerts on degraded |
| Chat history `ORDER BY ASC LIMIT 50` returned the oldest 50 forever | High | `DESC LIMIT 50` + reverse |
| Weekly recap generated for the in-progress week (near-empty on Monday, cached stale all week) | High | Recap now covers the previous completed Mon–Sun week |
| Weight trend inverted (gain reported as loss) | High | Fixed comparison direction |
| Daily insights/recaps batch functions never scheduled — proactive pushes never fired | High | Cron routes + GitHub Actions schedules |
| On-demand daily insight sent a push to a user already looking at it | Low | `sendPush` flag; only batch pushes |
| Leaderboard included managers/trainers | Low | `role = 'member'` filter |
| Kudos 409 response shape inconsistent with global error format | Low | `ConflictError`; mobile reads `message` first |
| AI Coach screen was unreachable — route existed but nothing navigated to it | High | Home header sparkle button + daily-insight card now open `/ai-coach` |

## Deploy checklist (do once)

1. Render env: add `CRON_SECRET` (generate: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`)
2. GitHub repo secret: add the same value as `CRON_SECRET`
3. Push to master → Render auto-deploys → verify `/api/health` is `ok`
4. Manually run the "AI Coach Cron" workflow once (workflow_dispatch) to smoke-test
5. Google OAuth Cloud Console fixes (redirect URI, test users, SHA-1) — steps documented in previous session

---

## Fixes & Polish Pass (July 15, 2026)

| Feature / Fix | Type | Details |
|---|---|---|
| **76/76 API Audit** | Verification | Ran full functional API audit script against live local DB/server; all endpoints pass |
| **Photo-First Food Logging (Primary Flow)** | UI Improvement | Added prominent GlassCard entry banner at the top of CalorieLogScreen to launch the scanner when not searching |
| **Scanner base64 Bug** | Bug Fix | Changed camera options in `FoodScannerScreen.tsx` to request base64 data and send it directly to the API, resolving local URI parameter crash |
| **AI Vision Response Mapping** | Bug Fix | Mapped backend items/total format correctly to detectedFood state instead of expecting legacy `response.food` |
| **Scanned Details Prefill** | UI Improvement | Parsed scanner navigation parameters in `CalorieLogScreen` via `useLocalSearchParams` to open and prefill details modal immediately |
| **Portion Sliders** | UI Improvement | Built and integrated a custom high-performance `CustomSlider` component to smoothly adjust serving count or gram amount |
