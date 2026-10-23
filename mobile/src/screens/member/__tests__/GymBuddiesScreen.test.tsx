import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import GymBuddiesScreen from '../GymBuddiesScreen';
import GlassCard from '../../../components/GlassCard';
import { friendsAPI } from '../../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
const mockSuccess = jest.fn();
const mockError = jest.fn();
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => true }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (callback: any) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: mockError, success: mockSuccess }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../../../services/api', () => ({
    friendsAPI: {
        getFriends: async () => ({ friends: [], pending_requests: [], sent_requests: [{ id: 'request', name: 'A very long buddy name that must not push out the status', username: 'very_long_handle' }] }),
        getSuggested: async () => ({ suggested: [] }), getLeaderboard: async () => ({ success: true, leaderboard: [] }),
        cancelRequest: jest.fn(),
    },
    settingsAPI: { getSharingPreference: async () => ({ friends_intro_seen: true }) },
}));
beforeEach(() => {
    jest.clearAllMocks();
    (friendsAPI.cancelRequest as jest.Mock).mockResolvedValue({});
});
it('contains the pending label in its own pill and reserves shrinkable space for a long buddy name', async () => {
    let screen: any;
    await act(async () => { screen = create(<GymBuddiesScreen />); });
    try {
        const pending = screen.root.findAllByType(Text).find((n: any) => n.props.children === 'PENDING');
        // Border belongs to a View, not Text (Android font padding clips text pills).
        expect([View, 'View']).toContain(pending.parent.type);
        expect(StyleSheet.flatten(pending.parent.props.style)).toMatchObject({ flexShrink: 0, borderWidth: 1 });
        const card = screen.root.findAllByType(GlassCard).find((n: any) => n.findAllByType(Text).some((t: any) => t.props.children === 'PENDING'));
        expect(StyleSheet.flatten(card.props.style).padding).toBeGreaterThan(0);
        const name = card.findAllByType(Text).find((n: any) => n.props.children.startsWith?.('A very long'));
        expect(name.props.numberOfLines).toBe(1);
        expect(StyleSheet.flatten(name.parent.props.style).minWidth).toBe(0);
    } finally { await act(async () => screen.unmount()); }
});

it('keeps the request visible and disables cancellation until the server confirms, then removes it', async () => {
    let finish!: (value: unknown) => void;
    (friendsAPI.cancelRequest as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    let screen: any;
    await act(async () => { screen = create(<GymBuddiesScreen />); });
    const cancel = () => screen.root.findAllByProps({ accessibilityRole: 'button' }).find((node: any) => node.props.accessibilityLabel?.startsWith('Cancel request to'));
    try {
        await act(async () => { void cancel().props.onPress(); });
        expect(friendsAPI.cancelRequest).toHaveBeenCalledWith('request');
        expect(cancel().props.disabled).toBe(true);
        expect(cancel().props.accessibilityState.busy).toBe(true);
        expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === 'PENDING')).toBe(true);
        await act(async () => finish({}));
        expect(cancel()).toBeUndefined();
        expect(mockSuccess).toHaveBeenCalledWith('Request cancelled', expect.any(String));
    } finally { await act(async () => screen.unmount()); }
});

it('keeps a failed cancellation available to retry and shows the error', async () => {
    (friendsAPI.cancelRequest as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    let screen: any;
    await act(async () => { screen = create(<GymBuddiesScreen />); });
    const cancel = () => screen.root.findAllByProps({ accessibilityRole: 'button' }).find((node: any) => node.props.accessibilityLabel?.startsWith('Cancel request to'));
    try {
        await act(async () => cancel().props.onPress());
        expect(cancel().props.disabled).toBe(false);
        expect(mockError).toHaveBeenCalledWith('Could not cancel request', 'offline');
        expect(mockSuccess).not.toHaveBeenCalled();
    } finally { await act(async () => screen.unmount()); }
});
