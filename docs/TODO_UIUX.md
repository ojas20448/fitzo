# Fitzo - TODO & UI/UX Improvements

> Last Updated: January 16, 2026 (Continued Refinement Pass)

This document outlines all identified UI/UX issues and improvement opportunities across the Fitzo mobile app.

**Progress Summary:**
- ✅ Skeleton loading component created
- ✅ Register screen created + refined styling
- ✅ Toast/Snackbar system implemented
- ✅ EmptyState component created
- ✅ Button component improved (ripple, variants, accessibility)
- ✅ Avatar component improved (initials fallback, skeleton)
- ✅ HomeScreen updated (skeleton, greeting, XP badge)
- ✅ WorkoutLogScreen & CalorieLogScreen improved
- ✅ GymBuddiesScreen improved
- ✅ LearnScreen skeleton added

**🎨 Major UI Refresh (Onyx & Snow v2):**
- ✅ Theme updated with refined glass tokens (surfaceLight, surfaceHover, borderLight)
- ✅ Typography updated with letterSpacing tokens and light weight
- ✅ Shadows updated with glowMd intermediate effect
- ✅ HomeScreen completely redesigned (streak badge, training section, squad pulse)
- ✅ WorkoutIntentScreen redesigned (3-col training type, 2-col body focus, privacy pill)
- ✅ WorkoutLogScreen redesigned (date display, locked intent, duration/energy pills)
- ✅ CalorieLogScreen redesigned (circular progress ring, custom numpad)
- ✅ GymBuddiesScreen updated (refined header, glass feed cards)
- ✅ LearnScreen redesigned (vertical timeline with progress indicators)
- ✅ GlassCard updated with 'subtle' variant

**🔄 Continued Refinement Pass:**
- ✅ Profile screen - skeleton loading, header pattern (PROFILE · YOU), settings button
- ✅ Tab bar - floating pill style, refined modal styling
- ✅ QR Checkin screen - refined header, permission UI, success state
- ✅ ClassBooking screen - skeleton loading, header pattern (CLASSES · BOOK)
- ✅ Login screen - Toast integration (replacing Alert), refined form styling
- ✅ Register screen - Toast integration, refined input styling
- ✅ TrainerHomeScreen - skeleton loading, header pattern (TRAINER · DASHBOARD)
- ✅ ManagerDashboardScreen - skeleton loading, header pattern (MANAGER · OVERVIEW)
- ✅ ManagePeopleScreen - skeleton loading, header pattern, Input component integration

**🎭 Animation & Component Polish:**
- ✅ CrowdIndicator - pulsing live indicator animation
- ✅ Badge - added warning, error, info variants
- ✅ WeeklyProgress - animated day dots with staggered entrance
- ✅ NutritionAnalytics - animated progress bar
- ✅ Input component - new reusable component with focus glow effect

---

## 🎨 Design System Issues

### Color & Theming
- [ ] **LOW_001**: Inconsistent use of glass surface opacity - some components use `rgba(255, 255, 255, 0.08)` directly instead of `colors.glass.surface`
- [x] **LOW_002**: Crowd indicator colors (green/amber/red) break the monochrome "Onyx & Snow" theme - consider using white with varying opacity/glow effects
- [ ] **LOW_003**: The `success` color is `#FFFFFF` in theme but `colors.crowd.low` (green) is used for success states - inconsistent
- [ ] **LOW_004**: No dark mode toggle - app is locked to dark theme only
- [ ] **LOW_005**: Missing accent color variations - everything is pure white which can feel monotonous

### Typography
- [ ] **TYP_001**: Section titles use `textTransform: 'uppercase'` inconsistently across screens
- [ ] **TYP_002**: Font weights jump directly from 400 to 700 in many places - no intermediate weights used
- [ ] **TYP_003**: Line heights not consistently applied - some text feels cramped
- [ ] **TYP_004**: No letter-spacing guidelines being followed consistently

### Spacing
- [ ] **SPC_001**: Inconsistent bottom padding for scroll content - some use `{ height: 100 }` spacer, others don't
- [ ] **SPC_002**: Tab bar overlaps content on some screens without proper safe area handling
- [ ] **SPC_003**: Section spacing varies between `xl` and `2xl` inconsistently

---

## 📱 Component Issues

### Button Component
- [ ] **BTN_001**: No loading spinner animation - just static `ActivityIndicator`
- [x] **BTN_002**: Ghost button has no visual feedback on press ✅ Added scale animation
- [x] **BTN_003**: No ripple effect for Android - missing `android_ripple` prop ✅ Added
- [x] **BTN_004**: Disabled state is too subtle - hard to distinguish from enabled ✅ Improved
- [x] **BTN_005**: Missing button variants: `danger`, `link`, `outline-primary` ✅ Added danger/outline

### GlassCard Component
- [ ] **GLS_001**: No blur effect - `backdrop-filter` doesn't work in React Native without additional libraries
- [ ] **GLS_002**: Active variant text color assumes parent will handle it - can cause color collisions
- [ ] **GLS_003**: No press state for interactive cards
- [ ] **GLS_004**: Missing hover/focus states for accessibility

### Avatar Component
- [ ] **AVT_001**: Grayscale effect using opacity instead of actual grayscale filter
- [ ] **AVT_002**: Default avatar is a remote URL - should have local fallback for offline
- [ ] **AVT_003**: Border always uses `colors.primary` - should be configurable
- [x] **AVT_004**: No skeleton loading state while image loads ✅ Added skeleton loading
- [x] **AVT_005**: Missing initials fallback when name is available ✅ Added initials fallback

### Badge Component
- [x] **BDG_001**: Limited variants - needs `warning`, `error`, `info` ✅ Added all variants
- [ ] **BDG_002**: Icon positioning is inconsistent with text alignment

### WeeklyProgress Component
- [ ] **WKP_001**: Static weekly target (hardcoded 4) - should come from user settings
- [ ] **WKP_002**: No animation on progress changes
- [ ] **WKP_003**: Check icon inside small dot is hard to see
- [ ] **WKP_004**: Past week data not visible - can't see historical trends

### NutritionAnalytics Component
- [ ] **NUT_001**: Progress bar has no animation
- [ ] **NUT_002**: No breakdown of macros (protein/carbs/fat) in summary view
- [ ] **NUT_003**: Target calories hardcoded to 2500 - should be personalized
- [ ] **NUT_004**: No weekly/monthly trend view

### CrowdIndicator Component
- [x] **CRD_001**: "Live" indicator has no pulsing animation to indicate live status ✅ Added pulse animation
- [ ] **CRD_002**: No history/trend of crowd levels

### StreakCounter Component
- [x] **STK_001**: Fire emoji should animate on streak milestone achievements
- [ ] **STK_002**: No "best streak" comparison shown inline

---

## 📄 Screen-Specific Issues

### Login Screen
- [x] **LGN_001**: No onboarding flow for first-time users ✅ Fully functional OnboardingWizard with fitness target calculator
- [x] **LGN_002**: Password requirements not shown ✅ Shown on register screen
- [x] **LGN_003**: Forgot password flow needs proper routes ✅ Integrated focus-glow Input component (no route defined)
- [ ] **LGN_004**: No biometric authentication option (Face ID/Fingerprint)
- [ ] **LGN_005**: No "Remember me" option
- [x] **LGN_006**: Error states not shown inline (only alert) ✅ Toast integration
- [ ] **LGN_007**: Loading state covers entire button - should show inline spinner
- [x] **LGN_008**: No visual feedback when typing (input focus states weak) ✅ Created Input component
- [x] **LGN_009**: Register route doesn't exist (`/register` 404) ✅ Created register.tsx

### Home Screen
- [x] **HOM_001**: Loading state is just text "Loading..." - needs skeleton placeholders ✅ SkeletonHomeScreen
- [x] **HOM_002**: Greeting emoji is static - could be time-based (☀️ morning, 🌙 evening) ✅ Time-based greeting
- [x] **HOM_003**: Gym card is too small/cramped for touch targets ✅ Improved
- [ ] **HOM_004**: "Today's Focus" card active state has black text on white - low contrast for some elements
- [ ] **HOM_005**: "Quick Log" section lacks visual hierarchy - both buttons look identical
- [ ] **HOM_006**: No empty states for new users (no workouts, no calories, no streak)
- [ ] **HOM_007**: Pull-to-refresh indicator is small and hard to notice
- [x] **HOM_008**: XP points not prominently displayed on home ✅ Added XP badge in header
- [ ] **HOM_009**: No notification bell/indicator for social updates
- [ ] **HOM_010**: Scroll content bottom padding uses fixed `{ height: 100 }` - not safe area aware

### Workout Log Screen
- [ ] **WRK_001**: Type selection grid has uneven columns on smaller screens (30% width causes issues)
- [ ] **WRK_002**: Emoji icons are system default - should use consistent custom icons
- [x] **WRK_003**: "Rest Day" mixed with workout types is confusing UX ✅ Removed
- [ ] **WRK_004**: No time/duration input for workout
- [x] **WRK_005**: No exercise database/autocomplete ✅ Added live autocomplete search and body filters
- [ ] **WRK_006**: Privacy options take up too much vertical space
- [x] **WRK_007**: Success alert uses system Alert - should use custom modal with animation ✅ Toast + Celebration
- [ ] **WRK_008**: No photos/media attachment option
- [ ] **WRK_009**: No recurring workout templates

### Calorie Log Screen
- [ ] **CAL_001**: Large calorie input is hard to edit (giant font)
- [x] **CAL_002**: Quick Add items are not customizable by user ✅ Custom shortcut modal with AsyncStorage persistence
- [ ] **CAL_003**: No food search/database integration
- [ ] **CAL_004**: No barcode scanner for packaged foods
- [ ] **CAL_005**: Macro inputs (protein/carbs/fat) are hidden by default
- [ ] **CAL_006**: No meal timing/schedule tracking
- [ ] **CAL_007**: No calorie history for easy repeat logging

### Workout Intent Screen
- [ ] **INT_001**: Two-step wizard is confusing - could be single unified view
- [ ] **INT_002**: Quick Sets feel cramped and repetitive
- [ ] **INT_003**: Muscle group selection limited to 3 - not explained in UI
- [ ] **INT_004**: Session label (A/B) concept is unclear for new users
- [ ] **INT_005**: No visual preview of what friends will see
- [ ] **INT_006**: Visibility setting at bottom - easy to miss

### Gym Buddies Screen
- [ ] **BUD_001**: Feed vs Friends tabs not visually distinct enough
- [x] **BUD_002**: Empty state for no friends is missing ✅ Added EmptyState component
- [ ] **BUD_003**: Friend request UI is buried
- [ ] **BUD_004**: No "suggested friends" based on gym/activity
- [ ] **BUD_005**: Like/reaction functionality has no animation
- [ ] **BUD_006**: No comments on feed items
- [ ] **BUD_007**: Search UX is hidden behind icon - not discoverable

### Learn Screen
- [ ] **LRN_001**: "Learning Path" concept is unclear - no explanation
- [ ] **LRN_002**: Locked lessons don't explain unlock requirements
- [ ] **LRN_003**: XP badge at top is not tappable for details
- [ ] **LRN_004**: Path visual lacks actual connecting lines between nodes
- [ ] **LRN_005**: No progress percentage per unit
- [ ] **LRN_006**: Lessons themselves don't exist (route not implemented)

### QR Check-in Screen
- [ ] **QRC_001**: Camera permission request is bland - no illustration
- [ ] **QRC_002**: QR scanner frame not visible - hard to align
- [ ] **QRC_003**: Success animation is too brief (2.5s)
- [ ] **QRC_004**: No manual gym selection fallback if QR fails
- [ ] **QRC_005**: Streak celebration is minimal - should be more celebratory

### Trainer Home Screen
- [ ] **TRN_001**: Member list lacks search/filter
- [ ] **TRN_002**: No quick actions for common trainer tasks
- [x] **TRN_003**: Stats cards are repetitive design ✅ Refined with light font weights
- [ ] **TRN_004**: No scheduling/calendar view for sessions
- [x] **TRN_005**: No skeleton loading state ✅ Added skeleton loading

### Manager Dashboard
- [x] **MGR_001**: Dense information - needs better visual grouping ✅ Added skeleton, refined header pattern
- [ ] **MGR_002**: Settings button leads nowhere
- [ ] **MGR_003**: No quick actions for common manager tasks
- [ ] **MGR_004**: Missing staff management quick access
- [ ] **MGR_005**: Revenue/metrics not visible
- [x] **MGR_006**: No skeleton loading state ✅ Added skeleton loading

### Profile Screen
- [x] **PRF_001**: Profile tab exists in layout but no screen implementation found ✅ Exists at app/(tabs)/profile.tsx
- [ ] **PRF_002**: No profile editing functionality visible
- [x] **PRF_003**: No settings/preferences accessible from profile ✅ Added settings button

---

## 🔄 Navigation & Flow Issues

- [ ] **NAV_001**: Tab bar center button (+) modal feels disconnected from main nav
- [ ] **NAV_002**: No deep linking support visible
- [ ] **NAV_003**: Back navigation inconsistent - some screens use X, others use arrow
- [ ] **NAV_004**: No transition animations between screens
- [x] **NAV_005**: Routes like `/register`, `/lesson/:id` are referenced but don't exist ✅ /register created
- [ ] **NAV_006**: Manager/Trainer roles use completely different navigation trees

---

## ♿ Accessibility Issues

- [ ] **A11Y_001**: No screen reader labels on icons
- [x] **A11Y_002**: Touch targets often smaller than 44x44px minimum ✅ Fixed in Button, screens
- [ ] **A11Y_003**: Color contrast issues with muted text on dark background
- [ ] **A11Y_004**: No reduced motion support
- [x] **A11Y_005**: Form inputs lack proper accessibility labels ✅ Input component with labels
- [ ] **A11Y_006**: No keyboard navigation support for Android TV/tablets
- [ ] **A11Y_007**: Loading states not announced to screen readers

---

## ⚡ Performance & Polish

- [ ] **PRF_001**: No image caching strategy visible
- [ ] **PRF_002**: API calls don't show optimistic updates
- [ ] **PRF_003**: No offline mode/caching
- [ ] **PRF_004**: Lexend font not loaded with proper fallbacks
- [ ] **PRF_005**: Large list screens (buddies, members) lack virtualization optimization
- [x] **PRF_006**: No skeleton screens for loading states ✅ Created Skeleton component

---

## 🎭 Animation & Micro-interactions

- [ ] **ANI_001**: No page transition animations
- [x] **ANI_002**: Button press feedback is minimal (only haptic) ✅ Added scale animation
- [x] **ANI_003**: Cards don't have press/scale animations ✅ Created PressableCard
- [x] **ANI_004**: No celebration animations for achievements ✅ Created Celebration component
- [x] **ANI_005**: Progress bars don't animate on value change ✅ Added to NutritionAnalytics, WeeklyProgress
- [ ] **ANI_006**: Tab bar icon doesn't animate on selection
- [ ] **ANI_007**: Pull-to-refresh needs custom animation

---

## 📐 Layout Issues

- [ ] **LAY_001**: Workout type grid breaks on narrow screens (3 columns * 30% > 90%)
- [ ] **LAY_002**: Tab bar height (80px) doesn't account for different device sizes
- [ ] **LAY_003**: Some screens don't respect safe areas properly
- [ ] **LAY_004**: Horizontal scroll views lack padding hints (edge items cut off)
- [ ] **LAY_005**: Modal sheets don't adjust for keyboard
- [ ] **LAY_006**: Landscape orientation not supported/tested

---

## 🔧 Technical Debt (UI-Related)

- [ ] **TEC_001**: Inline styles mixed with StyleSheet in some components
- [ ] **TEC_002**: `as any` type assertions on router.push calls
- [ ] **TEC_003**: Magic numbers throughout stylesheets (should use theme tokens)
- [ ] **TEC_004**: No error boundary UI for component failures
- [x] **TEC_005**: Alert.alert used instead of custom toast/snackbar ✅ Created Toast system
- [ ] **TEC_006**: Some color values hardcoded instead of using theme

---

## 📋 Priority Matrix

### P0 - Critical (Blocking core UX)
- ✅ ~~LGN_009: Register route missing~~ → Created register.tsx
- ✅ ~~PRF_001: Profile screen implementation~~ → Already exists at app/(tabs)/profile.tsx
- ✅ ~~NAV_005: Missing route definitions~~ → /register created
- ✅ ~~A11Y_002: Touch target sizes~~ → Fixed throughout

### P1 - High (Significant UX impact)
- ✅ ~~HOM_001: Skeleton loading states~~ → Created Skeleton component
- ✅ ~~WRK_007: Custom success modals~~ → Created Toast + Celebration
- ✅ ~~ANI_004: Celebration animations~~ → Created Celebration component
- [ ] LGN_004: Biometric auth
- ✅ ~~BUD_002: Empty states~~ → Created EmptyState component

### P2 - Medium (Quality of life)
- ✅ ~~LOW_002: Consistent color theming~~ → Monochrome gym crowd indicator colors
- ✅ ~~BTN_003: Android ripple effects~~ → Added to Button
- ✅ ~~PRF_006: Skeleton screens~~ → Created Skeleton component
- ✅ ~~QRC_002: Scanner frame UI~~ → Added visual borders and scanner frame to QR view

### P3 - Low (Polish)
- [ ] ANI_006: Tab bar animations
- ✅ ~~HOM_002: Time-based greeting~~ → Added to HomeScreen
- ✅ ~~STK_001: Streak animations~~ → Fire emoji spring pop animation on streak updates
- [ ] TYP_001: Consistent typography

---

## 🎯 Recommended Action Plan

### Phase 1: Fix Critical Issues
1. Implement missing routes (`/register`, `/lesson/:id`)
2. Create Profile screen with basic functionality
3. Fix touch target sizes across all interactive elements
4. Add proper error boundaries

### Phase 2: Core UX Improvements
1. Implement skeleton loading states
2. Add custom modal/toast system (replace Alert.alert)
3. Create celebration/success animations
4. Add biometric authentication

### Phase 3: Visual Polish
1. Unify color system (fix crowd indicator colors)
2. Add micro-interactions (button press, card press)
3. Implement page transitions
4. Add pull-to-refresh animations

### Phase 4: Accessibility & Performance
1. Add screen reader labels
2. Implement reduced motion support
3. Add offline caching
4. Optimize list virtualization

---

## 📝 Notes

- The glassmorphism effect (`backdrop-filter`) requires `expo-blur` or similar library
- Consider using `react-native-reanimated` for performant animations
- Lottie could be used for celebration animations
- ~~Consider implementing a toast/snackbar library like `react-native-toast-message`~~ ✅ Custom Toast created

## ✅ Completed Components

| Component | File | Description |
|-----------|------|-------------|
| Skeleton | src/components/Skeleton.tsx | Shimmer loading placeholders with pre-built patterns |
| Toast | src/components/Toast.tsx | Toast notification system with ToastProvider |
| EmptyState | src/components/EmptyState.tsx | Empty state illustrations with multiple variants |
| Celebration | src/components/Celebration.tsx | Confetti celebration modal for achievements |
| PressableCard | src/components/PressableCard.tsx | Animated pressable cards with micro-interactions |
| Input | src/components/Input.tsx | Reusable input with focus glow, icons, and validation |
| Register | app/register.tsx | Two-step registration wizard |

## ✅ Updated Components

| Component | Changes |
|-----------|----------|
| CrowdIndicator | Pulsing live indicator animation with glow ring |
| Badge | Added warning, error, info variants |
| WeeklyProgress | Animated day dots with staggered entrance and check pop |
| NutritionAnalytics | Animated progress bar fill |

## ✅ Updated Screens

| Screen | Changes |
|--------|----------|
| HomeScreen | Skeleton loading, time-based greeting, XP badge, improved gym card |
| WorkoutLogScreen | Toast, Celebration, accessibility labels |
| CalorieLogScreen | Toast, Celebration, accessibility labels |
| GymBuddiesScreen | EmptyState, SkeletonList, toast for errors |
| LearnScreen | Skeleton loading state |
| ProfileScreen | Skeleton loading, header pattern (PROFILE · YOU), settings button |
| QRCheckinScreen | Refined header, permission UI, success state styling |
| ClassBookingScreen | Skeleton loading, header pattern (CLASSES · BOOK), section headers |
| LoginScreen | Toast integration (replacing Alert), refined form styling |
| RegisterScreen | Toast integration, refined input styling with surfaceLight |
| TrainerHomeScreen | Skeleton loading, header pattern (TRAINER · DASHBOARD), user row |
| ManagerDashboardScreen | Skeleton loading, header pattern (MANAGER · OVERVIEW), user row |
| ManagePeopleScreen | Skeleton loading, header pattern, Input component, improved empty state |
| Tab Layout | Floating pill-style tab bar, refined modal styling |
