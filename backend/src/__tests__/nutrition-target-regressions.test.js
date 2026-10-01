const { calculateMacros, resolveTargets } = require('../utils/nutritionTargets');
const profile = { weight_kg: 70, height_cm: 175, age: 25, gender: 'male', activity_level: 'sedentary', goal_type: 'maintenance', calorie_target_mode: 'automatic', macro_target_mode: 'custom' };

test.each(['fat_loss', 'muscle_gain', 'maintenance'])('%s keeps protein independent of calorie target', goal_type => {
    for (const target_calories of [1800, 2200, 2800, 3200]) {
        const target = resolveTargets({ ...profile, goal_type, calorie_target_mode: 'custom', macro_target_mode: 'automatic', target_calories });
        expect(target.target_protein).toBe({ maintenance: 126, muscle_gain: 126, fat_loss: 140 }[goal_type]);
        expect(Math.abs(target.target_fat * 9 - target_calories * 0.30)).toBeLessThanOrEqual(4.5);
        expect(Math.abs(target.target_protein * 4 + target.target_carbs * 4 + target.target_fat * 9 - target_calories)).toBeLessThanOrEqual(2);
    }
});
test.each([0, -1, 10000, NaN, Infinity])('rejects invalid macro-derived targets (%s)', value => {
    expect(() => resolveTargets({ ...profile, target_protein: value, target_carbs: value, target_fat: value })).toThrow();
});
test('preserves a deliberate 170g personal protein target', () => {
    const target = resolveTargets({ ...profile, calorie_target_mode: 'custom', target_calories: 2800, target_protein: 170 });
    expect(target.target_protein).toBe(170);
    expect(target.target_calories).toBe(2800);
});
test('rejects conflicting custom calorie and complete macro targets', () => {
    expect(() => resolveTargets({ ...profile, calorie_target_mode: 'custom', target_calories: 2800, target_protein: 100, target_carbs: 100, target_fat: 10 })).toThrow(/add up/);
});
test('checks final automatic calorie minimum after custom macro override', () => {
    expect(() => resolveTargets({ ...profile, target_protein: 50, target_carbs: 100, target_fat: 20 })).toThrow(/Final calorie/);
});
test('rejects a protein/fat combination above the calorie budget', () => {
    expect(() => calculateMacros(800, 70, { protein: 200, fat: 40 })).toThrow(/exceed/);
});
