# Onboarding and shared UI: first implementation pass

7 October 2026. Implemented in the working tree; not deployed, built for TestFlight, or submitted to a store. No production profiles were changed. Unrelated local changes were preserved.

## What changed

- Onboarding now has four focused stages: Goal → Routine → Basics → Plan. Choices start unanswered instead of silently choosing a goal, sex or activity level.
- Routine setup accepts one to six training days and saves the same schedule shown in the preview. Activity choices collapse after selection. This creates a schedule, not an AI-generated exercise prescription; exercises are selected in the existing workout flow.
- The main flow no longer shows BMI categories, body-fat inputs, fixed weekly weight-change predictions or the old “Blueprint” presentation. Sources, target rationale and optional calorie editing remain available under “How these targets work.” The existing calculator policy is unchanged: maintenance/gain 1.8 g/kg protein, fat loss 2.0 g/kg, with roughly 30% fat and remaining calories allocated to carbs.
- Back preserves answers. Account-scoped native drafts use SecureStore; web drafts use session storage. Invalid drafts cannot jump past unanswered stages. Successful completion clears the draft and persists the completed-user cache.
- Schedule failures prevent profile completion and remain visible. A retry within the same screen does not save an already-confirmed identical schedule twice. Saving the schedule before creating the nutrition profile avoids claiming completion when the schedule failed; these remain two API requests, not a cross-request transaction.
- Completion opens the workout setup or food logger, with Home underneath. Pending buddy invitations retain their existing redirect priority; staff destinations retain their role routing.
- Launch/sign-up no longer requests notification permission. The existing Settings toggle owns that explicit request; previously granted notifications can still register after onboarding. Health connections stay optional and retain their existing native request flow.
- `ScreenBackdrop` provides a shared static training-track illustration on onboarding, sign-in, registration, Home, buddies, learning, profile, coach, workout planning/logging, food logging, fitness profile, health report and Settings. Six outline shapes use 3.5–8% stroke opacity. It does not intercept touches, animate, or appear in the accessibility tree. It is outside exported share/report card captures.
- Home now places training, its logging actions and a compact food summary above coach/gym extras. Food totals explicitly describe what is logged. Detailed nutrition charts remain in nutrition insights. Main actions can wrap on narrow screens and no longer use a glow.
- The coach greeting/header describes available logs without claiming it has already read a user's history. Failed chat requests restore the question without overwriting a newer draft.
- Coach context now prefers `nutrition_profiles` for goals, measurements and targets, retaining legacy fitness-profile fallback and coach notes. Saved macro targets and vegetarian preference reach the prompt. Nutrition saves wait for context-cache invalidation; split saves also invalidate coach context.

## Verification

- Mobile TypeScript passed after final code changes.
- Full mobile run: 30 suites / 273 tests passed before the last focused refinements. After those refinements, all 25 tests in onboarding, schedule/draft validation and Home passed again.
- Full backend run: 44 suites / 445 tests passed. Canonical-profile SQL was additionally exercised against an isolated PGlite PostgreSQL engine, including conflicting profile values, nutrition-only accounts, legacy accounts and missing profiles. That test passed again after its final cleanup.
- The new onboarding/background utilities passed ESLint with no warnings after cleanup.
- Actual Expo web onboarding was walked through with synthetic data at 390 × 844. Goal and plan layouts were also checked at 320 × 568, and the plan at 820 × 1180. Small-screen checks found no horizontal page overflow or buttons extending outside the viewport. Preview console had no errors when checked.
- Browser saving to production was not performed. API failures, retry behaviour, completion and buddy-invite priority were checked through isolated automated tests.
- Native keyboard/safe-area behaviour, VoiceOver/TalkBack, large text and physical-device permission/sync behaviour still require a device build and testing. Web screenshots and passing unit tests do not certify those behaviours.

## Visual evidence

- [Goal, phone](assets/2026-10-07-onboarding/goal-390.jpg)
- [Routine, phone](assets/2026-10-07-onboarding/routine-390.jpg)
- [Basics, phone](assets/2026-10-07-onboarding/basics-390.jpg)
- [Plan, phone](assets/2026-10-07-onboarding/plan-390.jpg)
- [Goal, small phone](assets/2026-10-07-onboarding/goal-320.jpg)
- [Plan, small phone](assets/2026-10-07-onboarding/plan-320.jpg)
- [Plan, tablet](assets/2026-10-07-onboarding/plan-tablet.jpg)

Example plan screenshots use synthetic measurements and preferences, not a user's saved account. Other pages received the shared decoration; they have not all had a new native visual walkthrough.

## Still planned

The [product roadmap](../roadmap/2026-10-07-product-and-onboarding-todo.md) remains the source for remaining work: training-first setup without compulsory nutrition, richer routine/equipment preferences that actually affect exercises, usability measurement, editable coach memory, structured confirmed coach actions, clearer health freshness/recovery, live provider diagnostics, physical sync verification and practical meal planning. Manager features remain deferred.
