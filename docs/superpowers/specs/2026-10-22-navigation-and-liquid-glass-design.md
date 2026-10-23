# Fitzo navigation and liquid-glass design

Date: 22 October 2026 · Status: local implementation; native device acceptance remains open

**User clarification, applied during implementation:** the earlier HTML/image is a layout sample. The actual app retains the existing Lexend fonts, Material Icons, Onyx & Snow colours, ScreenBackdrop, GlassCard and button components. Glass is subtle: a 64-pixel capsule and an inset selected pill, with no protruding bubble, chromatic fringe, new emoji or replacement icon family. This clarification supersedes the more pronounced lens in the original study.

## 1. Product decision

Use five permanent member destinations, in this order:

**Workout · Food · Gym · Friends · Profile**

Workout opens by default and absorbs the useful training summary from Home. Food becomes a diary destination rather than only a logging form. Gym gathers existing gym membership, check-in, attendance information and classes. Friends remains a first-class destination. Profile provides a prominent Progress entry, account and goals, and Learn.

Remove the central + action from the tab bar. Start workout and Add food become explicit actions within their destinations. Keep exercise demonstrations available from both Workout discovery and the active workout.

This is a product/design recommendation based on source inspection and the user's walkthrough. No new user study or native frame-time measurement has been performed.

## 2. Evidence and current implementation

Inspected against the current working tree, including existing uncommitted improvements. Preserve those changes during execution.

| Area | Current implementation | Planned treatment |
|---|---|---|
| Navigation | `mobile/app/(tabs)/_layout.tsx`: Home, Friends, central + menu, Learn, Profile; hidden Stats | Keep Expo Router's JS Tabs; install a custom tab bar with five destinations |
| Home | `mobile/src/screens/member/HomeScreen.tsx`: training, food, coach, gym, learning and social sections | Extract a focused Workout landing screen; redistribute other sections |
| Workout | `WorkoutLogScreen.tsx`, `activeWorkoutDraft.ts`, `savedWorkoutPlan.ts`, `components/workout/` | Reuse logger, account-scoped drafts, prior values, input preferences and rest timer |
| Food | `CalorieLogScreen.tsx`, `FoodEntrySheet.tsx`, `NutritionContext.tsx` | Add a diary landing screen; preserve logging, portions, recents, recipes and editing |
| Exercises | `ExerciseList.tsx`, `ExerciseLibraryScreen.tsx`, `ExerciseDetailsModal.tsx` | Make discovery visible and share demo/instruction presentation |
| Gym | `settingsAPI.getGym/joinGym/leaveGym`, `checkinAPI`, `gymAPI.getBusyTimes`, `classesAPI` | Build an initial hub from available data |
| Profile | `mobile/app/(tabs)/profile.tsx`, `StatsScreen.tsx`, `WorkoutCalendar.tsx` | Surface Progress and Learn without duplicating existing analytics |
| AI | `AICoachScreen.tsx`, existing consent flow | Add contextual, editable prompt entry points; preserve consent |

Observed versions: Expo `~54.0.33`, Expo Router `~6.0.23`, React Native `0.81.5`, Reanimated `~4.1.1`, React Navigation bottom tabs `^7.0.0`. The installed Expo compatibility map recommends `expo-glass-effect ~0.1.8` and `expo-blur ~15.0.8`; neither is currently installed. `expo-linear-gradient 15.0.8` is installed.

## 3. Screen architecture

### Workout

Above the fold: compact heading/date, today's routine or an optional plan invitation, and one Start workout or Resume workout action. A user without a split can start an empty workout and add an exercise without completing plan setup. A rest day does not block a voluntary workout.

Below: two clear shortcuts, My plan and Explore; then recent workouts and compact weekly training progress. Avoid putting a training summary and its matching Start action in separate competing cards.

- **My plan:** existing saved split, scheduled days and training preferences. Only display a scheduled workout when existing saved data establishes it. Keep changing a plan separate from performing a workout.
- **Explore:** Exercises and Workouts views. Exercises reuse search and muscle filters, with equipment filtering only when supported by the catalogue data. Workouts reuse curated routines and existing difficulty/type filters.
- **History:** date, routine, duration and completed-session details from saved records. History does not mix suggestions with completed work.
- **Exercise details:** demo, equipment, target muscles and concise numbered instructions. Add to current workout uses an explicit action; viewing a demo does not create a draft or change a routine.
- **Logging:** keep weight, reps, completion and previous values together. Previous values remain suggestions until confirmed. Preserve precise input, optional RIR, rest timer and unilateral settings.

### Food

Opening view: date selector, logged calorie/protein summary, meal groups, Add food and access to Recents/Saved meals. Existing recipe and meal-building features remain available. Show targets only when configured; food logging must still work without them.

- Add food opens the existing logger with search as the primary input.
- Give camera and voice one labelled entry each; avoid a second competing camera banner.
- Tap a diary entry to edit its portion, meal assignment or nutrition in the existing entry sheet.
- Saving refreshes the diary and relevant totals. A failed update retains the user's input. Avoid a second network mutation for presentation-only changes.
- For deletion, use a short pending-delete window before the existing delete request so Undo can cancel it without inventing a restore endpoint. Navigation/unmount must not silently cancel a confirmed pending deletion; own the queue outside a transient sheet. A save confirmation without Undo is acceptable for mutations with no reliable inverse.

### Gym, first release

The tab is useful with current data and does not wait for a public directory or 3D modelling.

- Member with a gym: gym name, check-in/check-out, attendance-based crowd information, busy-time confidence and classes/bookings.
- No gym: Join your gym with the existing access-code flow; explain that workouts and food still work independently. Keep the same five tab positions.
- Unknown attendance data: show Unavailable or Retry. Describe counts as app check-ins, rather than claiming to count everyone physically present. Show sample confidence for historical busy times.
- Joining, leaving and booking remain explicit writes. Opening Gym and viewing a class do not join or book anything.
- Membership controls move to Gym, with a shortcut retained in Profile/Settings where appropriate.
- Hours, address, machine counts and floor information are absent from the inspected member gym API; omit them until supported by verified data. Do not present example values as real information.

### Friends

Keep the existing buddies, invitations, search and leaderboard features. Clean up labels so the top-level name is Friends and internal language is consistent. Group-workout creation is a separate feature: class booking is not represented as a shared live workout. Retain current sharing choices and disclosures.

### Profile

Use this order: identity/edit profile, Progress, goals/training preferences, measurements and health, Learn, settings/support. Progress is an obvious labelled entry near the top; use existing Stats and history views. Learn opens its existing lesson path with progress intact. Relevant form instructions remain accessible within exercise details.

### Coach

One consistent Ask coach entry on Workout and Food, with editable suggested prompts. Context parameters are optional, bounded and validated. Opening a destination does not send a message. Keep existing AI consent and only transmit relevant context after the user submits. This release does not grant the coach autonomous write access to workouts, meals or membership.

## 4. Liquid-glass navigation direction

Reference: the user's Repivo screenshot, supplied 22 October. It shows a floating dark translucent capsule, five icon/label pairs, a highlighted convex active lens, a fine bright rim and restrained shadow. The orange brand accent is not adopted; Fitzo keeps its existing dark/white palette.

Reference-image path, for this machine only: `C:/Users/PC/AppData/Local/Temp/codex-clipboard-520b8212-3b17-43e2-b440-b004c528c822.jpg`. The temporary file is not a durable design asset. This written direction and the companion HTML study are the persistent reference.

### Geometry and appearance

| Property | Initial design value |
|---|---|
| Horizontal inset | 12 logical pixels at widths below 360; 16 otherwise |
| Maximum bar width | 440 logical pixels, horizontally centred |
| Capsule height | 64 logical pixels at normal system text size |
| Bottom clearance | `max(safeAreaBottom, 10)`; never add the safe-area inset twice |
| Capsule corner radius | Half the rendered capsule height |
| Tab targets | Five equal columns; at least 48 × 48 logical pixels |
| Icons | Consistent 24-pixel Material Icons; no unrelated icon family |
| Labels | 11–12 logical pixels normally; respect system font scale |
| Active lens | One column wide with an internal gap; inset 5 pixels vertically within the capsule |
| Active lens rim | 1-pixel light edge, brighter on the upper edge; no rainbow/chromatic fringe |
| Foreground | Active white; inactive light grey; distinct selected shape and accessibility state |
| Motion | 180 ms translation; no recurring shimmer, scale bounce or idle animation |

These are starting measurements, not values to force when large text requires more room. Derive active-lens placement from measured column width; do not hardcode five screen coordinates. Keep a single visual material behind the bar. Build the active lens with tonal fill, rim and highlight above that material, avoiding nested live blurs and distorted labels.

At high font scales, increase height and permit two-line labels while preserving full names. The user's October 23 refinement supersedes the initial fixed-height requirement: downward scrolling fades the labels and reduces the capsule to 54 points; deliberate upward scrolling, returning to the top, focusing a destination or pressing a tab restores the labels. Preserve at least 44-point tap targets, screen-reader names and the expanded content inset so resizing cannot cause scroll jumps. It hides for the keyboard where needed and remains stable during background data refreshes.

Content may scroll behind the capsule, but the final interactive row must scroll fully above the complete occupied area. Place a compact active-workout banner above the capsule, separated by 8 pixels; account for its measured height in content padding. Full-screen logger/detail routes use their own back/close controls rather than adding duplicate navigation chrome.

### Platform rendering

- **Supported iOS:** use Expo's SDK-compatible native `GlassView`, regular style and dark appearance. Guard component/API availability and observe Reduce Transparency separately. Keep native-view opacity at 1; control tint/material rather than fading the entire native glass view.
- **Older iOS:** `expo-blur` dark material with a charcoal tint and the same outline/shape.
- **Android:** trial SDK-54's `experimentalBlurMethod="dimezisBlurView"` behind a presentation configuration. Default to the tinted capsule if a supported-device check shows stale blur, artifacts or measurable scrolling regression. Do not use newer SDK blur props in SDK 54.
- **Reduced transparency/high contrast:** opaque charcoal capsule and selected lens, with readable labels and visible selected outline.
- **Reduced motion:** switch the lens directly to its destination; do not run spring or scale effects.
- **Web preview:** CSS backdrop blur approximates the appearance; it does not validate native optical refraction or device performance.

No Expo SDK migration, custom shader, Skia pipeline or new rendering engine is required for this work. Rebuild native development/release clients after installing native dependencies; a JavaScript-only update cannot add their native modules to older binaries.

### Behaviour

Every tab has a visible label and selected accessibility state. Emit React Navigation's `tabPress` event before navigating and honour prevention. Forward `tabLongPress`. Do not navigate again or clear a draft when pressing the selected tab. Decorative lens/highlight layers do not intercept touches.

Preserve screen state and scroll position between tab switches. Stack details return to the initiating destination. An active workout remains resumable from all five primary tabs. Backing out of a logger does not complete or discard a workout. Ending a workout clears only that account's active draft after successful finalization.

## 5. Route compatibility

| Existing route | Outcome |
|---|---|
| `/(tabs)` and `/(tabs)/index` | Workout landing; keep the existing index route |
| `/(tabs)/buddies` | Friends; preserve route and invitation links |
| `/(tabs)/profile` | Profile |
| `/(tabs)/learn` | Hidden compatibility route to the canonical `/member/learn` screen |
| `/(tabs)/stats` | Existing hidden Stats route remains available; Profile links to it |
| `/(tabs)/scan` | Hidden compatibility route to Workout; no automatic camera or modal action |
| `/log/workout`, `/log/calories` | Preserve logger routes and their supported parameters |
| `/exercise-library`, `/lesson/[id]` | Preserve direct links and details |
| `/qr-checkin`, `/classes`, `/buddy` | Preserve behaviour and authentication checks |
| New `/(tabs)/food`, `/(tabs)/gym` | Diary and Gym destinations |

Update internal Learn links to the canonical route. Hide compatibility tabs explicitly so they cannot become accidental sixth/seventh destinations. Do not rename stored draft keys or convert saved history during a visual migration.

## 6. Delivery boundaries and order

1. **Design and native spike:** review this specification and HTML study, verify material support on an iOS and Android development build, and capture baseline screenshots/performance.
2. **Navigation foundation:** tab bar, geometry, fallbacks, route compatibility and active-workout banner. Wire working existing content before removing the + menu from a shippable build.
3. **Daily flows:** focused Workout landing, Food diary, exercise discovery, fast edits and visible Progress/Learn. Preserve existing data contracts.
4. **Gym hub and coach entry:** relocate existing gym functions, then contextual coach prompts. Run full regression and native acceptance.
5. **Gym discovery and equipment expansion:** separate backend/data project, described below. It is not a dependency for the initial navigation release.
6. **3D gym maps and shared live workouts:** separate optional product projects with their own data and interaction validation. They do not block daily-flow improvements.

### Follow-on gym data project

First secure gym permission and an operator who can maintain each listing. Import verified address/hours, equipment inventory, exercise associations and floors. Add explicit publishing and last-verified timestamps; an unverified gym is not public. Separate public browsing responses from membership-only fields and access codes.

API shape for its separate specification: paginated `GET /gyms/discover`, `GET /gyms/:id/preview`, `GET /gyms/:id/equipment`, `GET /gyms/:id/floors`. Viewing these endpoints must be read-only. Reuse explicit join-by-code for membership. Tag scanning requires an opaque tag-to-machine mapping and a manual exercise-search alternative; it must not interpret an arbitrary barcode as a membership action.

Render an accessible equipment list and 2D floor plan first. A 3D milestone requires a surveyed floor plan, consistent machine coordinates, licensed/lightweight models, an update owner and device budgets. Load the model only after Open map; keep the list usable if the model fails. Validate whether people can find equipment faster before commissioning more 3D models. No fabricated sample gym is labelled My gym.

## 7. Acceptance and measurement

Required user tasks: start a workout without a split; find a chest demo and add it; edit a set; repeat a meal and change its portion; check gym information; open Progress and a lesson; resume a workout after visiting every other tab.

Targets are design acceptance goals, not measured claims:

- Start/Resume is visible without scrolling on representative small phones at default text size.
- Either Workout or Food is reachable with one tab selection. Add food is then an explicit diary action.
- A valid suggested set can be confirmed in one tap; unconfirmed values do not count as performed work.
- Food entry editing does not require searching for the food again.
- No content, toast, timer or final list action is hidden under the capsule/banner or keyboard.
- No lost/account-crossed draft, duplicate meal mutation, unsolicited AI request or implicit gym join occurs.
- Labels remain readable over dark, bright and moving backgrounds. Normal text targets WCAG AA contrast; native VoiceOver/TalkBack and large text need explicit verification.
- Capture native frame pacing during a 30-second list scroll before and after. Reject Android live blur if it adds over five percentage points of missed frames versus the same build with the tinted capsule, or causes visible artifacts. Absolute budgets are tuned to the test device's refresh rate.
- Trial with five people across new/existing members; record task success, wrong destinations and hesitation. Five is a formative usability sample, not a statistical retention study.

If existing analytics do not already support these tasks, add only non-content navigation/action event names through the existing telemetry mechanism. Do not introduce a new analytics vendor or collect exercise/meal text for this redesign.

## 8. Sources and technical caution

- [Apple: Materials](https://developer.apple.com/design/human-interface-guidelines/materials) — reserve glass for functional navigation/control surfaces and adapt to accessibility settings.
- [Apple: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) — stable top-level destinations.
- [Expo: GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) — native iOS availability and runtime checks. Current docs are not a dependency version pin.
- [Expo SDK 54 glass exports](https://github.com/expo/expo/blob/sdk-54/packages/expo-glass-effect/src/index.ts) and [types](https://github.com/expo/expo/blob/sdk-54/packages/expo-glass-effect/src/GlassView.types.ts).
- [Expo SDK 54 blur types](https://github.com/expo/expo/blob/sdk-54/packages/expo-blur/src/BlurView.types.ts) — Android uses `experimentalBlurMethod`; the current latest SDK uses a different API.
- [Repivo's member flow](https://repivo.fit/en/app/) — its published scan, previous-session and set-saving flow supports contextual navigation; the supplied screenshot is the visual reference.

The versioned Expo documentation URLs redirected to newer SDK content during research. Use the installed SDK compatibility map and the SDK-54 package types when implementing. Confirm exports against the actual installed compatible patch release before coding the native wrapper.

## 9. Planning-artifact verification

**Latest direction, after hands-on testing:** The user subsequently requested outline icons, a more visible Apple-style glass material, roomier plan/weekly cards and clearer workout controls. This supersedes the initial requirement to retain the filled Material Icons in member navigation. Use the existing Expo Ionicons package, Lexend and current theme. The downloaded Repivo recording was reviewed for spacing and interaction hierarchy. See [the local refinement review](../../reviews/navigation-2026-10-22/refinement.md) for implementation and evidence.

The HTML study was rendered and visually inspected in Chromium. Clicks and keyboard arrows change the selected destination; the opacity and motion switches work. At 320, 390, 760 and 1440 CSS-pixel viewport widths there was no horizontal page overflow or clipped tab label; the smallest measured tab target was 48.19 pixels wide. The final Food row can scroll above the Resume banner. No page JavaScript errors were observed during these checks.

The Markdown documents were checked for missing local links, trailing whitespace and unresolved planning markers. Test commands use the project's installed Jest 29 syntax. These are checks of the plan and browser study only; mobile app tests, native builds, optical effects and native accessibility remain execution tasks.
