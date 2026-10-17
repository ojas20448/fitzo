import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import FoodScannerScreen from '../FoodScannerScreen';
import Button from '../../../components/Button';
import { foodPhotoAPI } from '../../../services/api';

const { create, act } = jest.requireActual('react-test-renderer');
const mockSave = jest.fn(async () => ({ base64: 'prepared-jpeg' }));
const mockRender = jest.fn(async () => ({ saveAsync: mockSave }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('../../../utils/haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-camera', () => {
    const React = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');
    return {
        useCameraPermissions: () => [{ granted: true }, jest.fn()],
        CameraView: React.forwardRef(function CameraView(props: any, ref: any) {
            React.useImperativeHandle(ref, () => ({ takePictureAsync: async () => ({ uri: 'file:///meal.jpg' }) }));
            return React.createElement(View, { ...props, testID: 'camera-preview' });
        }),
    };
});
jest.mock('expo-image-manipulator', () => ({
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: { manipulate: () => ({ resize: () => ({ renderAsync: () => mockRender() }) }) },
}));
jest.mock('../../../services/api', () => ({ foodPhotoAPI: { analyzePhoto: jest.fn() } }));
jest.mock('../../../services/foodJobs', () => ({ foodJobsEnabled: false }));
jest.mock('../../../components/AIConsentModal', () => ({ __esModule: true, default: () => null, getAIConsent: async () => true }));

let screen: any;
let alert: jest.SpyInstance;
const analyze = () => screen.root.findAllByType(Button).find((n: any) => n.props.title === 'Analyze Photo');
const capture = () => screen.root.findAllByType(TouchableOpacity).at(-1).props.onPress();
beforeEach(async () => {
    mockSave.mockReset().mockResolvedValue({ base64: 'prepared-jpeg' });
    mockRender.mockReset().mockResolvedValue({ saveAsync: mockSave });
    (foodPhotoAPI.analyzePhoto as jest.Mock).mockReset().mockResolvedValue({
        success: true, items: [{ name: 'Banana' }], total: { calories: 100, protein_g: 1, carbs_g: 25, fat_g: 0 },
    });
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await act(async () => { screen = create(<FoodScannerScreen />); });
});
afterEach(async () => { await act(async () => screen?.unmount()); alert.mockRestore(); });

it('waits for image preparation before offering analysis', async () => {
    let finish!: (image: { saveAsync: typeof mockSave }) => void;
    mockRender.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending!: Promise<void>;
    await act(async () => { pending = capture(); });
    expect(analyze()).toBeUndefined();
    await act(async () => { finish({ saveAsync: mockSave }); await pending; });
    expect(analyze()).toBeTruthy();
});

it('returns to a usable camera when image preparation fails', async () => {
    mockRender.mockRejectedValueOnce(new Error('Native image processing failed'));
    await act(async () => { await capture(); });
    expect(analyze()).toBeUndefined();
    await act(async () => { await capture(); });
    expect(analyze()).toBeTruthy();
});

it('sends the prepared image and shows the multi-item API result', async () => {
    await act(async () => { await capture(); });
    await act(async () => { await analyze().props.onPress(); });
    expect(foodPhotoAPI.analyzePhoto).toHaveBeenCalledWith('prepared-jpeg');
    expect(screen.root.findAllByType(Button).some((n: any) => n.props.title === 'Log Food')).toBe(true);
    expect(alert).not.toHaveBeenCalled();
});

it('preserves the prepared image so analysis can be retried after an API error', async () => {
    (foodPhotoAPI.analyzePhoto as jest.Mock).mockRejectedValueOnce({ status: 429, message: 'Try again in a minute.' });
    await act(async () => { await capture(); });
    await act(async () => { await analyze().props.onPress(); });
    expect(alert).toHaveBeenCalledWith('Error', 'Try again in a minute.');
    await act(async () => { await analyze().props.onPress(); });
    expect(screen.root.findAllByType(Button).some((n: any) => n.props.title === 'Log Food')).toBe(true);
});
