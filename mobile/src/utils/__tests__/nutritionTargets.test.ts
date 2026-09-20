import {
    calculateEnergy,
    calculateCalories,
    calculateMacros,
} from '../nutritionTargets';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

test('mobile and backend produce identical valid target previews', () => {
    const inputs: [number, number, { protein?: number; fat?: number }, string][] = [];
    for (const goal of ['maintenance', 'fat_loss', 'muscle_gain']) for (const weight of [50, 70, 100]) for (const calories of [1500, 2200, 2800]) {
        inputs.push([calories, weight, {}, goal], [calories, weight, { protein: 170 }, goal], [calories, weight, { protein: 140, fat: 50 }, goal]);
    }
    // Run the real backend module in Node, outside Expo's React Native transform.
    const expected = JSON.parse(execFileSync(process.execPath, ['-e',
        'const n=require(process.argv[1]); process.stdout.write(JSON.stringify(JSON.parse(process.argv[2]).map(args=>n.calculateMacros(...args))));',
        resolve(__dirname, '../../../../backend/src/utils/nutritionTargets.js'), JSON.stringify(inputs),
    ], { encoding: 'utf8' }));
    expect(inputs.map(args => calculateMacros(...args))).toEqual(expected);
});

describe('mobile nutritionTargets parity tests', () => {
    test('calculateEnergy matches backend Mifflin-St Jeor formula', () => {
        const male = calculateEnergy(70, 175, 25, 'male', 'sedentary');
        expect(male.bmr).toBe(1674);
        expect(male.tdee).toBe(2009);

        const female = calculateEnergy(60, 165, 25, 'female', 'light');
        expect(female.bmr).toBe(1345);
        expect(female.tdee).toBe(1850);
    });

    test('calculateCalories applies lean surplus for muscle gain', () => {
        const cal = calculateCalories(2000, 'muscle_gain', 'male', 22.8);
        expect(cal).toBe(2200); // 10% surplus
    });

    test('calculateCalories applies moderate deficit for fat loss', () => {
        const cal = calculateCalories(2200, 'fat_loss', 'male', 24.5);
        expect(cal).toBe(1804); // 18% deficit
    });

    test('calculateCalories respects underweight check', () => {
        const cal = calculateCalories(1900, 'fat_loss', 'female', 17.0);
        expect(cal).toBe(1900); // no deficit if underweight
    });

    test('calculateMacros uses the requested weight-based protein default', () => {
        const { protein, fat, carbs } = calculateMacros(2800, 70);
        expect(protein).toBe(126); // maintenance: 70 kg * 1.8
        expect(fat).toBe(93); // about 30%
        expect(carbs).toBe(365); // remaining calories
    });

    test('calculateMacros uses 2.0 g/kg for fat loss on lower calorie intakes', () => {
        const { protein } = calculateMacros(1500, 75, {}, 'fat_loss');
        expect(protein).toBe(150); // 75 * 2.0
    });

    test('calculateMacros accepts custom overrides and balances cleanly', () => {
        const { protein, fat, carbs } = calculateMacros(2000, 70, { protein: 140 });
        expect(protein).toBe(140);
        expect(fat).toBe(67);
        expect(carbs).toBe(209);
    });
});
