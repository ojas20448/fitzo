const { normalizeTranscript } = require('../services/hinglish');

describe('Hinglish counts — the failures actually measured on Whisper', () => {
    test('"das reps" becomes 10 reps, the error that started this', () => {
        // Groq returned "dos reps" for spoken "das reps" (ten). Prompt-seeding
        // did not fix it, so it is repaired deterministically here.
        expect(normalizeTranscript('char set, dos reps, 60 kilo'))
            .toBe('4 set, 10 reps, 60 kilo');
    });

    test.each([
        ['do roti aur dal', '2 roti and dal'],
        ['ek bowl dal', '1 bowl dal'],
        ['teen sets', '3 sets'],
        ['chaar set das reps', '4 set 10 reps'],
        ['paanch minutes', '5 minutes'],
        ['bees kilo', '20 kilo'],
        ['aath reps', '8 reps'],
        ['do egg', '2 egg'],
    ])('%s -> %s', (input, expected) => {
        expect(normalizeTranscript(input)).toBe(expected);
    });

    test('accepts the spelling variants ASR actually produces', () => {
        expect(normalizeTranscript('char reps')).toBe('4 reps');
        expect(normalizeTranscript('chaar reps')).toBe('4 reps');
        expect(normalizeTranscript('dus reps')).toBe('10 reps');
        expect(normalizeTranscript('das reps')).toBe('10 reps');
    });

    test('tolerates ASR punctuation between numeral and unit', () => {
        // Observed on Whisper: "ek katori dal" transcribed as "ek, katori, dal".
        // Requiring plain whitespace left the count unconverted.
        expect(normalizeTranscript('ek, katori, dal')).toBe('1 bowl, dal');
        expect(normalizeTranscript('das, reps')).toBe('10 reps');
    });

    test('a comma does not defeat the English guard', () => {
        expect(normalizeTranscript('do, you have protein')).toBe('do, you have protein');
    });

    test('allows one adjective between numeral and unit', () => {
        expect(normalizeTranscript('do bade roti')).toBe('2 bade roti');
    });
});

describe('must NOT invent numbers — the dangerous direction', () => {
    // A missed conversion leaves the downstream LLM a Hindi word it can still
    // interpret. A wrong conversion fabricates a number nobody said, and the
    // user sees a plausible entry that is simply false.
    test('"do" as an English verb is left alone', () => {
        expect(normalizeTranscript('do you have protein')).toBe('do you have protein');
        expect(normalizeTranscript('what should I do today')).toBe('what should I do today');
    });

    test('"no" as English is left alone', () => {
        // "nau" is 9, and "no" is a listed variant — but only before a unit.
        expect(normalizeTranscript('no pain today')).toBe('no pain today');
    });

    test('"set" as a verb does not trigger on an unrelated numeral', () => {
        expect(normalizeTranscript('do not set a reminder')).toBe('do not set a reminder');
    });

    test('a spoken range is preserved rather than collapsed', () => {
        // "do teen roti" is "two or three rotis". Picking one invents precision.
        expect(normalizeTranscript('do teen roti')).toBe('do teen roti');
    });

    test('plain English passes through untouched', () => {
        const s = 'Bench press 3 sets of 8 at 80 kilos and 1 whey protein shake';
        expect(normalizeTranscript(s)).toBe(s);
    });
});

describe('Devanagari', () => {
    test('number words convert anywhere — no English word collides', () => {
        expect(normalizeTranscript('दस reps')).toBe('10 reps');
        expect(normalizeTranscript('चार सेट')).toBe('4 सेट');
    });

    test('Devanagari digits become ASCII', () => {
        expect(normalizeTranscript('१२ reps')).toBe('12 reps');
        expect(normalizeTranscript('५ sets')).toBe('5 sets');
    });
});

describe('quantity words', () => {
    test.each([
        ['aadha bowl dal', 'half bowl dal'],
        ['thoda paneer', 'a little paneer'],
        ['ek katori chawal', '1 bowl chawal'],
        ['poora plate', 'full plate'],
    ])('%s -> %s', (input, expected) => {
        expect(normalizeTranscript(input)).toBe(expected);
    });
});

describe('"aur" vs "or" — a meaning inversion, not a spelling slip', () => {
    test('after a counted noun it means "and"', () => {
        // "roti or dal" reads as a choice; the speaker listed two items.
        expect(normalizeTranscript('2 roti or dal')).toBe('2 roti and dal');
        expect(normalizeTranscript('do roti aur dal')).toBe('2 roti and dal');
    });

    test('a genuine English "or" after a verb is untouched', () => {
        expect(normalizeTranscript('should I squat or deadlift'))
            .toBe('should I squat or deadlift');
    });
});

describe('input hygiene', () => {
    test.each([[null], [undefined], [''], [123], [{}]])('%p returns empty string', (v) => {
        expect(normalizeTranscript(v)).toBe('');
    });

    test('collapses the whitespace it introduces', () => {
        // Neutral text on purpose: "do roti" would legitimately convert to
        // "2 roti", which is the feature, not a whitespace concern.
        expect(normalizeTranscript('had   lunch   already')).toBe('had lunch already');
        expect(normalizeTranscript('  ek bowl dal  ')).toBe('1 bowl dal');
    });
});
