# Training-first setup and editable preferences — 12 October 2026

Implemented locally, beginning 8 October and completed during the 12 October continuation. These changes have not been deployed or included in an App Store build.

## Shorter setup

The default path has three screens: Goal → Routine → Plan. Food targets are optional. A non-critical totals refresh runs in the background instead of delaying the first workout. Users can add a fourth food-basics screen from the preview or skip it, keeping their training answers. Measurements, sex and dietary preference are not required for the training-only path. Health connections remain optional. Required choices are explicit, drafts stay per account, and the starting workout has unchecked sets with no invented weights. Unknown ages use the conservative two-set template.

Setup completion now persists separately from a nutrition profile in `users.onboarding_completed_at`. The server verifies that the saved starting routine matches the setup preferences before completing it. Each mobile write is pinned to its starting authentication token. Failed saves keep answers and permit retry; a retry in the same wizard does not create the identical split again.

## Preferences after setup

Settings → Training preferences shows the stored training goal, experience, equipment, approximate session time and active routine. “Keep current routine” is the default. Replacement requires choosing it explicitly, reviewing the equipment-specific exercises, then saving. Custom/adopted routines and performed workout history are retained. A changed active split rejects a stale preview, with a reload action. Replacement and adopted-routine writes use transactions and a shared account lock.

Removal needs a second explicit action. It clears stored preferences and embedded starting suggestions across that account's saved splits, preserving schedules and performed logs. Food targets are separate. A legacy seven-day custom routine can be retained; replacements require supported days rather than crashing.

The coach receives saved preferences with its context only after the existing AI data-sharing consent. Newly completed training-only accounts do not inherit default measurements or calorie targets from an old empty fitness profile.

## Honest food states

The updated app represents absent calorie/macronutrient targets as null. Today shows logged totals and a setup link; logging without targets cannot trigger a target-hit celebration. Stats and weekly summaries omit absent goal lines and adherence claims. Food details offers setup or logging without goals, and failed loads have Retry instead of pretending setup was skipped.

Food setup starts with blank measurements and explicit choices. It preserves decimal measurements and the existing weekly workout target unless that target is deliberately edited. The weekly selector is collapsed initially. Narrow screens wrap measurement fields and keep units within the correct input. Food details no longer subtracts guessed workout expenditure or describes a chosen calorie goal as measured maintenance, deficit or surplus.

### Installed-version compatibility

The updated API client sends `X-Fitzo-Setup-Version: 2`. Only clients with that capability use durable training-only completion and nullable nutrition responses. Older builds still use nutrition-profile-based completion and their earlier numeric nutrition response shape. This bridge avoids pushing an old food-detail screen into a null-target crash during rollout. It does not create default targets in a new user's database profile.

## Verification

- Full mobile suite: 41 suites, 330 tests passed.
- Full backend suite: 49 suites, 471 tests passed, including isolated PostgreSQL-compatible PGlite tests.
- Mobile TypeScript passed. Core edited UI/context files passed scoped ESLint without errors. Windows-aware `git diff --check` passed.
- Real SQL tests cover repeatable migrations, missing-schema rollback, keeping an adopted routine, training-only completion across `/auth/me` and password login, legacy-client compatibility, absent targets, invalid/stale previews, insertion failure, account-scoped removal and retained performed history.
- UI tests cover three-screen completion without food writes, voluntary food setup/skip/back, failed-save retry, keep/replace/removal review, a seven-day legacy routine, explicit food answers, decimal measurements, absent-target logging, stale reads and preserved weekly goals.
- Synthetic Expo web previews were inspected at 390×844, 320×568 and 820×1180. The primary onboarding action stayed visible. The corrected small-phone measurement inputs were confirmed blank and contained in their own fields. Screenshots are in `docs/reviews/assets/2026-10-08-training-first/`; they are web previews with synthetic data, not device captures.

The temporary preview route was removed and its server stopped after verification.

Physical iOS/Android, keyboards, large system text, VoiceOver/TalkBack, native permission sheets and background health delivery are still unverified. No claims of complete native or production readiness follow from these checks.

## Release requirements

Apply migrations **021** (starter templates) and **022** (separate setup completion and preferences) before the corresponding backend deploy, then release the matching mobile build after native verification. Keep the older-client bridge through rollout. The native checklist is recorded separately; coach actions and practical meal suggestions remain later work. Manager features and staging remain deferred.
