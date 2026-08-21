/**
 * The transcription router's job is to keep voice logging working when one
 * provider is down, without wasting the other provider's quota on failures
 * that would repeat identically.
 *
 * The distinction that matters: a TRANSIENT failure (quota, timeout) is worth
 * retrying elsewhere; a PERMANENT one (corrupt audio, unsupported format) will
 * fail the same way on the second provider, so retrying only doubles the
 * latency before showing the same error.
 */

const realGroq = jest.requireActual('../services/groq');

jest.mock('../services/groq');
jest.mock('../services/gemini');

describe('transcription router', () => {
    let transcribe, groq, gemini;

    const load = (provider) => {
        jest.resetModules();
        if (provider) process.env.TRANSCRIPTION_PROVIDER = provider;
        else delete process.env.TRANSCRIPTION_PROVIDER;
        process.env.GEMINI_API_KEY = 'test-key';

        // Re-require INSIDE the fresh registry, so these are the very objects
        // transcription.js will resolve.
        groq = require('../services/groq');
        gemini = require('../services/gemini');
        // isTransientError is real logic, not a stub — the routing decision
        // depends on it, so stubbing it would test nothing.
        groq.isTransientError.mockImplementation(realGroq.isTransientError);
        groq.isConfigured.mockReturnValue(true);

        const mod = require('../services/transcription');
        transcribe = mod.transcribe;
        return mod;
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('gemini is the default provider — Whisper Hinglish is unverified', () => {
        expect(load(null).PROVIDER).toBe('gemini');
    });

    test('uses the configured primary', async () => {
        load('groq');
        groq.transcribeAudio.mockResolvedValue('two roti and dal');
        const result = await transcribe('base64', 'audio/mp4');
        expect(result).toEqual({ text: 'two roti and dal', provider: 'groq' });
        expect(gemini.transcribeAudio).not.toHaveBeenCalled();
    });

    test('falls back to the other provider on a TRANSIENT failure', async () => {
        load('groq');
        const err = new Error('Groq transcription failed: 429 rate limit');
        err.status = 429;
        groq.transcribeAudio.mockRejectedValue(err);
        gemini.transcribeAudio.mockResolvedValue('recovered');

        const result = await transcribe('base64', 'audio/mp4');
        expect(result).toEqual({ text: 'recovered', provider: 'gemini' });
    });

    test('does NOT fall back on a PERMANENT failure', async () => {
        load('groq');
        // Corrupt audio fails identically everywhere. A second attempt just
        // doubles the wait before the user sees the same message.
        groq.transcribeAudio.mockRejectedValue(new Error('Invalid file format'));

        await expect(transcribe('base64', 'audio/mp4')).rejects.toThrow(/Failed to transcribe/);
        expect(gemini.transcribeAudio).not.toHaveBeenCalled();
    });

    test('an empty transcript is returned, not treated as failure', async () => {
        load('groq');
        // Silence is a legitimate result. Retrying it on the second provider
        // burns quota to arrive at the same empty string; the route already
        // has its own "didn't catch that" message for this.
        groq.transcribeAudio.mockResolvedValue('');

        const result = await transcribe('base64', 'audio/mp4');
        expect(result).toEqual({ text: '', provider: 'groq' });
        expect(gemini.transcribeAudio).not.toHaveBeenCalled();
    });

    test('surfaces AI_UNAVAILABLE when both providers are exhausted', async () => {
        load('groq');
        const quota = () => Object.assign(new Error('rate limit exceeded'), { status: 429 });
        groq.transcribeAudio.mockRejectedValue(quota());
        gemini.transcribeAudio.mockRejectedValue(quota());

        // Asserted on `code`, not `instanceof`. jest.resetModules() hands the
        // router its own copy of utils/errors, so its AIUnavailableError is a
        // different constructor from the one this file imported and instanceof
        // can never match across the two registries. The HTTP contract — a 503
        // carrying AI_UNAVAILABLE — is what callers actually depend on anyway.
        await expect(transcribe('base64', 'audio/mp4')).rejects.toMatchObject({
            code: 'AI_UNAVAILABLE',
            statusCode: 503,
        });
    });

    test('skips an unconfigured provider instead of failing on it', async () => {
        const mod = load('groq');
        groq.isConfigured.mockReturnValue(false);   // no GROQ_API_KEY
        gemini.transcribeAudio.mockResolvedValue('from gemini');

        const result = await mod.transcribe('base64', 'audio/mp4');
        expect(result.provider).toBe('gemini');
        expect(groq.transcribeAudio).not.toHaveBeenCalled();
    });
});

describe('groq.isTransientError', () => {
    test.each([
        ['429', { status: 429 }],
        ['503', { status: 503 }],
        ['rate limit prose', { message: 'rate limit exceeded' }],
        ['abort', { name: 'AbortError', message: 'aborted' }],
        ['timeout', { message: 'Request timed out' }],
    ])('treats %s as transient', (_l, e) => expect(realGroq.isTransientError(e)).toBe(true));

    test.each([
        ['bad format', { status: 400, message: 'Invalid file format' }],
        ['bad key', { status: 401, message: 'Invalid API Key' }],
        ['null', null],
    ])('does not claim %s', (_l, e) => expect(realGroq.isTransientError(e)).toBe(false));
});
