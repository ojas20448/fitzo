/**
 * Cooking Medium Tests
 *
 * Same dish, different kitchen. A home dal and a restaurant dal tadka differ
 * almost entirely in fat — this adjusts fat and recomputes calories from it.
 */

const {
    MEDIUMS,
    isMediumApplicable,
    applyCookingMedium,
    buildServingVariants,
} = require('../utils/cookingMedium');

const baseServing = {
    id: 'default',
    description: '1 cup (200g)',
    measurementDescription: '1 cup (200g)',
    calories: 180,
    protein: 9,
    carbs: 25,
    fat: 5,
    fiber: 4,
    sugar: 0,
    sodium: 0,
    saturatedFat: 0,
    cholesterol: 0,
};

describe('isMediumApplicable', () => {
    it('applies to cooked dishes', () => {
        expect(isMediumApplicable('Sabzi')).toBe(true);
        expect(isMediumApplicable('Home Cooking')).toBe(true);
        expect(isMediumApplicable('South Indian')).toBe(true);
        expect(isMediumApplicable('Street Food')).toBe(true);
    });

    it('does not apply to items with fixed nutrition', () => {
        expect(isMediumApplicable('Packaged')).toBe(false);
        expect(isMediumApplicable('Beverages')).toBe(false);
        expect(isMediumApplicable('Dairy')).toBe(false);
        expect(isMediumApplicable('Fast Food')).toBe(false);
    });

    it('is case-insensitive and safe on junk input', () => {
        expect(isMediumApplicable('sabzi')).toBe(true);
        expect(isMediumApplicable('')).toBe(false);
        expect(isMediumApplicable(null)).toBe(false);
        expect(isMediumApplicable(undefined)).toBe(false);
    });
});

describe('applyCookingMedium', () => {
    it('leaves the baseline medium untouched', () => {
        const out = applyCookingMedium(baseServing, 'home_light');
        expect(out.fat).toBe(5);
        expect(out.calories).toBe(180);
    });

    it('raises fat and recomputes calories for ghee', () => {
        const out = applyCookingMedium(baseServing, 'home_ghee');
        // fat 5 * 1.8 = 9; calories 180 + 9*(9-5) = 216
        expect(out.fat).toBe(9);
        expect(out.calories).toBe(216);
    });

    it('holds protein and carbs constant', () => {
        const out = applyCookingMedium(baseServing, 'restaurant');
        expect(out.protein).toBe(baseServing.protein);
        expect(out.carbs).toBe(baseServing.carbs);
    });

    it('never mutates the input serving', () => {
        const snapshot = JSON.stringify(baseServing);
        applyCookingMedium(baseServing, 'street');
        expect(JSON.stringify(baseServing)).toBe(snapshot);
    });

    it('preserves the full serving contract keys', () => {
        const out = applyCookingMedium(baseServing, 'home_ghee');
        Object.keys(baseServing).forEach((k) => {
            expect(out).toHaveProperty(k);
        });
    });

    it('returns an unchanged copy for an unknown medium', () => {
        const out = applyCookingMedium(baseServing, 'nonsense');
        expect(out.calories).toBe(180);
        expect(out.fat).toBe(5);
    });

    it('handles a zero-fat base without producing NaN', () => {
        const zero = { ...baseServing, fat: 0, calories: 136 };
        const out = applyCookingMedium(zero, 'restaurant');
        expect(out.fat).toBe(0);
        expect(out.calories).toBe(136);
    });
});

describe('buildServingVariants', () => {
    it('returns base plus one entry per medium for cooked dishes', () => {
        const variants = buildServingVariants(baseServing, 'Sabzi');
        expect(variants).toHaveLength(MEDIUMS.length);
        expect(variants[0].id).toBe('home_light');
    });

    it('labels each variant so the picker is readable', () => {
        const variants = buildServingVariants(baseServing, 'Sabzi');
        const labels = variants.map((v) => v.description);
        expect(labels.some((l) => /ghee/i.test(l))).toBe(true);
        expect(labels.some((l) => /restaurant/i.test(l))).toBe(true);
    });

    it('returns only the base serving when not applicable', () => {
        const variants = buildServingVariants(baseServing, 'Packaged');
        expect(variants).toHaveLength(1);
        expect(variants[0].id).toBe('default');
    });

    it('produces strictly increasing calories across mediums', () => {
        const variants = buildServingVariants(baseServing, 'Sabzi');
        const cals = variants.map((v) => v.calories);
        const sorted = [...cals].sort((a, b) => a - b);
        expect(cals).toEqual(sorted);
    });
});
