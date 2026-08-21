/**
 * Groq Whisper transcription.
 *
 * Why this exists: transcription is the highest-volume AI call in Fitzo — a
 * single voice log costs two calls (transcribe, then extract) — and on Gemini
 * it competes for the same project-wide quota as the coach. When that quota
 * ran out in production, Flash stopped responding entirely and the coach went
 * down with it.
 *
 * Groq's free tier carries roughly 2,000 transcriptions/day against Gemini's
 * ~250 requests/day shared across every feature, and runs Whisper far faster.
 * Moving ASR here removes the largest consumer from the Gemini bucket, so a
 * busy day of voice logging can no longer starve the coach.
 *
 * ── Deliberately NOT the default ────────────────────────────────────────────
 * Fitzo's users speak Hinglish, and code-switched Hindi-English is exactly
 * where ASR models differ most. Gemini has handled it acceptably in production;
 * Whisper is unverified on it. Switching the default on an untested assumption
 * would be trading a known-good path for an unknown one to save money that is
 * not currently the bottleneck.
 *
 * So: TRANSCRIPTION_PROVIDER selects the provider and defaults to gemini.
 * Set it to 'groq' once Hinglish accuracy has been compared on real recordings.
 * scripts/compare_transcription.js does that comparison.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// whisper-large-v3 rather than the turbo variant: turbo is faster and cheaper
// but measurably weaker on non-English and code-switched speech, which is the
// exact case that decides whether this is usable for Fitzo at all.
const GROQ_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3';

const TIMEOUT_MS = parseInt(process.env.GROQ_TIMEOUT_MS || '30000', 10);

/**
 * Seeds Whisper's decoder with in-domain vocabulary.
 *
 * Whisper accepts a `prompt` that biases token choice, and it matters most for
 * proper nouns and loanwords — precisely the words Fitzo depends on. Without
 * it, "paneer bhurji" and "Romanian deadlift" degrade into plausible English
 * neighbours, and the extraction step downstream then has nothing to match on.
 */
const DOMAIN_PROMPT =
    // Hindi NUMERALS come first because they are the highest-stakes words here.
    // Measured before this was added: "das reps" (ten) transcribed as "dos
    // reps". A mangled food name usually fails extraction visibly; a mangled
    // number silently logs the wrong rep count, which is worse — the user sees
    // a plausible entry and never knows it is wrong.
    'Hindi numbers: ek, do, teen, chaar, paanch, chhe, saat, aath, nau, das, ' +
    'gyarah, barah, pandrah, bees, pachees, tees, chalees, pachaas. ' +
    // Quantity words: "ek bowl dal" degraded to "ek bol dal", losing the unit
    // the extraction step needs to size the portion.
    'Quantities: bowl, katori, plate, glass, cup, piece, half, aadha, thoda, poora. ' +
    'Gym: reps, sets, kilos, drop set, RIR, bench press, deadlift, squat, ' +
    'overhead press, lat pulldown, barbell, dumbbell. ' +
    'Indian food: roti, chapati, dal, paneer, bhurji, rajma, chawal, curd, dahi, ' +
    'sabzi, idli, dosa, poha, chana, whey protein.';

function isTransientError(error) {
    if (!error) return false;
    const status = error.status || error.code;
    if (status === 429 || status === 503) return true;
    const text = String(error.name || '') + ' ' + String(error.message || '');
    return /\b429\b|\b503\b|quota|rate limit|abort|timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up/i.test(text);
}

function isConfigured() {
    return Boolean(process.env.GROQ_API_KEY);
}

/**
 * @param {string} base64Data Raw base64 audio (no data: prefix).
 * @param {string} mimeType   e.g. 'audio/mp4'
 * @returns {Promise<string>} Transcript text.
 */
async function transcribeAudio(base64Data, mimeType) {
    if (!isConfigured()) {
        const err = new Error('GROQ_API_KEY is not configured');
        err.code = 'GROQ_NOT_CONFIGURED';
        throw err;
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Whisper dispatches on the file EXTENSION, not the multipart content-type,
    // so the filename has to carry a real one or the request is rejected as an
    // unsupported format even though the bytes are fine.
    const ext = ({
        'audio/mp4': 'mp4',
        'audio/aac': 'aac',
        'audio/wav': 'wav',
        'audio/mp3': 'mp3',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/flac': 'flac',
    })[mimeType] || 'mp4';

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), `audio.${ext}`);
    form.append('model', GROQ_MODEL);
    form.append('response_format', 'text');
    form.append('prompt', DOMAIN_PROMPT);
    // `language` is deliberately left unset. Pinning 'en' makes Whisper
    // transliterate or drop Hindi words; pinning 'hi' makes it render English
    // gym terms in Devanagari. Auto-detect is the only option that keeps a
    // code-switched sentence intact.

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
            body: form,
            signal: controller.signal,
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            const err = new Error(`Groq transcription failed: ${res.status} ${detail.slice(0, 200)}`);
            err.status = res.status;
            throw err;
        }

        // response_format=text returns a bare string, not JSON.
        return (await res.text()).trim();
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { transcribeAudio, isConfigured, isTransientError, GROQ_MODEL, DOMAIN_PROMPT };
