import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import UserProfileScreen from '../UserProfileScreen';
import { friendsAPI } from '../../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: {}, useLocalSearchParams: () => ({ userId: 'buddy', userName: 'Alex' }) }));
jest.mock('../../../services/api', () => ({
    friendsAPI: { getFriendshipStatus: jest.fn(), cancelRequest: jest.fn(), sendRequest: jest.fn() },
    buddyActivityAPI: { getActivity: async () => null },
}));
let screen: any;
const cancel = () => screen.root.findAllByProps({ accessibilityLabel: 'Cancel request to Alex' }).find((node: any) => typeof node.props.onPress === 'function');
beforeEach(() => {
    jest.clearAllMocks();
    (friendsAPI.getFriendshipStatus as jest.Mock).mockResolvedValue({ status: 'pending_sent' });
    (friendsAPI.cancelRequest as jest.Mock).mockResolvedValue({});
    (friendsAPI.sendRequest as jest.Mock).mockResolvedValue({ status: 'pending' });
});
afterEach(async () => { await act(async () => screen?.unmount()); jest.restoreAllMocks(); });

it('cancels an outgoing request from the profile and allows sending it again', async () => {
    await act(async () => { screen = create(<UserProfileScreen />); });
    await act(async () => cancel().props.onPress());
    expect(friendsAPI.cancelRequest).toHaveBeenCalledWith('buddy');
    expect(cancel()).toBeUndefined();
    const add = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.findAllByType(Text).some((text: any) => text.props.children === 'Add Friend'));
    await act(async () => add.props.onPress());
    expect(friendsAPI.sendRequest).toHaveBeenCalledWith('buddy');
    expect(cancel()).toBeDefined();
});

it('keeps the outgoing request after a failed cancellation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (friendsAPI.cancelRequest as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await act(async () => { screen = create(<UserProfileScreen />); });
    await act(async () => cancel().props.onPress());
    expect(cancel().props.disabled).toBe(false);
    expect(alert).toHaveBeenCalledWith('Could not cancel request', 'offline');
});
