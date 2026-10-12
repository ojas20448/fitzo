import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const keyFor = (userId: string) => `fitzo_onboarding_v1_${userId}`;
// Body measurements stay in secure storage on native devices. Web previews use
// session storage so drafts do not outlive the browser session.
export async function readOnboardingDraft(userId: string) {
    const key = keyFor(userId);
    return Platform.OS === 'web' ? sessionStorage.getItem(key) : SecureStore.getItemAsync(key);
}
export async function writeOnboardingDraft(userId: string, value: string) {
    const key = keyFor(userId);
    if (Platform.OS === 'web') sessionStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
}
export async function clearOnboardingDraft(userId: string) {
    const key = keyFor(userId);
    if (Platform.OS === 'web') sessionStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
}
