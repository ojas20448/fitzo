const { getMealIdeas } = require('../utils/mealIdeas');
const foods = require('../data/indian-foods.json');
const recipes = require('../data/meal-ideas.json');
const { validateComboItems } = require('../utils/mealCombo');

test('all ideas have ordinary ready-to-eat portions and complete swaps from the food catalogue', () => {
    const ideas = getMealIdeas();
    expect(ideas).toHaveLength(8);
    expect(new Set(ideas.map(idea => idea.id)).size).toBe(8);
    for (const idea of ideas) {
        const calories = idea.items.reduce((total, item) => total + item.calories, 0);
        const protein = idea.items.reduce((total, item) => total + item.protein, 0);
        expect(calories).toBeGreaterThanOrEqual(250);
        expect(calories).toBeLessThanOrEqual(650);
        expect(protein).toBeLessThan(40);
        expect(['breakfast', 'lunch', 'dinner', 'snack']).toContain(idea.meal_type);
        for (const item of idea.items.flatMap(item => [item, ...item.alternatives])) {
            expect(item.portion.grams).toBeGreaterThan(0);
            expect(item.portion.grams).toBeLessThanOrEqual(200);
            const food = foods.find(food => food.id === item.food_id);
            expect(food).toBeDefined();
            expect(Number.isFinite(item.protein)).toBe(true);
        }
    }
});

test('vegetarian ideas contain neither eggs nor meat, including substitution choices', () => {
    const ideas = getMealIdeas({ vegetarian: true });
    expect(ideas).toHaveLength(6);
    for (const idea of ideas) {
        expect(idea.vegetarian).toBe(true);
        for (const item of idea.items.flatMap(item => [item, ...item.alternatives])) {
            const food = foods.find(food => food.id === item.food_id);
            expect(food.category).not.toMatch(/Non-Veg|Eggs/);
        }
    }
});

test('recipe multipliers match catalogue nutrition, without confusing cooked and dry weights', () => {
    const ideas = getMealIdeas();
    const roti = ideas[0].items[0];
    expect(roti).toMatchObject({ calories: 240, protein: 7, portion: { grams: 80, amount: 2 } });
    const rice = ideas.find(idea => idea.id === 'rajma_rice').items[1];
    expect(rice).toMatchObject({ calories: 206, portion: { grams: 150, preparation: 'cooked' } });
    for (const recipe of recipes) {
        for (const spec of recipe.items) {
            const food = foods.find(food => food.id === spec.food_id);
            const item = ideas.find(idea => idea.id === recipe.id).items.find(item => item.food_id === spec.food_id);
            expect(item.calories).toBe(Math.round(food.calories * (spec.multiplier ?? 1)));
        }
    }
});

test('bulk logging preserves a reviewed portion and rejects invalid portion data', () => {
    const item = { meal_name: 'Rice', calories: 206, serving_size: '1 cup · 150 g, cooked' };
    expect(validateComboItems([item]).items[0].serving_size).toBe(item.serving_size);
    for (const serving_size of [42, '', ' '.repeat(2), 'a'.repeat(101)]) {
        expect(validateComboItems([{ ...item, serving_size }]).valid).toBe(false);
    }
    expect(validateComboItems([{ meal_name: 'Rice', calories: 206 }]).items[0].serving_size).toBeNull();
});
