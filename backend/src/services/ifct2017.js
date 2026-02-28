/**
 * IFCT2017 Service - Indian Food Composition Tables 2017
 * Official government nutrition data from National Institute of Nutrition (ICMR), Hyderabad
 * 528 key Indian foods with detailed nutrient composition per 100g
 */

const fs = require('fs');
const path = require('path');

let foods = null;

function loadFoods() {
    if (foods) return foods;

    const csvPath = path.join(__dirname, '..', '..', 'node_modules', '@ifct2017', 'compositions', 'index.csv');
    const csv = fs.readFileSync(csvPath, 'utf8');
    const lines = csv.split('\n').filter(l => l.trim());

    // Skip header, parse data rows
    foods = [];
    for (let i = 1; i < lines.length; i++) {
        // CSV uses comma separator — fields may be quoted with commas inside
        const fields = parseCSVLine(lines[i]);
        if (fields.length < 24) continue;

        const code = clean(fields[0]);
        const name = clean(fields[1]);
        const localNames = clean(fields[3]);
        const group = clean(fields[4]);
        const energy = parseFloat(fields[7]) || 0;
        const fat = parseFloat(fields[15]) || 0;
        const fiber = parseFloat(fields[19]) || 0;
        const carbs = parseFloat(fields[21]) || 0;
        const protein = parseFloat(fields[23]) || 0;

        // Energy in the CSV is in kJ, convert to kcal
        const calories = Math.round(energy / 4.184);

        if (!name || calories === 0) continue;

        foods.push({
            id: `ifct_${code}`,
            code,
            name,
            localNames,
            group,
            calories,
            protein: Math.round(protein * 10) / 10,
            carbs: Math.round(carbs * 10) / 10,
            fat: Math.round(fat * 10) / 10,
            fiber: Math.round(fiber * 10) / 10,
            servingSize: '100g',
        });
    }

    console.log(`IFCT2017: Loaded ${foods.length} Indian foods`);
    return foods;
}

function clean(str) {
    return (str || '').replace(/^"|"$/g, '').trim();
}

function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}

/**
 * Search Indian foods by name, local names, or food group
 */
function searchFoods(query, limit = 10) {
    const data = loadFoods();
    const searchTerm = query.toLowerCase();
    const words = searchTerm.split(/\s+/).filter(w => w.length > 0);

    const scored = data.map(food => {
        const name = food.name.toLowerCase();
        const local = food.localNames.toLowerCase();
        const group = food.group.toLowerCase();
        const searchable = `${name} ${local} ${group}`;
        let score = 0;

        // Exact substring match on name
        if (name.includes(searchTerm)) score += 10;
        // Local name match (Hindi, Tamil, etc.)
        if (local.includes(searchTerm)) score += 8;
        // Group match
        if (group.includes(searchTerm)) score += 5;
        // All words match
        if (words.every(w => searchable.includes(w))) score += 7;
        // Partial word matches
        const matchCount = words.filter(w => searchable.includes(w)).length;
        if (matchCount > 0) score += matchCount * 2;

        return { food, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    return {
        foods: scored.map(({ food }) => ({
            id: food.id,
            name: food.name,
            brand: food.group,
            type: 'IFCT2017',
            description: `Per 100g - ${food.calories}kcal | P: ${food.protein}g | C: ${food.carbs}g | F: ${food.fat}g`,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            fiber: food.fiber,
            servingSize: food.servingSize,
        })),
        total: scored.length,
    };
}

module.exports = { searchFoods };
