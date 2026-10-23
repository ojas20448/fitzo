import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import ShareComposerScreen from '../ShareComposerScreen';
import { useShareComposerStore } from '../../../stores/shareComposerStore';
import { THEMES, THEME_ORDER } from '../../../components/share/themes';

const { create, act } = jest.requireActual('react-test-renderer');
let mockShareWait: Promise<void> | null = null;
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('../../../utils/haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), ImpactFeedbackStyle: { Medium: 'medium' } }));
jest.mock('../../../hooks/useShareCapture', () => ({ useShareCapture: () => ({ captureAndShare: () => mockShareWait ?? Promise.resolve(), isSharing: false, shareError: null }) }));
jest.mock('expo-camera', () => {
    const React = jest.requireActual('react');
    return {
        useCameraPermissions: () => [{ granted: true }, jest.fn()],
        CameraView: React.forwardRef(function CameraView(_props: any, ref: any) {
            React.useImperativeHandle(ref, () => ({ takePictureAsync: async () => ({ uri: 'file:///gym.jpg' }) }));
            return null;
        }),
    };
});
jest.mock('react-native-reanimated', () => {
    const React = jest.requireActual('react');
    const { View, Image } = jest.requireActual('react-native');
    return { __esModule: true, default: { View, Image },
        useSharedValue: (value: any) => React.useRef({ value }).current,
        useAnimatedStyle: (callback: any) => callback(), runOnJS: (callback: any) => callback };
});
jest.mock('react-native-gesture-handler', () => {
    const make = (kind: string) => {
        const gesture: any = { kind, handlers: {} };
        for (const name of ['averageTouches', 'enabled', 'onStart', 'onBegin', 'onUpdate', 'onFinalize']) {
            gesture[name] = (callback: any) => { gesture.handlers[name] = callback; return gesture; };
        }
        return gesture;
    };
    return { GestureDetector: ({ children }: any) => children, Gesture: {
        Pan: () => make('pan'), Pinch: () => make('pinch'), Rotation: () => make('rotation'),
        Simultaneous: (...gestures: any[]) => ({ gestures }),
    } };
});

let screen: any;
const press = async (label: string) => {
    const button = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === label);
    expect(button).toBeTruthy();
    await act(async () => button.props.onPress());
};
const photo = () => screen.root.findAllByType(Image).filter((node: any) => node.props.source?.uri === 'file:///gym.jpg');
const layers = () => screen.root.findAllByType(View).filter((node: any) => node.props.testID === 'workout-card-layer');
const transform = (node: any) => StyleSheet.flatten(node.props.style).transform;
const gesture = async (kind: string, event: any) => {
    const handler = screen.root.findByType(GestureDetector).props.gesture.gestures.find((item: any) => item.kind === kind);
    await act(async () => { handler.handlers.onStart?.({}); handler.handlers.onUpdate(event); handler.handlers.onFinalize(); });
};
beforeEach(async () => {
    mockShareWait = null;
    useShareComposerStore.getState().setSource({ kind: 'static', payload: {
        headline: '4,000 KG', subtitle: 'Push day', rows: [{ label: 'Sets', value: '10' }], prs: [], exercises: [], date: new Date(2026, 9, 15),
    } });
    await act(async () => { screen = create(<ShareComposerScreen />); });
    const preview = screen.root.findAll((node: any) => typeof node.props.onLayout === 'function' && StyleSheet.flatten(node.props.style)?.minHeight === 0)[0];
    await act(async () => preview.props.onLayout({ nativeEvent: { layout: { width: 360, height: 640 } } }));
    await press('Add background photo');
    await press('Take photo');
});
afterEach(async () => { await act(async () => screen?.unmount()); useShareComposerStore.getState().clearSource(); });

test('pinches the workout card while keeping the camera photo fixed in preview and export', async () => {
    await gesture('pinch', { scale: 0.8 });
    expect(photo()).toHaveLength(2);
    for (const image of photo()) expect(transform(image)).toEqual([
        { translateX: 0 }, { translateY: 0 }, { scale: 1 }, { rotate: '0deg' },
    ]);
    expect(layers()).toHaveLength(2);
    for (const layer of layers()) expect(transform(layer).find((item: any) => item.scale)?.scale).toBeCloseTo(0.56);
});

test('drags and rotates the card without moving the photo and resets its placement', async () => {
    await gesture('pan', { translationX: 18, translationY: 16 });
    await gesture('rotation', { rotation: 0.1 });
    for (const image of photo()) expect(transform(image)).toContainEqual({ translateX: 0 });
    for (const layer of layers()) expect(transform(layer)).toContainEqual({ translateX: 54 });
    await press('Reset workout card placement');
    for (const layer of layers()) {
        expect(transform(layer)).toContainEqual({ scale: 0.7 });
        expect(transform(layer)).toContainEqual({ translateX: 0 });
        expect(transform(layer)).toContainEqual({ rotate: '0deg' });
    }
});

test.each(THEME_ORDER.filter(id => THEMES[id].supportsBackground))('keeps the photo fixed and the card resizable in %s', async id => {
    const button = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityRole === 'radio' && node.findAll((child: any) => child.props.children === THEMES[id].label).length);
    await act(async () => button.props.onPress());
    await press('Make workout card smaller');
    expect(photo()).toHaveLength(2);
    for (const layer of layers()) expect(transform(layer)).toContainEqual({ scale: 0.6 });
});

test('retaking the photo preserves the card placement; removing it restores the full card', async () => {
    await press('Make workout card smaller');
    await press('Retake background photo');
    await press('Take photo');
    for (const layer of layers()) expect(transform(layer)).toContainEqual({ scale: 0.6 });
    await press('Remove background photo');
    expect(photo()).toHaveLength(0);
    expect(screen.root.findAllByType(GestureDetector)).toHaveLength(0);
});

test('exports the latest gesture placement even before finalize and freezes it while sharing', async () => {
    await act(async () => { for (const image of screen.root.findAllByType(Image)) image.props.onLoad?.(); });
    const pinch = screen.root.findByType(GestureDetector).props.gesture.gestures.find((item: any) => item.kind === 'pinch');
    await act(async () => { pinch.handlers.onStart({}); pinch.handlers.onUpdate({ scale: 0.8 }); });
    let finish!: () => void;
    mockShareWait = new Promise(resolve => { finish = resolve; });
    let sharing: Promise<void>;
    const share = screen.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === 'Share card image');
    expect(share.props.disabled).toBe(false);
    await act(async () => { sharing = share.props.onPress(); });
    await act(async () => { pinch.handlers.onUpdate({ scale: 0.5 }); });
    for (const layer of layers()) expect(transform(layer).find((item: any) => item.scale)?.scale).toBeCloseTo(0.56);
    await act(async () => { finish(); await sharing; });
    for (const layer of layers()) expect(transform(layer).find((item: any) => item.scale)?.scale).toBeCloseTo(0.56);
});
