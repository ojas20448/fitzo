const { createHash } = require('node:crypto');
const context = require('./aiContext');

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const OUTPUT_LIMITS = {
    coach: 1024, form: 1024, nutrition: 2048,
    food_text: 1024, food_photo: 4096, workout_plan: 6144,
    food_extract: 1024, workout_extract: 4096, transcription: 2048,
    daily_insight: 256, weekly_recap: 384,
};
// Process-local, short-lived and owner-isolated. No prompts, photos or responses
// are written to Redis/logs/disk. Fresh coach/context advice is never reused.
const CACHE_FEATURES = new Set(['food_text', 'food_photo', 'food_extract', 'workout_extract']);
const responses = new Map();
const CACHE_MS = 120000;
const CACHE_ENTRIES = 256;

function boundedOptions(feature, options = {}) {
    const model = options.model || DEFAULT_MODEL;
    const config = { ...options.generationConfig };
    const allowance = OUTPUT_LIMITS[feature] || 2048;
    config.maxOutputTokens = Number.isInteger(config.maxOutputTokens) && config.maxOutputTokens > 0
        ? Math.min(config.maxOutputTokens, allowance) : allowance;
    // This API field is forwarded by the JS SDK even though its old TypeScript
    // declaration predates Gemini 3. Apply it only to the verified model.
    if (model.replace(/^models\//, '') === DEFAULT_MODEL) {
        config.thinkingConfig = { thinkingLevel: 'minimal' };
    }
    return { ...options, model, generationConfig: config };
}

function reusable(response, options) {
    if (response.candidates?.[0]?.finishReason !== 'STOP') return false;
    try {
        const text = response.text();
        if (!text.trim()) return false;
        if (options.generationConfig.responseMimeType === 'application/json') JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

function getCostControlledModel(client, feature, options, requestOptions, ownerId) {
    const bounded = boundedOptions(feature, options);
    const timeout = Number(process.env.GEMINI_TIMEOUT_MS || 30000);
    const model = client.getGenerativeModel(bounded, {
        timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 30000,
        ...requestOptions,
    });
    const generate = async input => {
        const result = await model.generateContent(input);
        const response = await result.response;
        const usage = response.usageMetadata;
        if (usage) console.info('Gemini usage', {
            feature, model: bounded.model,
            inputTokens: usage.promptTokenCount || 0,
            outputTokens: usage.candidatesTokenCount || 0,
            thinkingTokens: usage.thoughtsTokenCount || 0,
            totalTokens: usage.totalTokenCount || 0,
        });
        return result;
    };
    return { generateContent: async input => {
        const owner = ownerId || context.getStore()?.userId;
        if (!owner || !CACHE_FEATURES.has(feature)) return generate(input);
        const key = createHash('sha256').update(JSON.stringify([owner, feature, bounded, input])).digest('hex');
        const now = Date.now();
        const cached = responses.get(key);
        if (cached && cached.expiresAt > now) return cached.promise;
        for (const [oldKey, entry] of responses) {
            if (entry.expiresAt <= now) responses.delete(oldKey);
        }
        if (responses.size >= CACHE_ENTRIES) responses.delete(responses.keys().next().value);
        const entry = { expiresAt: now + CACHE_MS };
        entry.promise = generate(input).then(async result => {
            if (!reusable(await result.response, bounded) && responses.get(key) === entry) responses.delete(key);
            return result;
        }).catch(error => {
            if (responses.get(key) === entry) responses.delete(key);
            throw error;
        });
        responses.set(key, entry);
        return entry.promise;
    } };
}

module.exports = { getCostControlledModel, DEFAULT_MODEL };
