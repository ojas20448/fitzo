import { Platform } from 'react-native';
import { localDateString } from '../utils/healthDate';

type AppleHealth = typeof import('@kingstinct/react-native-healthkit');
type HealthConnectModule = typeof import('react-native-health-connect');
export interface HealthSummary {
    steps: number | null;
    activeCalories: number | null;
    restingHeartRate: number | null;
    sleepHours: number | null;
    date: string;
    lastSynced: number;
}
let apple: AppleHealth | null = null;
let android: HealthConnectModule | null = null;
try {
    if (Platform.OS === 'ios') apple = require('@kingstinct/react-native-healthkit');
    if (Platform.OS === 'android') android = require('react-native-health-connect');
} catch { /* Custom native build required. */ }
const READ_TYPES = ['Steps', 'ActiveCaloriesBurned', 'RestingHeartRate', 'SleepSession'] as const;

export function isHealthAvailable(): boolean {
    if (apple) return apple.isHealthDataAvailable();
    return android !== null;
}
// Apple reports completion of the request, not whether read access was granted.
export async function requestPermissions(): Promise<boolean> {
    if (apple) {
        if (!apple.isHealthDataAvailable()) return false;
        try {
            return await apple.requestAuthorization({ toRead: [
                'HKQuantityTypeIdentifierStepCount', 'HKQuantityTypeIdentifierActiveEnergyBurned',
                'HKQuantityTypeIdentifierRestingHeartRate', 'HKCategoryTypeIdentifierSleepAnalysis',
            ] });
        } catch {
            return false;
        }
    }
    if (android) {
        try {
            if (await android.getSdkStatus() !== android.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
            if (!await android.initialize()) return false;
            const granted = await android.requestPermission(READ_TYPES.map(recordType => ({ accessType: 'read', recordType })));
            return granted.some(p => p.accessType === 'read' && READ_TYPES.some(t => t === p.recordType));
        } catch {
            return false;
        }
    }
    return false;
}
const rounded = (value: number | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

// Merge overlapping asleep stages from multiple sources; never add time in bed.
function sleepHours(intervals: [number, number][], start: number, end: number): number | null {
    const spans = intervals.map(([a, b]) => [Math.max(a, start), Math.min(b, end)])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a, b) => a[0] - b[0]);
    if (!spans.length) return null;
    let total = 0, left = spans[0][0], right = spans[0][1];
    for (const [a, b] of spans.slice(1)) {
        if (a <= right) right = Math.max(right, b);
        else { total += right - left; left = a; right = b; }
    }
    return Math.round((total + right - left) / 360000) / 10;
}
export function hasHealthData(s: HealthSummary): boolean {
    return [s.steps, s.activeCalories, s.restingHeartRate, s.sleepHours].some(v => v !== null);
}
export function healthSyncPayload(s: HealthSummary) {
    return { date: s.date,
        ...(s.steps !== null ? { steps: s.steps } : {}),
        ...(s.activeCalories !== null ? { active_calories: s.activeCalories } : {}),
        ...(s.restingHeartRate !== null ? { resting_heart_rate: s.restingHeartRate } : {}),
        ...(s.sleepHours !== null ? { sleep_hours: s.sleepHours } : {}),
    };
}
export async function getTodaysSummary(): Promise<HealthSummary> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getTime() - 86400000);
    const result: HealthSummary = { steps: null, activeCalories: null, restingHeartRate: null,
        sleepHours: null, date: localDateString(now), lastSynced: now.getTime() };
    if (apple) {
        const hk = apple;
        const filter = { date: { startDate: start, endDate: now } };
        await Promise.all([
            hk.queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], { filter, unit: 'count' })
                .then(r => { result.steps = rounded(r.sumQuantity?.quantity); }).catch(() => {}),
            hk.queryStatisticsForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], { filter, unit: 'kcal' })
                .then(r => { result.activeCalories = rounded(r.sumQuantity?.quantity); }).catch(() => {}),
            hk.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
                filter: { date: { startDate: yesterday, endDate: now } }, unit: 'count/min', ascending: false, limit: 1,
            }).then(r => { result.restingHeartRate = rounded(r[0]?.quantity); }).catch(() => {}),
            hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
                filter: { date: { startDate: yesterday, endDate: now } }, limit: 0,
            }).then(rows => { result.sleepHours = sleepHours(rows.filter(s => [1, 3, 4, 5].includes(s.value))
                .map(s => [new Date(s.startDate).getTime(), new Date(s.endDate).getTime()]), yesterday.getTime(), now.getTime()); }).catch(() => {}),
        ]);
    } else if (android) {
        const hc = android;
        if (await hc.getSdkStatus() !== hc.SdkAvailabilityStatus.SDK_AVAILABLE || !await hc.initialize()) return result;
        const permissions = await hc.getGrantedPermissions();
        const allowed = (type: string) => permissions.some(p => p.accessType === 'read' && p.recordType === type);
        const timeRangeFilter = { operator: 'between' as const, startTime: start.toISOString(), endTime: now.toISOString() };
        const overnight = { ...timeRangeFilter, startTime: yesterday.toISOString() };
        await Promise.all([
            allowed('Steps') ? hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter })
                .then(r => { if (r.dataOrigins.length) result.steps = rounded(r.COUNT_TOTAL); }).catch(() => {}) : undefined,
            allowed('ActiveCaloriesBurned') ? hc.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter })
                .then(r => { if (r.dataOrigins.length) result.activeCalories = rounded(r.ACTIVE_CALORIES_TOTAL?.inKilocalories); }).catch(() => {}) : undefined,
            allowed('RestingHeartRate') ? hc.readRecords('RestingHeartRate', { timeRangeFilter: overnight, ascendingOrder: false, pageSize: 1 })
                .then(r => { result.restingHeartRate = rounded(r.records[0]?.beatsPerMinute); }).catch(() => {}) : undefined,
            allowed('SleepSession') ? (async () => {
                const intervals: [number, number][] = [];
                let pageToken: string | undefined;
                do {
                    const page = await hc.readRecords('SleepSession', { timeRangeFilter: overnight, pageSize: 1000, pageToken });
                    for (const record of page.records) {
                        // Without stages a session includes unknown awake time.
                        for (const stage of record.stages ?? []) {
                            if ([2, 4, 5, 6].includes(stage.stage)) intervals.push([Date.parse(stage.startTime), Date.parse(stage.endTime)]);
                        }
                    }
                    pageToken = page.pageToken || undefined;
                } while (pageToken);
                result.sleepHours = sleepHours(intervals, yesterday.getTime(), now.getTime());
            })().catch(() => {}) : undefined,
        ]);
    }
    return result;
}
export default { isHealthAvailable, requestPermissions, getTodaysSummary };
