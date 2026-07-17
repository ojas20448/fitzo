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
| Screen transition animations (ANI_001) | ✅ | Native slide/fade stack options added in app _layout.tsx |

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

## Fixes from full functional audit (July 15, 2026 — 76/76 API checks + wiring audit)

| Bug | Severity | Fix |
|-----|----------|-----|
| AI chat + daily insight 500 — context pack queried nonexistent `meal_name` column | Critical | Use `food_name`; schema.sql updated to match live DB |
| **Active Workout flow 404** — api.ts called `/workouts/sessions/*` but routes live at `/workout-sessions/*` (get/complete/add exercise/log set all broken) | Critical | Repointed 7 paths in api.ts |
| Notifications status/preferences 500 — `push_platform`, `notification_preferences` etc. columns never migrated | High | `migrations/add_push_metadata.sql` applied to live DB |
| Progress volume 500 — `COALESCE(muscle_groups, 'other')` on an ARRAY column | High | `muscle_groups[1]` + `array_to_string` filter |
| Non-UUID `/:id` params returned 500 (pg 22P02) on every detail route | Medium | Global 400 mapping in errorHandler |
| Unknown exercise ID returned 500 | Medium | 404 |
| `router.replace('/home')` — route doesn't exist (ExerciseLibrary back button) | Medium | `/(tabs)` |
| Dead api.ts methods calling nonexistent routes (`intent/sessions`, workout like/unlike) | Low | Removed |
| `workouts/latest` threw on unknown enum type value | Low | `::text` comparison → `found:false` |

New audit tooling (rerun anytime — both now enforced in CI):
- `node scripts/full_api_audit.js --url http://localhost:3001` — 76 endpoint checks, 3 roles
- `node scripts/wiring_audit.js` — mobile nav targets ↔ screens, api.ts ↔ backend routes

## Smart Log bridge (July 15, 2026)

**Problem:** the app logs workouts as flat JSON into `workout_logs`, but the AI coach
context pack, progress/volume charts, PRs, and weekly recap all read the structured
`workout_sessions`/`exercise_logs`/`set_logs` tables — which only the orphaned
ActiveWorkoutScreen wrote to. Real users' training was invisible to every AI +
analytics feature, and workout XP (direct `users.xp_points` update) never reached
`xp_logs`, so **workouts never counted on the weekly leaderboard**.

**Fix (POST /api/workouts):**
- Mirrors every Smart Log into the structured tables (session + exercise logs + sets,
  RIR→RPE converted, exercise names matched against the exercises table)
- Idempotent per day+type (`notes='smart-log'` marker; re-log replaces the mirror)
- XP now goes through `xpService.awardXP` (+15, logged to `xp_logs` → leaderboard) —
  no double XP on same-day re-log
- Context pack cache invalidated on log, so the coach sees the workout immediately
- Mobile now sends `duration_minutes`
- Verified live end-to-end: session + sets in DB, XP on leaderboard, re-log idempotent

**Status note:** `ActiveWorkoutScreen` (live session mode) remains unreachable by design
for now — WorkoutLogScreen's Smart Log is the intended flow; its API paths were fixed
so it can be wired in later as a premium "live mode" without backend work.

## Process rule — migrations

Two of today's critical bugs (`meal_name`, missing push columns) were schema drift:
code written against columns that were never migrated. Rule going forward:
**every schema change = a file in `src/db/migrations/` applied via
`node scripts/run_sql.js`, then reflected in `schema.sql`.** Never ad-hoc SQL.

## Still open (needs owner action)

- `YOUTUBE_API_KEY` on Render — workout videos currently serve mock data
- `CRON_SECRET` on Render + GitHub secret (then dispatch "AI Coach Cron" once to smoke it)
- Google OAuth Cloud Console steps (redirect URI, test users, SHA-1)

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

## Bridge audit — unwired producer/consumer pairs (July 16, 2026)

New tool: `node backend/scripts/bridge_audit.js` — builds a write/read matrix for
every table and flags data collected-but-never-read, read-but-never-written, and
dead tables. Same bug class that made the AI coach blind to workouts.

| Bridge fixed | Severity | Fix |
|--------------|----------|-----|
| **Wearable data never reached the AI coach** — `health_data` (steps/HR/sleep/calories from Apple Health & Health Connect auto-sync) was written but no AI feature read it | High | Context pack now fetches last 7 days of wearables; gemini chat + daily insight prompts already referenced the `wearables` key |
| **Check-in left 3 caches stale** — writing an attendance didn't invalidate the cached streak (5-min TTL), home data, or gym crowd level, so the home screen showed the old streak after checking in | High | `checkin.js` now busts `userStreak`, `homeData`, and `crowdLevel` caches (matching the context-pack invalidation already there) |
| **Adopt-split XP bypassed the leaderboard** — `workouts-published.js` awarded XP via a bare `xp_points` UPDATE that never wrote `xp_logs` (same bug we fixed in `workouts.js`) | Medium | Routed through `xpService.awardXP` → now counts on the weekly gym leaderboard |
| **Push notifications ignored user preferences** — `sendToUser`/`sendToUsers` fetched the token but never checked `notification_preferences`; a user who muted a category still got pushed | Medium | Added `isTypeAllowed()` gate mapping each notification type to its preference flag; muted categories are skipped |

Not bugs (verified, left as-is):
- `workout_plans`/`calorie_plans`/`class_sessions` are read-only in-app (seed data only, no create endpoint) — deferred B2B trainer/manager tooling, not a wiring break
- `learn_lessons`/`exercises` read-but-never-written = reference/seed data loaded via SQL scripts (correct)
- `workout_splits`/`recipe_ingredients` "dead" tables don't exist in the live DB — stale schema.sql definitions superseded by `user_splits` and JSON `ingredients` columns

## Heatmap data fix + receipt share cards (July 16, 2026)

**Heatmap audit (Antigravity commit a1d709a):** UI solid, but the data chain was broken —
Smart Log exercises rarely matched the 38-row exercises catalog ("Barbell Bench Press"
!= "Bench Press") so muscle attribution fell to 'other' and the heatmap stayed grey.
Fixes:
- `exercise_logs.muscle_group` column (migration applied) — client-reported target
  muscle stored directly, normalized to the six buckets
- Containment name matching (either direction, longest wins) → "Barbell Bench Press"
  now matches "Bench Press"
- volume + contextPack queries fall back to `el.muscle_group`; fixed GROUP BY
  alias-shadowing (42803)
- StatsScreen folds specific muscles (biceps, quads, lats…) into the six buckets
- Verified live: chest 2 sets / arms 1 set attributed from a Smart Log with targets

**Receipt share cards (PUSH-inspired):** new `ReceiptShareCard.tsx` — thermal-receipt
aesthetic (cream paper on black, monospace, black section bars, SVG barbell/trophy
line-art, hand-drawn ink circle around the total, Indian weight equivalences:
elephants/auto-rickshaws/Royal Enfields/gas cylinders/watermelons). Wired into
WorkoutRecapScreen with a STORY/RECEIPT toggle through the existing
ViewShot + expo-sharing pipeline. RN letterSpacing note: values are points, not %,
so "Swiss tracking" needs fontSize-proportional values.

## PR detection + anatomical heatmap + share flow (July 16, 2026)

- **PR detection wired end-to-end**: POST /api/workouts now compares each exercise's
  top set against the user's previous best (catalog-id or name match, excludes the
  current session) and returns `prs[]` — verified live (75kg beat 70kg → PR fired).
  Lights up both the dark story card's PR display and the receipt trophy variant.
- **AnatomyHeatmap component**: organic muscle-shaped SVG paths (left side authored,
  right side mirrored — always symmetric) replace the blocky rectangles. Front: delts,
  pecs, biceps, forearms, abs, obliques, quads, shins. Back: traps, lats, lower back,
  triceps, glutes, hamstrings, calves. Neutral head/neck/pelvis/hands.
- Share flow confirmed: finish workout → recap screen → STORY/RECEIPT toggle →
  ViewShot PNG → expo-sharing sheet (Instagram Stories, WhatsApp, etc.)
- Removed stray preview_anatomy.html from repo root

## Best-user polish pass (July 17, 2026)

- **Exercise catalog seeded: 38 → 164 rows** (`scripts/seed_exercises_from_catalog.js`,
  insert-only) — Smart Log name matching, heatmap muscle attribution, PR detection,
  and coach context all sharpen; 126 mobile-catalog exercises added with normalized
  muscle_groups + category + is_compound heuristic
- **Weekly recap share is now a 1-bit receipt** — StatsScreen captures a
  ReceiptShareCard (workouts headline, check-ins caption, calories/protein/trend rows,
  streak circled in ink) via the ViewShot pipeline; text share kept as fallback
- Verified avatar system end-to-end (8 dithered presets → picker → PUT /member/profile
  → auth-cache invalidation) — already fully wired, no changes needed
- Food depth reviewed: 1,000+ local Indian foods + IFCT2017 + OpenFoodFacts + USDA +
  AI photo/text logging — depth is sufficient; no additions needed
