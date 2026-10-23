# Hevy inspiration for Fitzo

Reviewed 23 October 2026. Evidence: Hevy's published product screenshots, feature pages and help articles, compared with Fitzo's current mobile and backend source. This is a product assessment, not a hands-on test of Hevy's installed native app. No application code changed in this review.

## Recommendation

Adopt the interaction patterns that make a live workout quick to read and edit. Keep Fitzo's Lexend typography, black/white palette, existing outline icons, subtle glass navigation and Workout / Food / Gym / Friends / Profile structure.

The most useful visual lessons from the [official logging screenshots](https://www.hevyapp.com/features/track-workouts/) are aligned set rows, visible previous performance, one exercise actions menu, clear completed-state feedback and an easily reached rest timer. For Fitzo, reduce decoration behind the logging table and give the values more space. A separate previous-performance column should not be forced into narrow screens when RIR is visible; use a labelled line or an expandable history view instead.

## What to adopt

| Priority | Feature and Fitzo behavior | Current foundation / remaining work |
| --- | --- | --- |
| First | Quick entry in the set rows: tap weight, type, Next to reps; complete the set with its checkbox. Retain the combined editor for fuller editing. | Fitzo already validates combined edits and remembers input mode. Inline entry needs keyboard-aware scrolling, focus navigation and draft handling so a dismissed keyboard never loses edits. Prototype on small phones before replacing the current interaction. |
| First | Show **Last session: 40 kg × 8**, with an explicit **Use last session** action. Keep **Copy previous set** distinct. | Last-session hints and repeat-last data exist. Current copy fills from the preceding row in this workout. Add structured previous values rather than parsing display strings, preserve set ordering, and leave copied sets unchecked. Broader cross-routine history needs exact exercise identity and an exercise-level lookup. |
| First | Open **Guide / History** from an exercise. History shows dated real set values and a small progress chart when enough data exists. | Fitzo has guide/media, workout search, structured logs and progress endpoints. The existing PR-history endpoint reports aggregates; a complete set-history view needs exact set records and stable ID matching, including custom exercises. Do not combine independently calculated best weight and best reps into a fictional set. |
| Next | A rest chip per exercise, such as **Rest · 90s**, with Off, Skip and time adjustment. | Current timer is global and optional. Per-exercise duration must survive routine loading, local drafts and saving. First fix the existing extension callback: it updates the displayed seconds without moving the timer's target timestamp, so the next tick can cancel the extension. |
| Next | Short exercise notes, such as **Seat 4, neutral grip**. Clearly distinguish a note for today from a saved reminder. | Exercise instructions exist, but user-editable exercise notes are not represented in the logger's UserExercise type. Add explicit storage and round-trip support; keep notes separate from the exercise's technique guide. |
| Next | At finish, distinguish **Save today's workout** from **Update saved routine** when exercises or set counts changed. Default to keeping the routine. | Current live edits preserve the saved routine, and a recap follows saving. Add an explicit routine-update operation only for user-owned editable routines; show the proposed structural changes before applying them. Routine weight/reps targets and actual performed values must remain separate. |
| Later | Optional **Warm-up / Working / Drop / Failure** set labels. Default to Working. | The backend has is_warmup, but the current legacy-to-structured mirror inserts false for every logged set, and the mobile ExerciseSet has no set-type field. Wire labels through drafts, saved routines, API validation, history and PR/working-set statistics. Define drop-set rest behavior explicitly. |
| Later | Superset grouping, visible A1/A2 labels and optional movement to the next exercise after completion. | Current curated content mentions supersets, but live logger types have no group identity. Add durable grouping, ordering, timer behavior and handling of replacement/removal. Automatic scrolling should be optional and respect reduced motion. |

## Source support

- [Previous workout values](https://www.hevyapp.com/features/track-exercises/): Hevy displays previous performance and allows tapping it to reuse the values. It also provides exercise-level performance details. This supports the previous-session and history recommendations; their priority for Fitzo is our assessment.
- [Automatic rest timer](https://www.hevyapp.com/features/workout-rest-timer/): Hevy supports different rest periods per exercise, an Off setting, and time adjustments during training.
- [Exercise notes](https://www.hevyapp.com/features/exercise-notes/): Hevy distinguishes routine, workout and pinned exercise notes. Start Fitzo with clearly scoped notes rather than exposing all scopes immediately.
- [Update Routine vs Keep Original Routine](https://help.hevyapp.com/hc/en-us/articles/38387296276375-Update-Routine-vs-Keep-Original-Routine): Hevy offers this choice for structural changes such as adding/removing exercises or sets and reordering. Its documented prompt does not apply just to weight or rep changes.
- [Set types](https://help.hevyapp.com/hc/en-us/articles/34896293707927-Set-Types-in-Hevy-Explained-Drop-Sets-Warm-Up-Sets-and-More): Hevy supports regular, warm-up, drop and failure sets, with special timer behavior for drop sets.
- [Supersets](https://www.hevyapp.com/features/what-are-supersets/): Hevy supports grouped exercises and optional automatic scrolling between them.
- [RPE vs RIR](https://help.hevyapp.com/hc/en-us/articles/34490600233111-RPE-vs-RIR-What-They-Mean-and-How-to-Use-Them-in-Hevy): Hevy uses optional RPE tracking. Fitzo already exposes optional RIR. Keep one effort measure visible by default rather than adding another column.

## Fitzo code reviewed

- mobile/src/components/workout/ExerciseCard.tsx — set rows, completion, last-session hint, visible set editing.
- mobile/src/components/workout/WorkoutSetEditor.tsx — combined entry and copying the preceding set.
- mobile/src/components/workout/types.ts — current exercise/set fields.
- mobile/src/screens/member/WorkoutLogScreen.tsx — history loading, global rest timer, draft updates, finish/save flow.
- mobile/src/components/ExerciseDetailsModal.tsx — technique and media presentation.
- mobile/src/components/ExerciseList.tsx — current search/filter and batch-selection flow.
- mobile/src/utils/workoutSetup.ts — previous-workout and template merging.
- mobile/src/utils/activeWorkoutDraft.ts — per-account local draft storage.
- mobile/src/screens/member/HomeScreen.tsx — existing Resume workout entry point.
- mobile/src/services/api.ts; backend/src/routes/progress.js — exercise progress endpoints.
- backend/src/routes/workouts.js — mirroring legacy saves into structured sessions and sets.

## Delivery order and checks

1. Correct timer extension, improve previous-session presentation and add keyboard-entry prototype. Compare taps and error correction with the current set editor using the same three-exercise workout.
2. Add exercise history, then per-exercise rest and notes. Verify drafts and history remain correct after closing/reopening the app and switching accounts.
3. Add explicit routine updates, followed by set types and superset grouping. Verify old workouts remain readable and working-set/PR calculations follow the declared rules.

For every phase: small-screen and keyboard checks, completed-only saving, bodyweight 0 kg, optional RIR 0, cancelling edits, offline draft restoration, no cross-account data, and consistent routine-vs-session behavior. Preserve manual scrolling and existing accessibility labels.

Do not duplicate features already present: resume drafts, add multiple exercises, replace/reorder exercises, exercise previews, optional effort tracking, saved plans, history search and the recap. Improve their discoverability within the flow instead. Watch apps and additional social surfaces can wait until logging is consistently easy.

No new build or tests were run for this research-only review. Native Hevy behavior and the proposed Fitzo changes still need hands-on validation during implementation.
