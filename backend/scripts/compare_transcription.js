/**
 * Compare Gemini and Groq Whisper on the same audio.
 *
 * The decision this exists to settle: Fitzo's users speak Hinglish, and
 * code-switched Hindi-English is where ASR models diverge most. Groq is much
 * cheaper and faster, but cheaper is worthless if "do roti aur dal" comes back
 * as "do rocket and doll" — the extraction step downstream has nothing to match
 * on, and the user sees a wrong food logged rather than an error.
 *
 * So this runs both providers over the same recordings and prints them side by
 * side. Judge the transcripts yourself; there is no reference text to score
 * against, and eyeballing five real recordings tells you more than a WER number
 * computed from a script's own assumptions.
 *
 *   node scripts/compare_transcription.js <file.m4a> [more.m4a ...]
 *
 * Record on the phone you actually ship to, saying the things users will say:
 *
 *   "do roti, ek bowl dal aur thoda paneer bhurji"
 *   "bench press three sets of eight at eighty kilos"
 *   "aaj maine squats kiye, chaar set, das reps, sixty kilo"
 *   "protein shake with banana post workout"
 *
 * Mixed sentences matter most — a model can score well on pure English and
 * still collapse the moment a Hindi noun appears mid-sentence.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const groq = require('../src/services/groq');
const gemini = require('../src/services/gemini');

const MIME_BY_EXT = {
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mp3',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
};

async function timed(label, fn) {
    const start = Date.now();
    try {
        const text = await fn();
        return { label, ok: true, text, ms: Date.now() - start };
    } catch (error) {
        return { label, ok: false, text: error.message, ms: Date.now() - start };
    }
}

(async () => {
    const files = process.argv.slice(2);
    if (files.length === 0) {
        console.error('Usage: node scripts/compare_transcription.js <file.m4a> [...]');
        console.error('Record real Hinglish on the phone you ship to — see the header of this file.');
        process.exit(1);
    }

    if (!groq.isConfigured()) console.error('GROQ_API_KEY not set — Groq column will fail.\n');
    if (!process.env.GEMINI_API_KEY) console.error('GEMINI_API_KEY not set — Gemini column will fail.\n');

    for (const file of files) {
        if (!fs.existsSync(file)) { console.error(`missing: ${file}`); continue; }

        const ext = path.extname(file).toLowerCase();
        const mimeType = MIME_BY_EXT[ext];
        if (!mimeType) { console.error(`unsupported extension: ${ext}`); continue; }

        const base64 = fs.readFileSync(file).toString('base64');
        const kb = Math.round(base64.length / 1024);

        console.log('\n' + '─'.repeat(72));
        console.log(`${path.basename(file)}  (${mimeType}, ~${kb}KB base64)`);
        console.log('─'.repeat(72));

        // Sequential, not parallel: these hit two different rate limiters and a
        // 429 caused by our own concurrency would look like a quality problem.
        const results = [
            await timed(`groq/${groq.GROQ_MODEL}`, () => groq.transcribeAudio(base64, mimeType)),
            await timed('gemini', () => gemini.transcribeAudio(base64, mimeType)),
        ];

        for (const r of results) {
            console.log(`\n  ${r.label}  ${r.ms}ms  ${r.ok ? '' : '[FAILED]'}`);
            console.log(`    ${r.text}`);
        }

        const [g, m] = results;
        if (g.ok && m.ok) {
            const same = g.text.trim().toLowerCase() === m.text.trim().toLowerCase();
            console.log(`\n  identical: ${same ? 'yes' : 'no — read both above'}`);
            if (m.ms > 0) console.log(`  groq speed: ${(m.ms / g.ms).toFixed(1)}x vs gemini`);
        }
    }

    console.log('\n' + '─'.repeat(72));
    console.log('Judge the Hinglish yourself. Food and exercise nouns are what matter —');
    console.log('a wrong noun becomes a wrong food logged, not a visible error.');
    console.log('Happy with Groq?  set TRANSCRIPTION_PROVIDER=groq in Render.');
    console.log('─'.repeat(72));
    process.exit(0);
})();
