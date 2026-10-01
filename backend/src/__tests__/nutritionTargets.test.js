const {
    calculateEnergy,
    calculateCalories,
    calculateMacros,
    validateProfile,
    legacyModes,
    resolveTargets,
    PROTEIN_PER_KG
} = require('../utils/nutritionTargets');

describe('nutritionTargets utility', () => {
    describe('calculateEnergy', () => {
        test('calculates male BMR and TDEE correctly', () => {
            // 70kg, 175cm, 25yr male: 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75 -> 1674
            const { bmr, tdee } = calculateEnergy(70, 175, 25, 'male', 'sedentary');
            expect(bmr).toBe(1674);
            expect(tdee).toBe(Math.round(1673.75 * 1.2)); // 2009
        });

        test('calculates female BMR and TDEE correctly', () => {
            // 60kg, 165cm, 25yr female: 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 -> 1345
            const { bmr, tdee } = calculateEnergy(60, 165, 25, 'female', 'light');
            expect(bmr).toBe(1345);
            expect(tdee).toBe(Math.round(1345.25 * 1.375)); // 1850
        });
    });

    describe('calculateCalories', () => {
        test('returns maintenance calories for maintenance goal', () => {
            const cal = calculateCalories(2000, 'maintenance', 'male', 22.8);
            expect(cal).toBe(2000);
        });

        test('calculates lean muscle gain surplus (10% clamped 180-280 kcal)', () => {
            // TDEE 2000 -> 10% is 200 kcal surplus -> 2200 kcal
            const cal = calculateCalories(2000, 'muscle_gain', 'male', 22.8);
            expect(cal).toBe(2200);

            // TDEE 1500 -> 10% is 150 -> clamped to min 180 surplus -> 1680 kcal
            const calLow = calculateCalories(1500, 'muscle_gain', 'female', 20.0);
            expect(calLow).toBe(1680);

            // TDEE 3200 -> 10% is 320 -> clamped to max 280 surplus -> 3480 kcal
            const calHigh = calculateCalories(3200, 'muscle_gain', 'male', 24.0);
            expect(calHigh).toBe(3480);
        });

        test('calculates moderate fat loss deficit (18% clamped 300-500 kcal)', () => {
            // TDEE 2200 -> 18% is 396 -> deficit -396 -> 1804 kcal
            const cal = calculateCalories(2200, 'fat_loss', 'male', 25.0);
            expect(cal).toBe(1804);

            // High TDEE 3200 -> 18% is 576 -> clamped to max -500 deficit -> 2700 kcal
            const calHigh = calculateCalories(3200, 'fat_loss', 'male', 28.0);
            expect(calHigh).toBe(2700);
        });

        test('does not apply deficit when user BMI is underweight (< 18.5)', () => {
            const cal = calculateCalories(1900, 'fat_loss', 'female', 17.5);
            expect(cal).toBe(1900);
        });

        test('enforces safety floors: male >= 1500, female >= 1200', () => {
            const maleFloor = calculateCalories(1400, 'fat_loss', 'male', 22.0);
            expect(maleFloor).toBe(1500);

            const femaleFloor = calculateCalories(1100, 'fat_loss', 'female', 21.0);
            expect(femaleFloor).toBe(1200);
        });
    });

    describe('calculateMacros', () => {
        test('uses maintenance protein and about 30% fat at 2800 kcal', () => {
            const { protein, fat, carbs } = calculateMacros(2800, 70);
            expect(protein).toBe(126); // 70 kg * 1.8
            expect(fat).toBe(93); // 30%, rounded to whole grams
            expect(carbs).toBe(365); // remaining calories
            // Sum of macro calories should be within ~2 kcal of 2800
            expect(Math.abs(protein * 4 + carbs * 4 + fat * 9 - 2800)).toBeLessThanOrEqual(2);
        });

        test('uses 2.0 g/kg for fat loss when calories are low', () => {
            // Protein depends on body weight, not calorie percentage.
            const { protein } = calculateMacros(1500, 75, {}, 'fat_loss');
            expect(protein).toBe(150);
        });

        test('handles custom protein override and balances carbs', () => {
            const { protein, fat, carbs } = calculateMacros(2000, 70, { protein: 140 });
            expect(protein).toBe(140);
            expect(fat).toBe(67);
            expect(carbs).toBe(209);
            expect(Math.abs(protein * 4 + carbs * 4 + fat * 9 - 2000)).toBeLessThanOrEqual(2);
        });

        test('handles all custom macros without throwing errors', () => {
            const result = calculateMacros(2000, 70, { protein: 130, carbs: 220, fat: 50 });
            expect(result).toEqual({ protein: 130, carbs: 220, fat: 50 });
        });
    });

    describe('validateProfile', () => {
        const valid = {
            weight_kg: 70,
            height_cm: 175,
            age: 25,
            gender: 'male',
            activity_level: 'sedentary',
            goal_type: 'maintenance'
        };

        test('passes for valid adult profile', () => {
            expect(() => validateProfile(valid)).not.toThrow();
        });

        test('passes for adolescent gym member (age 14)', () => {
            expect(() => validateProfile({ ...valid, age: 14 })).not.toThrow();
        });

        test('rejects age under 14', () => {
            expect(() => validateProfile({ ...valid, age: 13 })).toThrow(/age must be between 14 and 100/);
        });

        test('rejects invalid gender', () => {
            expect(() => validateProfile({ ...valid, gender: 'other' })).toThrow(/Choose a sex/);
        });

        test('rejects out of range weight and height', () => {
            expect(() => validateProfile({ ...valid, weight_kg: 10 })).toThrow(/weight_kg/);
            expect(() => validateProfile({ ...valid, height_cm: 300 })).toThrow(/height_cm/);
        });
    });

    describe('resolveTargets', () => {
        test('resolves full automatic targets for 70 kg male', () => {
            const p = {
                weight_kg: 70,
                height_cm: 175,
                age: 25,
                gender: 'male',
                activity_level: 'sedentary',
                goal_type: 'muscle_gain',
                calorie_target_mode: 'automatic',
                macro_target_mode: 'automatic'
            };
            const targets = resolveTargets(p);
            expect(targets.target_protein).toBe(126);
            expect(targets.target_calories).toBeGreaterThan(2000);
            expect(targets.calorie_target_mode).toBe('automatic');
            expect(targets.macro_target_mode).toBe('automatic');
            expect(targets.target_formula_version).toBe(4);
        });

        test('respects custom calorie target and re-derives macros', () => {
            const p = {
                weight_kg: 70,
                height_cm: 175,
                age: 25,
                gender: 'male',
                activity_level: 'sedentary',
                goal_type: 'maintenance',
                calorie_target_mode: 'custom',
                macro_target_mode: 'automatic',
                target_calories: 2800
            };
            const targets = resolveTargets(p);
            expect(targets.target_calories).toBe(2800);
            expect(targets.target_protein).toBe(126); // 70 kg * 1.8
            expect(targets.target_fat).toBe(93); // about 30%
            expect(targets.target_carbs).toBe(365); // remaining calories
            expect(targets.calorie_target_mode).toBe('custom');
            expect(targets.macro_target_mode).toBe('automatic');
        });
    });
});
