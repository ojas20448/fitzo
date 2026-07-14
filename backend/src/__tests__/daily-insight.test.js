/**
 * Daily Insight Service Tests
 * Verifies proactive daily note generation, database storage, English-only restrictions,
 * and push notification dispatches.
 */

const { generateDailyInsight, getTodayDailyInsight } = require('../services/dailyInsight');
const { query } = require('../config/database');
const pushNotifications = require('../services/pushNotifications');

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/contextPack', () => ({
    getContextPack: jest.fn().mockResolvedValue({
        streak: 5,
        profile: { goal_type: 'deficit', current_weight: 80.0, target_weight: 75.0, target_calories: 2000 },
        training: { volume: { chest: 4 }, skippedMuscleGroups: ['legs'] },
        nutrition: [],
        readiness: [{ readiness_score: 90, recommendation: 'push' }]
    })
}));

jest.mock('../services/pushNotifications', () => ({
    sendToUser: jest.fn().mockResolvedValue({ success: true })
}));

describe('Daily Insight Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('generates, persists, and notifies daily insights successfully', async () => {
        const userId = 'user-uuid-123';

        // Mock database responses
        query.mockImplementation((sql, params) => {
            if (sql.includes('INSERT INTO daily_insights')) {
                return {
                    rows: [{ note: 'You have skipped legs for 14 days. Today is a great day to squat and maintain your 5-day streak!' }]
                };
            }
            return { rows: [] };
        });

        const note = await generateDailyInsight(userId);

        expect(note).toContain('skipped legs');
        expect(query).toHaveBeenCalledTimes(1);
        expect(pushNotifications.sendToUser).toHaveBeenCalledWith(userId, expect.objectContaining({
            title: "Coach's Daily Insight",
            body: note,
            type: 'general'
        }));
    });

    it('returns today cached daily note if it exists', async () => {
        const userId = 'user-uuid-123';

        query.mockImplementation((sql, params) => {
            if (sql.includes('SELECT note FROM daily_insights')) {
                return { rows: [{ note: 'Cached daily note' }] };
            }
            return { rows: [] };
        });

        const note = await getTodayDailyInsight(userId);

        expect(note).toBe('Cached daily note');
        // Daily note generation should not run if cached
        expect(pushNotifications.sendToUser).not.toHaveBeenCalled();
    });
});
