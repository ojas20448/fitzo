/**
 * Transcription provider router.
 *
 * Routes ASR to Groq Whisper or Gemini, with the other as a fallback. Callers
 * ask for a transcript and do not care which model produced it.
 *
 * ── Why a router rather than just replacing the Gemini call ─────────────────
 * Transcription is the highest-volume AI call in Fitzo, and on Gemini it draws
 * from the same project-wide quota as the coach — when that quota ran out in
 * production, voice logging and the coach failed together. Groq's free tier
 * carries roughly 2,000 transcriptions/day against Gemini's ~250 shared across
 * every feature, so moving ASR off Gemini protects the coach as much as it
 * helps voice logging.
 *
 * But Fitzo's users speak Hinglish, and code-switched Hindi-English is exactly
 * where ASR models diverge. Gemini is known-acceptable there; Whisper is not
 * yet verified. A hard swap would trade a proven path for an unproven one.
 *
 * So the provider is configurable and the other one catches failures:
 *
 *   TRANSCRIPTION_PROVIDER=gemini   (default) Gemini primary, Groq fallback
 *   TRANSCRIPTION_PROVIDER=groq               Groq primary, Gemini fallback
 *
 * Flip it with an env var once scripts/compare_transcription.js shows Whisper
 * holds up on real Hinglish recordings. No deploy, and it flips back just as
 * fast if quality regresses in the field.
 */

const groq = require('./groq');
const gemini = require('./gemini');
const { AIUnavailableError } = require('../utils/errors');

const PROVIDER = (process.env.TRANSCRIPTION_PROVIDER || 'gemini').toLowerCase();

const PROVIDERS = {
    groq: {
        name: 'groq',
        available: () => groq.isConfigured(),
        run: (audio, mime) => groq.transcribeAudio(audio, mime),
    },
    gemini: {
        name: 'gemini',
        available: () => Boolean(process.env.GEMINI_API_KEY),
        run: (audio, mime) => gemini.transcribeAudio(audio, mime),
    },
};

/**
 * @returns {Promise<{ text: string, provider: string }>}
 */
async function transcribe(base64Data, mimeType) {
    const primary = PROVIDERS[PROVIDER] || PROVIDERS.gemini;
    const secondary = primary.name === 'groq' ? PROVIDERS.gemini : PROVIDERS.groq;

    // available() decides ORDER, never whether to try at all. If no provider
    // reports itself configured we still attempt the primary, because a
    // generic "unavailable" would hide the real cause — a renamed env var, a
    // credential injected by another mechanism, a stubbed service — behind a
    // 503 that says nothing. Let the provider fail with its own error.
    const configured = [primary, secondary].filter((p) => p.available());
    const order = configured.length > 0 ? configured : [primary];

    let lastError;
    for (const provider of order) {
        try {
            const text = await provider.run(base64Data, mimeType);
            // An empty transcript is a legitimate outcome — silence, or audio
            // the model could not resolve — not a provider failure. Returning
            // it lets the route give its own "didn't catch that" message rather
            // than burning a second provider's quota on the same silence.
            return { text, provider: provider.name };
        } catch (error) {
            lastError = error;
            const transient = groq.isTransientError(error) || error instanceof AIUnavailableError;
            console.error(
                `[transcription] ${provider.name} failed${transient ? ' (transient)' : ''}:`,
                error.message,
            );
            // A non-transient failure — bad audio, unsupported format, a
            // malformed request — will fail identically on the other provider.
            // Retrying it just doubles the latency before the same error.
            if (!transient) break;
        }
    }

    if (groq.isTransientError(lastError) || lastError instanceof AIUnavailableError) {
        throw new AIUnavailableError('Voice logging is busy right now. Try again in a moment.');
    }
    throw new Error('Failed to transcribe audio. Please try again.');
}

module.exports = { transcribe, PROVIDER };
