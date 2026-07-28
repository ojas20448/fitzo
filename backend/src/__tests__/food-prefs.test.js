/**
 * Food Preference Tests
 * Only the pure key-normalisation is unit tested here; the read/write
 * helpers touch Postgres and are covered by manual verification in Task 5.
 */

const { normaliseFoodKey } = require('../services/foodPrefs');

describe('normaliseFoodKey', () => {
    it('lowercases and trims', () => {
        expect(normaliseFoodKey('  Dal Tadka  ')).toBe('dal tadka');
    });

    it('collapses internal whitespace', () => {
        expect(normaliseFoodKey('Paneer   Butter  Masala')).toBe('paneer butter masala');
    });

    it('strips parenthetical qualifiers so variants share one key', () => {
        expect(normaliseFoodKey('Roti (Chapati)')).toBe('roti');
        expect(normaliseFoodKey('Dal (Toor/Arhar)')).toBe('dal');
    });

    it('truncates to the column width', () => {
        const key = normaliseFoodKey('x'.repeat(200));
        expect(key.length).toBeLessThanOrEqual(120);
    });

    it('returns empty string for junk input', () => {
        expect(normaliseFoodKey(null)).toBe('');
        expect(normaliseFoodKey(undefined)).toBe('');
        expect(normaliseFoodKey('')).toBe('');
    });
});
