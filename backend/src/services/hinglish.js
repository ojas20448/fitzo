/**
 * Normalise Hinglish transcripts before extraction.
 *
 * ── Why this exists rather than more prompt tuning ──────────────────────────
 * Measured on Groq Whisper: "das reps" (ten) came back as "dos reps". Seeding
 * the ASR prompt with Hindi numerals did NOT fix it, while the same prompt did
 * fix "ek bol" -> "ek bowl". Numbers are the highest-stakes words in the app —
 * a mangled food name usually fails extraction visibly, but a mangled number
 * silently logs the wrong rep count and the user never finds out.
 *
 * So the numbers are repaired deterministically here instead of being wished
 * for in a prompt. This layer is free, instant, testable, and provider-neutral:
 * it improves Gemini transcripts as much as Whisper ones, and keeps working if
 * the provider changes again.
 *
 * ── The ambiguity that shapes every rule below ──────────────────────────────
 * "do" is Hindi for 2 and an English verb. "Do roti" means two rotis; "do you
 * have" does not. So numerals are ONLY converted when immediately followed by
 * a unit the app cares about — reps, sets, kilos, a food, a container. Outside
 * that window the word is left exactly as spoken.
 *
 * Being wrong in the safe direction matters: a missed conversion leaves the
 * downstream LLM a Hindi word it can still interpret, whereas a wrong
 * conversion invents a number nobody said.
 */

// Hindi numerals, including the spellings ASR actually produces. Several
// variants map to one value on purpose: "chaar"/"char", "paanch"/"panch".
// "dos" and "das" both map to 10 — "dos" is not a Hindi word, it is the
// observed mishearing of "das", and treating it as 10 is what makes a real
// recording log correctly.
const NUMERALS = {
    ek: 1, aik: 1,
    do: 2, doh: 2,
    teen: 3, tin: 3,
    chaar: 4, char: 4, chār: 4,
    paanch: 5, panch: 5, paach: 5,
    chhe: 6, che: 6, chhah: 6, cheh: 6,
    saat: 7, sat: 7,
    aath: 8, ath: 8,
    nau: 9, no: 9,
    das: 10, dus: 10, dos: 10,
    gyarah: 11, gyara: 11,
    barah: 12, bara: 12,
    terah: 13, chaudah: 14,
    pandrah: 15, pandra: 15,
    solah: 16, satrah: 17, atharah: 18, unnis: 19,
    bees: 20, bis: 20,
    pachees: 25, pachis: 25,
    tees: 30, tis: 30,
    chalees: 40, chalis: 40,
    pachaas: 50, pachas: 50,
    saath: 60,
    sattar: 70, assi: 80, nabbe: 90,
    sau: 100,
};

// Devanagari, in case the provider auto-detects Hindi and returns native script.
const DEVANAGARI = {
    'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5,
    'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
    'ग्यारह': 11, 'बारह': 12, 'पंद्रह': 15, 'बीस': 20, 'तीस': 30,
    'चालीस': 40, 'पचास': 50, 'साठ': 60, 'सौ': 100,
};

// The words whose presence proves a preceding numeral really is a count.
// Deliberately narrow — this is the guard that stops "do you" becoming "2 you".
const UNITS = [
    'rep', 'reps', 'repetition', 'repetitions',
    'set', 'sets',
    'kilo', 'kilos', 'kg', 'kgs', 'kilogram', 'kilograms',
    'gram', 'grams', 'gm',
    'bowl', 'bowls', 'katori', 'katoris',
    'plate', 'plates', 'glass', 'glasses', 'cup', 'cups',
    'piece', 'pieces', 'slice', 'slices', 'spoon', 'spoons', 'tbsp', 'tsp',
    'roti', 'rotis', 'chapati', 'chapatis', 'phulka', 'paratha', 'parathas',
    'idli', 'idlis', 'dosa', 'dosas', 'egg', 'eggs', 'banana', 'bananas',
    'scoop', 'scoops', 'shake', 'shakes',
    'minute', 'minutes', 'min', 'second', 'seconds',
    'round', 'rounds', 'km', 'kilometre', 'kilometres',
];

// Hinglish quantity and filler words that carry meaning for portion sizing.
const QUANTITY_WORDS = {
    aadha: 'half', adha: 'half', aadhi: 'half',
    poora: 'full', pura: 'full', poori: 'full',
    thoda: 'a little', thodi: 'a little', thora: 'a little',
    zyada: 'a lot', jyada: 'a lot',
    katori: 'bowl', katoris: 'bowls',
};

// English function words that must never occupy the adjective slot between a
// numeral and a unit. "do" is Hindi 2 AND an English verb, and several units
// ("set", "round", "piece") are also English nouns or verbs, so without this
// guard ordinary English sentences get numbers injected into them.
const MIDDLE_STOPWORDS = new Set([
    'not', 'you', 'your', 'the', 'a', 'an', 'my', 'his', 'her', 'their', 'our',
    'is', 'are', 'was', 'were', 'be', 'been', 'am',
    'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must',
    'have', 'has', 'had', 'do', 'does', 'did',
    'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
    'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as',
    'i', 'me', 'we', 'he', 'she', 'it', 'they',
    'more', 'less', 'some', 'any', 'each', 'every', 'no',
]);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UNIT_ALT = UNITS.map(escape).join('|');

/**
 * @param {string} text Raw transcript from any provider.
 * @returns {string} Transcript with Hinglish counts and quantities normalised.
 */
function normalizeTranscript(text) {
    if (!text || typeof text !== 'string') return '';
    let out = text;

    // 1. Devanagari numerals — unambiguous, so converted anywhere they appear.
    //    No English word collides with these, so no unit guard is needed.
    for (const [word, value] of Object.entries(DEVANAGARI)) {
        out = out.replace(new RegExp(escape(word), 'g'), String(value));
    }

    // 2. Devanagari digits (१२३…) to ASCII.
    out = out.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));

    // 3. Romanised Hindi numerals — ONLY directly before a known unit.
    //    "das reps" -> "10 reps", but "do you have" is untouched because "you"
    //    is not a unit. One optional adjective is allowed between them so
    //    "do bade roti" still resolves.
    const numeralAlt = Object.keys(NUMERALS).map(escape).join('|');
    const counted = new RegExp(
        `\\b(${numeralAlt})\\b([,\\s]+\\w+)?([,\\s]+(?:${UNIT_ALT})\\b)`,
        'gi',
    );
    out = out.replace(counted, (match, num, middle, unit) => {
        const mid = middle ? middle.trim().toLowerCase() : '';

        // Reject the adjective slot if it is itself a numeral — "do teen roti"
        // is "two or three rotis", a genuine range, and collapsing it would
        // fabricate precision the speaker did not give.
        if (mid && NUMERALS[mid] !== undefined) return match;

        // Reject English function words in that slot. Without this, "do not
        // set a reminder" matched as <do><not><set> and became "2 not set a
        // reminder" — the exact class of error this whole module exists to
        // prevent, produced by the module itself.
        if (mid && MIDDLE_STOPWORDS.has(mid)) return match;

        // Separators are normalised to single spaces. The comma tolerance
        // above lets "ek, katori" match, but re-emitting the comma would leave
        // "1, bowl" in the text the extraction prompt reads — matched, then
        // handed on messier than it arrived.
        const tidy = (part) => (part ? ' ' + part.replace(/^[,\s]+/, '') : '');
        return `${NUMERALS[num.toLowerCase()]}${tidy(middle)}${tidy(unit)}`;
    });

    // 4. Quantity words, which are unambiguous in this domain.
    for (const [word, replacement] of Object.entries(QUANTITY_WORDS)) {
        out = out.replace(new RegExp(`\\b${escape(word)}\\b`, 'gi'), replacement);
    }

    // 5. "aur" is Hindi for "and" and is almost always heard as "or", which
    //    inverts the meaning: "roti or dal" reads as a choice, "roti and dal"
    //    as two items. Only fixed between two nouns, never after a verb.
    out = out.replace(/\b(\d+\s+\w+)\s+(?:aur|or)\s+(?=\w)/gi, '$1 and ');

    return out.replace(/\s{2,}/g, ' ').trim();
}

module.exports = { normalizeTranscript, NUMERALS, UNITS, QUANTITY_WORDS };
