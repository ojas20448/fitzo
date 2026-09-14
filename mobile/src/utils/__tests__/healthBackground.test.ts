const mockTasks = { defineTask: jest.fn(), isTaskDefined: () => false, isAvailableAsync: async () => true, isTaskRegisteredAsync: jest.fn() };
const mockBackground = { BackgroundTaskResult: { Success: 1, Failed: 2 }, BackgroundTaskStatus: { Available: 2 }, getStatusAsync: async () => 2,
    registerTaskAsync: jest.fn(), unregisterTaskAsync: jest.fn(), addExpirationListener: () => ({ remove: jest.fn() }) };
const mockToken = jest.fn();
const mockCanRead = jest.fn();
const mockEnabled = jest.fn();
const mockSync = jest.fn();
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-task-manager', () => mockTasks);
jest.mock('expo-background-task', () => mockBackground);
jest.mock('../../services/api', () => ({ getAuthToken: mockToken, authAPI: { getMe: async () => ({ user: { id: 'a' } }) } }));
jest.mock('../../services/healthService', () => ({ canReadHealthInBackground: mockCanRead }));
jest.mock('../../services/healthSync', () => ({ syncHealthDays: mockSync }));
jest.mock('../healthImportPreference', () => ({ isBackgroundHealthEnabled: mockEnabled }));
const { runBackgroundHealthSync, reconcileHealthBackground } = require('../../services/healthBackground');
const task = mockTasks.defineTask.mock.calls[0][1];
beforeEach(() => {
    jest.clearAllMocks();
    mockToken.mockResolvedValue('a');
    mockCanRead.mockResolvedValue(true);
    mockEnabled.mockImplementation(async id => id === 'a');
    mockTasks.isTaskRegisteredAsync.mockResolvedValue(false);
    mockSync.mockResolvedValue({ imported: 2 });
});
it('skips locked devices and signed-out sessions', async () => {
    mockCanRead.mockResolvedValue(false);
    await runBackgroundHealthSync();
    mockCanRead.mockResolvedValue(true);
    mockToken.mockResolvedValue(null);
    await runBackgroundHealthSync();
    expect(mockSync).not.toHaveBeenCalled();
});
it('requires background opt-in and rechecks it during the job', async () => {
    mockEnabled.mockResolvedValue(false);
    await runBackgroundHealthSync();
    expect(mockSync).not.toHaveBeenCalled();
    mockEnabled.mockResolvedValue(true);
    await runBackgroundHealthSync();
    const options = mockSync.mock.calls[0][1];
    expect(options.days).toBe(2);
    mockEnabled.mockResolvedValue(false);
    expect(await options.shouldContinue()).toBe(false);
});
it('registers opt-in accounts and unregisters on sign-out', async () => {
    await reconcileHealthBackground('a');
    expect(mockBackground.registerTaskAsync).toHaveBeenCalledWith('fitzo-health-sync', { minimumInterval: 60 });
    mockTasks.isTaskRegisteredAsync.mockResolvedValue(true);
    await reconcileHealthBackground();
    expect(mockBackground.unregisterTaskAsync).toHaveBeenCalledWith('fitzo-health-sync');
});
it('reports failures to the OS scheduler', async () => {
    mockSync.mockRejectedValue(new Error('Offline'));
    expect(await task()).toBe(mockBackground.BackgroundTaskResult.Failed);
});
