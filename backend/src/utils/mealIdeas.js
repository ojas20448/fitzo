const foods = require('../data/indian-foods.json');
const recipes = require('../data/meal-ideas.json');
const byId = new Map(foods.map(food => [food.id, food]));
const round1 = value => Math.round(value * 10) / 10;

// Each recipe references the same serving data as food search. Portions below
// are ready-to-eat amounts, never dry rice/dal weights or daily macro quotas.
function foodItem(spec) {
    const food = byId.get(spec.food_id);
    if (!food) throw new Error(`Missing meal idea food: ${spec.food_id}`);
    const multiplier = spec.multiplier ?? 1;
    return {
        food_id: food.id,
        meal_name: food.name,
        calories: Math.round(food.calories * multiplier),
        protein: round1(food.protein * multiplier),
        carbs: round1(food.carbs * multiplier),
        fat: round1(food.fat * multiplier),
        portion: spec.portion,
    };
}

function getMealIdeas({ vegetarian = false } = {}) {
    return recipes.filter(recipe => !vegetarian || recipe.vegetarian).map(recipe => ({
        id: recipe.id,
        name: recipe.name,
        emoji: recipe.emoji,
        vegetarian: recipe.vegetarian,
        meal_type: recipe.meal_type,
        description: recipe.description,
        items: recipe.items.map(spec => ({
            ...foodItem(spec),
            alternatives: (spec.alternatives || []).map(foodItem),
        })),
    }));
}

module.exports = { getMealIdeas };
