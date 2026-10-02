const { GoogleGenerativeAI } = require('@google/generative-ai');

describe('Gemini cost controls at the real SDK request boundary', () => {
    let getModel, context, requests, fetchSpy;
    const originalProvider = process.env.AI_PROVIDER;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
        process.env.AI_PROVIDER = 'gemini';
        requests = [];
        // Only the paid network boundary is replaced; options, serialization,
        // response parsing, ownership and deduplication run their real code.
        fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
            requests.push({ url: String(url), body: JSON.parse(init.body) });
            return new Response(JSON.stringify({
                candidates: [{ content: { role: 'model', parts: [{ text: `{"call":${requests.length}}` }] }, finishReason: 'STOP' }],
                usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 0, totalTokenCount: 120 },
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });
        ({ getModel } = require('../services/aiProvider'));
        context = require('../services/aiContext');
        jest.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        if (originalProvider === undefined) delete process.env.AI_PROVIDER;
        else process.env.AI_PROVIDER = originalProvider;
    });

    const client = () => new GoogleGenerativeAI('fake-test-key');
    const options = (extra = {}) => ({ model: 'gemini-3.1-flash-lite', ...extra });

    test.each([
        ['coach', 1024], ['form', 1024], ['nutrition', 2048],
        ['food_text', 1024], ['food_photo', 4096], ['workout_plan', 6144],
        ['food_extract', 1024], ['workout_extract', 4096],
        ['transcription', 2048], ['daily_insight', 256], ['weekly_recap', 384],
    ])('%s sends a bounded output allowance', async (feature, limit) => {
        await getModel(client(), feature, options()).generateContent('Example input');
        expect(requests[0].body.generationConfig.maxOutputTokens).toBe(limit);
    });

    test('photo JSON mode survives while its old oversized allowance is reduced', async () => {
        await getModel(client(), 'food_photo', options({
            generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
        })).generateContent(['Example meal', { inlineData: { data: 'YWJj', mimeType: 'image/jpeg' } }]);
        expect(requests[0].body.generationConfig).toEqual(expect.objectContaining({
            responseMimeType: 'application/json', maxOutputTokens: 4096,
        }));
        expect(requests[0].body.contents[0].parts[1].inlineData.data).toBe('YWJj');
    });

    test('never increases a caller-supplied smaller output limit', async () => {
        await getModel(client(), 'coach', options({ generationConfig: { maxOutputTokens: 300 } })).generateContent('Example');
        expect(requests[0].body.generationConfig.maxOutputTokens).toBe(300);
    });

    test('pins an unset model to Flash-Lite and requests minimal thinking', async () => {
        await getModel(client(), 'coach', {}).generateContent('Example');
        expect(requests[0].url).toContain('/models/gemini-3.1-flash-lite:generateContent');
        expect(requests[0].body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    });

    test('does not send Flash-Lite-specific thinking settings to another model', async () => {
        await getModel(client(), 'coach', { model: 'gemini-2.0-flash' }).generateContent('Example');
        expect(requests[0].body.generationConfig.thinkingConfig).toBeUndefined();
    });

    test('repeating the same scan for one owner avoids a second paid call', async () => {
        const run = () => context.run({ userId: 'owner-a' }, () => getModel(client(), 'food_photo', options()).generateContent('same meal'));
        const first = await run();
        const second = await run();
        expect(first.response.text()).toBe('{"call":1}');
        expect(second.response.text()).toBe('{"call":1}');
        expect(requests).toHaveLength(1);
    });

    test('concurrent duplicate scans share the in-flight call', async () => {
        const run = () => context.run({ userId: 'owner-a' }, () => getModel(client(), 'food_photo', options()).generateContent('same meal'));
        const results = await Promise.all([run(), run()]);
        expect(results.map(r => r.response.text())).toEqual(['{"call":1}', '{"call":1}']);
        expect(requests).toHaveLength(1);
    });

    test('different users cannot receive each other\'s cached scan', async () => {
        const model = getModel(client(), 'food_photo', options());
        const first = await context.run({ userId: 'a' }, () => model.generateContent('same meal'));
        const second = await context.run({ userId: 'b' }, () => model.generateContent('same meal'));
        expect(first.response.text()).toBe('{"call":1}');
        expect(second.response.text()).toBe('{"call":2}');
    });

    test('anonymous calls are never cached', async () => {
        const model = getModel(client(), 'food_photo', options());
        await model.generateContent('meal');
        const second = await model.generateContent('meal');
        expect(second.response.text()).toBe('{"call":2}');
    });

    test('coach replies are never reused even for identical questions', async () => {
        const model = getModel(client(), 'coach', options(), undefined, 'a');
        await model.generateContent('question');
        const second = await model.generateContent('question');
        expect(second.response.text()).toBe('{"call":2}');
    });

    test('scan cache expires after two minutes', async () => {
        const now = Date.now();
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
        const model = getModel(client(), 'food_photo', options(), undefined, 'a');
        await model.generateContent('meal');
        clock.mockReturnValue(now + 120001);
        const second = await model.generateContent('meal');
        expect(second.response.text()).toBe('{"call":2}');
    });

    test('truncated JSON is not cached as a successful scan', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            candidates: [{ content: { role: 'model', parts: [{ text: '{"items":[' }] }, finishReason: 'MAX_TOKENS' }],
        }), { status: 200 }));
        const model = getModel(client(), 'food_photo', options({ generationConfig: { responseMimeType: 'application/json' } }), undefined, 'a');
        await model.generateContent('meal');
        const second = await model.generateContent('meal');
        expect(second.response.text()).toBe('{"call":1}');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    test('a failed paid call does not poison retries', async () => {
        fetchSpy.mockRejectedValueOnce(new Error('network disconnected'));
        const model = getModel(client(), 'food_photo', options(), undefined, 'a');
        await expect(model.generateContent('meal')).rejects.toThrow('network disconnected');
        const second = await model.generateContent('meal');
        expect(second.response.text()).toBe('{"call":1}');
    });

    test('usage logs contain token counts, not prompts, images or user identifiers', async () => {
        await getModel(client(), 'food_text', options(), undefined, 'private-owner').generateContent('private-meal');
        expect(console.info).toHaveBeenCalledWith('Gemini usage', {
            feature: 'food_text', model: 'gemini-3.1-flash-lite',
            inputTokens: 100, outputTokens: 20, thinkingTokens: 0, totalTokens: 120,
        });
    });
});
