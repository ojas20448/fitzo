import { authAPI, getAuthToken, healthAPI } from './api';
import { getSummaryForDate, hasHealthData, healthSyncPayload, isHealthAvailable } from './healthService';
import { isHealthImportEnabled } from '../utils/healthImportPreference';
import { recentHealthDates } from '../utils/healthDate';
import { recordHealthSyncStatus } from '../utils/healthSyncStatus';

export interface HealthSyncProgress { checked: number; imported: number; total: number; unreadableDays?: number }
interface Options {
    days?: number;
    onProgress?: (progress: HealthSyncProgress) => void;
    shouldContinue?: () => Promise<boolean>;
}
const jobs = new Map<string, Promise<HealthSyncProgress>>();

export function syncHealthDays(userId: string, options: Options = {}): Promise<HealthSyncProgress> {
    const dates = recentHealthDates(options.days ?? 2);
    // Capture before waiting for another import: queued work cannot change accounts.
    const tokenAtStart = getAuthToken();
    const previous = jobs.get(userId);
    const job = (async () => {
        await previous?.catch(() => {});
        const token = await tokenAtStart;
        if (!token) throw new Error('Account changed. Sign in and try again.');
        const guard = async () => {
            if (!userId || !token || await getAuthToken() !== token) throw new Error('Account changed. Sign in and try again.');
            if (!await isHealthImportEnabled(userId)) throw new Error('Health importing is turned off.');
            if (options.shouldContinue && !await options.shouldContinue()) throw new Error('Health sync stopped.');
        };
        await guard();
        if (!isHealthAvailable()) throw new Error('Health importing requires a supported native build.');
        const account = await authAPI.getMe();
        if (account?.user?.id !== userId) throw new Error('Account changed. Sign in and try again.');
        await guard();
        const progress: HealthSyncProgress = { checked: 0, imported: 0, total: dates.length };
        try {
            for (const date of dates) {
                await guard();
                const summary = await getSummaryForDate(date);
                if (summary.readErrors) progress.unreadableDays = (progress.unreadableDays ?? 0) + 1;
                await guard();
                if (hasHealthData(summary)) {
                    await healthAPI.sync(healthSyncPayload(summary), token);
                    progress.imported++;
                    await guard();
                    // A later day's failure must not erase a successful upload.
                    await recordHealthSyncStatus(userId, { lastImportedAt: new Date().toISOString() }).catch(() => {});
                }
                progress.checked++;
                options.onProgress?.({ ...progress });
            }
            await guard();
            await recordHealthSyncStatus(userId, { lastCheckedAt: new Date().toISOString(),
                outcome: progress.unreadableDays ? 'incomplete' : progress.imported ? 'imported' : 'empty', checked: progress.checked, imported: progress.imported }).catch(() => {});
            return progress;
        } catch (error) {
            // Do not publish status into an account whose session or preference changed.
            if (await getAuthToken() === token && await isHealthImportEnabled(userId)) {
                await recordHealthSyncStatus(userId, { lastCheckedAt: new Date().toISOString(),
                    outcome: 'failed', checked: progress.checked, imported: progress.imported }).catch(() => {});
            }
            throw error;
        }
    })();
    jobs.set(userId, job);
    void job.finally(() => { if (jobs.get(userId) === job) jobs.delete(userId); }).catch(() => {});
    return job;
}
