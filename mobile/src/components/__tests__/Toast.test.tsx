import React from 'react';
import { Animated, PanResponder, Text } from 'react-native';
import { ToastProvider, useToast } from '../Toast';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));

let screen: any;
let api: ReturnType<typeof useToast>;
let gesture: any;
function Controls() { api = useToast(); return <Text>Food log</Text>; }
const messages = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');

beforeEach(async () => {
    jest.useFakeTimers();
    jest.spyOn(PanResponder, 'create').mockImplementation(config => { gesture = config; return { panHandlers: {} } as any; });
    for (const method of ['timing', 'spring'] as const) jest.spyOn(Animated, method).mockImplementation((value: any, config: any) => ({
        start: (done: any) => { value.setValue(config.toValue); done?.({ finished: true }); }, stop: jest.fn(), reset: jest.fn(),
    }) as any);
    await act(async () => { screen = create(<ToastProvider><Controls /></ToastProvider>); });
});
afterEach(async () => { await act(async () => screen.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });

test('shows one notification and deduplicates repeated errors without extending its lifetime', async () => {
    await act(async () => api.error('Could not log food', 'Try again.'));
    await act(async () => jest.advanceTimersByTime(2500));
    await act(async () => api.error('Could not log food', 'Try again.'));
    expect(messages().match(/Could not log food/g)).toHaveLength(1);
    await act(async () => jest.advanceTimersByTime(1500));
    expect(messages()).toBe('Food log');
});

test('replaces an older alert, even when notifications arrive in the same millisecond', async () => {
    await act(async () => { api.error('Old error'); api.success('Food saved'); });
    expect(messages()).toContain('Food saved'); expect(messages()).not.toContain('Old error');
    await act(async () => button('Dismiss notification').props.onPress());
    expect(messages()).toBe('Food log');
});

test.each([{ dx: -100, dy: 0, vx: 0, vy: 0 }, { dx: 100, dy: 0, vx: 0, vy: 0 }, { dx: 0, dy: -55, vx: 0, vy: 0 }, { dx: 20, dy: 0, vx: 1, vy: 0 }])('dismisses a directional swipe %j', async state => {
    await act(async () => api.error('Could not save'));
    expect(gesture.onMoveShouldSetPanResponder({}, state)).toBe(true);
    await act(async () => { gesture.onPanResponderGrant(); gesture.onPanResponderMove({}, state); gesture.onPanResponderRelease({}, state); });
    expect(messages()).toBe('Food log');
});

test('pauses expiry during a drag and returns a short drag to its resting position', async () => {
    await act(async () => api.error('Could not save'));
    const state = { dx: 15, dy: 0, vx: 0, vy: 0 };
    await act(async () => { gesture.onPanResponderGrant(); gesture.onPanResponderMove({}, state); jest.advanceTimersByTime(10000); });
    expect(messages()).toContain('Could not save');
    await act(async () => gesture.onPanResponderRelease({}, state));
    expect(messages()).toContain('Could not save');
    await act(async () => jest.advanceTimersByTime(4000));
    expect(messages()).toBe('Food log');
});

test('uses one icon action instead of a text row and close button, retaining accessibility dismissal', async () => {
    const action = jest.fn();
    await act(async () => api.showToast({ type: 'success', title: 'Entry saved', action: { label: 'View diary', onPress: action } }));
    expect(button('Dismiss notification')).toBeUndefined();
    expect(button('View diary').props.accessibilityRole).toBe('button');
    expect(messages()).not.toContain('View diary');
    await act(async () => button('View diary').props.onPress());
    expect(action).toHaveBeenCalledTimes(1); expect(messages()).toBe('Food log');
    await act(async () => api.error('Error'));
    const alert = screen.root.findAllByProps({ accessibilityRole: 'alert' }).find((node: any) => node.props.onAccessibilityAction);
    await act(async () => alert.props.onAccessibilityAction({ nativeEvent: { actionName: 'dismiss' } }));
    expect(messages()).toBe('Food log');
});

test('swiping an actionable notification dismisses it without opening the diary', async () => {
    const action = jest.fn();
    await act(async () => api.showToast({ type: 'success', title: 'Food saved', action: { label: 'View diary', onPress: action } }));
    await act(async () => { gesture.onPanResponderGrant(); gesture.onPanResponderRelease({}, { dx: 80, dy: 0, vx: 0, vy: 0 }); });
    expect(messages()).toBe('Food log');
    expect(action).not.toHaveBeenCalled();
});
