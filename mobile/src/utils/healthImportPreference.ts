import AsyncStorage from '@react-native-async-storage/async-storage';

// Device permissions belong to the app; importing readings belongs to an account.
export async function isHealthImportEnabled(userId?: string): Promise<boolean> {
    return Boolean(userId) && await AsyncStorage.getItem(`health_import_enabled_${userId}`) === 'true';
}
export async function enableHealthImport(userId: string): Promise<void> {
    if (!userId) throw new Error('Sign in before connecting health data');
    await AsyncStorage.setItem(`health_import_enabled_${userId}`, 'true');
}
