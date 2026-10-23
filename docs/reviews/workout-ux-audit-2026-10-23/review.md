# Workout logging usability audit

Completed alongside the community-workout library on 23 October 2026.

## Changes

- RIR is editable directly in a set row. Next moves from weight to reps to optional RIR, then the next row. Blank RIR and zero RIR remain distinct.
- Invalid completion focuses the problem field and shows a nearby accessible message. Weight, whole-number reps and optional RIR 0–5 are validated without forcing a second editor. Editing a completed row to invalid values unchecks it.
- Exercise names/photos expose one visible Guide & history action; the redundant details icon was removed to give long names more room. Removal controls keep their own 44 px target.
- The rest timer lives above the visibility/finish controls in normal layout. Add 30 seconds updates the actual timer target, so the next clock tick no longer cancels the extension. Add and Skip have labelled touch targets.
- The finish footer occupies its own flex layout area. Rows scroll in the remaining space; browser inputs explicitly scroll fully into view on focus. Friends / Only me use radio semantics and checked state.

## Evidence

The final browser review passes five scenarios and 22 captured layouts, including inline validation, RIR, long exercise names, 320×500 focused entry, the rest timer with privacy controls, guide/history retry, and both routine-saving choices. The timer extension measured 90 seconds before Add 30 and 119 seconds after the next tick. See [browser-results.json](./browser-results.json).

The combined mobile suite passes 599 tests; TypeScript and platform JavaScript exports pass. Browser requests were isolated fixtures. Earlier failure screenshots are retained as diagnostics; browser-results.json records the final pass. Native keyboard and assistive-technology behavior has not been verified on a device.
