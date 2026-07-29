/**
 * Food Category Tests
 * The dataset grew organically and has singular/plural splits
 * (Snack/Snacks, Beverage/Beverages) that fragment search and filtering.
 */

const { canonicalCategory } = require('../utils/foodCategories');

describe('canonicalCategory', () => {
    it('collapses singular/plural duplicates', () => {
        expect(canonicalCategory('Snack')).toBe('Snacks');
        expect(canonicalCategory('Snacks')).toBe('Snacks');
        expect(canonicalCategory('Beverage')).toBe('Beverages');
        expect(canonicalCategory('Beverages')).toBe('Beverages');
    });

    it('is case- and whitespace-insensitive', () => {
        expect(canonicalCategory('  snack ')).toBe('Snacks');
        expect(canonicalCategory('BEVERAGE')).toBe('Beverages');
    });

    it('passes through categories that need no change', () => {
        expect(canonicalCategory('Sabzi')).toBe('Sabzi');
        expect(canonicalCategory('South Indian')).toBe('South Indian');
    });

    it('title-cases unknown categories rather than dropping them', () => {
        expect(canonicalCategory('mithai')).toBe('Mithai');
    });

    it('returns Uncategorised for empty or junk input', () => {
        expect(canonicalCategory('')).toBe('Uncategorised');
        expect(canonicalCategory(null)).toBe('Uncategorised');
        expect(canonicalCategory(undefined)).toBe('Uncategorised');
    });

    it('leaves acronyms and hyphen-compounds untouched rather than lowercasing them', () => {
        expect(canonicalCategory('QSR Indian Chains')).toBe('QSR Indian Chains');
        expect(canonicalCategory('Non-Veg')).toBe('Non-Veg');
        expect(canonicalCategory('Indo-Chinese')).toBe('Indo-Chinese');
        expect(canonicalCategory('Packaged RTE')).toBe('Packaged RTE');
    });
});
