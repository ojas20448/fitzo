# Post-workout sharing audit — 13 September 2026

**Implementation follow-up:** see [fixes and verification, 14 September](SHARE_SLIP_FIXES_2026-09-14.md). The findings and evidence below describe the pre-change audit.

**Verdict: the feature has a good visual foundation, but needs changes before the exported slips can be considered consistently accurate and reliable.** Receipt is the strongest design. Fix the data and selection problems first, then improve phone-size typography and validate native export.

This audit covers the workout-finish producer, recap/photo receipt, all five composer themes, content selection, muscle mapping, image capture, sharing fallbacks, privacy boundaries, and the weekly-recap reuse of this composer. Manager features are outside scope. This pass adds audit documentation and local evidence; it does not change application behavior.

## Evidence and limits

- Fresh run: **9 existing suites / 120 tests passed** for payloads, exercise mapping, selection, stores, formatting, PR normalization, photo transforms, and art selection.
- Fresh diagnostic run: **8 probes reproduced defects or misleading output**. These assertions describe the current broken behavior; their passing result does **not** mean those behaviors are acceptable.
- The probes execute real production helpers and inspect the returned React element content for Receipt and Spec. They do not simulate native layout or interaction.
- A temporary web harness bundled the real components and produced readable DOM content. Fresh screenshots could not be completed because the browser screenshot tool stalled. Photo positioning and native rendering were therefore not certified.
- Visual review used the repository's **existing reference captures**, checked against current layout/font values. Their synthetic data and capture date are not evidence of current end-to-end correctness. The contact sheet below is a new arrangement of those existing images, not new app screenshots.
- iPhone/Android PNG dimensions, memory use, camera behavior, share destinations, and screen readers still need native-device validation. No public post, production data write, or store build was performed.

Local evidence: [test results](C:/Users/PC/Documents/Code/Fitzo/output/share-audit/existing-tests.txt), [diagnostic results](C:/Users/PC/Documents/Code/Fitzo/output/share-audit/probe-results.txt), [diagnostic source](C:/Users/PC/Documents/Code/Fitzo/output/share-audit/shareAudit.probe.test.ts).

## Findings to fix first

### 1. Prefilled, unchecked sets count; completed bodyweight sets disappear

**Confirmed by code and probes.** The previous workout is copied into the next log with its weight/reps still filled and `completed: false`. Finishing requires only a nonempty exercise list. Both the recap totals and share exercise builder count any set with positive weight and reps, without checking completion.

- One unchecked, prefilled `80 kg × 10` set becomes **800 KG / 1 set** on the share data.
- One checked `0 kg × 15` push-up set produces **no share exercise**. A bodyweight-only session can consequently appear to contain zero sets.

The share builder deliberately matches the existing finish-loop predicate. Changing just that builder would introduce another disagreement: repair the finalized-set contract across workout persistence, totals, PR calculation, recap, and sharing together. Keep completed bodyweight sets/reps even when external-load volume is zero; do not invent the user's effective lifted body mass. Label the volume metric precisely.

Sources: [previous-workout prefill](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/WorkoutLogScreen.tsx:289), [finish and totals](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/WorkoutLogScreen.tsx:589), [share filtering](C:/Users/PC/Documents/Code/Fitzo/mobile/src/utils/buildShareExercises.ts:27).

### 2. The default receipt presents one exercise's volume as “Total” beside whole-workout stats

**Confirmed with the real Receipt element tree.** With no PR, the composer initially selects the exercise with the most volume. The headline then uses that exercise's volume, while the subtitle remains the workout title and the rows use the whole session's sets/duration. Receipt does not print the selected exercise's name.

Reproduction: a Push session has **4,000 KG / 10 sets**, including **2,400 KG / 4 sets** of bench press. The default receipt reads “PUSH”, “2,400 KG”, “Sets 10”, and “Total 2,400 KG”, without identifying Bench Press. A recipient reasonably reads this as the workout total.

Use the whole-session total by default for a workout receipt. If a single lift is the intended highlight, name it prominently, call its number “Bench press volume”, and distinguish session stats from selected-exercise stats. A PR-only receipt should also avoid calling a weight/reps record “Total”.

Sources: [default selection](C:/Users/PC/Documents/Code/Fitzo/mobile/src/utils/shareMoment.ts:111), [headline and session rows](C:/Users/PC/Documents/Code/Fitzo/mobile/src/utils/buildSharePayload.ts:64), [Receipt content](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/themes/Receipt.tsx:123).

### 3. Selecting a second PR switches to a theme that omits the PR details

**Confirmed by transition code and a two-PR render-content probe.** Scoreboard supports one selected item. Adding a second chip switches to Spec, but Spec only renders `payload.exercises`; it has no PR renderer. For two PR-only chips, the result contains the first record's number, with neither exercise name nor the second record.

Example: selecting Bench `82.5 kg × 8` and Overhead Press `42.5 kg × 8` produces a Spec card containing only the first number, the session subtitle, and FITZO. Both PRs remain in the payload.

The same omission affects weekly cards: Spec ignores the generic `rows` supplied by Stats. Switching an otherwise useful weekly recap to Spec strips its detailed stats.

Give themes an explicit content-support contract. Render all selected content types, or restrict/disable incompatible themes with a clear explanation. Preserve multi-selection when switching styles; switching to Scoreboard currently collapses it to the first chip without a notice.

Sources: [theme/chip transitions](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/ShareComposerScreen.tsx:392), [Spec exercise-only rendering](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/themes/Spec.tsx:53), [weekly source](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/StatsScreen.tsx:188).

### 4. Anatomy does not recognize several common catalog muscle names

**Confirmed by catalog scan and probes.** Share mapping only lowercases the exercise target. The catalog uses names such as `pectorals`, `delts`, and `upper back`, whereas the heatmap expects canonical keys such as `chest`, `shoulders`, and `back`.

- A session containing `pectorals: 4` and `delts: 6` is considered to have no usable muscle volume. Its Muscles chip is unavailable and Anatomy falls back to summary content.
- A mixed session can highlight recognized muscles while silently omitting other trained muscles.
- **63 of 142 catalog entries** have target strings outside the heatmap's supported-key list. This is a schema mismatch count, not a claim that all 63 should be mapped to one of the pictured muscles: categories such as cardiovascular/full body need an explicit policy.

Normalize aliases against a shared, explicit taxonomy. The backend already contains muscle normalization that can inform that mapping; add catalog-based coverage so test fixtures use real target values.

There is also a meaning problem: the shared heatmap component describes **weekly** volume zones, while post-workout sharing passes **one session's** sets. Its legend says “UNDER TARGET” and “GROWTH ZONE”. Replace those with descriptive session labels or actually supply and label weekly data. The current input does not establish those claims about progress.

Sources: [deriveMuscleVolume](C:/Users/PC/Documents/Code/Fitzo/mobile/src/utils/buildSharePayload.ts:121), [supported keys](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/format.ts:79), [catalog example](C:/Users/PC/Documents/Code/Fitzo/mobile/src/data/defaultExercises.ts:14), [weekly component semantics](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/AnatomyHeatmap.tsx:7), [share legend](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/themes/Anatomy.tsx:158).

## Design assessment

![Existing theme references arranged for this audit](C:/Users/PC/Documents/Code/Fitzo/output/share-audit/theme-reference-sheet.png)

The 1080-wide card shrinks to roughly one third of its design width when viewed at 360 logical pixels on a phone. Evaluate text at that size, not while zoomed into the export. Extra export pixels improve sharpness; they do not make proportionally tiny labels larger.

| Theme | Assessment | Changes needed |
| --- | --- | --- |
| Receipt | Strongest visual identity and clearest hierarchy. Cream paper, mono type, dividers and circled total feel distinctive. | Fix metric scope; explicitly name selected lifts; disclose omitted PRs; remove the visible white rectangle behind receipt art where it clashes with the paper. |
| Spec | Useful, restrained table for an exercise breakdown. | Add PR/generic-stat support; enlarge headings and top-set text; allow important long exercise names to wrap; use the available lower space more effectively. |
| Scoreboard | A clear big-number concept, but context is effectively unreadable at normal story size. | Largest typography revision needed: enlarge exercise name, NEW PR, previous value and brand. Keep the hero number strong without reducing everything else to microtext. |
| Anatomy | A useful visual summary when fed correct data. | Fix muscle aliases and session/weekly wording first; enlarge the legend and context; retain the existing honest fallback when data is absent. |
| Chalk | Distinct green notebook style; a good alternative to the receipt. | Increase row typography/contrast, improve vertical balance for short sessions, and disclose checklist overflow. |

**Specific typography issue:** Scoreboard uses `MICRO = 11` for contextual text on the 1080-wide canvas—about **3.7 logical pixels at a 360-wide display**. Spec's 20-unit column labels become about 6.7, its 28-unit top-set text about 9.3, and Anatomy’s 16-unit legend about 5.3. Receipt's scaled 45-unit row text becomes about 15. These are source-derived sizes, not device measurements.

Recommended first sizing pass: essential secondary labels around 36–42 canvas units, important exercise/data text around 42–48, followed by real 360/390-wide review. Do not apply those values blindly to every font. Spec's dim labels also need more contrast; adding a scrim over a photo does not solve the small-text problem.

Sources: [Scoreboard sizes](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/themes/Scoreboard.tsx:45), [Spec styles](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/themes/Spec.tsx:170), [Anatomy legend](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/themes/Anatomy.tsx:320), [Receipt rows](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/themes/Receipt.tsx:252).

## Capture and interaction issues

### 5. There are two separate photo/share flows, and the main action drops the edited photo

**Confirmed by state and navigation flow; device interaction untested.** Recap opens the camera automatically after about 600 ms, including requesting camera permission. The photo and draggable receipt then live only in that recap screen. Its primary “SHARE TO STORY” action passes the workout session into the separate composer, which starts with no background. The user must use the secondary “SHARE PHOTO CARD” action to export the photo they just prepared.

Consolidate into one clear path: finish workout → recap → optional photo/style editing → share the displayed result. Make taking a photo an explicit action, carry any chosen photo into the composer, and label navigation versus export accurately. The current export opens the general OS share sheet; it is not a direct Instagram Story integration. Expo documents the native file-sharing behavior in [Sharing](https://docs.expo.dev/versions/v54.0.0/sdk/sharing/).

Sources: [automatic camera](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/WorkoutRecapScreen.tsx:136), [session-only handoff](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/WorkoutRecapScreen.tsx:186), [two share actions](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/WorkoutRecapScreen.tsx:345), [fresh composer background](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/ShareComposerScreen.tsx:57).

### 6. Native capture size is not actually constrained to 1080 × 1920 pixels

**Source-backed risk; actual PNGs and memory not measured.** The hidden card is 1080 × 1920 React Native layout units. `captureRef` has no explicit output-size handling. The installed iOS implementation defaults to the view bounds and creates its context with the device scale. Layout and physical pixels are different, as described by React Native's [PixelRatio documentation](https://reactnative.dev/docs/pixelratio).

At scale 3, this implies an output around **3240 × 5760**, approximately 18.7 million pixels and **71 MiB for one RGBA buffer**, before the background photo, additional copies and PNG encoding. That is nine times the pixels of the intended 1080 × 1920 image. Treat this as a calculation from the native implementation, not an observed crash or memory measurement.

Choose and verify a deliberate export-resolution strategy across iOS and Android; avoid merely passing dimensions without checking each platform's sizing semantics. Release temporary captures after sharing. Neither capture path currently calls `releaseCapture`. The older photo-card path also captures a screen-sized flex container, so its aspect ratio depends on the device rather than using the composer's 9:16 frame.

Sources: [capture target](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/ShareComposerScreen.tsx:445), [capture options](C:/Users/PC/Documents/Code/Fitzo/mobile/src/hooks/useShareCapture.ts:33), [installed iOS capture sizing](C:/Users/PC/Documents/Code/Fitzo/mobile/node_modules/react-native-view-shot/ios/RNViewShot.mm:95), [older photo capture](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/WorkoutRecapScreen.tsx:149).

### 7. Image readiness and sharing failures need explicit states

**Confirmed missing guards; resulting timing failures require device reproduction.** The composer correctly waits for a newly captured background's `onLoad` from the hidden capture tree. However:

- The readiness flag is reset for a new photo, but not when changing themes remounts that image. A previously ready flag can cover a newly mounted capture tree.
- `CardBackground` has no `onError` handling. A failed image load leaves “PREPARING PHOTO” active until the photo is removed or another action bypasses it.
- Receipt's art has no equivalent readiness gate. A fixed two frames plus 180 ms is not a general image-load guarantee.
- Theme/chip editing remains enabled during that capture wait, so the payload can change between tapping Share and capturing it.
- On capture/share failure, the hook silently attempts a text share; failure of that attempt is swallowed. The weekly fallback includes AI summary prose that is absent from the composed image, so the fallback content is different from the image preview. The OS sheet still requires the user's action; this is a preview/expectation problem, not automatic public disclosure.

Track readiness for the active image/theme generation, handle load errors with retry/remove feedback, and freeze a snapshot of the chosen content during export. Show a clear failure with retry and an explicit text-sharing option instead of silently substituting another format.

Sources: [load gate](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/ShareComposerScreen.tsx:195), [photo reset](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/ShareComposerScreen.tsx:213), [background image](C:/Users/PC/Documents/Code/Fitzo/mobile/src/components/share/CardBackground.tsx), [capture fallback](C:/Users/PC/Documents/Code/Fitzo/mobile/src/hooks/useShareCapture.ts:29), [weekly fallback text](C:/Users/PC/Documents/Code/Fitzo/mobile/src/screens/member/StatsScreen.tsx:200).

## Smaller correctness and completeness issues

| Issue | Evidence and recommendation |
| --- | --- |
| “Top set” ignores reps when weights tie | Probe: `80 × 5`, then `80 × 10`, reports `80 × 5`. Define the tie-break rule and use higher reps for equal weight. Source: `buildShareExercises.ts:41`. |
| Rounded rows can disagree with the visible total | Probe: raw volumes 135, 82.5, 87.5 yield headline 305 KG, while separately rounded displayed rows sum to 306. Preserve useful decimal precision or make rounding explicit. Raw summation itself is correct. Sources: `buildSharePayload.ts:62`, `Spec.tsx:102`. |
| Selected content can be silently truncated | Receipt caps PRs at 3 and Chalk summary rows at 6; neither shows a remaining-item count. Spec already shows `+N MORE` after 8 exercises. Use an overflow count, selection limit, or additional cards. |
| Recap and composer do not share every stat | Recap fetches the streak, but the workout's stored `LastSession` never receives it, so its optional composer streak row normally cannot appear. Pass one consistent recap snapshot if this stat should be shared. |
| Old recap date can differ from the workout date | The photo receipt uses the current date at rendering, while the composer uses the session completion timestamp. Use the same persisted completion timestamp. |
| Screen-reader behavior is unverified | The hidden capture tree uses `pointerEvents="none"` but lacks explicit accessibility hiding. That alone does not remove it from assistive navigation. Several icon/actions lack useful labels/roles. Hide the duplicate tree from assistive technology and run VoiceOver/TalkBack. |
| Old photo receipt has no clear long-content budget | Long names/many PRs can exceed the screen-sized capture region. Validate on short phones and with large system font settings; move export into the bounded composer rather than maintaining two layout rules. |
| Historical re-sharing is limited | Session sharing relies on a memory-only recent-session store and a two-hour stale check. After expiry/restart the composer has no session to use. If old workouts must be shareable, construct a fresh source from saved workout details. This is a capability gap, not a persistence defect. |

## What is already good

- All five themes share a typed payload and an exhaustive theme registry.
- New composer cards consistently use a 9:16 design canvas; preview/background transforms use normalized coordinates with dedicated tests.
- The new capture hook prevents duplicate simultaneous share calls, and the initial photo load gate observes the actual capture tree rather than only the preview.
- Volume calculations preserve raw values until formatting and account for unilateral work consistently. The remaining issue is the finalized-set contract and displayed rounding, not those arithmetic improvements.
- PR normalization accepts both backend response shapes for the composer.
- Required fonts are loaded at the app entry; the audit did not identify a missing-font initialization defect.
- Session/share stores are cleared on authentication identity changes. Cards do not automatically include the user's name, email or gym. User-entered titles and optional photos remain visible by design.
- The inspected sharing path hands a local image to the OS share sheet. It does not itself automatically upload or publish the image.

## Recommended implementation and verification order

1. Establish the finalized-set contract, including bodyweight exercises, and make persisted totals/PRs/recap/share agree. Cover prefilled unchecked, partly completed, all bodyweight and unilateral sessions.
2. Fix selected-versus-session labeling, multi-PR rendering and canonical muscle mapping. Add outcome tests for each theme/content combination, rather than only testing payload construction.
3. Consolidate the photo/share path; add accurate state/error handling and a stable capture snapshot.
4. Improve Scoreboard context first, then Spec/Anatomy/Chalk secondary text. Review all themes at actual phone display width with ordinary, empty, long-name, many-PR and weekly cases.
5. On a real iPhone and Android device, inspect exported PNG dimensions, sharpness, missing layers, photo crop/rotation, peak memory and temporary-file cleanup. Test cold-load immediate share, switching themes after a photo, repeated/cancelled shares, denied permissions, and unavailable/erroring share destinations. Verify Instagram/WhatsApp/gallery behavior and actual story UI overlap where those destinations are installed.
6. Run VoiceOver/TalkBack through recap, composer, theme choices and errors. A bitmap's information should also be available as accessible text in the composing experience.

The first four findings are reproduced correctness problems. Capture/performance and assistive-technology concerns should remain open until real-device evidence resolves them. Passing the existing unit suites is useful but insufficient to approve this feature end to end.

## Reproducing the audit probes

The audit-only harness and probes are preserved under `output/share-audit/`, which is ignored by Git. To repeat the probes, copy `shareAudit.probe.test.ts` into `mobile/.dtest/` and run from `mobile`:

```powershell
npx jest --runInBand --testMatch '**/.dtest/shareAudit.probe.test.ts'
```

These are diagnostic assertions of current behavior. Convert them into assertions of the desired behavior when implementing fixes; do not add them unchanged to the permanent regression suite. The temporary public web entry point was removed after this audit.
