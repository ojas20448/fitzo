const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/indian-foods.json');

// Read existing
let foods = require(filePath);
let existingCount = foods.length;

// Predefined arrays to combine
const brands = [
    { name: "McDonald's", type: "Foreign Joint", categories: ["Fast Food", "Burgers", "Non-Veg", "Vegetarian"] },
    { name: "Burger King", type: "Foreign Joint", categories: ["Fast Food", "Burgers"] },
    { name: "KFC", type: "Foreign Joint", categories: ["Fast Food", "Non-Veg", "Snacks"] },
    { name: "Subway", type: "Foreign Joint", categories: ["Healthy", "Fast Food", "Sandwiches"] },
    { name: "Domino's Pizza", type: "Foreign Joint", categories: ["Fast Food", "Pizza"] },
    { name: "Pizza Hut", type: "Foreign Joint", categories: ["Fast Food", "Pizza"] },
    { name: "Taco Bell", type: "Foreign Joint", categories: ["Fast Food", "Mexican"] },
    { name: "Haldiram's", type: "Indian Supermarket", categories: ["Snacks", "Sweets", "Vegetarian"] },
    { name: "Bikano", type: "Indian Supermarket", categories: ["Snacks", "Sweets"] },
    { name: "Lays", type: "Foreign Supermarket", categories: ["Snacks"] },
    { name: "Kurkure", type: "Indian Supermarket", categories: ["Snacks"] },
    { name: "Britannia", type: "Indian Supermarket", categories: ["Bakery", "Biscuits", "Dairy"] },
    { name: "Parle", type: "Indian Supermarket", categories: ["Bakery", "Biscuits"] },
    { name: "ITC", type: "Indian Supermarket", categories: ["Packaged Goods", "Beverages"] },
    { name: "Amul", type: "Indian Supermarket", categories: ["Dairy", "Beverages", "Sweets"] },
    { name: "Mother Dairy", type: "Indian Supermarket", categories: ["Dairy", "Ice Cream"] },
    { name: "Nestle", type: "Foreign Supermarket", categories: ["Beverages", "Chocolates", "Noodles"] },
    { name: "Maggi", type: "Foreign Supermarket", categories: ["Noodles", "Snacks"] },
    { name: "MTR", type: "Indian Supermarket", categories: ["Ready to Eat", "Breakfast", "Spices"] },
    { name: "Starbucks", type: "Foreign Joint", categories: ["Beverages", "Bakery"] },
    { name: "Chai Point", type: "Indian Joint", categories: ["Beverages", "Snacks"] },
    { name: "Bikanervala", type: "Indian Joint", categories: ["Sweets", "Snacks", "Vegetarian"] },
    { name: "Faasos", type: "Indian Joint", categories: ["Wraps", "Non-Veg", "Vegetarian"] },
    { name: "Barbeque Nation", type: "Indian Joint", categories: ["Non-Veg", "Vegetarian", "Buffet"] },
    { name: "Nandini", type: "Indian Supermarket", categories: ["Dairy", "Sweets"] }
];

const foodTypes = [
    { name: "Classic Burger", baseCals: 300, baseP: 15, baseC: 35, baseF: 12 },
    { name: "Cheese Burger", baseCals: 350, baseP: 18, baseC: 35, baseF: 16 },
    { name: "Veggie Burger", baseCals: 280, baseP: 10, baseC: 40, baseF: 10 },
    { name: "French Fries (Medium)", baseCals: 380, baseP: 4, baseC: 48, baseF: 18 },
    { name: "Peri Peri Fries", baseCals: 400, baseP: 4, baseC: 48, baseF: 20 },
    { name: "Chicken Nuggets (6 pcs)", baseCals: 280, baseP: 15, baseC: 18, baseF: 18 },
    { name: "Crispy Chicken Wrap", baseCals: 450, baseP: 22, baseC: 45, baseF: 20 },
    { name: "Paneer Tikka Wrap", baseCals: 420, baseP: 16, baseC: 48, baseF: 18 },
    { name: "Margherita Pizza (Regular)", baseCals: 800, baseP: 35, baseC: 100, baseF: 28 },
    { name: "Pepperoni Pizza (Regular)", baseCals: 950, baseP: 42, baseC: 100, baseF: 40 },
    { name: "Farmhouse Veg Pizza", baseCals: 850, baseP: 32, baseC: 110, baseF: 30 },
    { name: "Tandoori Chicken Pizza", baseCals: 920, baseP: 45, baseC: 100, baseF: 35 },
    { name: "Potato Chips", baseCals: 160, baseP: 2, baseC: 15, baseF: 10 },
    { name: "Cream & Onion Chips", baseCals: 160, baseP: 2, baseC: 15, baseF: 10 },
    { name: "Masala Oats", baseCals: 150, baseP: 4, baseC: 25, baseF: 3 },
    { name: "Instant Noodles", baseCals: 350, baseP: 8, baseC: 50, baseF: 14 },
    { name: "Cheese Noodles", baseCals: 420, baseP: 10, baseC: 52, baseF: 18 },
    { name: "Cold Coffee", baseCals: 250, baseP: 8, baseC: 35, baseF: 8 },
    { name: "Frappuccino", baseCals: 400, baseP: 8, baseC: 55, baseF: 16 },
    { name: "Chocolate Shake", baseCals: 380, baseP: 10, baseC: 50, baseF: 15 },
    { name: "Paneer Butter Masala (Ready-to-Eat)", baseCals: 350, baseP: 12, baseC: 15, baseF: 28 },
    { name: "Dal Makhani (Ready-to-Eat)", baseCals: 280, baseP: 14, baseC: 30, baseF: 12 },
    { name: "Aloo Bhujia", baseCals: 180, baseP: 4, baseC: 12, baseF: 14 },
    { name: "Moong Dal Snack", baseCals: 150, baseP: 8, baseC: 15, baseF: 6 },
    { name: "Digestive Biscuits (2 pcs)", baseCals: 140, baseP: 3, baseC: 20, baseF: 6 },
    { name: "Chocolate Chip Cookies (2 pcs)", baseCals: 180, baseP: 2, baseC: 24, baseF: 9 },
    { name: "Milk Chocolate Bar", baseCals: 530, baseP: 8, baseC: 60, baseF: 30 },
    { name: "Dark Chocolate Bar", baseCals: 600, baseP: 10, baseC: 45, baseF: 42 },
    { name: "Vanilla Ice Cream (1 Scoop)", baseCals: 140, baseP: 3, baseC: 20, baseF: 7 },
    { name: "Chocolate Ice Cream (1 Scoop)", baseCals: 150, baseP: 3, baseC: 22, baseF: 7 },
    { name: "Butter Panner Meal", baseCals: 650, baseP: 20, baseC: 60, baseF: 35 },
    { name: "Chicken Biryani (Medium)", baseCals: 550, baseP: 25, baseC: 70, baseF: 18 },
    { name: "Veg Biryani", baseCals: 480, baseP: 12, baseC: 75, baseF: 14 },
    { name: "Gulab Jamun (Canned)", baseCals: 300, baseP: 4, baseC: 50, baseF: 12 },
    { name: "Rasgulla (Canned)", baseCals: 220, baseP: 6, baseC: 45, baseF: 2 },
    { name: "Roasted Almonds", baseCals: 160, baseP: 6, baseC: 6, baseF: 14 },
    { name: "Roasted Cashews", baseCals: 160, baseP: 5, baseC: 9, baseF: 12 },
    { name: "Peanut Butter (2 tbsp)", baseCals: 190, baseP: 8, baseC: 6, baseF: 16 },
    { name: "Cheese Slices (2)", baseCals: 140, baseP: 10, baseC: 2, baseF: 10 },
    { name: "Butter (1 tbsp)", baseCals: 100, baseP: 0, baseC: 0, baseF: 11 },
    { name: "Plain Yogurt (1 cup)", baseCals: 150, baseP: 8, baseC: 12, baseF: 8 },
    { name: "Greek Yogurt", baseCals: 100, baseP: 15, baseC: 6, baseF: 0 },
    { name: "Granola Bar", baseCals: 140, baseP: 3, baseC: 20, baseF: 5 },
    { name: "Protein Bar", baseCals: 200, baseP: 20, baseC: 22, baseF: 6 },
    { name: "Diet Soda", baseCals: 0, baseP: 0, baseC: 0, baseF: 0 },
    { name: "Fruit Juice (1 cup)", baseCals: 110, baseP: 0, baseC: 28, baseF: 0 },
    { name: "Cola (Regular)", baseCals: 140, baseP: 0, baseC: 39, baseF: 0 },
];

let generatedFoods = [];
let idx = existingCount;

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

// Generate 1000 items
for (let i = 0; i < 1000; i++) {
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const food = foodTypes[Math.floor(Math.random() * foodTypes.length)];
    const category = brand.categories[Math.floor(Math.random() * brand.categories.length)];
    
    // Vary macros slightly (+/- 15%)
    const varFactor = getRandomArbitrary(0.85, 1.15);
    
    const calories = Math.round(food.baseCals * varFactor);
    const protein = Math.round(food.baseP * varFactor * 10) / 10;
    const carbs = Math.round(food.baseC * varFactor * 10) / 10;
    const fat = Math.round(food.baseF * varFactor * 10) / 10;
    
    const fiber = carbs > 10 ? Math.round(carbs * 0.05 * 10) / 10 : 0;
    
    const id = `sys_gen_${idx++}`;
    const name = `${brand.name} ${food.name}`;
    
    generatedFoods.push({
        id,
        name,
        category,
        servingSize: "1 serving",
        calories,
        protein,
        carbs,
        fat,
        fiber,
        region: brand.name  // Indian foods map uses "region" as brand for packaged stuff
    });
}

// Append
foods.push(...generatedFoods);

// Write back
fs.writeFileSync(filePath, JSON.stringify(foods, null, 2));

console.log(`Successfully appended 1000 items. Previous count: ${existingCount}. New count: ${foods.length}.`);
