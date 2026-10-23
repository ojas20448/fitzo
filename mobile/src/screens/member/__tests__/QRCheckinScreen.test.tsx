import React from 'react';
import { Alert, Linking, Text } from 'react-native';
import { CameraView } from 'expo-camera';
import { router } from 'expo-router';
import QRCheckinScreen from '../QRCheckinScreen';
import { checkinAPI, settingsAPI } from '../../../services/api';

const { create, act } = jest.requireActual('react-test-renderer');
let mockMode: string | undefined = 'join';
let mockAccount = 'member';
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
const mockRefreshUser = jest.fn(async () => {});
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => ({ mode: mockMode }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount }, refreshUser: mockRefreshUser }) }));
jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [mockPermission, mockRequestPermission] }));
jest.mock('../../../services/api', () => ({ checkinAPI: { checkin: jest.fn() }, settingsAPI: { joinGymWithQR: jest.fn() } }));
jest.mock('../../../components/Button', () => ({ __esModule: true, default: (props: any) => jest.requireActual('react').createElement('Button', props) }));
jest.mock('../../../utils/haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Medium: 'medium' }, NotificationFeedbackType: { Success: 'success', Error: 'error' } }));
jest.mock('react-native-reanimated', () => ({
    __esModule: true, default: { View: jest.requireActual('react-native').View },
    useSharedValue: (value: any) => jest.requireActual('react').useRef({ value }).current,
    useAnimatedStyle: (callback: any) => callback(), withRepeat: (value: any) => value,
    withTiming: (value: any) => value, Easing: { linear: jest.fn() },
}));

let screen: any;
const qr = JSON.stringify({ gym_id: '11111111-1111-1111-1111-111111111111' });
const copy = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const scan = () => screen.root.findByType(CameraView).props.onBarcodeScanned;
const press = async (title: string) => { await act(async () => screen.root.findByProps({ title }).props.onPress()); };
beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); mockMode = 'join'; mockAccount = 'member';
    mockPermission = { granted: true, canAskAgain: true };
    (settingsAPI.joinGymWithQR as jest.Mock).mockReset().mockResolvedValue({ gym: { name: 'My Club' } });
    (checkinAPI.checkin as jest.Mock).mockReset().mockResolvedValue({ streak: 3 });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
    await act(async () => screen?.unmount()); screen = null;
    jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});

it('joins from a gym QR, refreshes membership and returns without checking in', async () => {
    await act(async () => { screen = create(<QRCheckinScreen />); });
    expect(copy()).toContain('JOIN GYM');
    await act(async () => scan()({ type: 'qr', data: qr }));
    expect(settingsAPI.joinGymWithQR).toHaveBeenCalledWith(qr);
    expect(checkinAPI.checkin).not.toHaveBeenCalled();
    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    expect(copy()).toContain('Gym joined'); expect(copy()).not.toContain('STREAK');
    await act(async () => jest.advanceTimersByTime(2500));
    expect(router.back).toHaveBeenCalledTimes(1);
});

it('locks duplicate scan callbacks before the first request completes', async () => {
    let finish!: (value: unknown) => void;
    (settingsAPI.joinGymWithQR as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => { screen = create(<QRCheckinScreen />); });
    const onScan = scan();
    await act(async () => { void onScan({ type: 'qr', data: qr }); void onScan({ type: 'qr', data: qr }); });
    expect(settingsAPI.joinGymWithQR).toHaveBeenCalledTimes(1);
    await act(async () => finish({}));
});

it('keeps failures retryable and offers manual code entry', async () => {
    (settingsAPI.joinGymWithQR as jest.Mock).mockRejectedValueOnce(new Error('That QR code does not match a gym'));
    await act(async () => { screen = create(<QRCheckinScreen />); });
    await act(async () => scan()({ type: 'qr', data: qr }));
    expect(copy()).toContain('That QR code does not match a gym');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(screen.root.findByProps({ title: 'Enter code instead' })).toBeTruthy();
    await press('Try again');
    await act(async () => scan()({ type: 'qr', data: qr }));
    expect(settingsAPI.joinGymWithQR).toHaveBeenCalledTimes(2);
    expect(copy()).toContain('Gym joined');
});

it('does not navigate for a previous account after joining succeeds', async () => {
    await act(async () => { screen = create(<QRCheckinScreen />); });
    await act(async () => scan()({ type: 'qr', data: qr }));
    mockAccount = 'other';
    await act(async () => screen.update(<QRCheckinScreen />));
    await act(async () => jest.advanceTimersByTime(2500));
    expect(router.back).not.toHaveBeenCalled();
});

it('preserves the existing QR check-in flow', async () => {
    mockMode = undefined;
    await act(async () => { screen = create(<QRCheckinScreen />); });
    await act(async () => scan()({ type: 'qr', data: qr }));
    expect(checkinAPI.checkin).toHaveBeenCalledWith(JSON.parse(qr).gym_id);
    expect(settingsAPI.joinGymWithQR).not.toHaveBeenCalled();
    expect(copy()).toContain('Checked In'); expect(copy()).toContain('STREAK');
});

it('requests permission on demand and lets the user return to typing a code', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    await act(async () => { screen = create(<QRCheckinScreen />); });
    expect(screen.root.findAllByType(CameraView)).toHaveLength(0);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    await press('Continue'); expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    await press('Enter code instead'); expect(router.back).toHaveBeenCalledTimes(1);
});

it('offers settings when camera permission is permanently denied', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await act(async () => { screen = create(<QRCheckinScreen />); });
    await press('Open settings'); expect(openSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
});

it('recovers from a camera startup failure and keeps manual entry available', async () => {
    await act(async () => { screen = create(<QRCheckinScreen />); });
    await act(async () => screen.root.findByType(CameraView).props.onMountError());
    expect(copy()).toContain('Camera unavailable');
    await press('Try again'); expect(screen.root.findByType(CameraView)).toBeTruthy();
    await press('Enter code instead'); expect(router.back).toHaveBeenCalledTimes(1);
});

it('ignores a join response after the scanner is closed', async () => {
    let finish!: (value: unknown) => void;
    (settingsAPI.joinGymWithQR as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => { screen = create(<QRCheckinScreen />); });
    await act(async () => { void scan()({ type: 'qr', data: qr }); });
    await act(async () => screen.unmount()); screen = null;
    await act(async () => finish({}));
    expect(mockRefreshUser).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(2500)); expect(router.back).not.toHaveBeenCalled();
});
