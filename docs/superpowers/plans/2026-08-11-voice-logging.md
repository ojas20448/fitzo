# Implementation Plan: Voice Logging & AI Fallback Database
**Date:** 2026-08-11

## Overview
This plan defines a 3-step pipeline for voice logging. It leverages AI primarily for extraction and relies on the existing database for nutritional truth. To prevent hallucination problems (e.g., the "Butter Panner Meal" incident) and safeguard the core database, any AI-estimated food must be stored in a personal data island and never pollute the main catalogue.

## Pipeline Architecture
1. **SPEECH TO TEXT:** Route voice input to the existing `transcribe` endpoint.
2. **EXTRACTION (AI):** Pass the raw transcript to a new Gemini prompt configured to output a structured JSON array of items and quantities.
3. **RESOLUTION (Database):** Iterate over the extracted array. Pass each item to the existing algorithmic search (`rankFoods` in `foodSearch.js`).
   - *High-confidence match:* Use the catalogue's macros. AI is solely used for entity identification.
   - *No match:* Fall back to `analyzeFoodFromText` to have AI estimate macros, flagging the item as an estimate.

## Global Constraints
- AI-estimated foods must NEVER be added to `indian-foods.json`.
- Estimated foods must be persisted in a personal `user_foods` table linked to the user's ID.
- Any log relying on an AI estimate must be explicitly flagged in the database.

## Checklist

### Database Migrations
- [x] Create a new `user_foods` table.
- [x] Modify the existing `calorie_logs` table.

### Backend API
- [x] Implement Gemini extraction logic (`extractItemsFromText`) to parse transcripts into structured lists.
- [x] Create a new `/api/food/bulk-resolve` endpoint (Step 3).

### Mobile UI
- [ ] Connect microphone UI entry point in `CalorieLogScreen.tsx` to the `extract-foods` -> `bulk-resolve` API chain.
- [ ] Build a multi-item draft confirmation sheet to present the items before they are logged.
- [ ] Display an explicit UI badge (e.g., "AI Estimate") next to any item resolved via fallback.
- [ ] Provide inputs within the sheet to edit quantities or remove misidentified items before confirming the payload to the log endpoint.
