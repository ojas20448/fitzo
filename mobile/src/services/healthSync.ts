import { authAPI, getAuthToken, healthAPI } from './api';
import { getSummaryForDate, hasHealthData, healthSyncPayload, isHealthAvailable } from './healthService';
import { isHealthImportEnabled } from '../utils/healthImportPreference';
import { recentHealthDates } from '../utils/healthDate';

export interface HealthSyncProgress { checked: number; imported: number; total: number }
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
        const progress = { checked: 0, imported: 0, total: dates.length };
        for (const date of dates) {
            await guard();
            const summary = await getSummaryForDate(date);
            await guard();
            if (hasHealthData(summary)) {
                await healthAPI.sync(healthSyncPayload(summary), token);
                progress.imported++;
            }
            progress.checked++;
            options.onProgress?.({ ...progress });
        }
        return progress;
    })();
    jobs.set(userId, job);
    void job.finally(() => { if (jobs.get(userId) === job) jobs.delete(userId); }).catch(() => {});
    return job;
}
