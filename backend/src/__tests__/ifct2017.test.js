const { searchFoods } = require('../services/ifct2017');

test('the production nutrition dataset loads without the unused IFCT wrapper', () => {
    const { foods } = searchFoods('rice', 2);
    expect(foods).toHaveLength(2);
    for (const food of foods) {
        expect(food.id).toMatch(/^ifct_/);
        expect(food.calories).toBeGreaterThan(0);
        expect(Number.isFinite(food.protein)).toBe(true);
    }
});
