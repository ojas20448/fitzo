import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { foodPhotoAPI } from './api';
const STORAGE = 'fitzo.food-scan.pending.v1';
export type PendingScan = { requestId: string; id?: string };
export const foodJobsEnabled = process.env.EXPO_PUBLIC_FOOD_JOB_MODE === 'true';
export const loadPendingScan = async (): Promise<PendingScan | null> => {
    const value = await AsyncStorage.getItem(STORAGE);
    try { return value ? JSON.parse(value) : null; } catch { await AsyncStorage.removeItem(STORAGE); return null; }
};
export const clearPendingScan = () => AsyncStorage.removeItem(STORAGE);
export async function submitScan(image: string): Promise<PendingScan> {
    const pending = await loadPendingScan() || { requestId: Crypto.randomUUID() };
    await AsyncStorage.setItem(STORAGE, JSON.stringify(pending));
    let job;
    try { job = await foodPhotoAPI.submitJob(image, pending.requestId); }
    catch (e: any) {
        if (['AI_UNAVAILABLE', 'QUEUE_FULL', 'WORKER_FALLBACK_AVAILABLE', 'INVALID_PHOTO', 'AI_LIMIT_REACHED'].includes(e.code)) await clearPendingScan();
        throw e;
    }
    const saved = { ...pending, id: job.id };
    await AsyncStorage.setItem(STORAGE, JSON.stringify(saved));
    return saved;
}
export async function scanStatus(pending: PendingScan) {
    return pending.id ? foodPhotoAPI.jobStatus(pending.id) : foodPhotoAPI.jobByRequest(pending.requestId);
}
