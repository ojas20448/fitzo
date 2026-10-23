# Profile editing and custom workout setup — 23 October 2026

## Problems addressed

Editing a display name automatically selected the Zeus avatar when the account had no picture. The editor also lacked a way to restore the default silhouette, inline errors and protection against accidentally discarding a draft. The custom split builder advanced to session selection before its save completed and silently ignored save errors.

## Result

- Profile editing uses the shared avatar picker with a live preview and an explicit default-picture choice. Presets form a balanced three-by-three grid. Existing photo URLs remain selected until the member chooses another picture.
- Name edits preserve the default picture, trim surrounding spaces and validate length before submission. The save action is disabled when nothing changed.
- Name and avatar controls lock during saving. A synchronous guard blocks duplicate writes and dismissal while saving. A failed request keeps the editor open with the entered name and picture plus an inline retryable error.
- Closing a changed profile asks whether to keep editing or discard. This prompt stays inside the editor, avoiding a second stacked native modal. Closing an unchanged profile dismisses immediately.
- The editor uses labelled fields, autofill hints, keyboard avoidance, 44px close targets and centred content up to 600px wide, preserving Fitzo’s existing typography and colors.
- Custom splits remain in the builder until the server confirms saving. Errors preserve the name and days. Retry submits the same draft; pending saves block duplicate submission, day changes and navigation away.
- The split name is validated and trimmed. A typed custom day must be added explicitly before saving so it cannot be silently omitted.
- Workout-day chips, remove actions, Back, Skip and visibility choices have at least 44px touch targets. Visibility choices expose their checked state. The footer participates in layout, allowing errors and larger labels to grow without covering the final content.
- The profile API client type now accepts `avatar_url: null`, matching the existing server route’s support for the default picture. No new endpoint, dependency or backend deployment is required.

## Verification

- **69 Jest suites / 524 tests passed.** New cases cover default-picture preservation, preserving an existing photo, restoring the default, validation, server retry, keeping/discarding edits, pending-write locks, and failed/repeated custom split saves.
- TypeScript passed. Scoped lint has no errors; four existing warnings remain in the older profile, workout-intent and API files.
- Web, iOS and Android JavaScript exports passed; these are bundle checks, not device builds.
- An isolated Chromium context exercised profile save failure/retry, picture reset, keep/discard, custom split save failure/retry and the resulting session selection. All writes were intercepted: three profile attempts and two split attempts. No real profile or plan changed.
- **16 layout captures** cover 320, 390, 430 and 844px widths across the editor, error states, discard prompt and split builder. No horizontal page overflow was found. Browser assertions also check the workout touch-target sizes.
- The harness blocks third-party traffic, producing the recorded jsQR worker import failures. No additional application page errors were recorded.

## Evidence

- [Profile editor](./profile-editor-390.png)
- [Profile save error](./profile-save-error-320.png)
- [Keep or discard changes](./profile-discard-390.png)
- [Custom split retry](./custom-split-error-320.png)
- [Saved split](./custom-split-saved-390.png)
- [Browser results](./browser-results.json)

Native keyboard, page-sheet behavior, large accessibility fonts and screen readers still need device verification. The browser harness is `C:/Users/PC/AppData/Local/Temp/fitzo-profile-polish-review.cjs`. Metro remains running at `http://localhost:8081`.
