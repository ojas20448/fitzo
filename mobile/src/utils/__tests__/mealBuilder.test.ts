import {
    clampQuantity,
    entriesFromPreset,
    scaleEntry,
    mealTotals,
    displayTotals,
    setQuantity,
    removeEntry,
    toLogPayload,
    QUANTITY_STEP,
    MIN_QUANTITY,
    MAX_QUANTITY,
} from '../mealBuilder';

describe('clampQuantity', () => {
    it('rounds to half-serving granularity', () => {
        expect(clampQuantity(1.3)).toBe(1.5);
        expect(clampQuantity(1.2)).toBe(1);
    });

    it('clamps to the minimum', () => {
        expect(clampQuantity(0.1)).toBe(MIN_QUANTITY);
        expect(clampQuantity(0)).toBe(MIN_QUANTITY);
    });

    it('clamps to the maximum', () => {
        expect(clampQuantity(20)).toBe(MAX_QUANTITY);
    });

    it('treats non-finite input as the minimum', () => {
        expect(clampQuantity(NaN)).toBe(MIN_QUANTITY);
        expect(clampQuantity(Infinity)).toBe(MIN_QUANTITY);
    });
});

describe('entriesFromPreset', () => {
    it('seeds every item at one serving with a stable key', () => {
        const items = [{ meal_name: 'Dal', calories: 200 }, { meal_name: 'Roti', calories: 120 }];
        const entries = entriesFromPreset(items);
        expect(entries).toEqual([
            { meal_name: 'Dal', calories: 200, key: 'Dal#0', quantity: 1 },
            { meal_name: 'Roti', calories: 120, key: 'Roti#1', quantity: 1 },
        ]);
    });

    it('disambiguates repeated names via the index', () => {
        const entries = entriesFromPreset([
            { meal_name: 'Sabzi', calories: 150 },
            { meal_name: 'Sabzi', calories: 80 },
        ]);
        expect(entries[0].key).toBe('Sabzi#0');
        expect(entries[1].key).toBe('Sabzi#1');
    });

    it('handles a null/undefined preset', () => {
        expect(entriesFromPreset(null as any)).toEqual([]);
    });
});

describe('scaleEntry', () => {
    it('scales macros by quantity without rounding them to integers', () => {
        const entry = { key: 'Dal#0', meal_name: 'Dal', calories: 200, protein: 10.2, carbs: 20.5, fat: 5, quantity: 1.5 };
        expect(scaleEntry(entry)).toEqual({
            meal_name: 'Dal (x1.5)',
            calories: 300,
            protein: 15.3,
            carbs: 30.8,
            fat: 7.5,
        });
    });

    it('keeps the plain name at exactly one serving', () => {
        const entry = { key: 'Dal#0', meal_name: 'Dal', calories: 200, quantity: 1 };
        expect(scaleEntry(entry).meal_name).toBe('Dal');
    });

    it('defaults missing macros to zero', () => {
        const entry = { key: 'A#0', meal_name: 'A', calories: 100, quantity: 2 };
        expect(scaleEntry(entry)).toEqual({
            meal_name: 'A (x2)',
            calories: 200,
            protein: 0,
            carbs: 0,
            fat: 0,
        });
    });
});

describe('mealTotals & displayTotals', () => {
    const entries = [
        { key: 'Dal#0', meal_name: 'Dal', calories: 200, protein: 10, carbs: 20, fat: 5, quantity: 1 },
        { key: 'Roti#1', meal_name: 'Roti', calories: 120, protein: 4, carbs: 22, fat: 1, quantity: 0.5 },
    ];

    it('sums scaled macros', () => {
        expect(mealTotals(entries)).toEqual({ calories: 260, protein: 12, carbs: 31, fat: 5.5 });
    });

    it('formats totals for display — whole calories, 0.1g macros', () => {
        const messy = [
            { key: 'A#0', meal_name: 'A', calories: 99.4, protein: 3.06, carbs: 1.04, fat: 0.05, quantity: 1 },
        ];
        expect(displayTotals(messy)).toEqual({ calories: 99, protein: 3.1, carbs: 1, fat: 0.1 });
    });

    it('handles an empty list', () => {
        expect(mealTotals([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    });
});

describe('setQuantity & removeEntry', () => {
    const entries = entriesFromPreset([{ meal_name: 'Dal', calories: 200 }, { meal_name: 'Roti', calories: 120 }]);

    it('updates only the matching key', () => {
        const next = setQuantity(entries, 'Dal#0', 2);
        expect(next[0].quantity).toBe(2);
        expect(next[1].quantity).toBe(1);
    });

    it('clamps the value through setQuantity', () => {
        const next = setQuantity(entries, 'Dal#0', 99);
        expect(next[0].quantity).toBe(MAX_QUANTITY);
    });

    it('removes only the matching key', () => {
        const next = removeEntry(entries, 'Roti#1');
        expect(next).toHaveLength(1);
        expect(next[0].key).toBe('Dal#0');
    });
});

describe('toLogPayload', () => {
    it('produces the log-endpoint payload shape', () => {
        const entries = [
            { key: 'Dal#0', meal_name: 'Dal', calories: 200, protein: 10, quantity: 1.5 },
        ];
        expect(toLogPayload(entries)).toEqual([
            { meal_name: 'Dal (x1.5)', calories: 300, protein: 15, carbs: 0, fat: 0 },
        ]);
    });
});
