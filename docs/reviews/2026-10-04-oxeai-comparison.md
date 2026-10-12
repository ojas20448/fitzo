# OxeAI comparison and Fitzo recommendations

Reviewed 4 October 2026. Scope: OxeAI by OxeFit, official public product pages and store release history, compared with the current Fitzo source. No paid OxeAI account or installed-device walkthrough was performed. Competitor feature availability is based on publisher documentation; output quality, latency, accuracy and retention have not been independently measured. Existing local changes were preserved. No app code or production configuration changed.

## Main finding

OxeAI presents a coherent journey from conversation to a daily plan to progress feedback. Fitzo already has much of the underlying tracking functionality. The best opportunity is to connect those features into clear next actions, retain useful preferences, and make the health-data connection understandable.

## Evidence from OxeAI

- [Official product site](https://www.oxeai.com/): emphasizes conversational input, remembered preferences, an evolving plan and guidance spanning activity, nutrition, sleep and mood. These are product claims, not proof that its recommendations are more accurate.
- [App Store release history](https://apps.apple.com/gb/app/oxeai-ai-wellness-companion/id6755116409): documents direct Oura and WHOOP connections; device/source/metric sync status with last-sync times; manual refresh; hydration logging and grocery lists; a plans-first journal; weekly activity streaks and muscle maps.
- [Google Play listing and reviews](https://play.google.com/store/apps/details?id=com.oxeai.app): one visible review reports meal-plan generation failing, with a developer reply acknowledging the report. This is one anecdote and cannot establish an overall failure rate. It does mean we should not assume superior reliability from marketing alone.

The OxeAI wellness app and OxeFit's XS1/XP1 hardware ecosystem should not be conflated. Hardware-dependent protocol or real-time form capabilities were not counted as proven standalone phone advantages.

## What Fitzo already has

- Training and nutrition logs, Hinglish-aware AI prompts and voice extraction.
- Coach context containing recent workouts, nutrition, readiness, wearable readings, body measurements and the active split: `backend/src/services/contextPack.js`.
- Persistent chat history and a visible context summary: `backend/src/routes/ai.js` and `mobile/src/screens/member/AICoachScreen.tsx`.
- Today's workout intent, daily insight and quick actions on Home: `mobile/src/screens/member/HomeScreen.tsx`.
- Apple Health / Health Connect import of steps, active calories, resting heart rate and sleep. Manual sync, 30-day import and optional background sync are present: `mobile/src/services/healthService.ts` and `mobile/src/components/HealthImportSettings.tsx`. This code review does not certify background delivery on every device.
- Weekly workout goals, muscle visualization, workout sharing and buddy features. These should be improved rather than rebuilt merely because a competitor advertises them.

## Prioritized proposals

### 1. One useful Today screen

Keep today's workout, one nutrition action and a recovery check near the top. Put detailed charts and secondary features below. An example card is “Upper body · 45 minutes” with Start and Adjust actions. A nutrition card might show the remaining daily protein target and offer two suitable meal options. Always label incomplete food logs and missing health data accurately.

Build on the existing Home screen and workout intent. Do not replace the entire navigation or introduce more mandatory setup. Measure time to start a workout or log a meal, and successful completion of these tasks.

### 2. Coach responses that can become actions

The current chat endpoint returns text and saves messages. Add structured preview cards for actions such as changing today's session, adding a meal, or saving a preference. Require a user's confirmation before writing the change; support Undo. Keep direct logging available for people who prefer buttons.

Example: “I have 30 minutes today” produces a shorter workout preview and an Apply button. The model proposes the change; validated application logic performs it. Measure accepted suggestions and corrections, not just chat volume.

### 3. Consistent coach context and editable memory

First resolve a concrete source mismatch: the coach context reads targets from `fitness_profiles`, while the current nutrition editor saves to `nutrition_profiles` and the chat context-summary endpoint reads that latter table. Without reconciliation, the visible target and the model's target can disagree. The existence of two tables is confirmed in source; a specific affected production account was not tested.

Then add a “What your coach remembers” panel for meal preferences, available equipment, schedule and workout duration. Let users edit/delete facts. The current coach gets the last 10 stored messages and a profile summary field; no corresponding user-facing long-term-memory management flow was found. Avoid saving inferred sensitive facts automatically.

### 4. Health connections users can trust

Show last successful sync, the date of each reading, its source where available, and understandable missing-data states. “Importing enabled” alone does not establish that today's readings arrived. Keep one obvious Sync now action.

Fitzo already has imports and backfill controls. Add clear status before expanding integrations. Direct Oura/WHOOP connectors are a later opportunity if enough Fitzo users request them; confirm what existing HealthKit/Health Connect paths can already provide first. Measure successful syncs and the age of displayed readings.

### 5. Make recovery useful in the workout flow

There is already a backend readiness check-in based on energy, sleep and soreness. In the inspected mobile code, its API wrapper exists but no screen caller was found. Expose a short optional check-in near Start workout, then offer a explained adjustment that the user can accept or dismiss.

Do not present the subjective score as an HRV measurement or a validated medical readiness score. Missing sleep data must not become a zero. A lightweight check-in can be useful without adding wearable dependencies.

### 6. Practical meal planning and shopping

Build on the existing recipe and food-logging features with a small reusable meal plan: common Indian foods, vegetarian/non-vegetarian choices, preparation time, budget, substitutions and an optional grocery list. Make “repeat this meal” and changing a portion fast. Use the selected nutrition targets consistently; do not create separate AI-generated macro rules.

Start with a few repeatable meals rather than forcing a complex seven-day plan. Measure reuse, edits to suggested portions, and completed logs.

## What to defer

- Cognitive games and broad mental-wellness features: they expand the product well beyond Fitzo's current training and food workflow.
- Video form scoring: verify technical feasibility and accuracy before promising real-time correction. Fitzo's current form-analysis API takes an exercise name and description; it is not a demonstrated camera-based movement assessment.
- Additional composite scores without a clear action: more numbers can increase confusion.
- Chat-only navigation: structured workout entry must remain fast and usable when AI is unavailable.

## Suggested sequence

First: unify the coach's target source, simplify Today, and expose sync freshness. Next: optional recovery check-in, confirmed coach actions and editable preferences. Then: reusable meal plans and grocery lists. Reassess wearable expansion with actual user demand.

The code now contains provider routing and cost controls that were not part of the earlier Gemini investigation. Production reliability should be measured again before claiming that the earlier outage remains unresolved or that the newer code has fixed it. Essential logging and saved plans should remain available during an AI failure.

Success would mean fewer taps, fewer repeated explanations to the coach, more completed workouts/food logs and fewer confusing sync states. No retention or conversion uplift is claimed without testing.
