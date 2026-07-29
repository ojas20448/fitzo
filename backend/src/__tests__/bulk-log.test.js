/**
 * Bulk Meal Log Tests
 * Nobody eats "1 roti" — they eat 2 roti + dal + sabzi + rice + curd.
 */

const { validateComboItems, MAX_COMBO_ITEMS, MAX_ITEM_MACRO_GRAMS } = require('../utils/mealCombo');

const item = (over = {}) => ({
    meal_name: 'Roti',
    calories: 120,
    protein: 3,
    carbs: 20,
    fat: 3,
    ...over,
});

describe('validateComboItems', () => {
    it('accepts a normal thali', () => {
        const result = validateComboItems([item(), item({ meal_name: 'Dal' })]);
        expect(result.valid).toBe(true);
        expect(result.items).toHaveLength(2);
    });

    it('rejects a non-array', () => {
        expect(validateComboItems(null).valid).toBe(false);
        expect(validateComboItems({}).valid).toBe(false);
    });

    it('rejects an empty combo', () => {
        expect(validateComboItems([]).valid).toBe(false);
    });

    it('rejects more than the item cap', () => {
        const many = Array.from({ length: MAX_COMBO_ITEMS + 1 }, () => item());
        expect(validateComboItems(many).valid).toBe(false);
    });

    it('rejects negative or absurd calories', () => {
        expect(validateComboItems([item({ calories: -5 })]).valid).toBe(false);
        expect(validateComboItems([item({ calories: 99999 })]).valid).toBe(false);
    });

    it('defaults missing macros to zero rather than failing', () => {
        const result = validateComboItems([{ meal_name: 'Curd', calories: 60 }]);
        expect(result.valid).toBe(true);
        expect(result.items[0]).toMatchObject({ protein: 0, carbs: 0, fat: 0 });
    });

    it('rejects an item with no name', () => {
        expect(validateComboItems([item({ meal_name: '' })]).valid).toBe(false);
    });

    it('rejects an absurd macro value instead of letting it hit the INTEGER column', () => {
        const result = validateComboItems([item({ protein: 1e18 })]);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/Roti/);
    });

    it('accepts a macro value right at the cap', () => {
        const result = validateComboItems([item({ fat: MAX_ITEM_MACRO_GRAMS })]);
        expect(result.valid).toBe(true);
    });
});
