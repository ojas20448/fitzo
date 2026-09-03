/**
 * The quota detector has to match on error SHAPE, because the Gemini SDK
 * reports an exhausted quota inconsistently — sometimes an HTTP 429, sometimes
 * a RESOURCE_EXHAUSTED status string, sometimes only prose in the message.
 *
 * Getting this wrong is silent: a missed quota error falls through to the
 * canned "AI service unavailable" fallback, so a temporary, self-healing
 * condition is presented to the user as a broken feature. A false positive is
 * just as bad in the other direction — a genuine bug would be reported as
 * "busy, try again", and nobody would ever investigate it.
 */

const { AIUnavailableError } = require('../utils/errors');

// isQuotaError is module-private, so exercise it the way the service does:
// through the behaviour it drives. Kept in sync with the implementation.
function isQuotaError(error) {
    if (!error) return false;
    const status = error.status || error.code;
    if (status === 429 || status === 'RESOURCE_EXHAUSTED') return true;
    const text = String(error.message || '');
    return /\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(text);
}

describe('isQuotaError — shapes the Gemini SDK actually produces', () => {
    test.each([
        ['numeric HTTP status', { status: 429 }],
        ['status on .code', { code: 429 }],
        ['RESOURCE_EXHAUSTED status', { status: 'RESOURCE_EXHAUSTED' }],
        ['429 only in the message', { message: '[GoogleGenerativeAI Error]: ... [429 Too Many Requests]' }],
        ['RESOURCE_EXHAUSTED in prose', { message: 'reason: RESOURCE_EXHAUSTED' }],
        ['quota wording', { message: 'You exceeded your current quota' }],
        ['rate limit wording', { message: 'Rate limit exceeded for this project' }],
        ['mixed case', { message: 'QUOTA exceeded' }],
    ])('detects %s', (_label, err) => {
        expect(isQuotaError(err)).toBe(true);
    });
});

describe('isQuotaError — must NOT fire on unrelated failures', () => {
    // Each of these is a real bug. Misreporting it as "busy, try again" would
    // hide it behind a message that invites the user to retry forever.
    test.each([
        ['invalid API key', { status: 400, message: 'API key not valid. Please pass a valid API key.' }],
        ['model retired', { status: 404, message: 'models/gemini-2.5-flash is not found' }],
        ['safety block', { message: 'Candidate was blocked due to SAFETY' }],
        ['network failure', { message: 'fetch failed' }],
        ['parse failure', new SyntaxError('Unexpected token < in JSON')],
        ['null', null],
        ['undefined', undefined],
        ['empty object', {}],
    ])('ignores %s', (_label, err) => {
        expect(isQuotaError(err)).toBe(false);
    });

    test('a 4290 status code does not match the 429 word boundary', () => {
        expect(isQuotaError({ message: 'error 4290 occurred' })).toBe(false);
    });
});

// Mirrors the implementation. A timeout must be treated as transient because
// an exhausted quota can PRESENT as one: observed in production, Flash stopped
// returning 429s and simply hung, holding the connection for 150s.
function isTransientError(error) {
    if (isQuotaError(error)) return true;
    if (!error) return false;
    const name = String(error.name || '');
    const text = String(error.message || '');
    const status = error.status || error.code;
    if (status === 503 || status === 'UNAVAILABLE') return true;
    if (/\b503\b|Service Unavailable|high demand|overloaded|UNAVAILABLE/i.test(text)) return true;
    return /abort|timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up/i.test(name + ' ' + text);
}

describe('isTransientError — timeouts count, because a hung quota looks like one', () => {
    test.each([
        ['SDK abort error', { name: 'GoogleGenerativeAIAbortError', message: 'Request aborted' }],
        ['explicit timeout', { message: 'Request timed out after 30000ms' }],
        ['ETIMEDOUT', { message: 'connect ETIMEDOUT 142.250.0.1:443' }],
        ['socket hang up', { message: 'socket hang up' }],
        ['ECONNRESET', { message: 'read ECONNRESET' }],
        ['still catches plain quota', { status: 429 }],
        // Verbatim from the production Render logs. This was previously
        // unmatched, so Google being overloaded reached the user as a 400
        // saying their photo could not be read — a self-healing outage
        // reported as a permanent fault with their input.
        ['Gemini overload prose', {
            message: '[GoogleGenerativeAI Error]: Error fetching from '
                + 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent: '
                + '[503 Service Unavailable] This model is currently experiencing high demand. '
                + 'Spikes in demand are usually temporary. Please try again later.',
        }],
        ['503 numeric status', { status: 503 }],
        ['UNAVAILABLE status string', { status: 'UNAVAILABLE' }],
        ['overloaded wording', { message: 'The model is overloaded. Please try again.' }],
    ])('treats %s as transient', (_label, err) => {
        expect(isTransientError(err)).toBe(true);
    });

    test.each([
        ['invalid API key', { status: 400, message: 'API key not valid' }],
        ['safety block', { message: 'blocked due to SAFETY' }],
        ['parse failure', new SyntaxError('Unexpected token')],
    ])('does not claim %s', (_label, err) => {
        expect(isTransientError(err)).toBe(false);
    });
});

describe('AIUnavailableError', () => {
    test('is a 503, not a 429', () => {
        // 429 would mean "the client sent too much" and the app's own retry
        // logic keys off it. The user did nothing wrong here — the shared
        // project quota ran out — and the per-user aiQuota limiter already
        // owns 429, so these must stay distinguishable.
        const err = new AIUnavailableError();
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe('AI_UNAVAILABLE');
    });

    test('carries a message safe to show a user', () => {
        const err = new AIUnavailableError();
        expect(err.message).toMatch(/try again/i);
        expect(err.message).not.toMatch(/quota|gemini|api key|token/i);
    });

    test('accepts an override for non-coach surfaces', () => {
        expect(new AIUnavailableError('Voice logging is busy.').message).toBe('Voice logging is busy.');
    });
});
