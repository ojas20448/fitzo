/**
 * Unified Health Data Service
 *
 * Bridges HealthKit (iOS) and Health Connect (Android) into a single API.
 * Requires expo-dev-client (custom native build — won't work in Expo Go).
 *
 * Data collected:
 * - Steps (daily total)
 * - Active calories burned
 * - Resting heart rate
 * - Sleep duration
 * - Heart rate samples
 *
 * Usage:
 *   const health = useHealthService();
 *   await health.requestPermissions();
 *   const data = await health.getTodaysSummary();
 */

import { Platform } from 'react-native';

// ===========================================
// TYPES
// ===========================================

export interface HealthSummary {
    steps: number;
    activeCalories: number;
    restingHeartRate: number | null;
    sleepHours: number | null;
    lastSynced: number;
}

export interface HealthPermissionStatus {
    granted: boolean;
    canRequest: boolean;
}

// ===========================================
// iOS: HealthKit via @kingstinct/react-native-healthkit
// ===========================================

let Healthkit: any = null;
if (Platform.OS === 'ios') {
    try {
        Healthkit = require('@kingstinct/react-native-healthkit');
    } catch (e) {
    }
}

async function requestHealthKitPermissions(): Promise<boolean> {
    if (!Healthkit) return false;
    try {
        const status = await Healthkit.requestAuthorization([
            Healthkit.HKQuantityTypeIdentifier.stepCount,
            Healthkit.HKQuantityTypeIdentifier.activeEnergyBurned,
            Healthkit.HKQuantityTypeIdentifier.restingHeartRate,
            Healthkit.HKCategoryTypeIdentifier.sleepAnalysis,
        ]);
        return status;
    } catch (e) {
        return false;
    }
}

async function getHealthKitSummary(): Promise<HealthSummary> {
    if (!Healthkit) throw new Error('HealthKit not available');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Steps
    let steps = 0;
    try {
        const stepsData = await Healthkit.queryQuantitySamples(
            Healthkit.HKQuantityTypeIdentifier.stepCount,
            { from: startOfDay, to: now }
        );
        steps = stepsData.reduce((sum: number, s: any) => sum + s.quantity, 0);
    } catch (e) {
    }

    // Active calories
    let activeCalories = 0;
    try {
        const calData = await Healthkit.queryQuantitySamples(
            Healthkit.HKQuantityTypeIdentifier.activeEnergyBurned,
            { from: startOfDay, to: now }
        );
        activeCalories = Math.round(calData.reduce((sum: number, s: any) => sum + s.quantity, 0));
    } catch (e) {
    }

    // Resting heart rate (latest)
    let restingHeartRate: number | null = null;
    try {
        const hrData = await Healthkit.queryQuantitySamples(
            Healthkit.HKQuantityTypeIdentifier.restingHeartRate,
            { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now }
        );
        if (hrData.length > 0) {
            restingHeartRate = Math.round(hrData[hrData.length - 1].quantity);
        }
    } catch (e) {
    }

    // Sleep (last night)
    let sleepHours: number | null = null;
    try {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sleepData = await Healthkit.queryCategorySamples(
            Healthkit.HKCategoryTypeIdentifier.sleepAnalysis,
            { from: yesterday, to: now }
        );
        if (sleepData.length > 0) {
            const totalMs = sleepData.reduce((sum: number, s: any) => {
                const start = new Date(s.startDate).getTime();
                const end = new Date(s.endDate).getTime();
                return sum + (end - start);
            }, 0);
            sleepHours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
        }
    } catch (e) {
    }

    return { steps, activeCalories, restingHeartRate, sleepHours, lastSynced: Date.now() };
}

// ===========================================
// Android: Health Connect via react-native-health-connect
// ===========================================

let HealthConnect: any = null;
if (Platform.OS === 'android') {
    try {
        HealthConnect = require('react-native-health-connect');
    } catch (e) {
    }
}

async function requestHealthConnectPermissions(): Promise<boolean> {
    if (!HealthConnect) return false;
    try {
        const isAvailable = await HealthConnect.getSdkStatus();
        if (isAvailable !== HealthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
            return false;
        }

        await HealthConnect.initialize();
        const granted = await HealthConnect.requestPermission([
            { accessType: 'read', recordType: 'Steps' },
            { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
            { accessType: 'read', recordType: 'HeartRate' },
            { accessType: 'read', recordType: 'SleepSession' },
        ]);

        return granted.length > 0;
    } catch (e) {
        return false;
    }
}

async function getHealthConnectSummary(): Promise<HealthSummary> {
    if (!HealthConnect) throw new Error('Health Connect not available');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const timeRange = { startTime: startOfDay.toISOString(), endTime: now.toISOString() };

    // Steps
    let steps = 0;
    try {
        const stepsData = await HealthConnect.readRecords('Steps', { timeRangeFilter: { operatorType: 'between', ...timeRange } });
        steps = stepsData.records.reduce((sum: number, r: any) => sum + r.count, 0);
    } catch (e) {
    }

    // Active calories
    let activeCalories = 0;
    try {
        const calData = await HealthConnect.readRecords('ActiveCaloriesBurned', { timeRangeFilter: { operatorType: 'between', ...timeRange } });
        activeCalories = Math.round(calData.records.reduce((sum: number, r: any) => sum + r.energy.inKilocalories, 0));
    } catch (e) {
    }

    // Resting heart rate (latest sample)
    let restingHeartRate: number | null = null;
    try {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const hrData = await HealthConnect.readRecords('HeartRate', {
            timeRangeFilter: { operatorType: 'between', startTime: yesterday.toISOString(), endTime: now.toISOString() }
        });
        if (hrData.records.length > 0) {
            const lastRecord = hrData.records[hrData.records.length - 1];
            if (lastRecord.samples?.length > 0) {
                restingHeartRate = lastRecord.samples[lastRecord.samples.length - 1].beatsPerMinute;
            }
        }
    } catch (e) {
    }

    // Sleep
    let sleepHours: number | null = null;
    try {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sleepData = await HealthConnect.readRecords('SleepSession', {
            timeRangeFilter: { operatorType: 'between', startTime: yesterday.toISOString(), endTime: now.toISOString() }
        });
        if (sleepData.records.length > 0) {
            const totalMs = sleepData.records.reduce((sum: number, r: any) => {
                const start = new Date(r.startTime).getTime();
                const end = new Date(r.endTime).getTime();
                return sum + (end - start);
            }, 0);
            sleepHours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
        }
    } catch (e) {
    }

    return { steps, activeCalories, restingHeartRate, sleepHours, lastSynced: Date.now() };
}

// ===========================================
// UNIFIED API
// ===========================================

export function isHealthAvailable(): boolean {
    if (Platform.OS === 'ios') return Healthkit !== null;
    if (Platform.OS === 'android') return HealthConnect !== null;
    return false;
}

export async function requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') return requestHealthKitPermissions();
    if (Platform.OS === 'android') return requestHealthConnectPermissions();
    return false;
}

export async function getTodaysSummary(): Promise<HealthSummary> {
    if (Platform.OS === 'ios') return getHealthKitSummary();
    if (Platform.OS === 'android') return getHealthConnectSummary();
    return { steps: 0, activeCalories: 0, restingHeartRate: null, sleepHours: null, lastSynced: Date.now() };
}

export default {
    isHealthAvailable,
    requestPermissions,
    getTodaysSummary,
};
