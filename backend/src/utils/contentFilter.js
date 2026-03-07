/**
 * Content Filter - blocks slurs, hate speech, and severe profanity
 * Lightweight filter for user-generated content
 */

// Severe slurs and hate speech (always blocked)
const BLOCKED_WORDS = [
    'nigger', 'nigga', 'nigg3r', 'n1gger', 'n1gga',
    'faggot', 'fag', 'f4ggot', 'f4g',
    'retard', 'r3tard',
    'chink', 'ch1nk',
    'spic', 'sp1c',
    'kike', 'k1ke',
    'wetback',
    'gook',
    'tranny',
    'coon',
    'beaner',
    'sandnigger',
    'towelhead',
    'raghead',
    'whitetrash',
    'cracker',
];

// Build regex patterns that catch common evasion (letter substitution, spacing)
function buildPattern(word) {
    const escaped = word
        .replace(/a/gi, '[a@4]')
        .replace(/e/gi, '[e3]')
        .replace(/i/gi, '[i1!]')
        .replace(/o/gi, '[o0]')
        .replace(/s/gi, '[s$5]')
        .replace(/t/gi, '[t7]');
    return new RegExp(`\\b${escaped}s?\\b`, 'i');
}

const PATTERNS = BLOCKED_WORDS.map(buildPattern);

/**
 * Check if text contains blocked content
 * @param {string} text
 * @returns {{ blocked: boolean, reason?: string }}
 */
function checkContent(text) {
    if (!text) return { blocked: false };

    const normalized = text.toLowerCase().replace(/[_\-\.]/g, '');

    for (const pattern of PATTERNS) {
        if (pattern.test(normalized)) {
            return {
                blocked: true,
                reason: 'Your message contains language that violates our community guidelines.',
            };
        }
    }

    return { blocked: false };
}

module.exports = { checkContent };
