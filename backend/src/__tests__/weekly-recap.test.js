/**
 * Weekly Recap Service Tests
 * Verifies weekly metrics aggregation (workouts, check-ins, calorie averages, weight trends)
 * and database caching persistence.
 */

const { generateWeeklyRecap, getLatestWeeklyRecap, getStartOfWeek } = require('../services/weeklyRecap');
const { query } = require('../config/database');

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => {
            return {
                getGenerativeModel: jest.fn().mockImplementation(() => {
                    return {
                        generateContent: jest.fn().mockResolvedValue({
                            response: {
                                text: () => 'Mock weekly summary report.'
                            }
                        })
                    };
                })
            };
        })
    };
});

describe('Weekly Recap Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('aggregates weekly statistics correctly', async () => {
        const userId = 'user-uuid-123';
        const MondayDate = getStartOfWeek();

        query.mockImplementation((sql, params) => {
            if (sql.includes('fitness_profiles')) {
                return { rows: [{ goal_type: 'deficit', target_calories: 2000, current_weight: 80.0, target_weight: 75.0 }] };
            }
            if (sql.includes('workout_sessions')) {
                return { rows: [{ count: 4 }] };
            }
            if (sql.includes('attendances')) {
                return { rows: [{ count: 5 }] };
            }
            if (sql.includes('calorie_logs')) {
                return { rows: [{ avg_calories: 1950, avg_protein: 145, avg_carbs: 180, avg_fat: 65 }] };
            }
            if (sql.includes('body_measurements')) {
                return { rows: [{ weight: 79.5 }, { weight: 80.1 }] };
            }
            if (sql.includes('get_user_streak')) {
                return { rows: [{ streak: 7 }] };
            }
            if (sql.includes('INSERT INTO weekly_recaps')) {
                return {
                    rows: [{
                        id: 'recap-uuid-123',
                        user_id: userId,
                        recap_data: {
                            workouts_count: 4,
                            checkin_count: 5,
                            avg_calories: 1950,
                            avg_protein: 145,
                            avg_carbs: 180,
                            avg_fat: 65,
                            streak_days: 7,
                            weight_trend: 'loss',
                            target_calories: 2000
                        },
                        summary_text: 'Mock weekly summary report.',
                        week_start_date: MondayDate
                    }]
                };
            }
            return { rows: [] };
        });

        const recap = await generateWeeklyRecap(userId, MondayDate);

        expect(recap.user_id).toBe(userId);
        expect(recap.week_start_date).toBe(MondayDate);
        expect(recap.summary_text).toBe('Mock weekly summary report.');
        expect(recap.recap_data.workouts_count).toBe(4);
        expect(recap.recap_data.checkin_count).toBe(5);
        expect(recap.recap_data.avg_calories).toBe(1950);
        expect(recap.recap_data.weight_trend).toBe('loss');
        expect(recap.recap_data.streak_days).toBe(7);
    });

    it('returns today weekly recap if it exists', async () => {
        const userId = 'user-uuid-123';
        const MondayDate = getStartOfWeek();

        query.mockImplementation((sql, params) => {
            if (sql.includes('SELECT id, recap_data, summary_text')) {
                return {
                    rows: [{
                        id: 'recap-uuid-123',
                        recap_data: { workouts_count: 4 },
                        summary_text: 'Cached weekly recap summary',
                        week_start_date: MondayDate
                    }]
                };
            }
            return { rows: [] };
        });

        const recap = await getLatestWeeklyRecap(userId);

        expect(recap.summary_text).toBe('Cached weekly recap summary');
        expect(recap.recap_data.workouts_count).toBe(4);
    });
});
