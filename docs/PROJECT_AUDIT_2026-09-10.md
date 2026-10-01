# Fitzo project map and audit — 10 September 2026

Reviewed checkout: `74ff74a`. This is a repository audit, with local tests and selected mocked reproductions. It is not a production penetration test or a claim that every line has been verified. No application code was changed.

**Assessment**

Fitzo is a substantial fitness companion with gym administration, rather than the small gym MVP described in the root README. Its strongest foundations are modular Express routes, parameterized SQL, ownership checks on many personal resources, native secure token storage, AI quotas and provider fallbacks, and useful tests around calculations and food handling. The main risks are inconsistent authorization and privacy rules, duplicated workout storage, incomplete account cleanup, and important integrations hidden behind `any` types or unimplemented tests.

The source inventory contains 282 JavaScript/TypeScript files across backend/src, mobile/src and mobile/app, including tests; PowerShell counted approximately 59,100 nonempty lines. I mapped the route surface and reviewed the main application, persistence, authentication, social, workout, nutrition, health and deployment paths. Static inspection was deeper on those boundaries than on individual visual components and content assets.

**How the project works**

| Area | Implementation and responsibility |
| --- | --- |
| Mobile shell | Expo SDK 54, React Native 0.81.5, React 19, TypeScript and Expo Router. `mobile/app` defines routes, usually wrapping screens in `mobile/src/screens`. |
| Startup | `mobile/app/_layout.tsx` loads fonts and splash/brand intro, mounts auth, nutrition, toast and error providers, handles push registration and notification navigation. |
| Authentication | `AuthContext.tsx` coordinates email, Google and Apple sign-in. `api.ts` stores native tokens in SecureStore and web tokens in localStorage, adds Bearer headers and handles retries/logout. Backend uses custom JWTs and bcrypt, with cached user role/gym data. |
| Navigation and product | Member tabs: home, buddies, scan, learn, stats and profile. Additional routes cover onboarding, workout/food logging, coach, recipes, measurements, health, sharing, classes, trainer views and manager views. |
| Backend | `backend/src/index.js` mounts 31 route groups, CORS, JSON parsers, rate limiting, error handling and health endpoints. Express handlers call SQL and service modules directly. |
| Database | PostgreSQL through `pg`, configured for Supabase/Render. A five-connection pool backs `query()`; `getClient()` supports pinned connections. Schema changes span `src/db`, `src/db/migrations` and `data/migrations`. Some tables are still created when routes load. |
| Workout records | The main screen writes flat `workout_logs` through `/workouts`. A bridge creates `workout_sessions`, `exercise_logs` and `set_logs` for analytics. A second API directly manages those structured records. |
| Workout planning | Curated mobile plans, published splits, adopted/user splits, workout intent, exercise catalogs, RIR, unilateral volume, rest timer, warmups and share recap components. |
| Nutrition | Search combines local Indian foods/IFCT with external providers. Photo/text/voice analysis, barcode lookup, recipes, community foods, meal presets and calorie logs feed targets and weekly summaries. Multiple logging APIs write calorie data. |
| Social and gym | Friend requests, acceptance/blocking, activity/feed endpoints, sharing preferences, nudges, attendance, crowd/busy times, classes, trainer assignment and manager retention views. |
| Health and progress | HealthKit/Health Connect adapters upload summaries to `health_data`; measurements, readiness, volume and PR endpoints support member charts and coach context. |
| AI | Gemini supports coaching and analysis. Transcription routes between Gemini and Groq, with Hinglish normalization. Context packs, daily insights and weekly recaps use stored fitness activity. Per-user burst/day/month quotas use Redis or memory fallback. |
| Notifications | Expo push tokens and preferences, direct/admin messages, buddy notifications and scheduled insight/recap/quiet-hour jobs. |
| State | React contexts plus persisted Zustand stores for offline cache, last-session and sharing data. Shared cache ownership and lifecycle require attention. |
| Operations | Render configuration for the backend; EAS build/submit profiles for mobile; GitHub workflows for checks, Android builds, uptime and AI cron jobs; Sentry integration on the backend. |
| Supporting material | docs contains domain/API/design/store setup and feature plans. Media and mobile assets contain artwork. Numerous backend scripts support seed, repair, migrations and historical audits; they should not be assumed safe to run against an unspecified database. Agent/skill directories are tooling rather than product runtime. |

**Critical data flows**

1. Login returns JWT → mobile stores it → request interceptor attaches it → backend verifies it → cached/database user supplies role and gym → route queries data.
2. Workout screen → `/workouts` → flat log → best-effort structured mirror → XP/attendance → analytics and coach read structured tables. This dual-write boundary is a major consistency risk.
3. Food search or AI draft → user-reviewed logging → calorie tables → nutrition totals/context. Nutrition dates use IST in several paths while workout/attendance dates still use database `CURRENT_DATE`.
4. Friendship + log visibility + account sharing preference should govern every social read. The dedicated buddy endpoint enforces more rules than the legacy feeds.
5. Device health adapter → `/health/sync` → per-day health row → home/report/coach. Actual native execution needs separate device verification.

**Verified checks**

| Check | Result |
| --- | --- |
| Backend Jest with coverage | 30 suites, 356 tests passed. Reported statement coverage 35.01%, branch coverage 22.85%, function coverage 22.27%, line coverage 35.27%. |
| Mobile Jest | 13 suites, 171 tests passed. |
| Mobile TypeScript | `tsc --noEmit` passed. |
| Mobile ESLint | 0 errors, 249 warnings. |
| Route wiring audit | 30 distinct navigation targets against 38 routes; 152 API client calls against 170 backend routes; zero reported orphans. This is a static matching check, not behavioral verification. |
| Expo web export | Passed with `--no-minify`, output in `mobile/audit-web-export`. This does not validate iOS/Android native modules. |
| Manager authorization reproduction | Direct call to the real `trainerMemberGuard` with a manager and another member ID allowed access with zero database checks. |
| Class booking reproduction | Real Express class router with mocked database/auth returned 201 for an out-of-gym class; none of the queries constrained gym membership. No real booking was created. |

Logs are in `backend/audit-test-results.txt` and `mobile/audit-{test,typecheck,lint,export}-results.txt`. Tests ran locally; no production data was deliberately mutated. The backend test suite imports the application in one placeholder file, which also triggers import-time table setup against the local test DB configuration. These side effects should be removed from test discovery.

**Prioritized findings**

P1 means fix before relying on the affected privacy, security or data-integrity behavior. P2 means a material feature/reliability defect. Findings derived from schema describe repository-defined databases; production schema drift was not inspected.

1. **P1 — Managers bypass tenant checks when reading members.** `backend/src/middleware/roleGuard.js:61` immediately allows managers. `backend/src/routes/trainer.js:65` and `:150` then fetch the requested member's profile, private intent, attendance and nutrition by ID without checking gym. A manager with an out-of-gym member ID can read that member's information. Reproduced the guard bypass locally. Require same-gym membership for managers and assigned-member plus gym checks for trainers.

2. **P1 — Switching gym carries privileged roles into another tenant.** `backend/src/routes/settings.js:51` permits every authenticated role to join/switch by gym code, and `:78` changes only gym_id. A manager keeps the manager role, then accesses the destination gym's manager endpoints. Leaving/switching also retains trainer_id. Restrict this membership flow to ordinary members or explicitly re-authorize staff roles and clear incompatible assignments.

3. **P1 — Disabling sharing does not protect all feeds.** `backend/src/routes/settings.js:171` changes share_logs_default and tells the user their logs are private. `backend/src/routes/buddy-activity.js` honors that preference, but `/workouts/feed` (`workouts.js:336`), `/calories/feed` (`calories.js:195`) and the structured workout feed (`workout-sessions.js:506`) only check log visibility/friendship. Existing friends-only records remain readable through those APIs. Centralize the social visibility predicate and test every read surface after toggling sharing off.

4. **P1 — Gym managers can send notifications across the whole platform.** `authenticateAdmin` accepts manager role; `backend/src/routes/notifications.js:154` accepts any target user ID and `:173` calls sendBroadcast. `backend/src/services/pushNotifications.js:328` selects every push token without gym filtering. Broadcast also bypasses the preference filtering present in sendToUsers. Scope manager targets to their gym and reserve platform broadcast for a separate explicit permission, while respecting notification categories.

5. **P1 — Password reset does not revoke existing sessions.** `backend/src/routes/auth.js:730` updates only password_hash. Authentication checks the JWT and user existence, with no session version or password-change cutoff; `backend/src/middleware/auth.js:117` defaults tokens to 90 days unless overridden. A stolen pre-reset token therefore remains valid until expiry. Add revocable sessions or a token version and invalidate cached auth data after reset. Account deletion also needs auth-cache invalidation; otherwise a cached deleted user can still pass the middleware for up to five minutes when Redis is configured.

6. **P1 — Accounts with health rows cannot be deleted under the declared schema.** `backend/src/routes/health.js:33` declares `user_id ... REFERENCES users(id)` without ON DELETE CASCADE. `/auth/account` (`backend/src/routes/auth.js:736`) only deletes users and assumes every related table cascades. Once a health row exists, that delete fails with a foreign-key violation. Add a migration establishing the intended cascade, or transactional explicit cleanup, and test deletion after creating each supported type of account data.

7. **P1 — Logout leaves previous-account data available in shared mobile caches.** `mobile/src/context/AuthContext.tsx:220` removes the token and cached auth user, but not the offline store. `mobile/src/stores/offlineStore.ts:283` persists home data/recipes under one device-wide key; `mobile/src/services/api.ts` returns cached home data after a network error without validating its owner. After account switching and a network failure, account B can receive account A's cached home data. NutritionProvider also retains totals/goals when user changes until a successful refresh. Namespace user data by account, reset provider state, and reject late responses from an old session. The unowned offline write queue is an additional latent cross-account risk if connected later.

8. **P1 — Automatic network retry replays non-idempotent writes.** `mobile/src/services/api.ts:93` retries any method after a timeout/network error. If the server commits a meal but its response is lost, a retry can insert another meal and award XP again; calorie logging endpoints do not accept a deduplication key. Restrict transparent retries to safe operations, or persist an operation ID and enforce uniqueness server-side for mutations.

9. **P1 — Split transaction statements do not share a pinned connection.** `backend/src/routes/workout-sessions.js:567` calls the shared query helper for BEGIN, updates, insert, COMMIT and ROLLBACK. `backend/src/config/database.js` delegates each call independently to pool.query. Under concurrent requests the statements can run on different connections, leaving partial changes or affecting another request's transaction. Use getClient(), client.query throughout, and release in finally. Friends routes already provide an example of the correct pattern.

10. **P2 — iOS health integration calls a different library API.** `mobile/src/services/healthService.ts:55` passes an array to requestAuthorization and dereferences Healthkit.HKQuantityTypeIdentifier.stepCount and similar constants. The installed library declares authorization as `{ toRead, toShare }` in `mobile/node_modules/@kingstinct/react-native-healthkit/src/specs/CoreModule.nitro.ts:19`, with string-literal identifiers rather than the referenced constant object. Calls are hidden behind any and catch blocks, so permissions fail or metrics fall back to zero while TypeScript passes. Replace the adapter with typed calls against the installed package and verify permissions/readings on iOS hardware.

11. **P2 — Manager-created users omit a required username.** `backend/src/routes/manager.js:160` inserts a user without username. `backend/src/db/migrate_username.sql:9` makes username NOT NULL without a default. On that schema, creating members/trainers fails before invitation delivery. Reuse a collision-safe username generator and integration-test creation against the migrated database. The same handler should validate that an assigned trainer belongs to the manager's gym.

12. **P2 — Class booking ignores tenant/time constraints and can overbook.** `backend/src/routes/classes.js:76` fetches a class by ID without verifying gym or scheduled_at. Capacity is read before a separate INSERT without locking. An out-of-gym booking was reproduced with the real handler and a mock DB. Concurrent requests can both consume the last slot; past classes can also be booked by ID. Validate gym/time and check capacity inside a transaction with a locked class row.

13. **P2 — Workout deletion and mirroring leave analytics inconsistent.** `backend/src/routes/workouts.js:54` deletes/recreates structured sessions without a transaction; a failure can leave the old mirror deleted or a partial new one while the route reports the flat workout saved. Conversely, `workouts.js:371` deletes only the flat log, leaving mirrored sessions in progress charts, social feeds and coach context. Introduce an explicit source-log relationship and atomic synchronization/deletion. A durable retry job is an alternative if derived writes must be asynchronous.

14. **P2 — Offline writes are implemented but not integrated.** Search of mobile/src and mobile/app found no callers/imports of processSyncQueue, smartLogWorkout, smartLogCalories or queueIntent outside `syncService.ts`. The actual workout screen calls workoutsAPI.log directly; OfflineBanner maintains its own connectivity state. Consequently the advertised queue does not make normal logging work offline. Before wiring it, add account ownership, operation IDs, original log dates and recoverable failure states; the existing clearFailedActions silently discards writes after five failures.

15. **P2 — Privacy tests are empty while reporting success.** All 17 tests in `backend/src/__tests__/buddy-activity.test.js:23` onward contain comments only, with no assertions or requests. This includes the test claiming sharing changes immediately affect visibility. Replace them with behavior tests covering accepted/rejected/blocked friendship directions, private/public/friends records and all feed endpoints. Include authentication, manager tenant isolation, account deletion and transaction integration tests; the current passing count overstates protection at these boundaries.

**Additional concrete follow-ups**

- `backend/src/routes/trainer.js:179` returns “Nudge sent” without storing or sending a notification. Implement the delivery or present the feature as unavailable.
- `backend/src/routes/workouts-published.js:105` increments downloads using the raw route id even after resolving a preset alias to a database row. Its non-UUID alias branch should use split.id for that update. Exercise aliases such as ppl_6 directly in an endpoint test.
- `backend/apply_migrations.js:160` treats one duplicate-object error as evidence that the whole SQL file is already applied. A partially migrated database can miss later statements while the runner reports success. Introduce migration tracking and verify a clean build and partial-upgrade recovery using a disposable database.
- Runtime DDL in health/notifications routes sits outside the migration plan, and failures are logged/swallowed. Move it into versioned migrations so startup does not race table readiness.
- Workout/attendance paths use CURRENT_DATE while nutrition uses IST. Buddy check-in queries also compare an IST-derived date with CURRENT_DATE. Define one calendar-day contract and migrate all associated writers, readers and streak functions together.
- Push logout cleanup is missing in AuthContext. A signed-out account can retain the device token; ensure device/account registration is transferred or removed and prevent notification leakage on shared devices.
- Database SSL configuration disables certificate verification and rewrites matching Supabase direct URLs to one fixed region. Verify trusted CA configuration and explicit deployment connection settings.
- README setup omits the full migration runner, describes 11 tables and 7-day tokens, and recommends Expo Go despite native integrations requiring a custom build. Update setup and architecture documentation from the current source.
- Development and preview EAS profiles point at the production API. Provide a staging profile/database for safe integration and native testing.

**Recommended order of work**

1. Fix tenant boundaries and social visibility; add meaningful regression tests alongside those changes.
2. Fix account deletion/session revocation and mobile account-data cleanup.
3. Make writes idempotent and transactions connection-safe; reconcile the two workout representations.
4. Repair manager creation, class booking and native health; connect offline support only after ownership/retry semantics are defined.
5. Test a complete migration on a disposable PostgreSQL instance, then run native device flows and update setup docs.

**Limits of this audit**

I did not inspect production database policies/schema, secrets, provider dashboards, deployed cron delivery, store status or real user data. I did not run native builds or physical-device UX/accessibility tests, validate nutrition/medical claims, or perform a dependency advisory scan. Web export and unit tests do not establish those properties. Visual assets, generated media, old scripts and every UI component were not individually audited. Findings above distinguish direct code evidence, local mock reproduction and schema-dependent behavior; runtime deployment details still need staging verification.
