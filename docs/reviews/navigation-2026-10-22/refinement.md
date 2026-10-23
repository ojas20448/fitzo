# Member UI refinement

22 October 2026. Local branch: `codex/navigation-liquid-glass`.

The user tested the app and requested Apple-style glass, cleaner icons, exercise editing, more breathing room, a matching exercise logging control, a working discard action and a readable notification. The 96-second Repivo recording in Downloads (`WhatsApp Video 2026-10-21 at 8.04.18 PM.mp4`) was reviewed as a reference for hierarchy, action placement and exercise-guide structure. Fitzo retains its Lexend fonts and Onyx & Snow theme. [Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) informs the functional navigation layer.

## Shipped locally

- Bottom navigation: consistent Expo Ionicons outlines; stronger translucency, soft edge reflections, an inset lens and a damped spring. Reduced motion and transparency still apply. Supported iOS uses native glass; browser uses blur; Android retains the tinted fallback.
- Workout home: tidy two-by-two action rows, outline coach/streak icons, a named avatar fallback and more space above weekly progress. The calendar card has larger labels, more padding and no expanding idle pulse.
- Today's Session: the plan title occupies its own row. Change plan and Edit exercises wrap beneath it, with 44-pixel targets. Select a training day to expose Edit exercises.
- Active workout: Edit exercises opens a labelled sheet with Add, Replace, Remove and move up/down. Reordering preserves entered sets. Replacing an exercise with entered work asks before clearing only that exercise. Changes affect the active session; they do not overwrite the saved routine.
- Exercise guide: separated metadata, technique content and workout notes; existing catalog media can be recovered by exact ID/name; loading and failed media have explicit states. Whole movement / Each side uses the app's white selected-pill style. Duplicate prescription sentences are condensed for display.
- Confirmation: React Native Alert has no web implementation. Workout discard, exercise removal, set removal and day-switch confirmation now use a shared themed sheet. Cancel preserves the draft; failed discard preserves progress and allows retry; successful discard clears the draft/activity and returns to navigation, including directly opened sessions.
- Toast: the width now follows its container and caps at 480 pixels. The previous module-level window width could position notification text outside a resized viewport. Alerts remain readable and dismissible at 320 pixels.

## Verification

The mobile suite passes 61 suites / 470 tests. TypeScript passes. iOS, Android and web JavaScript exports succeed. Scoped source lint has no errors; the older modules retain existing warnings. Native device optics, screen readers, keyboard behaviour and frame pacing still require device verification.

Browser checks use intercepted synthetic account and workout data. API writes are intercepted and do not modify production records. The tested flows include session setup → exercise editor; guide → Each side; discard → cancel → discard; and a notification after resizing from desktop to 320 pixels. The guide's failed-media capture intentionally blocks its image request.

After the launch animation settles, the home page has no horizontal overflow at 320, 390, 430 and 844 pixels. The smallest tab target is 57.19 pixels wide. Plan actions fit at 320, 390 and 430 pixels. At 320 pixels the toast is 288 pixels wide, with 16-pixel side margins. The web radio exposes `aria-checked=true` after choosing Each side.

## Captures

- [Workout home](./refined-workout-390.png)
- [Today's Session](./refined-session-390.png)
- [Exercise editor](./refined-editor-390.png)
- [Exercise guide and logging mode](./refined-exercise-guide-390.png)
- [Notification at 320 pixels](./refined-workout-toast-320.png)

## Login screen follow-up

The login screen now uses compact horizontal branding, a clear welcome heading, visible input labels, 56-pixel fields and buttons, outline field icons, a proper Google G, a labelled password-visibility action and a recovery link alongside the password label. The enclosing form card and large floating logo were removed. The layout keeps Lexend and the current theme and caps its content width on larger screens. Google/Apple authentication handlers retain their existing behaviour and runtime availability checks.

Browser verification covered 320×568, 390×844, 430×932, 844×390 and 1440×900, with no horizontal overflow and a reachable registration action. Empty submission made no login request; Enter in email focused password; password visibility toggled; one intercepted failed login preserved the login screen; recovery and registration opened their existing routes. Synthetic credentials were used and the login request was intercepted. Native provider authorisation was not exercised.

TypeScript and scoped login lint pass without errors or warnings. Web, iOS and Android JavaScript exports pass. [Updated login capture](./refined-login-390.png).

The latest Spotter request replaces the headset with a simple outline coach portrait (`person-circle-outline`) on Workout and Food, using the same Ionicons family. The Workout shortcut exposes an explicit button role and Spotter hint. A fresh home load did not reproduce the reported `shadows is not defined` message; current source has no unbound shadow reference and TypeScript passes. The intercepted browser harness still blocks the unrelated jsQR worker CDN request. The earlier [Spotter shortcut capture](./refined-spotter-icon-390.png) shows the superseded headset.

## Meal selection, media, interaction and signup follow-ups

The subsequent Spotter feedback supersedes the portrait above. Workout now has a `bulb-outline` advice icon and a visible **Spotter** label; Food uses the same icon and **Ask Spotter**. Both use the existing Ionicons and Lexend styling. [Current shortcut](./spotter-bulb-390.png).

Add Food exposes Breakfast, Lunch, Dinner and Snacks before search or logging. The picker uses two equal columns at narrow widths and larger font settings. A repeat food retains the currently selected meal rather than importing its previous category. The context is passed to meal ideas, voice bulk logging and camera navigation/return. The full daily log is grouped by meal, with uncategorised legacy entries retained under Other. The food detail and meal-builder selections match the existing white selected treatment. Voice logging refreshes the nutrition summary as well as the entry list. [320px capture](./meal-selector-320.png), [390px capture](./meal-selector-390.png).

Holding a tab previews its lens position and increases lens height by 7% and icon scale by 14%, then springs back on release. A press alone does not navigate; cancellable navigation events and selected state remain intact. Reduce Motion disables the lift and enlargement. Browser measurements: lens height 52px at rest, 55.63px while held; release settled back. [Held state](./glass-held-390.png).

Signup/onboarding retained a centimetre validation message when switching units, allowed inches above 11 and rounded a metric height to a whole inch for display. Unit changes now clear stale errors, preserve the exact canonical centimetre value, show fractional inches, and validate imperial input before advancing. A 182.5cm round trip remains 182.5cm; entering 5ft 9in yields 175.26cm in the submitted nutrition profile. [Corrected height capture](./signup-height-390.png).

The exercise provider can return records without media URLs, replacing the local list and suppressing existing previews. A shared resolver restores previews by stable local ID or exact normalised exercise name, including cached rows. It preserves workout instructions and never fuzzy-matches a specialised movement. The additional photo manifest covers 873 names. Failed remote previews fall through to the corresponding available photo; unmatched exercises retain a readable guide.

Six actual animated GIFs are bundled with still posters, pause/play controls, reduced-motion support and source/license links: push-up, bodyweight squat, sit-up, lying leg raise, jump rope and pull-up. [Demo capture](./exercise-animation-390.png). Their [sources and licenses](../../../mobile/assets/exercise-demos/SOURCES.json) and [rebuild notes](../../../mobile/assets/exercise-demos/README.md) are included. This does not provide GIF coverage for the entire catalogue: the configured paid provider rejected the subscription with HTTP 403, and no purchase was made.

Browser verification used a separate headless context, a synthetic member and intercepted API writes. It verified meal targets and no overflow at 320/390/430px, repeating a lunch food into breakfast, a meal idea saving as dinner, actual GIF loading and pause-to-poster switching, tab hold/release and reduced motion, and signup invalid-inch correction followed by successful navigation to the plan. The isolated harness blocks the existing jsQR worker CDN import; that expected worker error is separate from the tested screens. No production records were changed. Native iOS glass optics and device frame pacing remain unverified.

Final checks after the Spotter and meal-selector refinements: **63 suites / 482 tests pass**, TypeScript passes, and iOS/Android/web JavaScript exports pass. Scoped lint for the new components, resolver, tab bar, onboarding and Food home passes without warnings. Older large screens retain existing lint warnings; the broader scoped lint reported no errors. Metro is running at `http://localhost:8081` for testing. The temporary browser harness is `C:/Users/PC/AppData/Local/Temp/fitzo-ui-followups-review.cjs`; it creates isolated synthetic contexts and intercepts API writes.

## Second polish pass — Food, Gym and History

The next pass refines the three newer destinations using the existing Lexend, Ionicons and Onyx & Snow tokens. Shared destination headers now have a smaller eyebrow and a clear 28px title. Content stays centred with a 600px maximum width, consistent spacing, and pressed feedback on action rows.

Food has a clearer daily calorie/target summary, a restrained progress track, readable macro values, and separate Breakfast/Lunch/Dinner/Snacks cards including empty meals. Each meal has its own Add action carrying the correct category into food logging. Historical diary shortcuts explicitly add to today; the header offers a Today shortcut. Existing uncategorised meals remain under Other, and saved entries still open the existing edit sheet. Meal sections precede secondary food tools. [Food at 390px](./round2-food-diary-390.png), [Food at 320px](./round2-food-diary-320.png).

Gym now separates gym identity/check-in state from recorded attendance and secondary actions. The access-code form has a visible label, Enter submission and explanatory copy. Leaving a gym uses the existing themed confirmation sheet on native and web; cancellation sends no request, repeated submission is guarded, and failures keep the sheet open with an inline retry message. [Gym](./round2-gym-home-390.png), [join form](./round2-gym-join-390.png).

Workout history has local search by workout title or exercise name, including readable titles containing spaces where storage uses underscores. Session rows show exercise/set counts and expand to clearly aligned set details. Empty search results can be cleared, and the existing earlier-workout pagination remains available when appropriate. Searches cover the currently fetched history and expand as earlier dates are loaded. No durations or progress measurements are invented. [History](./round2-workout-history-390.png), [expanded sets](./round2-history-expanded-390.png).

Final checks: **63 suites / 488 tests pass**, TypeScript passes, scoped source lint has no warnings, and iOS/Android/web JavaScript exports pass. Browser checks cover all three destinations at 320, 390, 430 and 844px without horizontal overflow. They verify exercise-name search, clear search, meal deep links, returning to today, and gym confirmation cancellation/confirmation. API writes were intercepted in an isolated synthetic context. The only recorded browser page errors are the harness-blocked existing jsQR worker CDN import. Native screen-reader use and physical-device frame pacing remain unverified. The browser harness is `C:/Users/PC/AppData/Local/Temp/fitzo-ui-destinations-review.cjs`, with [captured results](./round2-browser-results.json).

## Third polish pass — exercise discovery and editing

The exercise library now uses the same eyebrow/title hierarchy as the other destinations, a compact Workouts shortcut, a pill search field with a matching focus border, and roomier exercise rows. Rows show an existing preview, movement name, muscle information and equipment without the previous fixed-height text area. Muscle filters have 44px targets and explicit selected states. Session-restricted pickers label their combined filter Session muscles.

Search keeps built-in and cached matches visible during online requests. Multiple words match across the movement name, equipment and muscle metadata. Remote results pass through the same selected/session muscle restrictions. Request generations prevent a late search or page response from replacing the current scope or overwriting its cache; pagination keeps a provider offset separate from visible built-in rows and guards repeated requests. All muscles preserves search text; Reset explicitly clears both filters. Changing the query/filter returns the list to its first result. Failed online loads retain the usable library and offer Retry, with clear limited-search/empty states.

In workout selection, preview and Add are separate controls. Preview does not alter the session; the guide offers an explicit Add to workout action. Custom exercises are offered only in selection mode. Search names containing slashes, including 3/4 sit-up, are encoded as one API path segment. Stored mirror photos also fall back to the exact original file path when the display name differs from the source catalog name. No additional GIF coverage is claimed.

The editor has movement previews, exercise/set counts, completed-set context, grouped move controls, clearer Replace controls and a dismissible backdrop. Reordering keeps entered weights and reps. Existing confirmation before replacing entered work remains intact. The picker close control has a labelled 44px target. [Library](./round3-library-390.png), [multiword search](./round3-search-390.png), [editor at 320px](./round3-editor-320.png), [editor at 390px](./round3-editor-390.png).

Checks after this pass: **66 suites / 501 tests pass**, TypeScript passes, focused source lint has no warnings, and web/iOS/Android JavaScript exports pass. Tests cover immediate local results, stale search/page rejection, pagination guards, session muscle restrictions, explicit selection, custom creation, retry, metadata matching, mirror fallback and slash encoding. Browser checks verify the library at 320/390/430/844px and editor at 320/390/430px without horizontal overflow, 44px muscle filters, searching after scrolling, preview without adding, reordering without losing entered sets, and adding exactly once. No API writes occurred in the isolated synthetic context. The harness-blocked jsQR worker CDN import remains the only recorded page error. Native-device motion, keyboard and screen-reader behaviour remain unverified. [Browser results](./round3-browser-results.json); temporary harness: `C:/Users/PC/AppData/Local/Temp/fitzo-ui-exercises-review.cjs`.
