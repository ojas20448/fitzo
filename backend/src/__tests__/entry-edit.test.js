/**
 * Entry Edit Tests
 *
 * A PATCH must only touch what was sent. Nulling unspecified macros would
 * silently zero a member's protein when they only meant to fix calories,
 * which is exactly the kind of quiet corruption this feature exists to undo.
 */

const { validateEntryPatch } = require('../utils/entryEdit');
const { MAX_ITEM_CALORIES, MAX_ITEM_MACRO_GRAMS } = require('../utils/mealCombo');

describe('validateEntryPatch', () => {
    it('returns only the fields that were sent', () => {
        const r = validateEntryPatch({ calories: 250 });
        expect(r.valid).toBe(true);
        expect(r.fields).toEqual({ calories: 250 });
        expect('protein' in r.fields).toBe(false);
    });

    it('accepts every editable field together', () => {
        const r = validateEntryPatch({
            food_name: 'Dal', calories: 200, protein: 9, carbs: 25, fat: 5,
            serving_size: '1 katori', meal_type: 'lunch',
        });
        expect(r.valid).toBe(true);
        expect(Object.keys(r.fields).sort()).toEqual(
            ['calories', 'carbs', 'fat', 'food_name', 'meal_type', 'protein', 'serving_size'],
        );
    });

    it('rejects an empty body — a PATCH that changes nothing is a mistake', () => {
        expect(validateEntryPatch({}).valid).toBe(false);
        expect(validateEntryPatch(null).valid).toBe(false);
    });

    it('ignores unknown keys rather than passing them toward SQL', () => {
        const r = validateEntryPatch({ calories: 100, user_id: 'someone-else', id: 'x' });
        expect(r.valid).toBe(true);
        expect(r.fields).toEqual({ calories: 100 });
    });

    it('accepts 0 as a real value for every macro', () => {
        const r = validateEntryPatch({ calories: 0, protein: 0, carbs: 0, fat: 0 });
        expect(r.valid).toBe(true);
        expect(r.fields).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    });

    it('enforces the bounds already used by bulk logging', () => {
        expect(validateEntryPatch({ calories: MAX_ITEM_CALORIES }).valid).toBe(true);
        expect(validateEntryPatch({ calories: MAX_ITEM_CALORIES + 1 }).valid).toBe(false);
        expect(validateEntryPatch({ protein: MAX_ITEM_MACRO_GRAMS }).valid).toBe(true);
        expect(validateEntryPatch({ protein: MAX_ITEM_MACRO_GRAMS + 1 }).valid).toBe(false);
    });

    it('rejects negatives and junk', () => {
        expect(validateEntryPatch({ calories: -1 }).valid).toBe(false);
        expect(validateEntryPatch({ fat: 'abc' }).valid).toBe(false);
        expect(validateEntryPatch({ carbs: null }).valid).toBe(false);
    });

    it('rejects an empty or whitespace-only food name', () => {
        expect(validateEntryPatch({ food_name: '' }).valid).toBe(false);
        expect(validateEntryPatch({ food_name: '   ' }).valid).toBe(false);
    });

    it('trims and truncates text to the column widths', () => {
        const r = validateEntryPatch({ food_name: '  Dal  ', serving_size: 'x'.repeat(200) });
        expect(r.fields.food_name).toBe('Dal');
        expect(r.fields.serving_size.length).toBeLessThanOrEqual(100);
    });

    it('rejects an unknown meal_type', () => {
        expect(validateEntryPatch({ meal_type: 'brunch' }).valid).toBe(false);
        expect(validateEntryPatch({ meal_type: 'lunch' }).valid).toBe(true);
    });

    it('names the offending field in its error', () => {
        expect(validateEntryPatch({ protein: 99999 }).error).toMatch(/protein/i);
    });
});
