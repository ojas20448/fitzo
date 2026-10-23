export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = typeof MEAL_TYPES[number];

export function isMealType(value: unknown): value is MealType {
    return MEAL_TYPES.some(meal => meal === value);
}

// An opaque "bowl" or "serving" is not necessarily 100g. Only offer gram
// conversion when the serving itself specifies a weight.
export function portionGrams(description: string): number | null {
    const match = description.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/i);
    const grams = match ? Number(match[1]) : 0;
    return Number.isFinite(grams) && grams > 0 ? grams : null;
}

export function savedPortion(description: string, quantity: number): string {
    if (quantity === 1) return description;
    const grams = portionGrams(description);
    const scaled = description.match(/^(\d+(?:\.\d+)?)\s*×\s*(.+)$/);
    const units = Math.round(quantity * (scaled ? Number(scaled[1]) : 1) * 100) / 100;
    const original = scaled ? scaled[2] : description;
    if (grams !== null) {
        // Remove the base weight so the next repeat cannot accidentally use it
        // as the total weight of the larger portion.
        const label = original.replace(/\(?\d+(?:\.\d+)?\s*(?:g|grams?)\b(?:\s+total)?\)?/i, '').trim();
        const total = Math.round(grams * quantity * 100) / 100;
        return label ? `${units} × ${label} (${total}g total)` : `${total}g`;
    }
    return `${units} × ${original}`;
}

export function repeatServing(food: {
    serving_size?: string | null; calories: number; protein?: number | null;
    carbs?: number | null; fat?: number | null; is_estimate?: boolean;
}) {
    return {
        id: 'previous', description: food.serving_size?.trim() || 'previous portion',
        measurementDescription: 'portion', calories: Number(food.calories),
        protein: Number(food.protein) || 0, carbs: Number(food.carbs) || 0,
        fat: Number(food.fat) || 0, fiber: 0, sugar: 0,
        isEstimate: food.is_estimate === true,
    };
}
