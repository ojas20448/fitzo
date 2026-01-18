export interface Serving {
    id: string;
    description: string;
    measurementDescription: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
}

export interface FoodItem {
    id: string;
    name: string;
    brand: string | null;
    description: string;
    image?: string;
    servings: Serving[];
    category?: string;
    isLocal?: boolean;
}

export const defaultFoods: FoodItem[] = [
    // --- PROTEIN SOURCES ---
    {
        id: 'chicken_breast_cooked',
        name: 'Chicken Breast (Cooked)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 165kcal | P: 31g | C: 0g | F: 3.6g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0 },
            { id: '1breast', description: '1 breast', measurementDescription: 'breast', calories: 284, protein: 53.4, carbs: 0, fat: 6.2, fiber: 0, sugar: 0 },
        ]
    },
    {
        id: 'chicken_thigh_cooked',
        name: 'Chicken Thigh (Cooked)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 209kcal | P: 26g | C: 0g | F: 10.9g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 209, protein: 26, carbs: 0, fat: 10.9, fiber: 0, sugar: 0 },
            { id: '1thigh', description: '1 thigh', measurementDescription: 'thigh', calories: 135, protein: 16.9, carbs: 0, fat: 7.1, fiber: 0, sugar: 0 },
        ]
    },
    {
        id: 'egg_large',
        name: 'Egg (Large, Boiled)',
        brand: 'Generic',
        description: '1 large egg - Calories: 78kcal | P: 6g | C: 0.6g | F: 5g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '1egg', description: '1 large egg', measurementDescription: 'egg', calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0, sugar: 0.6 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0, sugar: 1.1 },
        ]
    },
    {
        id: 'egg_white',
        name: 'Egg Whites',
        brand: 'Generic',
        description: 'Per 100g - Calories: 52kcal | P: 11g | C: 0.7g | F: 0.2g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0, sugar: 0.7 },
            { id: '1large', description: '1 large egg white', measurementDescription: 'egg white', calories: 17, protein: 3.6, carbs: 0.2, fat: 0.1, fiber: 0, sugar: 0.2 },
        ]
    },
    {
        id: 'whey_protein_powder',
        name: 'Whey Protein Powder',
        brand: 'Generic',
        description: '1 scoop (30g) - Calories: 120kcal | P: 24g | C: 3g | F: 1g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '1scoop', description: '1 scoop (30g)', measurementDescription: 'scoop', calories: 120, protein: 24, carbs: 3, fat: 1, fiber: 0, sugar: 1 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 400, protein: 80, carbs: 10, fat: 3.3, fiber: 0, sugar: 3.3 },
        ]
    },
    {
        id: 'salmon_cooked',
        name: 'Salmon (Cooked)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 208kcal | P: 20g | C: 0g | F: 13g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 208, protein: 20.4, carbs: 0, fat: 13.4, fiber: 0, sugar: 0 },
            { id: '1fillet', description: '1 fillet (150g)', measurementDescription: 'fillet', calories: 312, protein: 30.6, carbs: 0, fat: 20.1, fiber: 0, sugar: 0 },
        ]
    },
    {
        id: 'tuna_canned',
        name: 'Tuna (Canned in Water)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 116kcal | P: 26g | C: 0g | F: 1g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 116, protein: 25.5, carbs: 0, fat: 0.8, fiber: 0, sugar: 0 },
            { id: '1can', description: '1 can (drained)', measurementDescription: 'can', calories: 191, protein: 42, carbs: 0, fat: 1.4, fiber: 0, sugar: 0 },
        ]
    },
    {
        id: 'greek_yogurt',
        name: 'Greek Yogurt (Plain, Nonfat)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 59kcal | P: 10g | C: 3.6g | F: 0.4g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 59, protein: 10.2, carbs: 3.6, fat: 0.4, fiber: 0, sugar: 3.2 },
            { id: '1cup', description: '1 cup (170g)', measurementDescription: 'cup', calories: 100, protein: 17.3, carbs: 6.1, fat: 0.7, fiber: 0, sugar: 5.5 },
        ]
    },
    {
        id: 'cottage_cheese',
        name: 'Cottage Cheese (Low Fat)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 81kcal | P: 11g | C: 4g | F: 2g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 81, protein: 11, carbs: 4, fat: 2.3, fiber: 0, sugar: 4 },
            { id: '1cup', description: '1 cup (226g)', measurementDescription: 'cup', calories: 183, protein: 24.9, carbs: 9.1, fat: 5.2, fiber: 0, sugar: 9.1 },
        ]
    },
    {
        id: 'tofu_firm',
        name: 'Tofu (Firm)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 144kcal | P: 17g | C: 3g | F: 8g',
        category: 'Protein',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 144, protein: 17.3, carbs: 2.8, fat: 8.7, fiber: 2.3, sugar: 0 },
            { id: '1block', description: '1 block (340g)', measurementDescription: 'block', calories: 490, protein: 58.8, carbs: 9.5, fat: 29.6, fiber: 7.8, sugar: 0 },
        ]
    },

    // --- CARB SOURCES ---
    {
        id: 'rice_white_cooked',
        name: 'White Rice (Cooked)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 130kcal | P: 2.7g | C: 28g | F: 0.3g',
        category: 'Carbs',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1 },
            { id: '1cup', description: '1 cup (158g)', measurementDescription: 'cup', calories: 205, protein: 4.3, carbs: 44.5, fat: 0.4, fiber: 0.6, sugar: 0.1 },
        ]
    },
    {
        id: 'rice_brown_cooked',
        name: 'Brown Rice (Cooked)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 111kcal | P: 2.6g | C: 23g | F: 0.9g',
        category: 'Carbs',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 111, protein: 2.6, carbs: 23, fat: 0.9, fiber: 1.8, sugar: 0.4 },
            { id: '1cup', description: '1 cup (195g)', measurementDescription: 'cup', calories: 216, protein: 5, carbs: 44.8, fat: 1.8, fiber: 3.5, sugar: 0.7 },
        ]
    },
    {
        id: 'oats_rolled',
        name: 'Rolled Oats (Raw)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 389kcal | P: 16.9g | C: 66g | F: 6.9g',
        category: 'Carbs',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, sugar: 0 },
            { id: '1cup', description: '1 cup (81g)', measurementDescription: 'cup', calories: 315, protein: 13.7, carbs: 53.7, fat: 5.6, fiber: 8.6, sugar: 0 },
            { id: '1serving', description: '1 serving (40g)', measurementDescription: 'serving', calories: 156, protein: 6.8, carbs: 26.5, fat: 2.8, fiber: 4.2, sugar: 0 },
        ]
    },
    {
        id: 'potato_baked',
        name: 'Potato (Baked)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 93kcal | P: 2.5g | C: 21g | F: 0.1g',
        category: 'Carbs',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 93, protein: 2.5, carbs: 21.2, fat: 0.1, fiber: 2.2, sugar: 1.2 },
            { id: '1medium', description: '1 medium (173g)', measurementDescription: 'potato', calories: 161, protein: 4.3, carbs: 36.6, fat: 0.2, fiber: 3.8, sugar: 2 },
        ]
    },
    {
        id: 'sweet_potato_baked',
        name: 'Sweet Potato (Baked)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 90kcal | P: 2g | C: 20.7g | F: 0.1g',
        category: 'Carbs',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 90, protein: 2, carbs: 20.7, fat: 0.1, fiber: 3.3, sugar: 6.5 },
            { id: '1medium', description: '1 medium (150g)', measurementDescription: 'potato', calories: 135, protein: 3, carbs: 31, fat: 0.2, fiber: 5, sugar: 9.7 },
        ]
    },
    {
        id: 'pasta_cooked',
        name: 'Pasta (Cooked)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 158kcal | P: 6g | C: 31g | F: 1g',
        category: 'Carbs',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, fiber: 1.8, sugar: 0.6 },
            { id: '1cup', description: '1 cup (140g)', measurementDescription: 'cup', calories: 221, protein: 8.1, carbs: 43.2, fat: 1.3, fiber: 2.5, sugar: 0.8 },
        ]
    },
    {
        id: 'bread_whole_wheat',
        name: 'Whole Wheat Bread',
        brand: 'Generic',
        description: '1 slice - Calories: 81kcal | P: 4g | C: 13.8g | F: 1.1g',
        category: 'Carbs',
        isLocal: true,
        servings: [
            { id: '1slice', description: '1 slice', measurementDescription: 'slice', calories: 81, protein: 4, carbs: 13.8, fat: 1.1, fiber: 1.9, sugar: 1.5 },
            { id: '2slices', description: '2 slices', measurementDescription: 'slices', calories: 162, protein: 8, carbs: 27.6, fat: 2.2, fiber: 3.8, sugar: 3 },
        ]
    },
    {
        id: 'roti_chapati',
        name: 'Roti / Chapati',
        brand: 'Generic',
        description: '1 medium - Calories: 104kcal | P: 3.1g | C: 20.7g | F: 0.9g',
        category: 'Carbs',
        isLocal: true,
        servings: [
            { id: '1medium', description: '1 medium', measurementDescription: 'roti', calories: 104, protein: 3.1, carbs: 20.7, fat: 0.9, fiber: 3.6, sugar: 0 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 297, protein: 8.8, carbs: 59.1, fat: 2.6, fiber: 10.3, sugar: 0 },
        ]
    },

    // --- FATS ---
    {
        id: 'almonds',
        name: 'Almonds (Raw)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 579kcal | P: 21g | C: 22g | F: 50g',
        category: 'Fats',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, sugar: 4.4 },
            { id: '1oz', description: '1 oz (28g)', measurementDescription: 'oz', calories: 164, protein: 6, carbs: 6.1, fat: 14.1, fiber: 3.5, sugar: 1.2 },
        ]
    },
    {
        id: 'peanut_butter',
        name: 'Peanut Butter',
        brand: 'Generic',
        description: '1 tbsp - Calories: 94kcal | P: 4g | C: 3g | F: 8g',
        category: 'Fats',
        isLocal: true,
        servings: [
            { id: '1tbsp', description: '1 tbsp (16g)', measurementDescription: 'tbsp', calories: 94, protein: 4, carbs: 3.1, fat: 8.1, fiber: 1, sugar: 1.5 },
            { id: '2tbsp', description: '2 tbsp (32g)', measurementDescription: 'tbsp', calories: 188, protein: 8, carbs: 6.3, fat: 16.1, fiber: 1.9, sugar: 3 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 588, protein: 25.1, carbs: 19.6, fat: 50.4, fiber: 6, sugar: 9.2 },
        ]
    },
    {
        id: 'avocado',
        name: 'Avocado',
        brand: 'Generic',
        description: 'Per 100g - Calories: 160kcal | P: 2g | C: 8.5g | F: 14.7g',
        category: 'Fats',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7 },
            { id: '1medium', description: '1 medium (150g)', measurementDescription: 'avocado', calories: 240, protein: 3, carbs: 12.8, fat: 22, fiber: 10, sugar: 1 },
        ]
    },
    {
        id: 'olive_oil',
        name: 'Olive Oil',
        brand: 'Generic',
        description: '1 tbsp - Calories: 119kcal | P: 0g | C: 0g | F: 13.5g',
        category: 'Fats',
        isLocal: true,
        servings: [
            { id: '1tbsp', description: '1 tbsp', measurementDescription: 'tbsp', calories: 119, protein: 0, carbs: 0, fat: 13.5, fiber: 0, sugar: 0 },
            { id: '100ml', description: '100ml', measurementDescription: 'ml', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0 },
        ]
    },

    // --- FRUITS ---
    {
        id: 'banana',
        name: 'Banana',
        brand: 'Generic',
        description: '1 medium - Calories: 105kcal | P: 1.3g | C: 27g | F: 0.4g',
        category: 'Fruit',
        isLocal: true,
        servings: [
            { id: '1medium', description: '1 medium (118g)', measurementDescription: 'banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14.4 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2 },
        ]
    },
    {
        id: 'apple',
        name: 'Apple',
        brand: 'Generic',
        description: '1 medium - Calories: 95kcal | P: 0.5g | C: 25g | F: 0.3g',
        category: 'Fruit',
        isLocal: true,
        servings: [
            { id: '1medium', description: '1 medium (182g)', measurementDescription: 'apple', calories: 95, protein: 0.5, carbs: 25.1, fat: 0.3, fiber: 4.4, sugar: 18.9 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugar: 10.4 },
        ]
    },
    {
        id: 'orange',
        name: 'Orange',
        brand: 'Generic',
        description: '1 medium - Calories: 62kcal | P: 1.2g | C: 15.4g | F: 0.2g',
        category: 'Fruit',
        isLocal: true,
        servings: [
            { id: '1medium', description: '1 medium (131g)', measurementDescription: 'orange', calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, fiber: 3.1, sugar: 12.2 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fiber: 2.4, sugar: 9.4 },
        ]
    },
    {
        id: 'blueberries',
        name: 'Blueberries',
        brand: 'Generic',
        description: '1 cup - Calories: 84kcal | P: 1.1g | C: 21.4g | F: 0.5g',
        category: 'Fruit',
        isLocal: true,
        servings: [
            { id: '1cup', description: '1 cup (148g)', measurementDescription: 'cup', calories: 84, protein: 1.1, carbs: 21.4, fat: 0.5, fiber: 3.6, sugar: 14.7 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4, sugar: 10 },
        ]
    },
    {
        id: 'strawberries',
        name: 'Strawberries',
        brand: 'Generic',
        description: '1 cup - Calories: 49kcal | P: 1g | C: 11.7g | F: 0.5g',
        category: 'Fruit',
        isLocal: true,
        servings: [
            { id: '1cup', description: '1 cup (152g)', measurementDescription: 'cup', calories: 49, protein: 1, carbs: 11.7, fat: 0.5, fiber: 3, sugar: 7.4 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, sugar: 4.9 },
        ]
    },

    // --- VEGETABLES ---
    {
        id: 'broccoli',
        name: 'Broccoli',
        brand: 'Generic',
        description: 'Per 100g - Calories: 34kcal | P: 2.8g | C: 6.6g | F: 0.4g',
        category: 'Vegetable',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, sugar: 1.7 },
            { id: '1cup', description: '1 cup chopped (91g)', measurementDescription: 'cup', calories: 31, protein: 2.6, carbs: 6, fat: 0.3, fiber: 2.4, sugar: 1.5 },
        ]
    },
    {
        id: 'spinach',
        name: 'Spinach (Raw)',
        brand: 'Generic',
        description: 'Per 100g - Calories: 23kcal | P: 2.9g | C: 3.6g | F: 0.4g',
        category: 'Vegetable',
        isLocal: true,
        servings: [
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, sugar: 0.4 },
            { id: '1cup', description: '1 cup (30g)', measurementDescription: 'cup', calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, fiber: 0.7, sugar: 0.1 },
        ]
    },
    {
        id: 'carrot',
        name: 'Carrot',
        brand: 'Generic',
        description: '1 medium - Calories: 25kcal | P: 0.6g | C: 5.8g | F: 0.1g',
        category: 'Vegetable',
        isLocal: true,
        servings: [
            { id: '1medium', description: '1 medium (61g)', measurementDescription: 'carrot', calories: 25, protein: 0.6, carbs: 5.8, fat: 0.1, fiber: 1.7, sugar: 2.9 },
            { id: '100g', description: '100g', measurementDescription: 'g', calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, sugar: 4.7 },
        ]
    },

    // --- BEVERAGES / OTHERS ---
    {
        id: 'coffee_black',
        name: 'Coffee (Black)',
        brand: 'Generic',
        description: '1 cup - Calories: 2kcal | P: 0.3g | C: 0g | F: 0g',
        category: 'Beverage',
        isLocal: true,
        servings: [
            { id: '1cup', description: '1 cup (240ml)', measurementDescription: 'cup', calories: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
        ]
    },
    {
        id: 'milk_whole',
        name: 'Milk (Whole)',
        brand: 'Generic',
        description: '1 cup - Calories: 149kcal | P: 7.7g | C: 11.7g | F: 7.9g',
        category: 'Beverage',
        isLocal: true,
        servings: [
            { id: '1cup', description: '1 cup (244ml)', measurementDescription: 'cup', calories: 149, protein: 7.7, carbs: 11.7, fat: 7.9, fiber: 0, sugar: 12.3 },
            { id: '100ml', description: '100ml', measurementDescription: 'ml', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, sugar: 5.1 },
        ]
    },
];
