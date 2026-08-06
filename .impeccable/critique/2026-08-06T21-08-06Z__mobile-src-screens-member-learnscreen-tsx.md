---
target: Learn feature + Continue Learning card
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-06T21-08-06Z
slug: mobile-src-screens-member-learnscreen-tsx
---
Method: dual-agent (A: a85c2cc28 design review · B: a915160ab detector + mechanical evidence)

## Design Health Score — 16/40 (Poor)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | lesson/[id].tsx:156 guards on `loading \|\| !lesson` — failed fetch = permanent skeleton |
| 2 | Match System / Real World | 2 | "UNIT 3", "PATH", diamond shows global app XP misread as learning score |
| 3 | User Control and Freedom | 1 | No back in quiz, irreversible answers, 21/22 lessons unreachable, one inert button |
| 4 | Consistency and Standards | 2 | Markdown body sets no fontFamily — largest text block renders in OS system font |
| 5 | Error Prevention | 1 | finishQuiz swallows failures; Finish twice appends duplicate answer = permanent soft-lock |
| 6 | Recognition Rather Than Recall | 2 | Quiz header never shows lesson title |
| 7 | Flexibility and Efficiency | 1 | No search, filter, bookmark, jump-to-current, read-time |
| 8 | Aesthetic and Minimalist | 3 | Genuinely restrained — strongest dimension |
| 9 | Error Recovery | 1 | Tapping a locked lesson does nothing; no toast, no reason |
| 10 | Help and Documentation | 1 | Nothing explains lock rule, XP, or time cost |

## Design Specificity Verdict

Category-interchangeable. Rebrandable as compliance training unchanged. Unit 1 and Unit 8 render byte-identical. Two moments of authored personality total.

Detector: 0 findings exit 0, but tooling-fit result (web DOM ruleset vs React Native StyleSheet). Not evidence of quality. tsc --noEmit passes clean.

Strategic miss: curriculum has 2 India-relevant food references across 1,072 lines, one offering salmon as omega-3 source in an India-first app. No links from lessons to the food database, volume rule, or rest timer. Learn is an island. The warranted makeover is IA, not visual.

## Priority Issues

P0 — Lesson screen has no failure state and can trap the user. loadLesson catches to console.error only; guard leaves lesson null forever = permanent skeleton; header with close-X lives inside success branch so stuck state has no exit. Fix: hoist header, add error state + retry, retry finishQuiz from immutable finalAnswers.

P0 — Explanations exist in DB and are discarded. learn.js:118-123 strips correct and never returns explanation. App says you are wrong, shows right letter, refuses to say why. Fix: return explanations[] from /attempt, render under wrong answers. ~2 backend lines, ~10 UI lines.

P1 — List lies about every lesson and hides the actionable one. (a) GET /learn/lessons returns no questions field so `lesson.questions?.length || 5` yields literal 5 on all 22 cards; reader shows real count — adjacent screens contradict. (b) Nothing collapses, 22 cards, 1 tappable. (c) Always opens at scroll 0. Fix: jsonb_array_length in list query; collapse completed units; pin Continue bar.

P1 — Zero accessibility across 1,285 lines. No accessibilityRole/Label in LearnScreen.tsx or lesson/[id].tsx (grep-verified). Locked cards lack accessibilityState. Quiz radios expose no checked. Locked text ~2:1 contrast vs WCAG AA 4.5:1. Close button 32x32pt, no hitSlop, only exit from screen.

P2 — ProgressRing zero state renders empty. progress=0 + showLabel={learnStarted} = hollow 72x72 circle, arc fully offset, label suppressed. Hits exactly the new users the card was un-gated to reach. Second bug stacked: ring shows unit progress while tap opens a lesson. Fix: drop ring at zero, show solid menu-book icon tile.

## Persona Red Flags

Sam (screen reader): cannot use the feature. Locked cards announce as normal tappable content, 19 times. Quiz options give zero selection confirmation.

Riley (stress tester): airplane mode mid-quiz discards answers silently then soft-locks on retry. Empty questions array crashes at render. Quiz mode has no ScrollView.

Jordan (first-timer): first substantive fact is "0/22 Lessons — 0%". 21 locked cards, no explanation, tap does nothing.

## Minor Observations

Dead imports (Modal, Dimensions), dead refs (questionAnim, xpEarned, quizCompleted). Style keys xpIndicator/xpAmount now style a question count. xp_reward returned but never rendered. Failing awards 25% XP, never disclosed. learn.js:88 hardcodes current_streak: 0. ~12 magic numbers where exact tokens exist. Completing all 22 lessons makes the Home card silently vanish.

## Questions to Consider

Is "lessons in a list" right, vs a searchable topic-tagged library with optional guided track? Why is anything locked? Should Learn be a tab at all, or contextual links inside the rest timer and food log?
