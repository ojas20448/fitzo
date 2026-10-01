import { healthReportData, healthReportDetails } from '../healthReportData';
it('reads the actual API health/daily envelopes and numeric PostgreSQL values', () => {
    const result = healthReportData({ health: { steps: 100, active_calories: null, sleep_hours: '7.5', resting_heart_rate: 60 } },
        { daily: [{ steps: 100, sleep_hours: '7.5' }, { steps: null, sleep_hours: null }, { steps: 200, sleep_hours: '8' }] });
    expect(result.today).toEqual({ steps: 100, active_calories: null, sleep_hours: 7.5, resting_heart_rate: 60 });
    expect(result.history.averages).toEqual({ avg_steps: 150, avg_calories: null, avg_sleep: 7.75, avg_heart_rate: null });
});
it('does not turn missing records or missing readings into zero', () => {
    expect(healthReportData(null, null).today).toBeNull();
    expect(healthReportData({ health: { steps: null } }, { daily: [] }).history.averages.avg_steps).toBeNull();
});
it('maps report details from the backend PR, nutrition and measurement contracts', () => {
    const details = healthReportDetails(
        { prs: [{ exercise_name: 'Bench Press', max_weight_kg: '82.5', reps_at_max: 8 }] },
        { profile: { target_calories: 2200, target_protein: '140', target_carbs: 260, target_fat: 65 } },
        { measurement: { weight: '75.5', body_fat: null, waist: '80', chest: '97' } },
    );
    expect(details.prs).toEqual([{ exercise_name: 'Bench Press', max_weight_kg: 82.5, reps_at_max: 8 }]);
    expect(details.nutrition).toEqual({ target_calories: 2200, target_protein: 140, target_carbs: 260, target_fat: 65 });
    expect(details.measurements).toEqual({ weight: 75.5, body_fat: null, waist: 80, chest: 97 });
});
it('preserves recorded zero values and distinguishes missing report details', () => {
    expect(healthReportDetails(null, null, null)).toEqual({ prs: [], nutrition: null, measurements: null });
    const details = healthReportDetails(
        { prs: [{ exercise_name: 'Push Up', max_weight_kg: 0, reps_at_max: 15 }] },
        { profile: { target_calories: 2000, target_protein: null, target_carbs: '', target_fat: 'invalid' } },
        null,
    );
    expect(details.prs[0].max_weight_kg).toBe(0);
    expect(details.nutrition).toEqual({ target_calories: 2000, target_protein: null, target_carbs: null, target_fat: null });
});
