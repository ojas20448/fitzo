# Fitzo Gemini API billing

Fitzo calls the Gemini API from its backend. Google AI Pro/Antigravity subscription access does not configure this API project's billing.

## Add credit

1. Open https://aistudio.google.com/api-keys and select the existing Fitzo project (`gen-lang-client-0073163271`). Upgrade the project associated with Render's existing `GEMINI_API_KEY`; do not fund an unrelated project.
2. Choose **Set up billing**. Complete the country, terms, billing-address and payment-method steps yourself. Never send card details or an API key in chat.
3. If Prepay is offered, follow the actual minimum shown for your account; Google can require a different regional/account minimum. Fitzo's India account required **INR 3,000** on 2 October 2026. Keep **auto-reload off**. Postpay accounts instead charge for accumulated usage.
4. Confirm that the Fitzo project's billing tier changes from Free to Paid/Tier 1. Payment and tier changes can take time to propagate.
5. In **Spend**, select Fitzo and use **Monthly spend cap > Edit spend cap** to set your chosen budget. Fitzo's owner selected **INR 1,000/month**, saved on 2 October 2026. This cap is separate from the INR 3,000 prepaid balance. Enforcement can be delayed by about ten minutes and overages can occur; it is not an exact hard real-time ceiling. The project cap does not cover Groq or other Google Cloud products. Google resets it on the first of the month (PST).
6. Check **Usage** and **Spend** after actual scans and coach requests. Input includes photos, prompts and history; output billing includes thinking tokens. The earlier INR 180/month calculation was an example for 1,500 requests at 2,000 input and 500 output tokens, not measured total Fitzo spending.

## Application configuration

- Render: `AI_PROVIDER=gemini`, existing `GEMINI_API_KEY` stays server-side. Keep existing Groq voice configuration.
- Both `GEMINI_MODEL` and `GEMINI_FAST_MODEL` are pinned to `gemini-3.1-flash-lite`, including daily/weekly notes. The shared provider explicitly uses minimal thinking for this verified model (not an absolute guarantee of zero thought tokens). Legacy 2.5 access is restricted, so it is not a safe default for a newly enabled project.
- Paid requests have feature-sized output ceilings: coach/form/food text/food extraction 1,024; nutrition/transcription 2,048; food photo/workout extraction 4,096; workout plans 6,144; daily notes 256; weekly summaries 384. Lower caller limits are preserved. These ceilings do not represent typical consumption. Test busy plates and longer workout plans before widening traffic.
- Exact duplicate food/photo/extraction requests share one call and reuse only successful completed responses for two minutes, per authenticated owner. No coach replies are reused. This bounded cache is process-local (256 entries) and does not persist photos/prompts to disk or Redis. Restarts clear it; user request quotas still apply to duplicates.
- Repeated home-screen opens share one in-flight daily-note cache warm per user instead of each starting a new paid generation. The persisted daily note remains the source of truth, and failures release the lock for a future retry.
- Per-user defaults: 3 AI requests/minute, 10/day, 150/month. Invalid quota configuration falls back to safe positive defaults. Voice logging can use two endpoint requests. Counters use Redis if configured, otherwise process-local fallback that resets on restart and is not a multi-instance hard budget. The Google project spend cap is the independent project-level safeguard, including background Gemini calls.
- Render logs contain feature/model and input/output/thought token counts, never prompt/image/user data in the new usage telemetry. Check actual Google Spend for billing rather than estimating solely from request counts.
- Mobile: `EXPO_PUBLIC_API_URL=https://fitzo.onrender.com/api` and `EXPO_PUBLIC_FOOD_JOB_MODE=false`. No provider key belongs in the mobile build.
- Archived laptop worker: pause its queue and revoke its dedicated production credential. Preserve shared contracts and additive tables.
- No new Android or iOS EAS builds are authorized for this cost-control rollout; wait until the owner's remaining app changes are ready. These changes are backend-only and existing direct-API builds inherit them immediately.

Official references: https://ai.google.dev/gemini-api/docs/billing , https://ai.google.dev/gemini-api/docs/pricing , https://ai.google.dev/gemini-api/docs/rate-limits .
