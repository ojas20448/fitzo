import AsyncStorage from '@react-native-async-storage/async-storage';

// Device permissions belong to the app; importing readings belongs to an account.
export async function isHealthImportEnabled(userId?: string): Promise<boolean> {
    return Boolean(userId) && await AsyncStorage.getItem(`health_import_enabled_${userId}`) === 'true';
}
export async function enableHealthImport(userId: string): Promise<void> {
    if (!userId) throw new Error('Sign in before connecting health data');
    await AsyncStorage.setItem(`health_import_enabled_${userId}`, 'true');
}

export async function disableHealthImport(userId: string): Promise<void> {
    await AsyncStorage.setItem(`health_import_enabled_${userId}`, 'false');
    await setBackgroundHealthEnabled(userId, false);
}

export async function isBackgroundHealthEnabled(userId?: string): Promise<boolean> {
    return Boolean(userId) && await isHealthImportEnabled(userId) &&
        await AsyncStorage.getItem(`health_background_enabled_${userId}`) === 'true';
}

export async function setBackgroundHealthEnabled(userId: string, enabled: boolean): Promise<void> {
    if (!userId) throw new Error('Sign in before changing health imports');
    await AsyncStorage.setItem(`health_background_enabled_${userId}`, String(enabled));
}
