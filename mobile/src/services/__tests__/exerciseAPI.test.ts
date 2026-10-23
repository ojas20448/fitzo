jest.mock('axios', () => {
    const client = { get: jest.fn(async () => ({ data: { exercises: [] } })), put: jest.fn(async () => ({ data: {} })), post: jest.fn(async () => ({ data: {} })), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
    return { create: () => client };
});
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../../stores/offlineStore', () => ({ useOfflineStore: { getState: () => ({}) } }));
import { exerciseAPI, workoutsAPI } from '../api';
const mockGet = jest.requireMock('axios').create().get;

test('keeps slash-containing exercise names in a single search path segment', async () => {
    await exerciseAPI.search('3/4 sit-up');
    expect(mockGet).toHaveBeenCalledWith('/exercises/search/3%2F4%20sit-up');
});

test('binds history requests to the expected account token', async () => {
    await workoutsAPI.getHistory(90, 'test-token');
    expect(mockGet).toHaveBeenCalledWith('/workouts/history?limit=90', { _expectedAuthToken: 'test-token' });
});

test('sends combined community filters and the expected account token', async () => {
    const filters = { official: false, days: 3, difficulty: 'beginner', search: 'strength', sort: 'most_liked' as const, page: 1 };
    await workoutsAPI.getPublishedSplits(filters, 'member-token');
    expect(mockGet).toHaveBeenCalledWith('/workouts/published', { params: filters, _expectedAuthToken: 'member-token' });
});

test('binds heart and adoption writes to the initiating account', async () => {
    const client = jest.requireMock('axios').create();
    await workoutsAPI.setSplitHeart('split/id', true, 'member-token');
    expect(client.put).toHaveBeenCalledWith('/workouts/published/split%2Fid/heart', { liked: true }, { _expectedAuthToken: 'member-token' });
    await workoutsAPI.adoptSplit('split/id', 'member-token');
    expect(client.post).toHaveBeenCalledWith('/workouts/published/split%2Fid/adopt', {}, { _expectedAuthToken: 'member-token' });
});

test('publishing sends saved-plan identity and public metadata', async () => {
    const data = { source_split_id: 'saved', name: 'Upper', description: 'Strength', difficulty_level: 'beginner', tags: ['strength'] };
    await workoutsAPI.publishSplit(data, 'member-token');
    expect(jest.requireMock('axios').create().post).toHaveBeenCalledWith('/workouts/published', data, { _expectedAuthToken: 'member-token' });
});
