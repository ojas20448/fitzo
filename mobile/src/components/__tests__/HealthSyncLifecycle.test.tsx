import React from 'react';
import HealthSyncLifecycle from '../HealthSyncLifecycle';
const { create, act } = jest.requireActual('react-test-renderer');
const mockSession = { user: { id: 'a' } as { id: string } | null, isLoading: false };
let mockState = 'active';
let mockAppStateChange: (state: string) => void;
let mockHealthChange: () => void;
const mockRemoveAppState = jest.fn();
const mockRemoveHealth = jest.fn();
const mockEnabled = jest.fn();
const mockSync = jest.fn();
const mockObserve = jest.fn((callback: () => void) => { mockHealthChange = callback; return mockRemoveHealth; });
jest.mock('react-native', () => ({ AppState: {
    get currentState() { return mockState; },
    addEventListener: (_event: string, callback: (state: string) => void) => {
        mockAppStateChange = callback;
        return { remove: mockRemoveAppState };
    },
} }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockSession }));
jest.mock('../../services/healthBackground', () => ({ reconcileHealthBackground: jest.fn(async () => {}) }));
jest.mock('../../services/healthSync', () => ({ syncHealthDays: (...args: unknown[]) => mockSync(...args) }));
jest.mock('../../services/healthService', () => ({ subscribeToHealthChanges: (callback: () => void) => mockObserve(callback) }));
jest.mock('../../utils/healthImportPreference', () => ({ isHealthImportEnabled: (...args: unknown[]) => mockEnabled(...args) }));
let screen: any;
beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSession.user = { id: 'a' };
    mockState = 'active';
    mockEnabled.mockResolvedValue(true);
    mockSync.mockResolvedValue({ imported: 1 });
});
afterEach(async () => { await act(async () => screen?.unmount()); jest.useRealTimers(); });
it('syncs on cold launch and refreshes while the app remains active', async () => {
    await act(async () => { screen = create(<HealthSyncLifecycle />); });
    expect(mockSync).toHaveBeenCalledWith('a', expect.anything());
    mockSync.mockClear();
    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(mockSync).toHaveBeenCalledTimes(1);
});
it('refreshes on native changes and releases observers in the background', async () => {
    await act(async () => { screen = create(<HealthSyncLifecycle />); });
    expect(mockObserve).toHaveBeenCalledTimes(1);
    mockSync.mockClear();
    await act(async () => { mockHealthChange(); });
    expect(mockSync).toHaveBeenCalledTimes(1);
    await act(async () => { mockState = 'background'; mockAppStateChange(mockState); });
    expect(mockRemoveHealth).toHaveBeenCalledTimes(1);
    mockSync.mockClear();
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(mockSync).not.toHaveBeenCalled();
    await act(async () => { mockState = 'active'; mockAppStateChange(mockState); });
    expect(mockSync).toHaveBeenCalledTimes(1);
});
it('skips opted-out accounts and stops queued work on account change', async () => {
    mockEnabled.mockResolvedValue(false);
    await act(async () => { screen = create(<HealthSyncLifecycle />); });
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockObserve).not.toHaveBeenCalled();
    mockEnabled.mockResolvedValue(true);
    await act(async () => { jest.advanceTimersByTime(30000); });
    const guard = mockSync.mock.calls[0][1].shouldContinue;
    expect(await guard()).toBe(true);
    await act(async () => { mockSession.user = { id: 'b' }; screen.update(<HealthSyncLifecycle />); });
    expect(await guard()).toBe(false);
    expect(mockRemoveHealth).toHaveBeenCalled();
});
it('coalesces native events arriving during an import into one follow-up import', async () => {
    await act(async () => { screen = create(<HealthSyncLifecycle />); });
    let finish!: (value: unknown) => void;
    mockSync.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mockSync.mockClear();
    await act(async () => { mockHealthChange(); });
    await act(async () => { mockHealthChange(); mockHealthChange(); });
    expect(mockSync).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ imported: 1 }); });
    expect(mockSync).toHaveBeenCalledTimes(2);
});
