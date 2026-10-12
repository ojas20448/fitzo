import AsyncStorage from '@react-native-async-storage/async-storage';
import { healthSyncStatusText, readHealthSyncStatus, recordHealthSyncStatus, subscribeHealthSyncStatus } from '../healthSyncStatus';
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(async () => { await AsyncStorage.clear(); });
it('isolates account histories and listeners and keeps the last successful import after an empty check', async () => {
    const notified = jest.fn();
    const unsubscribe = subscribeHealthSyncStatus('a', notified);
    await recordHealthSyncStatus('a', { lastImportedAt: '2026-10-07T04:00:00Z', outcome: 'imported' });
    await recordHealthSyncStatus('a', { lastCheckedAt: '2026-10-07T05:00:00Z', outcome: 'empty' });
    expect((await readHealthSyncStatus('a')).lastImportedAt).toBe('2026-10-07T04:00:00Z');
    expect(await readHealthSyncStatus('b')).toEqual({});
    expect(notified).toHaveBeenCalledTimes(2);
    unsubscribe();
    await recordHealthSyncStatus('a', { outcome: 'failed' });
    expect(notified).toHaveBeenCalledTimes(2);
});
it('does not turn absent or invalid timestamps into a recent sync', async () => {
    await AsyncStorage.setItem('health_sync_status_a', '{broken');
    expect(await readHealthSyncStatus('a')).toEqual({});
    await AsyncStorage.setItem('health_sync_status_a', JSON.stringify({ lastImportedAt: 'invalid', outcome: 'made-up' }));
    expect(healthSyncStatusText(await readHealthSyncStatus('a'))).toContain('No import has completed');
});
it('distinguishes failed, empty, and old imports without declaring read permission denied', () => {
    expect(healthSyncStatusText({ outcome: 'empty' })).toContain('limited access');
    expect(healthSyncStatusText({ outcome: 'failed' })).toContain('did not finish');
    expect(healthSyncStatusText({ outcome: 'incomplete' })).toContain('Some readings could not be checked');
    expect(healthSyncStatusText({ outcome: 'imported', lastImportedAt: '2026-10-05T04:00:00Z' }, new Date('2026-10-07T04:00:00Z'))).toContain('last 24 hours');
});
