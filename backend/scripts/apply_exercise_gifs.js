/**
 * Apply exercise image URLs from mapping to defaultExercises.ts
 *
 * Usage: node backend/scripts/apply_exercise_gifs.js
 */

const fs = require('fs');
const path = require('path');

const mappingPath = path.resolve(__dirname, 'exercise_gif_mapping.json');
const exercisesPath = path.resolve(__dirname, '..', '..', 'mobile', 'src', 'data', 'defaultExercises.ts');

const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
let content = fs.readFileSync(exercisesPath, 'utf8');

let count = 0;

for (const [id, url] of Object.entries(mapping)) {
    // Match the line containing this exercise id and add gifUrl before the closing }
    // Pattern: { id: 'bench_press_barbell', ... equipment: 'barbell' },
    // We want: { id: 'bench_press_barbell', ... equipment: 'barbell', gifUrl: 'https://...' },

    const idPattern = `id: '${id}'`;

    // Find the line containing this id
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(idPattern)) {
            const line = lines[i];
            // Check if gifUrl already exists
            if (line.includes('gifUrl')) continue;

            // Replace the closing ' },' or ' }' with ', gifUrl: '...' },'
            const newLine = line.replace(
                /(\s*})(,?\s*)$/,
                `, gifUrl: '${url}' $1$2`
            );

            if (newLine !== line) {
                lines[i] = newLine;
                count++;
            }
            break; // Only match first occurrence for this id
        }
    }
    content = lines.join('\n');
}

fs.writeFileSync(exercisesPath, content);
console.log(`✅ Updated ${count} exercises with gifUrl`);
console.log(`📊 Total exercises with images: ${count}/${Object.keys(mapping).length}`);
