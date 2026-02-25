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
async function chatWithCoach(question, context = {}) {
    const contextStr = Object.keys(context).length > 0
        ? `\n\nUser context: ${JSON.stringify(context)}`
        : '';

    const prompt = `${INDIAN_CONTEXT}

You are a friendly, knowledgeable fitness coach for Indian gym-goers. You understand Hinglish and can respond in a mix of English with Hindi words when the user uses them.

If the user mentions Indian foods (roti, dal, sabzi, paratha, etc.), provide accurate nutritional info.
If the user asks about diet, suggest Indian-friendly meal plans with local foods.
If the user asks about supplements, suggest options available in India (MuscleBlaze, ON India, MyProtein India, etc.).

User's question: ${question}${contextStr}

Provide actionable advice in 2-3 paragraphs. Be practical and relatable to Indian gym culture.`;

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

module.exports = {
    generateWorkoutPlan,
    getNutritionAdvice,
    chatWithCoach,
    analyzeForm,
    analyzeFoodFromText,
    analyzeFoodFromPhoto
};
