const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate personalized workout plan using Gemini
 */
// Mock Data Generators
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

/**
 * Generate personalized workout plan using Gemini
 */
async function generateWorkoutPlan(userProfile) {
    const { goal, fitnessLevel, daysPerWeek, equipment } = userProfile;

    const prompt = `Create a ${daysPerWeek}-day workout plan for a ${fitnessLevel} level person.
Goal: ${goal}
Available equipment: ${equipment || 'bodyweight only'}

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
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from markdown if necessary
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

        return JSON.parse(jsonText);
    } catch (error) {
        console.error('Gemini API error (Switching to MOCK):', error.message);
        return getMockWorkoutPlan(goal);
    }
}

/**
 * Get nutrition advice based on user goals
 */
async function getNutritionAdvice(userProfile) {
    const { goal, currentWeight, targetWeight, activityLevel } = userProfile;

    const prompt = `Provide nutrition advice for someone with these details:
Goal: ${goal}
Current weight: ${currentWeight}kg
Target weight: ${targetWeight}kg
Activity level: ${activityLevel}

Include:
1. Recommended daily calorie intake
2. Macro distribution (protein, carbs, fats)
3. 3 meal timing suggestions
4. 2 supplement recommendations (if applicable)

Format as JSON:
{
  "calories": number,
  "macros": { "protein_g": number, "carbs_g": number, "fats_g": number },
  "meal_timing": ["string"],
  "supplements": ["string"],
  "tips": ["string"]
}`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

        return JSON.parse(jsonText);
    } catch (error) {
        console.error('Gemini API error (Switching to MOCK):', error.message);
        return getMockNutritionAdvice(goal);
    }
}

/**
 * AI Coach chat - general fitness questions
 */
async function chatWithCoach(question, context = {}) {
    // ... prompt ...
    const contextStr = Object.keys(context).length > 0
        ? `\n\nUser context: ${JSON.stringify(context)}`
        : '';

    const prompt = `You are a knowledgeable fitness coach. Answer this question concisely and practically:

${question}${contextStr}

Provide actionable advice in 2-3 paragraphs.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API error (Switching to MOCK):', error.message);
        return `[AI Monitor]: The advanced AI service is currently unavailable. \n\nHowever, regarding "${question}", generally consistency is key. Please ensure you are eating enough protein and getting enough sleep. (This is a simplified offline response).`;
    }
}

/**
 * Analyze exercise form from description
 */
async function analyzeForm(exerciseName, userDescription) {
    const prompt = `A user is performing ${exerciseName} and describes their form as:
"${userDescription}"

Provide:
1. Potential issues with their form
2. 3 specific corrections
3. Safety tips

Keep it brief and actionable.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API error (Switching to MOCK):', error.message);
        return `[AI Monitor]: Form analysis unavailable offline. Please check standard form guides for ${exerciseName}. Ensure your back is straight and movements are controlled.`;
    }
}

module.exports = {
    generateWorkoutPlan,
    getNutritionAdvice,
    chatWithCoach,
    analyzeForm
};
