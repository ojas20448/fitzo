const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  GEMINI_API_KEY not set — AI features will fail');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// Helper: extract JSON from Gemini response
function extractJSON(text) {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    return jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(extractJSON(text));
    } catch (error) {
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(extractJSON(text));
    } catch (error) {
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
- You understand Hinglish and should respond in a friendly, practical, encouraging tone using regional gym slang and terms where natural (e.g. "bhai", "yaar", "ghar ka khana", "katori", "diet", etc.).
- Proactively reference their data to reinforce good habits or point out corrections. (For example, if they ask about chest workout, and they've skipped legs for 12 days, write: "Bhai, chest toh badhiya chal raha hai, but legs ko 12 days se skip kiya hai, aaj intent mein push ki jagah legs kar le?").
- If they are eating over/under their target calories, reference it.
- Keep responses relatively brief (2-3 paragraphs, max 150-200 words), highly actionable, and formatted in clear paragraphs or bullet points.

${contextStr}${historyStr}

User's current question: ${question}

Provide your expert coaching advice:`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API error (Switching to MOCK):', error.message);
        return `[AI Monitor]: The advanced AI service is currently unavailable. \n\nHowever, regarding "${question}", generally consistency is key. Please ensure you are eating enough protein and getting enough sleep. (This is a simplified offline response).`;
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API error (Switching to MOCK):', error.message);
        return `[AI Monitor]: Form analysis unavailable offline. Please check standard form guides for ${exerciseName}. Ensure your back is straight and movements are controlled.`;
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType,
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const responseText = response.text();

        const parsed = JSON.parse(extractJSON(responseText));

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
        console.error('Gemini Vision food analysis error:', error.message);
        throw new Error('Failed to analyze food image. Please try again or use text description instead.');
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
        console.error('Gemini transcription service error:', error.message);
        throw new Error('Failed to transcribe audio. Please try again.');
    }
}

module.exports = {
    generateWorkoutPlan,
    getNutritionAdvice,
    chatWithCoach,
    analyzeForm,
    analyzeFoodFromText,
    analyzeFoodFromPhoto,
    transcribeAudio
};
