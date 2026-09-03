/**
 * Daily Insight Service Tests
 * Verifies proactive daily note generation, database storage, English-only restrictions,
 * and push notification dispatches.
 */

// The Gemini SDK must be mocked, not merely absent. Previously it was left real:
// with no valid key the call threw, the service fell through to its fallback, and
// the "success" test still passed only because it asserted on what the mocked
// INSERT returned. That meant the happy path was never actually exercised.
jest.mock('@google/generative-ai', () => {
    const generateContent = jest.fn();
    return {
        __generateContent: generateContent,
        GoogleGenerativeAI: jest.fn(() => ({
            getGenerativeModel: jest.fn(() => ({ generateContent })),
        })),
    };
});

const { generateDailyInsight, getTodayDailyInsight } = require('../services/dailyInsight');
const { query } = require('../config/database');
const pushNotifications = require('../services/pushNotifications');
const { __generateContent: mockGenerateContent } = require('@google/generative-ai');

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

const AI_NOTE = 'You have skipped legs for 14 days. Today is a great day to squat and maintain your 5-day streak!';

/** Shape returned by the Gemini SDK on a normal completion. */
const geminiOk = (text) => ({
    response: {
        text: () => text,
        candidates: [{ finishReason: 'STOP' }],
        promptFeedback: {},
    },
});

describe('Daily Insight Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGenerateContent.mockResolvedValue(geminiOk(AI_NOTE));
    });

    it('generates, persists, and notifies daily insights successfully', async () => {
        const userId = 'user-uuid-123';

        query.mockImplementation((sql) => {
            if (sql.includes('INSERT INTO daily_insights')) {
                return { rows: [{ note: AI_NOTE }] };
            }
            return { rows: [] };
        });

        const note = await generateDailyInsight(userId);

        expect(note).toContain('skipped legs');
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toContain('INSERT INTO daily_insights');
        expect(pushNotifications.sendToUser).toHaveBeenCalledWith(userId, expect.objectContaining({
            title: "Coach's Daily Insight",
            body: note,
            type: 'general'
        }));
    });

    it('returns today cached daily note if it exists', async () => {
        const userId = 'user-uuid-123';

        query.mockImplementation((sql) => {
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

    // The row is written with ON CONFLICT DO UPDATE, so persisting the fallback
    // pinned the user to the generic string for the rest of the day — long after
    // Gemini recovered. Failing without writing lets the next request retry.
    it('does not cache the fallback when generation fails', async () => {
        query.mockResolvedValue({ rows: [] });
        mockGenerateContent.mockRejectedValue(new Error('503 model overloaded'));

        const note = await generateDailyInsight('user-uuid-123');

        expect(note).toContain('Keep showing up');
        expect(query).not.toHaveBeenCalled();
        expect(pushNotifications.sendToUser).not.toHaveBeenCalled();
    });

    // `.text()` returns empty rather than throwing when a candidate is blocked or
    // truncated; that must not be cached as a legitimate insight either.
    it('treats a blocked or empty candidate as a failure', async () => {
        query.mockResolvedValue({ rows: [] });
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => '',
                candidates: [{ finishReason: 'SAFETY' }],
                promptFeedback: { blockReason: 'SAFETY' },
            },
        });

        const note = await generateDailyInsight('user-uuid-123');

        expect(note).toContain('Keep showing up');
        expect(query).not.toHaveBeenCalled();
    });

    // The home screen awaits this call, so a cache miss must not block on Gemini.
    it('answers immediately on a cache miss instead of awaiting generation', async () => {
        query.mockResolvedValue({ rows: [] });
        let released;
        mockGenerateContent.mockReturnValue(new Promise((r) => { released = r; }));

        const note = await getTodayDailyInsight('user-uuid-123');

        expect(note).toBeNull();
        released(geminiOk(AI_NOTE));
    });
});
