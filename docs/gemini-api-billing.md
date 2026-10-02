# Fitzo Gemini API billing

Fitzo calls the Gemini API from its backend. Google AI Pro/Antigravity subscription access does not configure this API project's billing.

## Add credit

1. Open https://aistudio.google.com/api-keys and select the existing Fitzo project (`gen-lang-client-0073163271`). Upgrade the project associated with Render's existing `GEMINI_API_KEY`; do not fund an unrelated project.
2. Choose **Set up billing**. Complete the country, terms, billing-address and payment-method steps yourself. Never send card details or an API key in chat.
3. If Prepay is offered, start with the minimum shown, normally **$5** (about **INR 481** at the conversion used on 2 October 2026, before applicable taxes/fees). Keep **auto-reload off** for the first measured trial. Postpay accounts instead charge for accumulated usage.
4. Confirm that the Fitzo project's billing tier changes from Free to Paid/Tier 1. Payment and tier changes can take time to propagate.
5. In **Spend**, select Fitzo and use **Monthly spend cap > Edit spend cap** to set your chosen budget; start around **$5/month** if available. This cap is separate from prepaid credit. Google documents enforcement delays of around ten minutes, so it is not a perfectly immediate cutoff.
6. Check **Usage** and **Spend** after actual scans and coach requests. Input includes photos, prompts and history; output billing includes thinking tokens. The earlier INR 180/month calculation was an example for 1,500 requests at 2,000 input and 500 output tokens, not measured total Fitzo spending.

## Application configuration

- Render: `AI_PROVIDER=gemini`, existing `GEMINI_API_KEY` stays server-side. Keep existing Groq voice configuration.
- Pin `GEMINI_MODEL` and `GEMINI_FAST_MODEL` to an available model after verifying it with the active key. `gemini-3.1-flash-lite` is the cost model used for the example above; image quality and actual token usage still need testing.
- Mobile: `EXPO_PUBLIC_API_URL=https://fitzo.onrender.com/api` and `EXPO_PUBLIC_FOOD_JOB_MODE=false`. No provider key belongs in the mobile build.
- Archived laptop worker: pause its queue and revoke its dedicated production credential. Preserve shared contracts and additive tables.

Official references: https://ai.google.dev/gemini-api/docs/billing , https://ai.google.dev/gemini-api/docs/pricing , https://ai.google.dev/gemini-api/docs/rate-limits .
