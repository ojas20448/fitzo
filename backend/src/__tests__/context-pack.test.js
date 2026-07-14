/**
 * Context Pack Service Tests
 * Verifies metrics aggregation, volume calculation, and formatting of context pack data.
 */

const { getContextPack } = require('../services/contextPack');
const { query } = require('../config/database');

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/cache', () => ({
    getOrSet: jest.fn((key, computeFn) => computeFn()),
    del: jest.fn()
}));

describe('Context Pack Builder Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('compiles 14-day context pack correctly', async () => {
        const userId = '1234-5678';

        // Mock database queries
        query.mockImplementation((sql, params) => {
            if (sql.includes('fitness_profiles')) {
                return {
                    rows: [{
                        goal_type: 'deficit',
                        current_weight: 80.5,
                        target_weight: 75.0,
                        height: 180,
                        age: 28,
                        gender: 'male',
                        activity_level: 'active',
                        target_calories: 2200,
                        ai_profile_summary: 'Prefers strength training.'
                    }]
                };
            }
            if (sql.includes('get_user_streak')) {
                return { rows: [{ streak: 5 }] };
            }
            if (sql.includes('attendances')) {
                return { rows: [{ check_date: '2026-07-14', checked_in_at: new Date() }] };
            }
            if (sql.includes('workout_sessions')) {
                return {
                    rows: [
                        {
                            id: 's1',
                            day_name: 'Push Day',
                            completed_at: new Date(),
                            duration_minutes: 60,
                            notes: 'Good pump',
                            log_id: 'l1',
                            exercise_name: 'Bench Press',
                            exercise_category: 'chest',
                            set_number: 1,
                            reps: 10,
                            weight_kg: 80.00,
                            rpe: 8
                        },
                        {
                            id: 's1',
                            day_name: 'Push Day',
                            completed_at: new Date(),
                            duration_minutes: 60,
                            notes: 'Good pump',
                            log_id: 'l1',
                            exercise_name: 'Bench Press',
                            exercise_category: 'chest',
                            set_number: 2,
                            reps: 8,
                            weight_kg: 85.00,
                            rpe: 9
                        }
                    ]
                };
            }
            if (sql.includes('calorie_logs')) {
                return {
                    rows: [
                        { logged_date: '2026-07-14', calories: 2150, protein: 160, carbs: 200, fat: 70, meals: ['Breakfast', 'Lunch'] }
                    ]
                };
            }
            if (sql.includes('readiness_logs')) {
                return {
                    rows: [
                        { log_date: '2026-07-14', energy_level: 4, sleep_quality: 4, soreness: 2, sleep_hours: 8.0, readiness_score: 85, recommendation: 'push' }
                    ]
                };
            }
            if (sql.includes('body_measurements')) {
                return { rows: [{ log_date: '2026-07-14', weight: 80.5, body_fat: 16.5 }] };
            }
            if (sql.includes('user_splits')) {
                return { rows: [{ split_id: 'ppl', name: 'Push Pull Legs', days: ['Push', 'Pull', 'Legs'], days_per_week: 3 }] };
            }
            if (sql.includes('workout_intents')) {
                return { rows: [{ muscle_group: 'chest', note: 'Push day focus', session_label: 'Push', created_at: new Date() }] };
            }
            return { rows: [] };
        });

        const pack = await getContextPack(userId);

        expect(pack.userId).toBe(userId);
        expect(pack.profile.goal_type).toBe('deficit');
        expect(pack.streak).toBe(5);
        expect(pack.training.sessions.length).toBe(1);
        expect(pack.training.sessions[0].exercises.length).toBe(1);
        expect(pack.training.sessions[0].exercises[0].sets.length).toBe(2);
        expect(pack.training.volume.chest).toBe(2);
        expect(pack.training.prs['Bench Press']).toBe(85);
        expect(pack.training.skippedMuscleGroups).toContain('legs');
        expect(pack.training.skippedMuscleGroups).toContain('back');
        expect(pack.nutrition[0].calories).toBe(2150);
        expect(pack.readiness[0].readiness_score).toBe(85);
        expect(pack.weightHistory[0].weight).toBe(80.5);
        expect(pack.activeSplit.split_id).toBe('ppl');
        expect(pack.todayIntent.muscle_group).toBe('chest');
    });
});
