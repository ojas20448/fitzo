jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseBuddyInvite, parseBuddyQr, inviteStatus, savePendingInvite, getPendingInvite, clearPendingInvite } from '../buddyInvite';
const invite = { id: '11111111-1111-4111-8111-111111111111', u: 'buddy' };
beforeEach(async () => { await AsyncStorage.clear(); });
test.each([
    ['friend', 'already_friend'], ['none', 'ready'], ['pending_sent', 'pending_sent'],
    ['pending_received', 'pending_received'], ['blocked', 'blocked'], ['unexpected', 'error'],
])('maps API status %s to %s', (value, expected) => expect(inviteStatus(value)).toBe(expected));
test('rejects malformed IDs and repeated query parameters', () => {
    expect(parseBuddyInvite('/login', 'buddy')).toBeNull();
    expect(parseBuddyInvite([invite.id], 'buddy')).toBeNull();
    expect(parseBuddyInvite(invite.id.toUpperCase(), ' buddy ')).toEqual(invite);
});
test('keeps a validated invite through login/onboarding, then clears it after opening', async () => {
    await savePendingInvite(invite);
    expect(await getPendingInvite()).toEqual(invite);
    expect(await getPendingInvite()).toEqual(invite); // reading before onboarding does not consume it
    await clearPendingInvite();
    expect(await getPendingInvite()).toBeNull();
});
test('does not reopen stale invites', async () => {
    await savePendingInvite(invite);
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
    expect(await getPendingInvite()).toBeNull();
    spy.mockRestore();
});
test('QR accepts Fitzo links and legacy codes without following arbitrary links', () => {
    expect(parseBuddyQr(`https://www.fitzoapp.in/buddy?id=${invite.id}&u=buddy`)).toEqual(invite);
    expect(parseBuddyQr(`fitzo://buddy?id=${invite.id}&u=buddy`)).toEqual(invite);
    expect(parseBuddyQr(JSON.stringify({ type: 'fitzo_profile', userId: invite.id, username: 'buddy' }))).toEqual(invite);
    expect(parseBuddyQr(`https://unrelated.example/buddy?id=${invite.id}`)).toBeNull();
    expect(parseBuddyQr('fitzo://buddy?id=%ZZ')).toBeNull();
});
