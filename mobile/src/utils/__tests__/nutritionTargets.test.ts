import {
    calculateEnergy,
    calculateCalories,
    calculateMacros,
    PROTEIN_PER_KG,
    ACTIVITY,
} from '../nutritionTargets';

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

    test('calculateMacros gives athletic 30% protein / 25% fat split (~210g protein at 2800 kcal)', () => {
        const { protein, fat, carbs } = calculateMacros(2800, 70);
        expect(protein).toBe(210); // 30% of 2800 / 4
        expect(fat).toBe(78); // 25% of 2800 / 9
        expect(carbs).toBe(315); // remaining 45%
    });

    test('calculateMacros preserves 1.6 g/kg floor on lower calorie intakes', () => {
        const { protein } = calculateMacros(1500, 75);
        expect(protein).toBe(120); // 75 * 1.6
    });

    test('calculateMacros accepts custom overrides and balances cleanly', () => {
        const { protein, fat, carbs } = calculateMacros(2000, 70, { protein: 140 });
        expect(protein).toBe(140);
        expect(fat).toBe(56); // 25% of 2000 / 9
        expect(carbs).toBe(234);
    });
});
