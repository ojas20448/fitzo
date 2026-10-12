// Older installed builds require a food profile before leaving onboarding and
// expect numeric nutrition targets. New builds explicitly opt into null goals
// and durable training-only setup, so both versions can share the backend.
const supportsTrainingFirst = req => req.get('X-Fitzo-Setup-Version') === '2';
const legacyNutritionTargets = Object.freeze({
    target_calories: 2000, target_protein: 150, target_carbs: 200, target_fat: 67,
});
module.exports = { supportsTrainingFirst, legacyNutritionTargets };
