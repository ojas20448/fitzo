/**
 * Transcription Service Tests
 * Verifies Gemini voice transcription service integration.
 */

const { transcribeAudio } = require('../services/gemini');

jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => {
            return {
                getGenerativeModel: jest.fn().mockImplementation(() => {
                    return {
                        generateContent: jest.fn().mockResolvedValue({
                            response: {
                                text: () => '2 roti, bowl of dal, 100g paneer'
                            }
                        })
                    };
                })
            };
        })
    };
});

describe('Gemini Voice Transcription Service', () => {
    it('transcribes base64 audio successfully', async () => {
        const base64Audio = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='; // dummy wave header
        const mimeType = 'audio/wav';

        const transcription = await transcribeAudio(base64Audio, mimeType);
        expect(transcription).toBe('2 roti, bowl of dal, 100g paneer');
    });
});
