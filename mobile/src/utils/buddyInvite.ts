import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fitzo.pending-buddy-invite';
const MAX_AGE = 24 * 60 * 60 * 1000;
export type BuddyInvite = { id: string; u: string };
export type InviteStatus = 'checking' | 'ready' | 'already_friend' | 'pending_sent' | 'pending_received' | 'blocked' | 'self' | 'invalid' | 'error';

export function parseBuddyInvite(id: unknown, username: unknown): BuddyInvite | null {
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
    return { id: id.toLowerCase(), u: typeof username === 'string' ? username.trim().slice(0, 64) : '' };
}

export function inviteStatus(status: unknown): InviteStatus {
    switch (status) {
        case 'friend': return 'already_friend';
        case 'none': return 'ready';
        case 'pending_sent': case 'pending_received': case 'blocked': return status;
        default: return 'error';
    }
}

export function parseBuddyQr(data: string): BuddyInvite | null {
    const raw = data.trim();
    const bare = parseBuddyInvite(raw, '');
    if (bare) return bare;
    try {
        const url = new URL(raw);
        const web = url.protocol === 'https:' && ['www.fitzoapp.in', 'fitzoapp.in'].includes(url.hostname) && url.pathname === '/buddy';
        const app = url.protocol === 'fitzo:' && url.hostname === 'buddy' && !url.pathname;
        if (!web && !app) return null;
        return parseBuddyInvite(url.searchParams.get('id') || url.searchParams.get('userId'), url.searchParams.get('u') || url.searchParams.get('username'));
    } catch {
        try {
            const value = JSON.parse(raw);
            return parseBuddyInvite(value?.userId, value?.username);
        } catch { return null; }
    }
}

export async function savePendingInvite(invite: BuddyInvite) {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...invite, savedAt: Date.now() }));
}

export async function getPendingInvite(): Promise<BuddyInvite | null> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return null;
        const value = JSON.parse(raw);
        const invite = parseBuddyInvite(value.id, value.u);
        if (invite && Number.isFinite(value.savedAt) && Date.now() - value.savedAt >= 0 && Date.now() - value.savedAt < MAX_AGE) return invite;
    } catch { /* Ignore malformed/expired local data; never block login. */ }
    await clearPendingInvite();
    return null;
}

export async function clearPendingInvite() {
    await AsyncStorage.removeItem(KEY).catch(() => {});
}
