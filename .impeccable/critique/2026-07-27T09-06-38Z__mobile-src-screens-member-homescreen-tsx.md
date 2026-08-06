---
target: Fitzo Home + Learn + Continuing Learning card
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-07-27T09-06-38Z
slug: mobile-src-screens-member-homescreen-tsx
---
Method: dual-agent (A: design review · B: detector/mechanical evidence)

Target: Fitzo mobile — Home tab, Learn tab, "Continuing Learning" card, tab bar.
Mode: Operate (app UI; scanability + native expectations outrank expression).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Swallowed catches; dead network looks identical to "no data yet" |
| 2 | Match System / Real World | 2 | "Continuing Learning" isn't English; "LOG WORKOUT" doesn't log a workout |
| 3 | User Control and Freedom | 2 | One-tap irreversible intent write, no undo; locked lessons silently do nothing |
| 4 | Consistency and Standards | 2 | sectionTitle defined 18x; headerTitle 5 ways; 7 progress-bar implementations |
| 5 | Error Prevention | 2 | No guard on progress unit (0-1 vs 0-100) interpolated into a width string |
| 6 | Recognition Rather Than Recall | 3 | Unlabeled 20px glyphs; learning card shows no position in the path |
| 7 | Flexibility and Efficiency | 2 | FAB and on-screen button share a label but route to different screens |
| 8 | Aesthetic and Minimalist Design | 3 | Handsome direction, but charts inject 3 hues into a monochrome system |
| 9 | Error Recovery | 1 | Zero error UI on either screen; EmptyState ships error/offline variants, unused |
| 10 | Help and Documentation | 1 | No onboarding, no XP explanation, "split" undefined, no crowd legend |
| **Total** | | **20/40** | **Acceptable (low end)** |

Converted for the user's request: **5.5/10 overall — UI 6.5, UX 4.5.**

## Design Specificity Verdict

LLM assessment: a well-executed generic dark SaaS shell with fitness data poured in. Strip the copy and it could be a crypto portfolio app — identical glass cards, identical borders, identical section titles. The two genuinely domain-authored elements (three-state intent card, crowd occupancy bar) carry the same visual weight as everything else. The streak — the only object with real emotional charge — is a 24px chip in the least reachable corner.

Deterministic scan: detect.mjs returned [] / exit 0 on all targets. This is a NON-RESULT, not a clean bill. Every rule engine is web-scoped (HTML semantics, CSS units, :hover, media queries, CSP); the text analyzer explicitly excludes .tsx. No deterministic evidence was contributed; all measurements below were hand-computed.

Visual overlays: not applicable — native RN target, no meaningful URL to inspect.

## What's Working

1. Three-state intent card — collapses "what am I training today" into one tap, adapts its label to why it's suggesting, degrades to "Set up your split". Real product design.
2. Cold-start message ladder (2s -> 6s -> 15s -> "Server is waking up") — converts unexplained latency into a narrated process. Defuses the worst mobile emotional valley.
3. Zero allowFontScaling={false} anywhere — Dynamic Type is respected app-wide. Rare and correct.

## Priority Issues

[P0] Both screens fail silently and permanently on network error. No `error` state variable exists in either file. HomeScreen renders a populated-looking shell of zeros; LearnScreen renders a completely blank ScrollView where failure is byte-identical to empty. api.ts returns `progress: {}` on the offline path, which is truthy, so LearnScreen renders "undefined/12 Lessons" and width:"NaN%". EmptyState already ships 'error' and 'offline' variants and is imported but never rendered.

[P0] No primary action on Home. Two byte-identical white 64px CTAs sit side by side, plus a white FAB, plus a white "Let's Go" pill. Four co-equal primaries. `secondaryActionBtn` is already defined in the file and never used.

[P1] "LOG WORKOUT" routes to /workout-intent (planning) while the FAB's "Log Workout" routes to /log/workout. Same words, two destinations.

[P1] Touch targets below the 44pt floor, none with hitSlop (0 occurrences anywhere): intentChangeBtn 26x26 (also the only icon-only control with no accessibilityLabel — fails both checks), three viewAllLink taps at ~12pt, "Let's Go" 29pt, checkinBadge 40x40.

[P1] QR check-in — the most time-boxed one-handed action in the product — is a 40x40 unlabeled icon at maximum thumb distance, while the tab bar's prime thumb real estate holds a generic +.

[P2] Contrast: text.subtle = 4.43:1 on #000000, missing AA body by 0.07 (used for locked lesson descriptions at 12px). colors.inactive = 2.48:1, failing even the 3:1 non-text minimum. The theme comment claims "contrast ratios improved for accessibility"; these two were not brought over the line.

[P2] Accessibility: HomeScreen 9/17 interactive elements lack accessibilityLabel, 13/17 lack role, 17/17 lack hint. profile.tsx 14/15 unlabeled. LearnScreen 1/1.

[P2] Design tokens not enforced: sectionTitle defined 18 times, sectionHeader 9 times, progress bar 7 times across 4 different height/radius pairs, glass-card chrome hand-rolled 7 times. commonStyles has exactly 2 consumers in the whole codebase; commonStyles.pill/.primaryButton/.secondaryButton/.labelUppercase are imported by nothing. 23 of 95 HomeScreen style keys are dead.

## The "Continuing Learning" Card

1. Grammar: "Continuing Learning" -> "Continue Learning". Better, drop the section header entirely; it wraps a single row.
2. Kill the empty 96x80 thumbnail (5% white box holding an 8% white circle and an 11px glyph — a grey smudge on black). Replace with a circular progress ring around a live number. Same footprint, real information, monochrome, product-specific.
3. No verb. Add a RESUME pill — tapHintPill already exists in the file.
4. Label the bar: "{n}% complete · {m} questions left". Clamp the fill with Math.max(pct, 4); gymStatusBarFill already does this because a 3% bar renders as an invisible nub.
5. Normalize the progress unit at the boundary — it's an untyped number interpolated straight into a percent string.
6. Padding is spacing.sm (8) where every neighbouring card uses 16. Reads cheaper than its siblings.
7. No pressed state — bare Pressable with a static style. gymCardPressed is defined in this exact file and unused.
8. No numberOfLines on the title; long names desync from the fixed 80px thumbnail. "{lesson} • {topic}" renders a dangling bullet when either is empty.
9. It sits dead last, ~2 screens down, above a 120px spacer. A resume prompt nobody scrolls to isn't a feature.
10. `progress > 0` hides it from brand-new users — exactly the people who need to discover that Fitzo teaches. Invert: show the first lesson with a START pill.

## Persona Red Flags

Casey (one-handed, interrupted, sweaty): QR check-in at max thumb distance below HIG minimum; three ~12x60px "VIEW ALL" taps unhittable with damp hands; 26px intentChangeBtn adjacent to a button that writes irreversible state; two identical white buttons resolved by whichever is nearer the thumb; useFocusEffect refetches with no scroll restoration, so any interruption returns her to the top; the learning card is below 1.5 viewport heights.

Jordan (first-timer): Learn tab renders a black rectangle on day one — no empty state, no CTA. "CONSISTENCY MATTERS." above his name on first launch reads as a lecture. "Set up your split" — "split" is undefined jargon. XP diamond with no explanation of what it buys. Locked lessons are disabled with no feedback and no unlock message. EmptyState variant='welcome' exists with correct copy, is imported into HomeScreen, and is never rendered — the onboarding moment was designed then not wired up.

## Minor Observations

- tabBar height hardcoded to 90 with no safe-area inset; tabLabel is 9px (below the smallest token, and below Lexend's practical legibility floor). At large Dynamic Type the bar clips.
- Time-based greeting is a static const with a "// Time-based greeting" comment above it.
- "N of your gym squads worked out today" — no denominator follows "of"; count isn't friends-only.
- StatsScreen is 761 lines behind href:null with one hidden entry point.
- router.push('/(tabs)/learn') pushes a tab route onto the stack instead of switching tabs, duplicating the screen.
- #FF6B35 on the streak flame is the only non-greyscale literal in HomeScreen and exists nowhere in the theme.
- Two empty style objects (lessonCard: {}, lessonCardCompleted: {}) still passed into style arrays.
- Screenshots are stale: tab reads "Buddies", code says "Friends"; the mock's full-bleed 48px intent headline is gone from current code, and the screen lost its only visual anchor without a replacement.

## Questions to Consider

1. If the streak is the product, why is it 24 pixels? What would Home look like if the streak were the composition rather than a chip?
2. What is Home for at 6:47am versus 8:15pm? The backend already computes suggestionReason; the layout ignores context entirely.
3. Would you ship the Continuing Learning card if Learn were the whole app? It's a grey box, an unlabeled bar, and no verb.
