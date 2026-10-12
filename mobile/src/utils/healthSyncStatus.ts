import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HealthSyncStatus {
    lastCheckedAt?: string;
    lastImportedAt?: string;
    outcome?: 'imported' | 'empty' | 'failed' | 'incomplete';
    checked?: number;
    imported?: number;
}
const listeners = new Map<string, Set<(status: HealthSyncStatus) => void>>();
const key = (userId: string) => `health_sync_status_${userId}`;

export async function readHealthSyncStatus(userId?: string): Promise<HealthSyncStatus> {
    if (!userId) return {};
    const value = await AsyncStorage.getItem(key(userId));
    if (!value) return {};
    try {
        const status = JSON.parse(value);
        if (!status || typeof status !== 'object') return {};
        const validTime = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : undefined;
        return {
            lastCheckedAt: validTime(status.lastCheckedAt),
            lastImportedAt: validTime(status.lastImportedAt),
            outcome: ['imported', 'empty', 'failed', 'incomplete'].includes(status.outcome) ? status.outcome : undefined,
            checked: Number.isInteger(status.checked) && status.checked >= 0 ? status.checked : undefined,
            imported: Number.isInteger(status.imported) && status.imported >= 0 ? status.imported : undefined,
        };
    } catch { return {}; }
}

// Called from the serialized account sync job, including background imports.
// Store timestamps and counts only; keep health readings on their existing path.
export async function recordHealthSyncStatus(userId: string, patch: HealthSyncStatus): Promise<void> {
    const status = { ...await readHealthSyncStatus(userId), ...patch };
    await AsyncStorage.setItem(key(userId), JSON.stringify(status));
    listeners.get(userId)?.forEach(listener => listener(status));
}

export function subscribeHealthSyncStatus(userId: string, listener: (status: HealthSyncStatus) => void): () => void {
    const accountListeners = listeners.get(userId) ?? new Set();
    listeners.set(userId, accountListeners);
    accountListeners.add(listener);
    return () => {
        accountListeners.delete(listener);
        if (!accountListeners.size) listeners.delete(userId);
    };
}

export function healthSyncStatusText(status: HealthSyncStatus, now = new Date()): string {
    if (status.outcome === 'failed') return 'The last import did not finish. Saved readings are kept. Try Sync now again.';
    if (status.outcome === 'incomplete') return 'Some readings could not be checked. Available readings were kept. This can happen when access or the health service is unavailable.';
    if (status.outcome === 'empty') return 'No readable data was found in the last check. This can mean no recordings or limited access.';
    if (status.lastImportedAt && now.getTime() - Date.parse(status.lastImportedAt) > 24 * 60 * 60 * 1000) {
        return 'No readings have been imported in the last 24 hours. Sync now to check for updates.';
    }
    return status.lastImportedAt ? 'Available readings were saved to your Fitzo account.' : 'No import has completed on this device yet.';
}
