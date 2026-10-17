import React from 'react';
import { Text } from 'react-native';
import HealthReportScreen from '../HealthReportScreen';
import { healthAPI } from '../../../services/api';
import { requestPermissions } from '../../../services/healthService';
import { enableHealthImport } from '../../../utils/healthImportPreference';
import { isHealthImportEnabled } from '../../../utils/healthImportPreference';
import { syncHealthDays } from '../../../services/healthSync';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('react-native-view-shot', () => {
    const React = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');
    return { __esModule: true, default: React.forwardRef((props: any, ref: any) => React.createElement(View, { ...props, ref, testID: 'report-capture' })) };
});
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'a' } }) }));
jest.mock('../../../hooks/useShareCapture', () => ({ useShareCapture: () => ({ captureAndShare: jest.fn(), isSharing: false }) }));
jest.mock('../../../services/healthService', () => ({ isHealthAvailable: () => true, requestPermissions: jest.fn(async () => false) }));
jest.mock('../../../utils/healthImportPreference', () => ({ isHealthImportEnabled: jest.fn(async () => false), enableHealthImport: jest.fn() }));
jest.mock('../../../services/healthSync', () => ({ syncHealthDays: jest.fn() }));
jest.mock('../../../services/api', () => ({
    healthAPI: { getToday: jest.fn(async () => ({ health: { steps: 0, active_calories: null, resting_heart_rate: null, sleep_hours: 7 } })), getHistory: jest.fn(async () => ({ daily: [] })) },
    progressAPI: { getPRs: async () => ({ prs: [] }) }, nutritionAPI: { getProfile: async () => ({ profile: null }) }, measurementsAPI: { getLatest: async () => ({ measurement: null }) },
}));
let screen: any;
const texts = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ').replace(/\s+/g, ' ');
afterEach(async () => { await act(async () => screen?.unmount()); jest.clearAllMocks(); (isHealthImportEnabled as jest.Mock).mockResolvedValue(false); });
it('shows coverage for partial readings and keeps connection controls out of the exported report', async () => {
    await act(async () => { screen = create(<HealthReportScreen />); });
    expect(texts()).toContain('2 of 4 readings available today');
    expect(texts()).not.toContain('Excellent');
    expect(texts()).not.toContain('50-70');
    const capture = screen.root.findByProps({ testID: 'report-capture' });
    expect(capture.findAllByType(Text).map((node: any) => node.props.children)).not.toContain('Continue');
    expect(capture.findAllByType(Text).map((node: any) => node.props.children).flat()).toContain('—');
    expect(capture.findAllByType(Text).map((node: any) => node.props.children).flat()).toContain('0');
});
it('leaves optional imports off after an incomplete native request without redirecting to device settings', async () => {
    await act(async () => { screen = create(<HealthReportScreen />); });
    const connect = screen.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.findAllByType(Text).some((text: any) => text.props.children === 'Continue'))[0];
    await act(async () => connect.props.onPress());
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(enableHealthImport).not.toHaveBeenCalled();
    expect(texts()).toContain('connection was not completed');
    expect(texts()).not.toContain('Open Settings');
});
it('does not export a report when saved data could not load', async () => {
    (healthAPI.getToday as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await act(async () => { screen = create(<HealthReportScreen />); });
    expect(texts()).toContain('load your report');
    expect(screen.root.findAllByProps({ accessibilityLabel: 'Share health report' })).toHaveLength(0);
});

it.each([
    [{ checked: 2, imported: 0, total: 2 }, 'No readable'],
    [{ checked: 2, imported: 0, total: 2, unreadableDays: 2 }, 'could not be read'],
    [{ checked: 2, imported: 2, total: 2 }, 'Updated 2 days'],
])('reports the result of a manual sync instead of silently finishing (%j)', async (result, message) => {
    (isHealthImportEnabled as jest.Mock).mockResolvedValue(true);
    (syncHealthDays as jest.Mock).mockResolvedValue(result);
    await act(async () => { screen = create(<HealthReportScreen />); });
    const sync = screen.root.findAll((node: any) => typeof node.props.onPress === 'function'
        && node.findAllByType(Text).some((text: any) => text.props.children === 'Sync now'))[0];
    await act(async () => sync.props.onPress());
    expect(texts()).toContain(message);
});
