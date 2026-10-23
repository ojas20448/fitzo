import React from 'react';
import RestTimerPill from '../RestTimerPill';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
test('exposes labelled add and skip buttons and preserves the parent-controlled timer', async () => {
    const add = jest.fn(), skip = jest.fn(); let screen: any;
    await act(async () => { screen = create(<RestTimerPill seconds={90} onAddSeconds={add} onDismiss={skip} />); });
    const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => typeof n.props.onPress === 'function');
    try {
        expect(button('Add 30 seconds of rest').props.accessibilityRole).toBe('button');
        await act(async () => button('Add 30 seconds of rest').props.onPress()); expect(add).toHaveBeenCalledWith(30);
        await act(async () => button('Skip rest').props.onPress()); expect(skip).toHaveBeenCalledTimes(1);
    } finally { await act(async () => screen.unmount()); }
});
