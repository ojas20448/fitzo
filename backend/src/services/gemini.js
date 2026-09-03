const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  GEMINI_API_KEY not set — AI features will fail');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const { AIUnavailableError, ValidationError } = require('../utils/errors');

// The model name lives in ONE place, and is env-overridable.
//
// Google retires model IDs over time: `gemini-2.5-flash` became unavailable to
// newly-created API keys, so the moment the key was rotated EVERY AI feature
// (coach, voice logging, food analysis, daily insights, weekly recaps) started
// returning 500s — with no obvious link between "I rotated a key" and "the AI
// died". The "-latest" alias tracks the current Flash generation so a future
// retirement can't do that again. Set GEMINI_MODEL to pin an exact version.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

/**
 * A cheaper, higher-throughput model for the mechanical calls.
 *
 * Transcription and entity extraction are not reasoning tasks — they turn one
 * representation into another with no judgement required. Flash-Lite handles
 * them at a materially higher requests-per-day allowance and lower cost, which
 * matters because free-tier limits are per PROJECT, not per user: every user
 * shares one bucket, and voice logging costs two calls (transcribe, then
 * extract). Those are far and away the highest-volume calls in the app.
 *
 * The coach, plan generation and photo analysis stay on Flash, where output
 * quality is the point and volume is low.
 */
const GEMINI_FAST_MODEL = process.env.GEMINI_FAST_MODEL || 'gemini-flash-lite-latest';

/**
 * Did the provider refuse because a quota or rate limit is exhausted?
 *
 * Matched on shape rather than a single field: the SDK surfaces this
 * inconsistently — sometimes an HTTP 429, sometimes a status string of
 * RESOURCE_EXHAUSTED, sometimes only prose in the message. Treating a quota
 * refusal as a generic failure is what produced the worst outcome: the caller
 * fell through to a canned "AI service unavailable" reply, so a temporary and
 * self-healing condition looked like a broken feature.
 */
/**
 * Hard ceiling on any single model call.
 *
 * Without this the SDK will wait indefinitely. Observed in production: with the
 * Flash daily quota exhausted, requests did not return a 429 — they simply
 * hung. The coach held the connection for 150s and returned zero bytes, so the
 * quota guard below never fired (a hang throws nothing) and the user watched a
 * spinner forever. A fast, honest failure beats an open socket.
 *
 * 30s is well clear of a healthy coach reply (typically under 15s, context
 * pack included) while still failing before a user gives up on their own.
 */
const REQUEST_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10);
const REQUEST_OPTIONS = { timeout: REQUEST_TIMEOUT_MS };

/**
 * Vision gets its own, longer budget. Measured against production, a real meal
 * photo takes 13-30s to come back where the text calls take 6-7s, so sharing the
 * 30s text timeout meant a photo that was still being analysed was aborted and
 * reported to the user as "Fitzo AI is busy right now" — a timeout dressed up as
 * a quota problem. Kept under the mobile client's own 60s ceiling so the server
 * always loses the race and can return a real message.
 */
const VISION_TIMEOUT_MS = parseInt(process.env.GEMINI_VISION_TIMEOUT_MS || '55000', 10);
const VISION_REQUEST_OPTIONS = { timeout: VISION_TIMEOUT_MS };

/**
 * Did the call fail in a way that is temporary and worth retrying?
 *
 * Covers both an exhausted quota and a timeout. They are indistinguishable to
 * the user — the feature is briefly unavailable and will work again later —
 * and, as the production hang showed, an exhausted quota can PRESENT as a
 * timeout rather than as a 429.
 */
function isTransientError(error) {
    if (isQuotaError(error)) return true;
    if (!error) return false;
    const name = String(error.name || '');
    const text = String(error.message || '');
    const status = error.status || error.code;

    // Upstream capacity, not the caller's fault. Gemini answers overload with
    // 503 "This model is currently experiencing high demand", which matched
    // neither the quota check (429 only) nor the abort/timeout regex below. It
    // therefore fell through to a generic 400 telling the user their photo could
    // not be read — blaming their picture for Google's load, and hiding a
    // self-healing outage behind a permanent-sounding error. Observed in the
    // production logs against both food photos and daily insights.
    if (status === 503 || status === 'UNAVAILABLE') return true;
    if (/\b503\b|Service Unavailable|high demand|overloaded|UNAVAILABLE/i.test(text)) return true;

    return /abort|timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up/i.test(name + ' ' + text);
}

function isQuotaError(error) {
    if (!error) return false;
    const status = error.status || error.code;
    if (status === 429 || status === 'RESOURCE_EXHAUSTED') return true;
    const text = String(error.message || '');
    return /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(text);
}

// ===========================================
// SHARED: Indian/Hinglish-aware system context
// ===========================================
const INDIAN_CONTEXT = `You are an expert fitness and nutrition coach with deep knowledge of Indian dietary habits, regional cuisines, and gym culture in India.

KEY CONTEXT - INDIAN FOOD & CULTURE:
- Understand Hinglish (Hindi-English mix): "roti", "sabzi", "dal", "chawal", "paneer", "dahi", "paratha", "poha", "upma", "idli", "dosa", "chole", "rajma", "aloo gobi", "bhindi", "palak", "raita", etc.
- Know common Indian meal patterns: breakfast (nashta), lunch (dopahar ka khana), evening snack (chai-time), dinner (raat ka khana)
- "Ghar ka khana" = homemade Indian food (typically: dal-chawal-roti-sabzi combo)
- Common gym foods in India: eggs (ande), chicken breast, paneer, curd/dahi, sprouts (ankurit moong), chana, soybean chunks, whey protein, peanut butter, banana shake
- Know Indian protein sources: paneer (18g/100g), curd/dahi (11g/cup), chana/chickpeas (19g/cup), rajma (15g/cup), moong dal (24g/cup dry), soybean chunks (52g/100g dry), eggs (6g each)
- Vegetarian is very common in India - always provide veg alternatives
- Common Indian cooking oils: mustard oil, ghee, coconut oil, refined oil - these add significant hidden calories
- Indian sweets (mithai) are calorie-dense: gulab jamun (~150cal each), rasgulla (~120cal), ladoo (~200cal), barfi (~180cal)
- Street food: samosa (~250cal), vada pav (~300cal), pani puri (~200cal for 6), bhel puri (~180cal)
- Regional variations: South Indian (dosa/idli/uttapam), North Indian (roti/paratha/naan), Bengali (fish/mishti), Gujarati (dhokla/thepla)
- Understand serving sizes in Indian context: "1 katori" (bowl ~150ml), "1 roti" (~80-100cal), "1 plate" rice (~200g cooked)`;

/**
 * Extract a JSON payload from a Gemini response.
 *
 * Handles both objects AND arrays. The previous implementation used
 * /\{[\s\S]*\}/ as its fallback, which is object-only: given the bare array
 * our extraction prompts ask for (`[{...},{...}]`) it sliced off the outer
 * brackets and produced invalid JSON — so every multi-item voice log threw.
 *
 * Strategy: strip any code fence (labelled or not, CRLF-safe), then slice
 * from the first bracket to its matching last bracket, preferring whichever
 * of `[` / `{` appears first.
 */
function extractJSON(text) {
    if (typeof text !== 'string') return '';

    // Remove ```json ... ``` or ``` ... ``` wrappers anywhere in the response
    let cleaned = text.replace(/```[a-zA-Z]*\s*([\s\S]*?)```/g, '$1').trim();

    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');

    // Pick whichever container starts first (arrays are the common case here)
    let openIdx;
    let closeChar;
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        openIdx = firstBracket;
        closeChar = ']';
    } else if (firstBrace !== -1) {
        openIdx = firstBrace;
        closeChar = '}';
    } else {
        return cleaned; // no JSON container found — let the caller's parse fail loudly
    }

    const closeIdx = cleaned.lastIndexOf(closeChar);
    if (closeIdx > openIdx) {
        return cleaned.slice(openIdx, closeIdx + 1);
    }
    return cleaned;
}

// ===========================================
// MOCK FALLBACKS
// ===========================================
function getMockWorkoutPlan(goal) {
    return {
        plan_name: `AI Generated ${goal} Plan`,
        duration_weeks: 4,
        days: [
            {
                day: "Monday",
                focus: "Upper Body",
                exercises: [{ name: "Pushups", sets: 3, reps: "10-12", rest_seconds: 60, notes: "Focus on form" }]
            },
            {
                day: "Wednesday",
                focus: "Lower Body",
                exercises: [{ name: "Squats", sets: 3, reps: "12-15", rest_seconds: 60, notes: "Keep back straight" }]
            },
            {
                day: "Friday",
                focus: "Full Body",
                exercises: [{ name: "Burpees", sets: 3, reps: "10", rest_seconds: 60, notes: "Explosive movement" }]
            }
        ]
    };
}

function getMockNutritionAdvice(goal) {
    return {
        calories: 2200,
        macros: { protein_g: 150, carbs_g: 200, fats_g: 70 },
        meal_timing: ["Breakfast: 8AM", "Lunch: 1PM", "Dinner: 8PM"],
        supplements: ["Detailed advice unavailable (Mock Mode)"],
        tips: ["Drink water", "Sleep 8 hours"]
    };
}

// ===========================================
// WORKOUT PLAN GENERATION
// ===========================================
async function generateWorkoutPlan(userProfile) {
    const { goal, fitnessLevel, daysPerWeek, equipment } = userProfile;

    const prompt = `${INDIAN_CONTEXT}

Create a ${daysPerWeek}-day workout plan for a ${fitnessLevel} level person.
Goal: ${goal}
Available equipment: ${equipment || 'bodyweight only'}

Include exercises commonly done in Indian commercial gyms. Use both English and common Hindi names where applicable (e.g., "Bench Press", "Lat Pulldown").

Format the response as JSON with this structure:
{
  "plan_name": "string",
  "duration_weeks": number,
  "days": [
    {
      "day": "Monday",
      "focus": "string",
      "exercises": [
        {
          "name": "string",
          "sets": number,
          "reps": "string",
          "rest_seconds": number,
          "notes": "string"
        }
      ]
    }
  ]
}`;

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL }, REQUEST_OPTIONS);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(extractJSON(text));
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError();
        console.error('Gemini API error (Switching to MOCK):', error.message);
        return getMockWorkoutPlan(goal);
    }
}

// ===========================================
// NUTRITION ADVICE (Indian-tuned)
// ===========================================
async function getNutritionAdvice(userProfile) {
    const { goal, currentWeight, targetWeight, activityLevel } = userProfile;

    const prompt = `${INDIAN_CONTEXT}

Provide nutrition advice for an Indian user:
Goal: ${goal}
Current weight: ${currentWeight}kg
Target weight: ${targetWeight}kg
Activity level: ${activityLevel}

IMPORTANT:
- Suggest Indian meals and foods (dal, roti, rice, paneer, chicken, eggs, etc.)
- Include both vegetarian and non-vegetarian options
- Mention common Indian protein sources with their protein content
- Consider typical Indian meal timing (breakfast 8-9AM, lunch 1-2PM, evening snack 5-6PM, dinner 8-9PM)
- Suggest affordable Indian supplements available on Amazon India / local stores

Format as JSON:
{
  "calories": number,
  "macros": { "protein_g": number, "carbs_g": number, "fats_g": number },
  "meal_timing": ["string"],
  "supplements": ["string"],
  "tips": ["string"]
}`;

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL }, REQUEST_OPTIONS);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(extractJSON(text));
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError();
        console.error('Gemini API error (Switching to MOCK):', error.message);
        return getMockNutritionAdvice(goal);
    }
}

// ===========================================
// AI COACH CHAT (Hinglish-aware)
// ===========================================
// ===========================================
// AI COACH CHAT (Hinglish-aware + context-aware)
// ===========================================
async function chatWithCoach(question, contextPack = {}, messageHistory = []) {
    // 1. Format the 14-day Context Pack details for the prompt
    let contextStr = '';
    
    if (contextPack && Object.keys(contextPack).length > 0) {
        const { profile, streak, training, nutrition, readiness, activeSplit, todayIntent, wearables, weightHistory } = contextPack;
        
        contextStr += `\nUSER DATA & METRICS (LAST 14 DAYS):`;
        if (profile) {
            contextStr += `\n- Profile: Goal is ${profile.goal_type || 'maintenance'}. Age: ${profile.age || 'N/A'}, Weight: ${profile.current_weight || 'N/A'}kg (Target: ${profile.target_weight || 'N/A'}kg). Target Calories: ${profile.target_calories || 'N/A'} kcal/day.`;
            if (profile.ai_profile_summary) {
                contextStr += `\n- Monthly Coach Notes: ${profile.ai_profile_summary}`;
            }
        }
        contextStr += `\n- Gym Streak: ${streak} days check-in streak.`;
        
        if (training) {
            contextStr += `\n- Muscle Groups Trained (Sets Completed): ${JSON.stringify(training.volume || {})}`;
            if (training.skippedMuscleGroups && training.skippedMuscleGroups.length > 0) {
                contextStr += `\n- Skipped Muscle Groups (0 sets in last 14 days): ${training.skippedMuscleGroups.join(', ')}`;
            }
            if (training.prs && Object.keys(training.prs).length > 0) {
                contextStr += `\n- Personal Records (PRs): ${JSON.stringify(training.prs)}`;
            }
            if (training.sessions && training.sessions.length > 0) {
                contextStr += `\n- Recent Workouts Logged: ${training.sessions.slice(0, 3).map(s => `${s.day_name || 'Workout'} completed on ${new Date(s.completed_at).toLocaleDateString()} (${s.duration_minutes || 'N/A'} mins)`).join('; ')}`;
            }
        }
        
        if (nutrition && nutrition.length > 0) {
            contextStr += `\n- Recent Daily Calories Logged: ${nutrition.slice(0, 3).map(n => `${n.logged_date}: ${n.calories}kcal (P: ${n.protein}g, C: ${n.carbs}g, F: ${n.fat}g)`).join('; ')}`;
        }
        
        if (readiness && readiness.length > 0) {
            contextStr += `\n- Recent Readiness Scores (0-100): ${readiness.slice(0, 3).map(r => `${r.log_date}: Score ${r.readiness_score}/100 (${r.recommendation})`).join('; ')}`;
        }

        if (wearables && wearables.length > 0) {
            contextStr += `\n- Recent Wearable Data (Apple Health/Health Connect): ${wearables.slice(0, 3).map(w => `${w.date}: ${w.steps} steps, ${w.active_calories} active kcal burned${w.resting_heart_rate ? `, Resting HR: ${w.resting_heart_rate} bpm` : ''}${w.sleep_hours ? `, Sleep: ${w.sleep_hours} hrs` : ''}`).join('; ')}`;
        }

        if (weightHistory && weightHistory.length > 0) {
            contextStr += `\n- Recent Weight Tracking: ${weightHistory.slice(0, 3).map(w => `${w.log_date}: ${w.weight}kg${w.body_fat ? ` (${w.body_fat}% body fat)` : ''}`).join('; ')}`;
        }
        
        if (activeSplit) {
            contextStr += `\n- Active Workout Split: ${activeSplit.name} (${activeSplit.days_per_week} days/week).`;
        }
        if (todayIntent) {
            contextStr += `\n- Today's Gym Intent: Focus is ${todayIntent.muscle_group} ("${todayIntent.note || 'No notes'}") logged under label "${todayIntent.session_label || 'Normal'}".`;
        }
    }

    // 2. Format the chat history turns
    let historyStr = '';
    if (messageHistory && messageHistory.length > 0) {
        historyStr += `\n\nRECENT CHAT HISTORY (Last 10 turns):`;
        messageHistory.forEach(msg => {
            const roleName = msg.sender === 'user' ? 'User' : 'Coach/AI';
            historyStr += `\n- ${roleName}: ${msg.message}`;
        });
    }

    const prompt = `${INDIAN_CONTEXT}

You are the personal AI fitness coach for this user. Unlike other basic chatbots, you actually KNOW this user because you have access to their full training logs, attendance check-ins, Hinglish-first nutrition, and daily readiness. Use this data contextually to provide tailored, hyper-specific feedback.

CRITICAL COACHING INSTRUCTIONS:
- Tone must be premium, professional, objective, and quiet. Do NOT use overly enthusiastic language, exclamation marks, or excessive emojis. Keep it data-focused and direct.
- Respond in a clean, quiet, declarative Hinglish or English tone. Refrain from calling the user "bhai" or "yaar" repeatedly; keep the tone premium, sophisticated, and mature.
- Proactively reference their data to reinforce good habits or point out corrections in a factual manner. (For example: "Chest workouts are on track, but leg training has been skipped for 12 days. Consider shifting today's focus to legs to maintain balance.").
- If they are eating over/under their target calories, reference it objectively.
- Keep responses brief (150-200 words max), highly actionable, structured, and premium.

${contextStr}${historyStr}

User's current question: ${question}

Provide your expert coaching advice:`;

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL }, REQUEST_OPTIONS);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError('The coach is busy right now. Try again in a moment.');
        console.error('Coach call failed (non-transient):', error.message);
        // A non-transient failure here is a real defect — a bad API key, a
        // retired model, a safety block. It must NOT be answered with canned
        // advice.
        //
        // The previous fallback returned "[AI Monitor]: The advanced AI service
        // is currently unavailable... consistency is key, eat enough protein",
        // and the route then PERSISTED that to coach_messages as though the
        // coach had said it. Three problems, worst last: it leaked internal
        // wording to users, it answered a specific question with generic
        // filler, and it wrote that filler permanently into the user's history
        // where it is indistinguishable from real coaching.
        //
        // Throwing keeps the history clean — the route's inserts run only after
        // a successful reply — and tells the user the truth.
        throw new AIUnavailableError('The coach could not answer that just now. Try again shortly.');
    }
}

// ===========================================
// FORM ANALYSIS
// ===========================================
async function analyzeForm(exerciseName, userDescription) {
    const prompt = `A user is performing ${exerciseName} and describes their form as:
"${userDescription}"

Provide:
1. Potential issues with their form
2. 3 specific corrections
3. Safety tips

Keep it brief and actionable.`;

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL }, REQUEST_OPTIONS);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError();
        console.error('Gemini API error (Switching to MOCK):', error.message);
        // Same reasoning as chatWithCoach: form advice the model did not
        // actually produce is worse than no advice, because the user cannot
        // tell it apart from a real answer.
        throw new AIUnavailableError('Form analysis is unavailable right now. Try again shortly.');
    }
}

// ===========================================
// FOOD TEXT ANALYSIS (Hinglish-aware)
// ===========================================
async function analyzeFoodFromText(text) {
    const prompt = `${INDIAN_CONTEXT}

A user described their meal as:
"${text}"

INSTRUCTIONS:
- If the user uses Hindi/Hinglish food names (roti, dal, sabzi, paratha, poha, dosa, idli, etc.), recognize them accurately
- "Ghar ka khana" typically means a standard Indian home meal (dal + roti/rice + sabzi + salad)
- Use accurate Indian food portions: 1 roti = ~30g, 1 katori dal = ~150ml, 1 plate rice = ~200g cooked
- Account for ghee/oil used in Indian cooking (typically 1-2 tsp per dish)
- If the description is vague, assume a standard single serving
- Be precise with protein content - this matters for gym users

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "name": "short descriptive name of the food/meal",
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "sugar_g": number,
  "serving_size": "description of serving size"
}`;

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL }, REQUEST_OPTIONS);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        const parsed = JSON.parse(extractJSON(responseText));

        return {
            name: parsed.name || text,
            calories: parseFloat(parsed.calories) || 0,
            protein_g: parseFloat(parsed.protein_g) || 0,
            carbs_g: parseFloat(parsed.carbs_g) || 0,
            fat_g: parseFloat(parsed.fat_g) || 0,
            fiber_g: parseFloat(parsed.fiber_g) || 0,
            sugar_g: parseFloat(parsed.sugar_g) || 0,
            serving_size: parsed.serving_size || '1 serving'
        };
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError();
        console.error('Gemini analyzeFoodFromText error:', error.message);
        throw new Error(`AI food analysis failed: ${error.message}`);
    }
}

// ===========================================
// FOOD PHOTO ANALYSIS (Gemini Vision - FREE)
// ===========================================
async function analyzeFoodFromPhoto(base64Image, mimeType = 'image/jpeg') {
    const prompt = `${INDIAN_CONTEXT}

Analyze this food image and identify ALL food items visible.

INSTRUCTIONS:
- Identify each distinct food item in the image
- If it's Indian food, use the correct name (e.g., "Paneer Butter Masala", "Dal Tadka", "Tandoori Roti")
- Estimate portion sizes from visual cues
- Account for cooking oil/ghee visible or implied
- For thalis or combo plates, break down each item separately

Return ONLY valid JSON (no markdown, no code fences) with this structure:
{
  "items": [
    {
      "name": "food item name",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "sugar_g": number,
      "serving_size": "estimated portion"
    }
  ],
  "total": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number
  }
}`;

    try {
        // responseMimeType forces valid JSON out of the model — the same thing the
        // text-extraction calls below already do. This call was the odd one out, and
        // it showed: a photo with no food returned `{"items":[]}` fine, but a real
        // meal produced a long response that arrived fenced or truncated, so
        // JSON.parse threw and the user got a 500. It broke precisely when it found
        // food, which is every real use. maxOutputTokens gives a multi-item thali
        // room to finish rather than being cut mid-object.
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: 'application/json',
                // Generous on purpose. GEMINI_MODEL resolves to gemini-flash-latest,
                // which is a 2.5-series thinking model, and thinking tokens are billed
                // against maxOutputTokens before a single character of JSON is emitted.
                // A busy plate reasons for longer, so a tight cap starved the actual
                // answer and truncated it mid-object — which is why this failed on real
                // meals and passed on an empty plate. SDK 0.24.1 has no thinkingConfig
                // to turn it off, so the budget has to absorb it.
                maxOutputTokens: 8192,
            },
        }, VISION_REQUEST_OPTIONS);

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType,
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const responseText = response.text();

        let parsed;
        try {
            parsed = JSON.parse(extractJSON(responseText));
        } catch (parseError) {
            // A parse failure used to surface as an unexplained 500. Log what the
            // model actually returned (and why it stopped) so the next one is
            // diagnosable from the Render logs alone.
            const finishReason = response.candidates?.[0]?.finishReason;
            console.error('Gemini Vision returned unparseable JSON:', {
                finishReason,
                blockReason: response.promptFeedback?.blockReason,
                preview: String(responseText).slice(0, 300),
            });
            // ValidationError, not a bare Error: only operational errors keep their
            // message through the error handler. A bare Error reached the user as
            // "Something went wrong. Please try again." — which is exactly what made
            // this bug so hard to place from the outside.
            throw new ValidationError(
                finishReason === 'MAX_TOKENS'
                    ? 'That photo had too much going on to read in one pass. Try a closer shot of fewer items.'
                    : 'Could not read the food in that photo. Please try a clearer photo, or describe it in text.',
            );
        }

        // Ensure consistent structure
        const items = (parsed.items || [parsed]).map(item => ({
            name: item.name || 'Unknown food',
            calories: parseFloat(item.calories) || 0,
            protein_g: parseFloat(item.protein_g) || 0,
            carbs_g: parseFloat(item.carbs_g) || 0,
            fat_g: parseFloat(item.fat_g) || 0,
            fiber_g: parseFloat(item.fiber_g) || 0,
            sugar_g: parseFloat(item.sugar_g) || 0,
            serving_size: item.serving_size || '1 serving',
        }));

        const total = parsed.total || {
            calories: items.reduce((sum, i) => sum + i.calories, 0),
            protein_g: items.reduce((sum, i) => sum + i.protein_g, 0),
            carbs_g: items.reduce((sum, i) => sum + i.carbs_g, 0),
            fat_g: items.reduce((sum, i) => sum + i.fat_g, 0),
        };

        return { items, total };
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError();
        // The parse branch above already classified itself; without this it would be
        // caught here and flattened back into a generic non-operational Error.
        if (error.isOperational) throw error;
        console.error('Gemini Vision food analysis error:', error.message);
        throw new ValidationError('Failed to analyze food image. Please try again, or describe it in text.');
    }
}

/**
 * Transcribes audio using Gemini 2.5 Flash's multimodal inputs.
 *
 * @param {string} base64Data - Base64 encoded audio
 * @param {string} mimeType - e.g. 'audio/m4a', 'audio/mp3', 'audio/wav'
 * @returns {Promise<string>} The transcribed text
 */
async function transcribeAudio(base64Data, mimeType) {
    const prompt = "Transcribe the spoken audio in this file. Provide only the text transcription, matching the languages spoken (usually English or Hinglish). Do not add any introduction, greeting, or explanation.";

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_FAST_MODEL }, REQUEST_OPTIONS);
        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            },
            prompt
        ]);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError();
        console.error('Gemini transcription service error:', error.message);
        throw new Error('Failed to transcribe audio. Please try again.');
    }
}

async function extractWorkoutFromText(text) {
    const prompt = `Extract all exercises and their sets from the following text describing a workout.
Return ONLY a valid JSON array of objects (no markdown, no code fences).
Each object must have:
- "name" (string, the exercise name)
- "is_unilateral" (boolean, true if it's a single-arm/leg movement)
- "sets" (array of objects, each with "reps" (number), "weight_kg" (number), "rir" (number, default 0 if not mentioned))

Example:
Text: "I did 3 sets of bench press 60kg for 10 reps, and 2 sets of bicep curls 15kg for 12 reps."
Output: [{"name": "Bench Press", "is_unilateral": false, "sets": [{"reps": 10, "weight_kg": 60, "rir": 0}, {"reps": 10, "weight_kg": 60, "rir": 0}, {"reps": 10, "weight_kg": 60, "rir": 0}]}, {"name": "Bicep Curls", "is_unilateral": false, "sets": [{"reps": 12, "weight_kg": 15, "rir": 0}, {"reps": 12, "weight_kg": 15, "rir": 0}]}]

Text: ${JSON.stringify(text)}`;

    let responseText = '';
    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_FAST_MODEL,
            generationConfig: { responseMimeType: 'application/json' },
        }, REQUEST_OPTIONS);
        const result = await model.generateContent(prompt);
        responseText = (await result.response).text();
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError();
        console.error('Gemini workout extraction call failed:', error.message);
        throw new Error('Could not reach the AI service. Please try again.');
    }

    // Parse failures are separated from network failures so logs say which
    // happened, and so a weird model reply degrades instead of 500-ing.
    try {
        const parsed = JSON.parse(extractJSON(responseText));
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Gemini workout extraction returned unparseable output:', responseText.slice(0, 300));
        return [];
    }
}

// ===========================================
// FOOD ITEMS TEXT EXTRACTION
// ===========================================
async function extractItemsFromText(text) {
    const prompt = `Extract all food items and their quantities or portion sizes from the following text.
Return ONLY a valid JSON array of objects (no markdown, no code fences).
Each object must have "item" (string) and "quantity" (string).
Do NOT include macros, just the raw text extraction.

Example:
Text: "I ate 250g of paneer tikka and 2 plates of biryani"
Output: [{"item": "paneer tikka", "quantity": "250g"}, {"item": "biryani", "quantity": "2 plates"}]

Text: ${JSON.stringify(text)}`;

    let responseText = '';
    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_FAST_MODEL,
            generationConfig: { responseMimeType: 'application/json' },
        }, REQUEST_OPTIONS);
        const result = await model.generateContent(prompt);
        responseText = (await result.response).text();
    } catch (error) {
        // A quota refusal is temporary and self-healing. Falling through to the
        // canned fallback below would present it as a broken feature instead.
        if (isTransientError(error)) throw new AIUnavailableError();
        console.error('Gemini food extraction call failed:', error.message);
        throw new Error('Could not reach the AI service. Please try again.');
    }

    try {
        const parsed = JSON.parse(extractJSON(responseText));
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Gemini food extraction returned unparseable output:', responseText.slice(0, 300));
        return [];
    }
}
module.exports = {
    generateWorkoutPlan,
    getNutritionAdvice,
    chatWithCoach,
    analyzeForm,
    analyzeFoodFromText,
    analyzeFoodFromPhoto,
    transcribeAudio,
    extractItemsFromText,
    extractWorkoutFromText
};
