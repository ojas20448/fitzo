const numeric = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};
const reading = (row: Record<string, unknown>) => ({
    steps: numeric(row.steps), active_calories: numeric(row.active_calories),
    sleep_hours: numeric(row.sleep_hours), resting_heart_rate: numeric(row.resting_heart_rate),
});

export function healthReportData(today: { health?: Record<string, unknown> } | null, history: { daily?: Record<string, unknown>[] } | null) {
    const daily = (history?.daily ?? []).map(row => ({ date: String(row.date ?? ''), ...reading(row) }));
    const average = (key: keyof ReturnType<typeof reading>) => {
        const values = daily.map(row => row[key]).filter((v): v is number => v !== null);
        return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
    };
    return {
        today: today?.health ? reading(today.health) : null,
        history: { daily, averages: { avg_steps: average('steps'), avg_calories: average('active_calories'),
            avg_sleep: average('sleep_hours'), avg_heart_rate: average('resting_heart_rate') } },
    };
}

export function healthReportDetails(
    records: { prs?: Record<string, unknown>[] } | null,
    nutrition: { profile?: Record<string, unknown> | null } | null,
    body: { measurement?: Record<string, unknown> | null } | null,
) {
    const profile = nutrition?.profile;
    const measurement = body?.measurement;
    return {
        prs: (records?.prs ?? []).slice(0, 5).map(pr => ({
            exercise_name: String(pr.exercise_name ?? 'Exercise'),
            max_weight_kg: numeric(pr.max_weight_kg),
            reps_at_max: numeric(pr.reps_at_max),
        })),
        nutrition: profile ? {
            target_calories: numeric(profile.target_calories), target_protein: numeric(profile.target_protein),
            target_carbs: numeric(profile.target_carbs), target_fat: numeric(profile.target_fat),
        } : null,
        measurements: measurement ? {
            weight: numeric(measurement.weight), body_fat: numeric(measurement.body_fat),
            waist: numeric(measurement.waist), chest: numeric(measurement.chest),
        } : null,
    };
}
