const mockApi = { getAuthToken: jest.fn(), authAPI: { getMe: jest.fn() }, healthAPI: { sync: jest.fn() } };
const mockEnabled = jest.fn();
const mockRead = jest.fn();
jest.mock('../../services/api', () => mockApi);
jest.mock('../healthImportPreference', () => ({ isHealthImportEnabled: mockEnabled }));
jest.mock('../../services/healthService', () => ({
    isHealthAvailable: () => true,
    getSummaryForDate: (...args: unknown[]) => mockRead(...args),
    hasHealthData: (s: any) => s.steps !== null,
    healthSyncPayload: (s: any) => ({ date: s.date, ...(s.steps !== null ? { steps: s.steps } : {}) }),
}));
const { syncHealthDays }: typeof import('../../services/healthSync') = require('../../services/healthSync');
beforeEach(() => {
    jest.clearAllMocks();
    mockApi.getAuthToken.mockResolvedValue('session-a');
    mockApi.authAPI.getMe.mockResolvedValue({ user: { id: 'a' } });
    mockEnabled.mockResolvedValue(true);
    mockRead.mockImplementation(async date => ({ date, steps: 0 }));
    mockApi.healthAPI.sync.mockResolvedValue({});
});
it('imports distinct dates, keeps true zero, and pins uploads to the starting session', async () => {
    const result = await syncHealthDays('a', { days: 3 });
    expect(result).toMatchObject({ checked: 3, imported: 3 });
    expect(new Set(mockApi.healthAPI.sync.mock.calls.map(c => c[0].date)).size).toBe(3);
    expect(mockApi.healthAPI.sync).toHaveBeenCalledWith(expect.objectContaining({ steps: 0 }), 'session-a');
});
it('does not upload empty readings', async () => {
    mockRead.mockImplementation(async date => ({ date, steps: null }));
    expect(await syncHealthDays('a', { days: 2 })).toMatchObject({ imported: 0 });
    expect(mockApi.healthAPI.sync).not.toHaveBeenCalled();
});
it('stops before upload if the account changes during a native read', async () => {
    mockRead.mockImplementation(async date => { mockApi.getAuthToken.mockResolvedValue('session-b'); return { date, steps: 12 }; });
    await expect(syncHealthDays('a')).rejects.toThrow('Account');
    expect(mockApi.healthAPI.sync).not.toHaveBeenCalled();
});
it('stops before upload if importing is turned off during a native read', async () => {
    mockRead.mockImplementation(async date => { mockEnabled.mockResolvedValue(false); return { date, steps: 12 }; });
    await expect(syncHealthDays('a')).rejects.toThrow('off');
    expect(mockApi.healthAPI.sync).not.toHaveBeenCalled();
});
it('refuses a stale user identity before reading device health', async () => {
    await expect(syncHealthDays('b')).rejects.toThrow('Account');
    expect(mockRead).not.toHaveBeenCalled();
});
it('reports failed imports and allows an idempotent retry', async () => {
    mockApi.healthAPI.sync.mockRejectedValueOnce(new Error('Offline'));
    await expect(syncHealthDays('a', { days: 2 })).rejects.toThrow('Offline');
    expect(await syncHealthDays('a', { days: 2 })).toMatchObject({ checked: 2, imported: 2 });
});
