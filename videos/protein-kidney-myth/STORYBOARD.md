---
format: 1080x1920
duration: 30s
message: "Protein doesn't damage healthy kidneys — that advice was written for people who already have kidney disease"
arc: "Agree → Artefact → Loop opens → TURN → Origin → Evidence → Caveat → Bonus truth → The real gap → CTA"
audience: "Indians who train, and the relatives who forward them health advice"
mode: autonomous
music: none
---

## Video direction

**The two-register system is the argument.** Broadside ships two surfaces — ink-black `#111111` and fire-orange `#E85D26`. This video assigns them meaning and never breaks the assignment:

- **Ink-black ground, cream type = the myth's world.** Frames 1–3 live entirely here. No orange appears, not even as an accent. The viewer is inside the forward.
- **Frame 4 inverts the whole canvas** — fire-orange ground, ink-black type. This is the only full inversion in the video, and it lands on the turn.
- **Frames 5–10 return to ink-black, but orange is now unlocked** as the colour of the correction. It marks exactly one element per frame — the corrected clause, the number, the CTA. Never decoration.

Because the flip is spent once, it cannot be diluted. Do not introduce orange before frame 4 for visual interest.

**Muted-first typography.** Instagram plays this silent, so every frame states its whole idea in type. Display lines use the `h1`/`h2` ramp lowercase; nothing below the `body` step carries a claim. Max ~6 words per line, max 3 lines per frame. A viewer who watches at thumbnail size must still get frames 1, 4, 6 and 10.

**Cutting.** Hard `cut` everywhere except frame 4, which arrives on the inversion itself. Reels reward abrupt; crossfades read as slow and lose the scroll. Each frame develops across its full 3s — reveal on entry, settle, then a small late accent — never front-load and freeze.

**Safe area.** Instagram overlays the bottom ~14% (caption, actions) and the top ~8%. All type sits inside the middle 78% of the 1920px height: nothing meaningful above y=155 or below y=1650.

**Restraint.** No red X / green tick, no talking head, no before/after bodies, no stock gym imagery. The visual world is documents — a chat bubble, a prescription, a lab line, a number. This is a video about a piece of paper being misread.

---

## Frame 1 — Your uncle is right

- status: animated
- src: compositions/frames/01-uncle-is-right.html
- duration: 3s
- transition_in: cut
- scene: "The hook agrees with the myth — the pattern interrupt."
- focal: the line "your uncle is right." set at hero scale
- roles: [hero-line, sub-line]
- blueprint: kinetic-type-beats

The single most important frame. Every other video on this subject opens by
telling you something is wrong; this one concedes. Agreement is what stops the
thumb, because it is not what a myth-bust is supposed to sound like.

The sub-line does the real work: it states the myth as fact, in the video's own
voice, with no hedging. The viewer should be briefly unsure what kind of video
this is. That uncertainty is the retention device.

**Shot sequence**
- 0.0–0.6s — `kinetic-beat-slam`: "your uncle is right." arrives one word at a
  time from below, weight 900, lowercase, filling the frame width. Ink-black
  ground, cream type. No orange.
- 0.6–1.4s — hold. The line is alone on the canvas. Let it be uncomfortable.
- 1.4–2.2s — `discrete-text-sequence`: the sub-line fades up beneath a 1px
  cream hairline — "protein does damage kidneys." Set in `lead`, cream-muted.
- 2.2–3.0s — settle; a 2% slow scale-up on the hero line only, so the frame is
  still moving when it cuts.

## Frame 2 — The forward

- status: animated
- src: compositions/frames/02-the-forward.html
- duration: 3s
- transition_in: cut
- scene: "The artefact itself — the WhatsApp message, forwarded many times."
- focal: a single chat bubble bearing the myth
- roles: [forwarded-label, bubble, timestamp]
- blueprint: typewriter-reveal

The thing the whole video is about, shown rather than described. It must read
as a real forward, not a designed graphic: the "Forwarded many times" label,
the folded-arrow glyph, the 🙏, a plausible timestamp.

Rendered in the video's own palette rather than WhatsApp green — this is the
message as the video sees it, and a screenshot-accurate green would drag the
frame out of the design system for no gain.

**Shot sequence**
- 0.0–0.5s — the bubble's rounded rectangle draws in from its top-left corner,
  `waterfall-entry`, on ink-black.
- 0.5–0.9s — the `label`-step chrome "↱↱ FORWARDED MANY TIMES" fades in above
  it, IBM Plex Mono, uppercase, cream-hint.
- 0.9–2.4s — `typewriter-reveal`: the message types out at a human, slightly
  uneven cadence — "protein powder se kidney fail ho jaata hai 🙏". This is the
  frame's whole runtime; do not rush it to a hold.
- 2.4–3.0s — a timestamp and double-tick settle in the bubble's bottom-right,
  cream-hint. The bubble nudges down 4px as if delivered.

## Frame 3 — That advice is real

- status: animated
- src: compositions/frames/03-advice-is-real.html
- duration: 3s
- transition_in: cut
- scene: "The loop opens — the video concedes the advice exists."
- focal: the line "that advice is real."
- roles: [hero-line, sub-line]
- blueprint: kinetic-type-beats

The second concession, and the one that sets the trap. The viewer now expects
the video to defend the myth. Instead this frame quietly plants the word that
frame 4 detonates: *a doctor wrote it.*

Still no orange. The frame must feel like a continuation of the myth's world so
that frame 4 reads as a rupture rather than a transition.

**Shot sequence**
- 0.0–0.7s — "that advice is real." rises as one block, `kinetic-beat-slam`,
  cream on ink-black, slightly smaller than frame 1's hero so the video feels
  like it is leaning in rather than shouting.
- 0.7–1.6s — hold.
- 1.6–2.4s — sub-line fades up: "a doctor wrote it." — `lead`, cream-muted.
- 2.4–3.0s — a thin cream hairline draws left-to-right beneath the sub-line
  (`svg-path-draw`), pointing forward. The unfinished gesture is the loop.

## Frame 4 — The turn

- status: animated
- src: compositions/frames/04-the-turn.html
- duration: 3s
- transition_in: cut
- scene: "THE TURN — the prescription, and the patient it was written for."
- focal: the clause "for people who already have kidney disease."
- roles: [prescription-slip, patient-line, sub-line]
- blueprint: titlecard-reveal

The pivot the entire concept exists to deliver. The canvas inverts — fire-orange
ground, ink-black type — and it is the only time in the video this happens.

The visual idea: the advice is a real prescription, and the patient name on it
is not yours. Nothing is debunked. The scope is simply corrected, which is both
more honest and more persuasive than contradiction.

**Shot sequence**
- 0.0–0.4s — `theme-crossfade-morph`: the entire canvas inverts to fire-orange
  in a single hard step, not a fade. The cut and the flip land together.
- 0.4–1.2s — a prescription slip assembles at centre — a paper plane in cream,
  a hairline rule, a mono "Rx" glyph, two ruled lines of illegible script.
  `waterfall-entry`, ink-black ink on the orange field.
- 1.2–2.2s — the clause "for people who already have kidney disease." arrives
  on the slip's ruled line at `h2`, ink-black, weight 900. Word-by-word, fast.
- 2.2–3.0s — "not for you." stamps in beneath, rotated ~3°, `spring-pop-entrance`,
  as if pressed onto the paper. It is the last thing on screen before the cut.

## Frame 5 — How it spread

- status: animated
- src: compositions/frames/05-how-it-spread.html
- duration: 3s
- transition_in: cut
- scene: "Advice for the sick became a warning for everyone."
- focal: the transformation of one phrase into another
- roles: [phrase-before, arrow, phrase-after]
- blueprint: comparison-split

Explains *why* the myth exists, which is what makes it stick. People forget
corrections and remember origins. One sentence mutating into another is the
whole idea; no diagram, no crowd, no arrows-of-transmission cliché.

Back on ink-black. Orange returns, but only on the second phrase — the
distortion — so the accent now reads as "this is the part that changed."

**Shot sequence**
- 0.0–0.8s — "advice for the sick" fades up in the frame's upper half, cream,
  `h2`, lowercase.
- 0.8–1.4s — a vertical hairline draws downward from it (`svg-path-draw`),
  cream-hint — the act of forwarding.
- 1.4–2.4s — "became a warning for everyone." lands in the lower half in
  fire-orange, `kinetic-beat-slam`, one word at a time and slightly larger than
  the first phrase. The growth is the point.
- 2.4–3.0s — the first phrase dims to cream-hint. The distortion outlives the
  original.

## Frame 6 — What the evidence says

- status: animated
- src: compositions/frames/06-no-damage-found.html
- duration: 3s
- transition_in: cut
- scene: "Healthy kidneys, high protein — no damage found."
- focal: the phrase "no damage found."
- roles: [condition-line, verdict-line, source-note]
- blueprint: kinetic-type-beats

The evidence beat, worded with deliberate restraint. It says **no damage
found**, never *protein is safe* — that is what the research supports for
healthy kidneys, and the narrower claim is the defensible one. Do not upgrade
this wording for punch.

The two conditions are stated first and the verdict second, so the claim is
never separable from the population it applies to. That ordering is a
correctness requirement, not a stylistic choice.

**Shot sequence**
- 0.0–0.9s — two conditions stack in, `discrete-text-sequence`, cream `h3`:
  "healthy kidneys." then "high protein." Each on its own line, ~0.3s apart.
- 0.9–1.9s — a cream hairline draws full-width beneath them, then "no damage
  found." lands in fire-orange at `h1` scale, `kinetic-beat-slam`.
- 1.9–2.6s — the source note fades in at `caption`, cream-hint:
  "long-term studies · trained adults".
- 2.6–3.0s — hold, with a 1% scale settle on the verdict.

## Frame 7 — Who this isn't for

- status: animated
- src: compositions/frames/07-ask-your-doctor.html
- duration: 3s
- transition_in: cut
- scene: "The caveat, at full size — kidney disease, diabetes, high BP: ask your doctor."
- focal: the instruction "then ask your doctor."
- roles: [conditions-list, instruction, sub-line]
- blueprint: kinetic-type-beats

**This frame is not cuttable and not shrinkable.** Someone with early kidney
disease will watch this video, and it must never read as permission to ignore
their doctor. It is set at the same scale as every other claim — not as fine
print, not as a footer, not held for less time.

It is also, not coincidentally, the most trustworthy beat in the piece. A video
that names who it is *not* for is the one people believe. Treat it as a
strength, not an obligation.

**Shot sequence**
- 0.0–1.0s — three conditions arrive as separate lines, `waterfall-entry`,
  cream `h3`: "kidney disease?" / "diabetes?" / "high bp?" — ~0.3s apart, each
  a question, stacked left-aligned.
- 1.0–1.9s — "then ask your doctor." lands in fire-orange at `h2`,
  `kinetic-beat-slam`. Full weight. Same visual authority as frame 6's verdict.
- 1.9–2.6s — sub-line fades up, cream-muted `body`: "this one's not for you
  either." — the callback to frame 4, and the video's honesty in one line.
- 2.6–3.0s — hold. No motion. The stillness is the tone.

## Frame 8 — The blood-test trap

- status: animated
- src: compositions/frames/08-creatine-creatinine.html
- duration: 3s
- transition_in: cut
- scene: "Creatine raises creatinine — a marker, not damage."
- focal: the near-identical pair of words
- roles: [word-a, word-b, verdict]
- blueprint: comparison-split

The bonus truth, and the frame most likely to earn a comment or a share —
it explains why a lifter's blood report can look alarming when nothing is
wrong. Two words differing by three letters is the entire visual: set them one
above the other so the eye does the comparison unaided.

**Shot sequence**
- 0.0–0.7s — "creatine" fades up, cream `h2`, lowercase, centred.
- 0.7–1.4s — "creatinine" lands directly beneath it, same size and position,
  `scale-swap-transition` — the shared letters hold their place so the word
  appears to *grow* the extra "in" rather than replace itself. The near-miss is
  the joke and the lesson.
- 1.4–2.3s — the inserted letters flash fire-orange, then settle to cream.
  A `label`-step mono line appears: "ONE IS A SUPPLEMENT · ONE IS A LAB VALUE".
- 2.3–3.0s — "a marker. not damage." lands beneath in fire-orange at `h3`,
  `kinetic-beat-slam`.

## Frame 9 — The real problem

- status: animated
- src: compositions/frames/09-miss-it-by-half.html
- duration: 3s
- transition_in: cut
- scene: "Most Indians don't overshoot protein — they miss it by half."
- focal: a bar that fills to roughly half and stops
- roles: [target-bar, actual-fill, verdict-line]
- blueprint: dataviz-countup

Reframes the entire anxiety. The myth warns about too much; the actual failure
is far too little. A bar that visibly stops halfway makes the point faster than
any number, and the frame carries the gap the CTA then answers.

Deliberately no absolute grams on screen — the honest figure depends on
bodyweight, and a specific number invites an argument that distracts from the
point. The bar shows a proportion, which is the claim being made.

**Shot sequence**
- 0.0–0.6s — "most indians don't overshoot protein." fades up top, cream `h3`.
- 0.6–1.0s — an empty full-width bar outline draws in, cream hairline, with a
  mono "TARGET" label at its right end.
- 1.0–2.0s — `stat-bars-and-fills`: the bar fills fire-orange from the left and
  **stops hard at ~50%**, with a small overshoot-and-settle so the stop reads as
  a failure to arrive rather than a design choice.
- 2.0–3.0s — "they miss it by half." lands beneath in cream `h2`,
  `kinetic-beat-slam`. The empty half of the bar stays visible under it.

## Frame 10 — Fitzo

- status: animated
- src: compositions/frames/10-cta.html
- duration: 3s
- transition_in: cut
- scene: "CTA — Fitzo, and the invitation to name the next forward."
- focal: the Fitzo wordmark
- roles: [wordmark, tagline, engagement-prompt]
- blueprint: cta-morph-press

The only frame that is about the app, and it arrives having earned it: the
video just showed a gap, and this is the tool for closing it. The engagement
prompt is last so the final held image is a question — the thing that drives
comments.

Brand lands here: pure black ground rather than ink-black, white wordmark, in
Fitzo's own register.

**Shot sequence**
- 0.0–0.5s — ground deepens from ink-black `#111111` to pure `#000000` —
  a subtle handover into the brand's own black.
- 0.5–1.2s — "fitzo" assembles centre at `h1`, cream-to-white,
  `logo-assemble-lockup` feel: letters settle in from a slight vertical scatter.
- 1.2–2.0s — tagline fades beneath, `lead`, cream-muted: "track what you
  actually eat."
- 2.0–3.0s — the engagement prompt lands at the lower third in fire-orange
  `h3`: "which forward next? 👇" with a soft `spring-pop-entrance`. Hold to the
  end — this is the frame people pause on to comment.
