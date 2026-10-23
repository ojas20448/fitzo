# Workout set entry — 23 October 2026

The logger now opens one set editor for weight, reps and optional RIR. It focuses the value tapped, supports keyboard Next, and offers explicit **Mark set complete** and **Save without completing** actions. Editing a completed set preserves completion. Checking an unfinished set with missing values opens the editor at the first missing field.

**Copy previous set** fills weight and reps for the current exercise without copying RIR or completion. Adding a set still copies the last row's values and leaves the new set unchecked. **Edit sets** exposes labelled remove buttons, using the existing confirmation sheet. Last-session hints now say “Last” to distinguish them from entered values.

New users start with typed input. Existing wheel preferences remain respected, and switching modes preserves all draft fields. The unconditional barbell plate hint was removed because it also appeared for machines and bodyweight movements. The sheet uses the existing Lexend type, monochrome colors, outline icons and button component.

Validation accepts explicit 0 kg for bodyweight, decimal dot/comma weights, whole positive reps, and optional whole-number RIR from 0 to 5. Invalid entries stay visible with a specific message. Cancel leaves the set untouched. Saving is guarded against duplicate taps.

## Verification

- All 70 Jest suites / 556 tests pass, including combined entry, invalid values, bodyweight, decimal input, copy, save-only, completion, account-specific input modes and accessible set-removal controls.
- TypeScript passes. Scoped ESLint reports no errors; seven existing warnings remain in the workout screen and ExerciseCard.
- Expo web, iOS and Android JavaScript exports succeed. These are not installed native builds.
- Browser flow passes with synthetic local authentication and intercepted API requests. All external media requests are blocked. No real account or production workout was written.
- Eleven responsive captures at 320, 390, 430 and 844 pixels wide, including 320 × 460 and 844 × 430 short viewports. No horizontal page overflow; the primary editor action remains visible.
- Browser checks cover empty-set completion opening the editor, invalid entry feedback, direct completion, unchecking, editing completed values, copying, switching input modes, saving without completion, cancelling changes, add-set defaults, cancelling/confirming removal, and finishing to the recap.
- Exactly one intercepted workout write contains the completed 42.5 kg × 8 set with RIR 0. Unfinished copied rows are excluded.

Results: [browser-results.json](browser-results.json). Captures: [combined editor](combined-editor-390x844.png), [short viewport](combined-editor-320x460.png), [copy previous](copy-previous-set-320x844.png), [wheel](wheel-editor-390x844.png), [visible removal](visible-set-removal-390x844.png).

The isolated browser's blocked jsQR CDN worker produces the existing importScripts error; no other page errors occurred. Physical iOS/Android keyboard behavior, haptics and safe-area rendering still need device checks.
