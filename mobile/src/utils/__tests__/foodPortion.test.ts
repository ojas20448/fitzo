import { portionGrams, repeatServing, savedPortion } from '../foodPortion';

it('repeats the actual last portion and totals, including fractional macros and real zeros', () => {
    const serving = repeatServing({ serving_size: '250g', calories: 310, protein: 12.5, carbs: 0, fat: null });
    expect(serving).toMatchObject({ description: '250g', calories: 310, protein: 12.5, carbs: 0, fat: 0 });
    expect(savedPortion(serving.description, 1)).toBe('250g');
});
it('does not invent a weight for an old bowl or a missing serving', () => {
    for (const label of ['1 bowl', 'previous portion', '1 glass (250ml)', '2 servings']) expect(portionGrams(label)).toBeNull();
    expect(repeatServing({ calories: 120 }).description).toBe('previous portion');
});
it('stores total weight when scaling a serving so repeating it cannot reuse the smaller base weight', () => {
    const twice = savedPortion('1 cup (150g)', 2);
    expect(portionGrams(twice)).toBe(300);
    expect(portionGrams(savedPortion(twice, 0.5))).toBe(150);
    expect(savedPortion('150g', 2)).toBe('300g');
    expect(savedPortion('2 × 1 bowl', 0.5)).toBe('1 × 1 bowl');
});
it('recognizes gram units without confusing ml or invalid zero weight', () => {
    expect(portionGrams('1 cup · 200 g, cooked')).toBe(200);
    expect(portionGrams('100 grams')).toBe(100);
    expect(portionGrams('0g')).toBeNull();
});
