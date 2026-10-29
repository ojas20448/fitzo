const SCOPE_REPLY = 'I can help with workouts, nutrition, recovery and using Fitzo. Ask me about one of those topics.';
// shortcut: lexical checks can misclassify mixed topics; retain provider quotas and tune from real examples.
const FITNESS = /\b(?:fitzo|spotter|fitness|workouts?|exercises?|gym|train(?:ing)?|nutrition|calories?|kcals?|proteins?|carbs?|fats?|meals?|foods?|diet|eating|weight|muscles?|reps?|sets?|cardio|strength|lifting|bench|squat|deadlift|pushups?|pullups?|recovery|rest|sleep|soreness|injur(?:y|ies)|chest|back|shoulders?|legs?|knees?|pain|stretch(?:ing)?|yoga|streak|steps?|running|walking|cycling|hydration|water|supplements?|creatine|whey|bulk|cutting|roti|dal|paneer|chawal|khana|sabzi|dahi|poha|idli|dosa|chicken|eggs?|rice|oats|breakfast|lunch|dinner|snacks?|workout|password|account|check.?in)\b/i;
const OTHER_TASK = /\b(?:javascript|typescript|python|sql|programming|source code|write code|crypto|stock market|elections?|politics|poems?|essays?|homework|horoscope|weather forecast|prime minister|capital of)\b|ignore (?:all |the |your )?(?:previous|system|instructions)|system prompt/i;
const FOLLOW_UP = /^(?:yes|no|why|how (?:much|many|often|long)|what about (?:that|this|it|me)|is (?:that|this|it)|can i (?:do|eat|try|have)|tell me more|explain|and (?:then|tomorrow|today))(?:\b|[?!.,])/i;
function isFitnessQuestion(question, previousQuestion = '') {
    if (OTHER_TASK.test(question)) return false;
    return FITNESS.test(question) || (question.length <= 120 && FOLLOW_UP.test(question) && FITNESS.test(previousQuestion) && !OTHER_TASK.test(previousQuestion));
}
module.exports = { isFitnessQuestion, SCOPE_REPLY };
