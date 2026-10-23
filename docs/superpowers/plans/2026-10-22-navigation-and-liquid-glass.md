# Fitzo Navigation and Liquid Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute in this chat unless the user separately requests delegation.

**Goal:** Deliver Workout, Food, Gym, Friends and Profile with a floating glass tab bar, reliable draft continuity and simpler daily flows.

**Architecture:** Keep the existing Expo Router JS Tabs and stable logger/detail routes. Add a custom React Navigation tab bar, platform-specific material wrapper and focused landing screens that reuse current API, draft, logger and context logic. Ship the initial Gym hub from current data; public equipment discovery and maps are a separate backend/data project.

**Tech Stack:** Expo SDK 54, Expo Router 6, React Native 0.81, React Navigation 7, Reanimated 4, safe-area-context, SDK-compatible expo-glass-effect/expo-blur, existing expo-linear-gradient, Jest/jest-expo and native device validation.

**Spec:** [Navigation and liquid-glass design](../specs/2026-10-22-navigation-and-liquid-glass-design.md). Read both documents. The companion [HTML direction study](../../reviews/navigation-2026-10-22/liquid-glass-study.html) illustrates the material/shape and information hierarchy, with sample data.

**Execution update, 22 October:** the user authorized implementation and clarified that glass must be subtle and all fonts/icons/theme must follow the existing app. The application uses Lexend, existing Material Icons and components, a 64-pixel capsule and an inset selected pill. The earlier study is illustrative. See [implementation and verification](../../reviews/navigation-2026-10-22/implementation.md) for completed work, deviations and native checks still open. Historical task checkboxes below are not a claim that physical-device gates have passed.

## Global constraints

- Five permanent destinations in this order: **Workout · Food · Gym · Friends · Profile**.
- Keep the existing dark/white Fitzo palette; the reference's orange is not a new brand colour.
- Keep Expo SDK 54 and existing routing/state libraries; use the installed Expo compatibility map for new packages.
- Preserve all current uncommitted changes. Do not reset, overwrite or stage unrelated work.
- Preserve account-scoped drafts, saved plans, performed history, nullable food targets, consent and sharing preferences.
- A native dependency installation requires new compatible native builds; do not distribute the feature to binaries missing those modules through an OTA update.
- Reserve glass for the navigation/control layer; do not convert every content card to glass.
- Start and Add are explicit screen actions; tab selection must not write data or open a camera.
- Initial Gym uses current membership/check-in/busy-times/classes APIs; public directories, inventory, 3D maps and live group workouts are separate releases.
- No new backend schema or migration is necessary for the initial navigation release.
- Native acceptance is required for glass, keyboards, screen readers, large text and frame pacing; browser previews alone cannot certify these.

## File and responsibility map

Paths below are relative to the repository root. Create only files needed by each completed task; proposed new files do not already exist.

| Files | Responsibility |
|---|---|
| `mobile/src/navigation/memberTabs.ts` | Visible destination definitions and measured shell geometry |
| `mobile/src/navigation/glassPolicy.ts` | Pure platform/accessibility material decision |
| `mobile/src/hooks/useGlassPreferences.ts` | Read/observe Reduce Motion, Reduce Transparency and supported contrast settings |
| `mobile/src/components/navigation/GlassSurface.ios.tsx`, `GlassSurface.tsx` | Native iOS material and cross-platform blur/tint fallback, same props |
| `mobile/src/components/navigation/MemberTabBar.tsx` | Tab events, labels, selected lens, floating layout and chrome measurement publishing |
| `mobile/src/components/navigation/MemberChromeContext.tsx` | Provider around Tabs; stores measured chrome heights and exposes the content inset |
| `mobile/src/components/navigation/ActiveWorkoutBanner.tsx`, `mobile/src/hooks/useActiveWorkoutSummary.ts` | Read existing account draft on route/app transitions; show Resume |
| `mobile/app/(tabs)/_layout.tsx`, `index.tsx`, new `food.tsx`, new `gym.tsx` | Wire five permanent tabs |
| Existing hidden `learn.tsx`, `scan.tsx`, `stats.tsx`; new `mobile/app/member/learn.tsx` | Preserve legacy routes and canonical Learn destination |
| New `WorkoutHomeScreen.tsx`, `FoodHomeScreen.tsx`, `GymHomeScreen.tsx` under `mobile/src/screens/member/` | Focused member landing screens |
| New `mobile/app/member/workout-history.tsx` and `WorkoutHistoryScreen.tsx` | Full workout-history list using existing API |
| Existing workout, exercise, food, profile, friends and coach modules | Targeted workflow and presentation changes |
| Existing tests plus task-specific tests named below | Behavioural regression coverage |

## Contracts shared between tasks

Place these definitions in `mobile/src/navigation/memberTabs.ts` in Task 1:

```ts
export type MemberTabName = 'index' | 'food' | 'gym' | 'buddies' | 'profile';
export const MEMBER_TABS = [
  { name: 'index', title: 'Workout', icon: 'fitness-center' },
  { name: 'food', title: 'Food', icon: 'restaurant' },
  { name: 'gym', title: 'Gym', icon: 'business' },
  { name: 'buddies', title: 'Friends', icon: 'people' },
  { name: 'profile', title: 'Profile', icon: 'person' },
] as const;

export function getMemberChromeInset(input: {
  barHeight: number;
  bottomInset: number;
  bannerHeight: number;
}): number {
  return input.barHeight + Math.max(input.bottomInset, 10)
    + (input.bannerHeight > 0 ? input.bannerHeight + 8 : 0) + 16;
}
```

Task 3 produces `MemberChromeProvider` and `useMemberContentInset(): number` from `MemberChromeContext.tsx`. Wrap the Tabs navigator in this provider so both screens and the tab bar can access it; a provider inside the tab bar cannot supply context to sibling screens. The bar publishes measured capsule/banner heights. Landing screens use this one computed inset for final content padding. Position the custom chrome absolutely and avoid adding the navigator's conventional tab-bar padding on top of it.

Full-screen stack routes outside Tabs retain their own safe-area/keyboard layout and do not consume this tab context.

## Task 1: Lock navigation contracts and baseline

**Files:** Create `mobile/src/navigation/memberTabs.ts`, `mobile/src/navigation/__tests__/memberTabs.test.ts`; create `docs/reviews/navigation-2026-10-22/native-baseline.md` during execution.

**Interfaces:** Produces `MemberTabName`, `MEMBER_TABS`, `getMemberChromeInset` exactly as above. No runtime routing changes yet.

- [ ] Record existing changed files with `git status --short` through a bounded/context-mode summary. Run the existing mobile tests and typecheck once; distinguish pre-existing failures from this work.
- [ ] Record native device model, OS, refresh rate, build ID, text scale, current Home/Food/logger screenshots and a 30-second list-scroll baseline. If an iOS machine/device is unavailable on this Windows host, record that requirement and keep native acceptance open for the build/device owner.
- [ ] Add the following contract tests, then run them before adding the module:

```ts
import { MEMBER_TABS, getMemberChromeInset } from '../memberTabs';

test('keeps daily destinations visible and in a stable order', () => {
  expect(MEMBER_TABS.map(tab => tab.title))
    .toEqual(['Workout', 'Food', 'Gym', 'Friends', 'Profile']);
});

test('counts the safe area once and reserves a workout banner', () => {
  expect(getMemberChromeInset({ barHeight: 72, bottomInset: 34, bannerHeight: 0 }))
    .toBe(122);
  expect(getMemberChromeInset({ barHeight: 72, bottomInset: 34, bannerHeight: 48 }))
    .toBe(178);
});
```

- [ ] Run `npm test -- --runInBand src/navigation/__tests__/memberTabs.test.ts` from `mobile`; expect module-not-found before implementation, then PASS after adding the contract.
- [ ] Run `npm run typecheck` from `mobile`. Review and commit only Task 1 files; preserve unrelated work.

**Deliverable:** Stable destination/geometry contract and an honest baseline. No claimed native results without a device capture.

## Task 2: Build the material adapter and accessibility policy

**Files:** Create `mobile/src/navigation/glassPolicy.ts`, `mobile/src/navigation/__tests__/glassPolicy.test.ts`, `mobile/src/hooks/useGlassPreferences.ts`, `mobile/src/components/navigation/GlassSurface.ios.tsx`, `GlassSurface.tsx`; modify `mobile/package.json` and `mobile/package-lock.json` only for compatible additions.

**Interfaces:** Both surface files export `GlassSurface({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> })`. The hook returns `{ reduceMotion: boolean; reduceTransparency: boolean; highContrast: boolean }`. Unknown accessibility preferences start with the opaque/reduced-motion treatment until the initial reads finish. Produce this pure material policy:

```ts
export type GlassMode = 'native' | 'blur' | 'opaque';
export function resolveGlassMode(input: {
  platform: 'ios' | 'android' | 'web';
  nativeAvailable: boolean;
  reduceTransparency: boolean;
  highContrast: boolean;
  androidBlurEnabled: boolean;
}): GlassMode {
  if (input.reduceTransparency || input.highContrast) return 'opaque';
  if (input.platform === 'ios') return input.nativeAvailable ? 'native' : 'blur';
  if (input.platform === 'android') return input.androidBlurEnabled ? 'blur' : 'opaque';
  return 'blur';
}
```

- [ ] Add `glassPolicy.test.ts`: unavailable iOS selects blur, supported iOS selects native, reduced transparency overrides native, high contrast selects opaque, Android defaults opaque, and Android blur is explicitly enabled. Example:

```ts
import { resolveGlassMode } from '../glassPolicy';
test('accessibility overrides native glass', () => {
  expect(resolveGlassMode({ platform: 'ios', nativeAvailable: true,
    reduceTransparency: true, highContrast: false, androidBlurEnabled: false }))
    .toBe('opaque');
});
```

- [ ] Run `npm test -- --runInBand src/navigation/__tests__/glassPolicy.test.ts`; expect import failure. Implement the policy and rerun to PASS.
- [ ] From `mobile`, run `npx expo install expo-glass-effect expo-blur`. Confirm compatible installed versions/types and inspect actual exported availability methods. Do not copy latest-SDK-only properties into SDK 54.
- [ ] Implement initial accessibility reads and event subscriptions using React Native `AccessibilityInfo`; remove every subscription on unmount. Query supported high-contrast preferences through the installed RN/native API; do not call an unverified method. Opaque rendering is the safe default while a preference read is pending.
- [ ] On iOS, require both glass component/design availability and the installed API-availability guard before rendering `GlassView`. Use `glassEffectStyle="regular"` and dark appearance, native opacity 1. On old iOS use dark `BlurView`; on Android use `experimentalBlurMethod="dimezisBlurView"` only when the presentation setting enables it. Use a single backdrop material; lens highlights are plain non-interactive views/gradients.
- [ ] Build development clients containing the new native modules. Capture the same capsule over a list, image and dark screen. Verify Reduce Transparency and Reduce Motion changes while the app is open. Do not infer native results from Expo web.
- [ ] Run policy tests, typecheck and `npx expo install --check`; commit only this task's dependency/material files.

**Deliverable:** One reusable material adapter with honest platform fallbacks. Android live blur stays off until Task 10 passes its frame/artifact gate.

## Task 3: Implement the floating tab bar and workout continuity

**Files:** Create `mobile/src/components/navigation/MemberTabBar.tsx`, `MemberChromeContext.tsx`, `ActiveWorkoutBanner.tsx`, `mobile/src/hooks/useActiveWorkoutSummary.ts`, `mobile/src/components/navigation/__tests__/MemberTabBar.test.tsx`, `mobile/src/hooks/__tests__/useActiveWorkoutSummary.test.tsx`. Consume existing `mobile/src/utils/activeWorkoutDraft.ts` without changing its persisted format.

**Interfaces:** `MemberTabBar(props: BottomTabBarProps)` uses the existing React Navigation contract. `MemberChromeContext.tsx` exports `MemberChromeProvider({ children }: { children: React.ReactNode })`, `useMemberContentInset(): number`, and `useMemberChromeMeasurements(): { setBarHeight: (height: number) => void; setBannerHeight: (height: number) => void }`. `useActiveWorkoutSummary(userId: string | undefined, pathname: string)` returns `{ hasActiveWorkout: boolean; label: string | null }`; it reads the existing per-account draft on pathname change and app foreground. `ActiveWorkoutBanner` consumes `{ label: string; onResume: () => void }`.

- [ ] Add a tab test harness with the five route descriptors, a mocked `navigation.emit` and `navigation.navigate`. Test that Gym emits a cancellable tabPress, prevented events do not navigate, the selected tab has accessibility state selected, and selected-tab presses do not navigate again. Check the actual `BottomTabBarProps` types from installed packages.
- [ ] Run `npm test -- --runInBand src/components/navigation/__tests__/MemberTabBar.test.tsx`; implement until these tests PASS.
- [ ] Filter to `MEMBER_TABS` by route name, rather than exposing every compatibility route. Measure available width and column positions. Render five equal accessible Pressables, forward tabLongPress, and put decoration behind targets with `pointerEvents="none"`.
- [ ] Build the reference-style 72-pixel capsule and 80-pixel active lens; animate measured translation with Reanimated. Respect large text, reduced motion and current focus after rotation. Avoid continuously animating blur intensity or remounting the whole bar on a tab press.
- [ ] Add active-summary race tests: pending account A read resolving after switching to B must not show A's session; completed/cleared drafts remove the banner; pathname/foreground refresh sees newly saved drafts. Use the existing draft fixture/utility test conventions. Guard stale effects with cancellation/identity checks; no polling or second draft store.
- [ ] Position Resume above the capsule and expose the measured complete content inset. Tap Resume pushes `/log/workout`; it must not manufacture a new intent or clear the existing draft. Keyboard hide/show adjusts chrome visibility without resizing or resetting lists unnecessarily.
- [ ] Run both new suites and existing active-workout utility/lifecycle suites with `npm test -- --runInBand --testPathPattern="MemberTabBar|useActiveWorkoutSummary|activeWorkoutDraft|WorkoutActivityLifecycle"`; then typecheck. Review and commit task files.

**Deliverable:** Working, accessible navigation chrome with preserved draft continuity, ready to wire into real routes.

## Task 4: Wire five routes, a usable Gym hub and Learn compatibility

**Files:** Modify `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/learn.tsx`, `mobile/app/(tabs)/scan.tsx`, `mobile/app/(tabs)/profile.tsx`; create `mobile/app/(tabs)/food.tsx`, `gym.tsx`, `mobile/app/member/learn.tsx`, `mobile/src/screens/member/GymHomeScreen.tsx`, `mobile/src/screens/member/__tests__/GymHomeScreen.test.tsx`, `mobile/src/navigation/__tests__/MemberRoutes.test.tsx`.

**Interfaces:** Food initially renders the existing logger so the route is useful before Task 6 adds its diary. Gym consumes existing `settingsAPI.getGym()`, `settingsAPI.joinGym(code)`, `settingsAPI.leaveGym()`, `checkinAPI.getStatus/checkout()`, `memberAPI.getHome()`, `gymAPI.getBusyTimes(gymId)` and `classesAPI.getClasses/getMyBookings()`. Reuse their current response shapes; do not expand the server contract here.

- [ ] Add route assertions for exactly five visible destinations, a working canonical Learn destination and hidden Learn/scan/stats compatibility screens. Add Gym tests for `gym: null`, joined gym, failed membership fetch with Retry, and expired/stale attendance data. Joining must only happen after submitting a non-empty code; merely opening Gym must not call it.
- [ ] Run `npm test -- --runInBand --testPathPattern="MemberRoutes|GymHomeScreen"`; capture the expected missing-route/screen failures.
- [ ] Wire the custom bar using the existing JS navigator:

```tsx
<MemberChromeProvider>
<Tabs tabBar={props => <MemberTabBar {...props} />}
  screenOptions={{ headerShown: false }}>
  <Tabs.Screen name="index" options={{ title: 'Workout' }} />
  <Tabs.Screen name="food" options={{ title: 'Food' }} />
  <Tabs.Screen name="gym" options={{ title: 'Gym' }} />
  <Tabs.Screen name="buddies" options={{ title: 'Friends' }} />
  <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
  <Tabs.Screen name="learn" options={{ href: null }} />
  <Tabs.Screen name="scan" options={{ href: null }} />
  <Tabs.Screen name="stats" options={{ href: null }} />
</Tabs>
</MemberChromeProvider>
```

- [ ] Make `/member/learn` render the existing LearnScreen. Replace the hidden old Learn component with `<Redirect href="/member/learn" />`; make hidden scan redirect to `/(tabs)`. Update all internal Learn links through an `rg` search; preserve direct `/lesson/[id]` links.
- [ ] Build Gym from existing modules: join code, membership summary, check-in via `/qr-checkin`, explicit checkout, attendance label/confidence and `/classes`. Reuse current profile membership validation and refresh auth/member data after membership changes. Check-in/crowd/class failures must not erase a successfully loaded membership summary.
- [ ] Add Learn and prominent Progress links to Profile. Keep membership control in Profile until the Gym equivalent is verified; then use a clear Gym shortcut. Preserve the existing profile edit and AI consent changes in the working tree.
- [ ] Remove the + modal only after Workout, Food and Explore have reachable entry points in the integrated build. Run route/Gym/profile tests and typecheck; review and commit only task changes.

**Deliverable:** A functional five-tab app, including useful no-gym states and working old links. Public gym search is not implied by the access-code join screen.

## Task 5: Make Workout a focused landing page and preserve quick start

**Files:** Create `mobile/src/screens/member/WorkoutHomeScreen.tsx`, `WorkoutHistoryScreen.tsx`, `mobile/app/member/workout-history.tsx`, `mobile/src/screens/member/__tests__/WorkoutHomeScreen.test.tsx`, `WorkoutHistoryScreen.test.tsx`; modify `mobile/app/(tabs)/index.tsx`, `HomeScreen.tsx` as needed for extracted behaviour, and `WorkoutLogScreen.tsx` for an explicit empty-start parameter.

**Interfaces:** Keep `/(tabs)/index` as the route. Reuse existing training intent/saved split APIs and draft utilities. Add optional logger parameter `start=empty`: it suppresses automatic suggested/previous-plan hydration only when there is no active account draft. Existing draft restoration takes priority. It does not change the persisted draft format. History uses `workoutsAPI.getHistory(limit)` and existing recap access where supported.

- [ ] Add tests for active draft → Resume, saved routine → Start, no split → Start empty without routing through setup, rest day → voluntary Start, and API failure → Retry without deleting the draft. Add a logger regression proving `start=empty` does not replace an existing draft.
- [ ] Run `npm test -- --runInBand --testPathPattern="WorkoutHomeScreen|WorkoutHistoryScreen|WorkoutLogScreen"`; new cases should fail before implementation.
- [ ] Extract only the useful training sections from Home into WorkoutHomeScreen. Retain existing starter/saved-plan logic and unknown/loading states. Keep one primary CTA, My plan → existing intent/preferences flow, Explore → `/exercise-library`, curated workouts → `/member/curated-workouts`, History → the new history route.
- [ ] Route the no-split action with this explicit contract:

```ts
router.push({ pathname: '/log/workout', params: { start: 'empty' } });
```

  In the logger, skip suggested-plan hydration for that mode after checking/restoring the account draft; render Add exercise immediately. Do not mark an empty session complete, fabricate a split ID or skip normal validation.
- [ ] Implement the history list with loading/error/empty/saved states; use real record IDs and existing detail/recap contracts. Provide a plain saved-record summary if the recap route requires a just-completed payload; do not invent a recap URL contract.
- [ ] Remove food, full coach, gym, learning and friends previews from the new Workout landing only after their destination links exist. Preserve data fetching helpers still used elsewhere. Apply the measured tab content inset.
- [ ] Run new/modified workout suites, saved-plan/draft suites and typecheck; review and commit task files.

**Deliverable:** Workout becomes the default useful entry point; starting, planning, browsing and history have distinct labelled paths.

## Task 6: Build Food diary and reliable entry editing

**Files:** Create `mobile/src/screens/member/FoodHomeScreen.tsx`, `mobile/src/screens/member/__tests__/FoodHomeScreen.test.tsx`; modify `mobile/app/(tabs)/food.tsx`, `CalorieLogScreen.tsx`, `FoodEntrySheet.tsx`, `NutritionContext.tsx` only if refresh contracts require it. If pending-delete Undo is included, create `mobile/src/context/FoodMutationQueue.tsx` and its dedicated tests rather than using sheet-local timers.

**Interfaces:** Consume existing `caloriesAPI.getDay(date)`, `getToday()`, `update(entryId, patch)`, `delete(entryId)` and current `CalorieEntry`/`CalorieDay` types. Existing `FoodEntrySheet` takes `{ entry, onClose, onChanged }`. Add food pushes `/log/calories`; close returns to the initiating Food context. The queue, if used, exports `scheduleDelete(entryId: string): string`, `undoDelete(token: string): boolean`, and `flushForAccountChange(): Promise<void>` with account ownership captured at scheduling.

- [ ] Add tests for target-free logging, meal grouping from saved meal types, date change, refresh after returning from the logger, editing an existing entry without search, rejected update retaining input, stale date/account responses and empty/error distinction.
- [ ] Run `npm test -- --runInBand --testPathPattern="FoodHomeScreen|CalorieLogScreen|NutritionContext"`; implement the diary using current data/contracts until PASS.
- [ ] Render logged totals, date selection, meal groups and Add food; keep absent targets as absent and label target setup separately. Use existing entry sheet for edits. Refresh only the affected day and today's macro context after successful mutation; do not overwrite a different selected day with a late response.
- [ ] Keep Recents, recipes and saved meal access; choose one camera affordance and one voice affordance in the logger. Preserve current portion conversions, repeated-food shortcuts, error handling and account checks.
- [ ] For optional delete Undo, test with fake timers that cancellation before the deadline makes no DELETE call, expiry makes exactly one call, errors restore the row, and navigating away does not leak or cancel the queue. Account switching must never execute a pending mutation with the next account's credentials. If the existing authentication client cannot pin credentials safely, retain explicit confirmed deletion and omit Undo for that release.
- [ ] Run Food/portion/context suites and typecheck; inspect diary and keyboard at 320/390 logical-pixel widths. Review and commit task files.

**Deliverable:** Food is a real daily destination, with existing logging/recipes preserved and direct editing of saved entries.

## Task 7: Unify exercise discovery and make set editing faster

**Files:** Modify `mobile/src/screens/member/ExerciseLibraryScreen.tsx`, `CuratedWorkoutsScreen.tsx`, `WorkoutLogScreen.tsx`, `mobile/src/components/ExerciseList.tsx`, `ExerciseDetailsModal.tsx`, `mobile/src/components/workout/ExerciseCard.tsx` and their existing/new tests. Add `ExerciseLibraryScreen.test.tsx` under the member screen tests.

**Interfaces:** Preserve `ExerciseList`'s existing view/select contract and `ExerciseDetailsModal`'s current exercise/unilateral props. Extend details with optional `onAdd?: () => void` only for an explicitly initiated add flow. Catalog browsing has no implicit save. Existing logger `handleAddExercise` remains the single place that appends a selected exercise.

- [ ] Add behaviour tests for muscle-filtered discovery, search reset, unavailable GIF with retained instructions, viewing without mutation, and adding the selected exercise exactly once through the logger's selection flow. Cover Show all muscles so suggested-session filters do not lock out other exercises.
- [ ] Add ExerciseCard regressions: previous values remain uncompleted; one completion action records one valid set; invalid weight/reps cannot complete; optional RIR/unilateral settings retain their current semantics. Reuse existing fixtures rather than replacing them with a narrower mock data model.
- [ ] Run `npm test -- --runInBand --testPathPattern="ExerciseLibraryScreen|ExerciseDetailsModal|ExerciseCard|WorkoutLogScreen"` before/after the targeted changes.
- [ ] Reuse the shared details modal for catalogue and workout demos; remove the duplicate details UI only after existing instructions, GIF failures and unilateral preferences remain covered. For browse → Add, navigate into the logger's explicit selection flow; pass only a validated bounded ID or use its existing in-memory selection, not a large serialized untrusted exercise object in a new deep link.
- [ ] Put previous-set hints next to the active row, preserve precise input and optional wheel, keep the rest timer and Finish reachable, and add a visible edit control where tap-only editing is ambiguous. Do not replace the whole logger with a novel slider interface.
- [ ] Use list virtualization and existing image caching; avoid playing every offscreen GIF. Show instructions while a demo loads or fails. Add equipment filters only after inspecting actual catalogue support and test empty results explicitly.
- [ ] Run affected suites/typecheck and inspect a long exercise list, short screen, keyboard and slow image loading. Review and commit task files.

**Deliverable:** Exercise browsing is visible and consistent, and repeat-set logging requires fewer interactions without altering performed-history meaning.

## Task 8: Finish Profile, Friends and contextual coach entry

**Files:** Modify `mobile/app/(tabs)/profile.tsx`, `mobile/src/screens/member/GymBuddiesScreen.tsx`, `AICoachScreen.tsx`, `WorkoutHomeScreen.tsx`, `FoodHomeScreen.tsx`; extend `ProfileScreen.test.tsx`, `GymBuddiesScreen.test.tsx`; add `AICoachEntry.test.tsx` under member screen tests.

**Interfaces:** Coach route accepts optional `source: 'workout' | 'food'` and `prompt: string` (maximum 500 characters), validated inside AICoachScreen. These prefill the composer only. Unknown sources are ignored; no URL parameter can submit a message or bypass consent.

- [ ] Add profile tests for prominent Progress and Learn links, preserved profile editing and no hidden membership loss. Add Friends navigation/large-text assertions without changing sharing defaults.
- [ ] Add coach tests for valid prefill, oversized/invalid parameter rejection, no request on route open, consent not granted, and one explicit send. Example acceptance: opening `source=workout&prompt=Suggest%20an%20alternative` fills the composer but calls no send method.
- [ ] Run `npm test -- --runInBand --testPathPattern="ProfileScreen|GymBuddiesScreen|AICoachEntry"`; implement until PASS.
- [ ] Group Profile in the spec's order and apply the shared content inset. Keep existing Stats/measurement/health routes and AI privacy controls; avoid adding a competing sixth Progress tab.
- [ ] Add consistent Ask coach controls to Workout/Food, passing only editable text and the bounded source. Existing consent and context-building logic owns what can be transmitted after explicit send. Automatic plan/meal changes remain outside this release.
- [ ] Align Friends terminology, headers, empty states and CTA styles with the new destinations. Do not represent an ordinary class booking as a live group workout.
- [ ] Run affected tests/typecheck; review and commit task files.

**Deliverable:** Supporting features remain easy to find and AI is reachable with a specific purpose, without unsolicited requests or writes.

## Task 9: Integrated route, layout and data regression

**Files:** Add/update `docs/reviews/navigation-2026-10-22/acceptance.md` and targeted integration tests under `mobile/src/navigation/__tests__/`; update `docs/SCREENS.md` and `docs/CONTEXT.md` only after implementation matches the new navigation. Preserve their existing uncommitted content.

- [ ] Run mobile `npm test -- --runInBand` and `npm run typecheck`; use context-mode to retain only failures and summary counts. Run lint on changed TS/TSX files and inspect diff whitespace. Run backend checks only if execution actually changes backend contracts; no backend migration is expected.
- [ ] Exercise legacy routes: tabs root/index, buddies, profile, learn, scan, stats, both loggers, exercise-library, lessons, classes, QR check-in and buddy invitation links. Check back/close returns to the correct source; old hidden routes never add visible destinations.
- [ ] Start a real draft, visit all tabs, change a portion, open a lesson, background/relaunch and Resume. Finish successfully and verify the banner disappears. Verify a failed finish keeps the draft; verify account switching cannot display or mutate the previous account's draft/data.
- [ ] Inspect 320×568, 390×844, 430×932 and landscape layouts; default and large text; safe-area and three-button/gesture navigation; keyboard; loading/empty/error/offline; no targets; no gym. Check final list rows, toasts, rest timer and sheets against the measured chrome.
- [ ] Record screen-reader focus order and selected-tab announcements with VoiceOver and TalkBack on devices. Verify every tab, Resume, Add food and close/edit action has a meaningful name, adequate target and visible state.
- [ ] Capture visual comparison of the capsule/lens against the supplied reference and HTML study. Resolve clipping, unreadable inactive labels, stale blur and lens positions before the native gate.

**Deliverable:** Evidence-backed integrated behaviour, with failed or unavailable checks explicitly left open.

## Task 10: Native acceptance, rollout and rollback

**Files:** Complete `docs/reviews/navigation-2026-10-22/acceptance.md`; create the matching release note under `docs/releases/` at release time using the actual version selected for that release.

- [ ] Validate one supported iOS Liquid Glass device, one older iOS/fallback device, and representative Android devices with both available navigation modes. Use native development or release builds containing the new dependencies.
- [ ] Repeat the baseline 30-second list scroll with the tinted capsule and Android live blur. Record frame pacing, missed-frame percentage and visible artifacts. Enable Android blur only if the spec's relative regression gate passes; otherwise ship the visually matched tinted fallback.
- [ ] Verify Reduce Transparency, Reduce Motion, increased contrast where supported, large text and display scaling while the app runs. Validate dark/bright media behind the bar. Confirm OS glass availability checks run before native glass rendering.
- [ ] Give five participants the spec's seven tasks. Record completion, wrong destinations, hesitation and comments. Resolve blocking navigation/editing failures before release; do not describe the sample as proof of retention improvement.
- [ ] Build with `eas build --platform android --profile preview` and `eas build --platform ios --profile preview` if those profiles remain valid in the current `eas.json`; otherwise use the project's existing equivalent internal distribution profiles. Recheck signing/runtime configuration without printing secrets. Confirm that installing native modules changes/partitions the update runtime so older binaries cannot receive incompatible JS.
- [ ] Package a release candidate only after required checks pass. Publishing/deployment is a separate explicit release action, not implied by finishing this implementation plan. Keep the previous compatible binary/build available; material defects can switch to the opaque presentation without changing stored data. A navigation rollback restores the prior compatible app build, with no draft/history migration to reverse.
- [ ] Record shipped versions, device evidence, remaining non-blocking issues and the actual Android material decision. Update screen documentation and release notes to describe the implemented result.

**Deliverable:** Native-verified release candidate and recoverable rollout, not a web-only visual claim.

## Subsequent projects, deliberately independent

The initial redesign is complete when Tasks 1–10 meet their acceptance criteria. The following projects have separate dependencies and must receive their own executable plans rather than being silently bundled into a navbar change:

1. **Gym directory/equipment:** gym permission/data owner, verified listings, paginated read-only browse APIs, protected membership fields, equipment-to-exercise mapping, opaque machine tags and operator editing. Start with a list and 2D plan. The design specification defines the endpoint/data boundaries.
2. **3D maps:** surveyed coordinates, model licensing/compression, lazy loading, accessible list fallback and a measured navigation benefit. No floor/model data exists in the inspected member API.
3. **Live group workouts:** shared-session membership/invitations, per-user set ownership, reconnection and privacy semantics. Existing Friends and class booking remain available while this is separately designed.
4. **AI write actions:** typed proposed changes, review/apply flows, authorization and replay protection. This plan adds contextual entry and editable prompts only.

## Self-review checklist

- [ ] Every design requirement maps to Tasks 1–10 or an explicitly separate project above.
- [ ] Proposed file names, shared contracts and route names match throughout the implementation.
- [ ] Installed SDK-54 package APIs were checked; latest-doc redirects did not introduce unsupported blur/material props.
- [ ] Existing uncommitted workout, food, health, profile and share work remains intact.
- [ ] Native checks, accessibility checks and participant results contain evidence rather than inferred PASS labels.

Execution should use scoped diffs and review after each task. For files already changed before execution, stage only task-owned hunks or leave changes uncommitted until ownership can be separated safely.
