import { EMPTY_ONBOARDING, restoreOnboarding, startingSplit, validateBody, validateStep } from '../onboardingPlan';
const form = { ...EMPTY_ONBOARDING, goal: 'maintenance' as const, days: 3, experience: 'new' as const, equipment: 'gym' as const, sessionMinutes: 35 as const, activity: 'light' as const, height: '175', weight: '70', age: '25', gender: 'male' as const, vegetarian: false };
test('routine validation identifies the next unanswered choice', () => {
    expect(validateStep(2, { ...form, experience: null, equipment: null })).toBe('Choose your training experience.');
    expect(validateStep(2, { ...form, equipment: null })).toBe('Choose the equipment you can train with.');
    expect(validateStep(2, { ...form, sessionMinutes: null })).toBe('Choose how much time you have for a session.');
});
test.each([1, 2, 3, 4, 5, 6])('%i-day schedules contain the requested number of sessions', days => {
    const split = startingSplit(days);
    expect(split.days).toHaveLength(days);
    expect(split.days_per_week).toBe(days);
});
test('an old draft preserves basics but returns to unanswered training preferences', () => {
    const { experience, equipment, sessionMinutes, ...old } = form;
    expect(restoreOnboarding(JSON.stringify({ version: 1, step: 4, form: old })))
        .toMatchObject({ step: 2, form: { weight: '70', experience: null, equipment: null, sessionMinutes: null } });
});
test.each(['', '175abc', 'NaN', 'Infinity', '99', '251'])('rejects an invalid height: %s', height => {
    expect(validateBody({ ...form, height })).toMatch(/height/);
});
test('age is validated as a whole number instead of truncating a decimal', () => {
    expect(validateBody({ ...form, age: '25.5' })).toMatch(/whole number/);
});
test('restores only valid fields and never jumps past unanswered stages', () => {
    expect(restoreOnboarding(JSON.stringify({ version: 1, step: 4, form: { ...form, goal: 'bad-goal', days: 99 } })))
        .toMatchObject({ step: 1, form: { goal: null, days: null } });
    expect(restoreOnboarding(JSON.stringify({ version: 1, step: 4, form }))).toMatchObject({ step: 4, form });
    expect(restoreOnboarding('corrupt')).toBeNull();
});
