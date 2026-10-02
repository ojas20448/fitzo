import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import GymBuddiesScreen from '../GymBuddiesScreen';
import GlassCard from '../../../components/GlassCard';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => true }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (callback: any) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../../../components/Toast', () => ({ useToast: () => ({ error: jest.fn(), success: jest.fn() }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../../../services/api', () => ({
    friendsAPI: {
        getFriends: async () => ({ friends: [], pending_requests: [], sent_requests: [{ id: 'request', name: 'A very long buddy name that must not push out the status', username: 'very_long_handle' }] }),
        getSuggested: async () => ({ suggested: [] }), getLeaderboard: async () => ({ success: true, leaderboard: [] }),
    },
    settingsAPI: { getSharingPreference: async () => ({ friends_intro_seen: true }) },
}));
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
