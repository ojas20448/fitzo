# Hyperframes Composition Brief: Fitzo

## Objective
Create a short launch-style brag video for Fitzo — the gym companion for Indian lifters with an AI coach that actually reads the user's data.

## Output
- Composition directory: `brag-output-2026-07-17-144626/composition/`
- Rendered video: `brag-output-2026-07-17-144626/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: `C:\Users\PC\Documents\Code\Fitzo`
- Primary files read: `mobile/src/styles/theme.ts` (Onyx & Snow tokens), `mobile/src/components/ReceiptShareCard.tsx`, `mobile/src/components/AnatomyHeatmap.tsx`, website `Fitzo web/fitzo` (hero copy), `docs/CONTEXT.md`
- Product name: Fitzo
- Tagline / strongest claim: "The coach that actually knows you."
- Key UI or visual moments to recreate: (1) the thermal receipt share card, (2) the anatomy heatmap with growth zones, (3) the coach chat with a data-specific reply
- Copy that must appear verbatim:
  - "The coach that actually knows you."
  - "The weight of 17 auto-rickshaws"
  - "See where you're growing."
  - "Early access → fitzoapp.in"

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium product film in Onyx & Snow — PUSH-style confidence with Indian personality
- Interpretation: longer settled holds, monochrome restraint; energy comes from precise motion (printing, typing, counting, muscle flips) synced to beats — never from flashing text or color noise.
- Angle: Every fitness app claims an "AI coach." Fitzo's actually looks at your data — so the video is built from receipts: the app printing what it knows about you (weight moved as auto-rickshaws, muscles in growth zones, a coach that calls out 12 skipped leg days).
- Hook: a cream thermal receipt prints down into a black frame — printer ticks, mono type, the auto-rickshaw line.
- Outro / punchline: F-mark stamps in, "The coach that actually knows you." → "Early access → fitzoapp.in"
- Avoid: generic SaaS language, abstract filler visuals, unrelated visual redesign, color noise on the black canvas.

## Visual Identity
- Background: #000000 (surfaces #0A0A0A; glass rgba(255,255,255,0.03–0.10) with 1px rgba(255,255,255,0.10) borders)
- Text: #FFFFFF primary; rgba(255,255,255,0.7) secondary; rgba(255,255,255,0.55) muted
- Accent: white-first; functional only — growth green #34D159, under-target amber #FDC90D
- Receipt: cream #F1EEE6 paper, ink #141414, pen blue #2B5CE6, slight −0.6° tilt, monospace type
- Display font: Lexend (Google Font; 700/500, tight tracking −0.02em). Body: Lexend 400. Receipt: monospace (VT323 or ui-monospace fallback).
- Visual references: geometric F logo (black rounded square, white angular F — from website `components/FitzoLogo.tsx` SVG path `M25 80V20H75L65 35H42V44H62L55 57H42V80H25Z`), anatomy heatmap muscle paths (from `mobile/src/components/AnatomyHeatmap.tsx`), receipt layout (from `ReceiptShareCard.tsx`)

## Storyboard
Use the storyboard in `brag-output-2026-07-17-144626/brag-plan.md` as the creative contract.

Scene summary:
1. The receipt prints — 4s — receipt prints top-to-bottom: FITZO® / TOTAL WEIGHT MOVED / 12,480 KG / "The weight of 17 auto-rickshaws" / ink circle draws around Total
2. Wordmark reveal — 3s — F mark + FITZO land on the 4.23s strong cue; "The coach that actually knows you." holds ≥1.8s
3. The coach knows — 5s — simulated chat: user asks, coach reply types out with data callout (bench +7.5kg, 12 skipped leg days), 3 context chips arrive on half-beats; headline "An AI coach that reads your training."
4. Growth zones — 5s — anatomy heatmap front+back; muscles flip amber→green on half-beat grid from the 10.54s cue; counter ticks 2→8; "Growth zone" label lands on 12.65s cue; headline "See where you're growing."
5. Dal to biryani + outro — 4s — food card types "2 roti · dal · 100g paneer", macros count up; leaderboard kudos 👊 pop; F mark stamps with "Early access → fitzoapp.in"

## Audio
- Audio role: warm confident bed with motion-matched accents
- Audio arc: printer ticks open in near-silence → bed settles low → brand lands on strong cue → quiet keys and half-beat UI pops in the middle → single stamp + music resolve/fade at the end
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (114.84 BPM)
- Music treatment: start 0s at low volume (~0.5), lift slightly into scene 4, fade out over the final 1s
- Music cue guidance: bundled preset `brag/assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json`. Strong cues: 4.23s (wordmark), 10.54s (heatmap flips start), 12.65s ("Growth zone" label). Beat grid ~0.52s; sequential visual events snap to every other beat (~1.05s); sequential TEXT holds ≥0.8s settled.
- Audio-reactive treatment: none — polished restraint (documented choice; motion syncs to beats, nothing pulses to the waveform)
- Audio-coupled moments:
  - Scene 1 receipt blocks — printer ticks per block; pen scribble on circle draw
  - Scene 2 wordmark — one soft stamp/impact on the 4.23s cue
  - Scene 3 coach reply — keyboard ticks while typing; soft pop per context chip
  - Scene 4 muscle flips — soft UI pop per flip on the half-beat; counter tick
  - Scene 5 — type ticks, kudos pop, final logo stamp
- SFX selection guidance: match motion; sparse and low-HF for polish. Keyboard sounds for typing, card/UI pops for arrivals, one impact for the stamp.
- SFX analysis guidance: `C:\Users\PC\Documents\Code\Fitzo\.agents\skills\brag\assets\sfx\sfx-analysis.md` — prefer low high-frequency-risk files for repeated moments.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density, volume after animation exists.
- Audio files: copy chosen music + SFX into `brag-output-2026-07-17-144626/composition/assets/`

## Hyperframes Instructions
Use the current `hyperframes` skill and CLI workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI/visual element from the source project (receipt card, heatmap, F logo — all specified above with source paths).
- Keep all text readable (settled holds per plan).
- 21 seconds total.
- Include music + SFX layer as planned.
- Beat-lock 1–3 major reveals (±0.15s); sequential events on the beat grid (±0.10s) except readable text.
- Lint and validate before render.
