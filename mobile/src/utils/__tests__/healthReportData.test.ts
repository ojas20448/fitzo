import { healthReportData } from '../healthReportData';
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
