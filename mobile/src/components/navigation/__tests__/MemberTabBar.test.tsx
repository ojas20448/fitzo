import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { MemberTabBar } from '../MemberTabBar';
import { MemberChromeProvider, useMemberChromeMeasurements } from '../MemberChromeContext';
import { useMemberTabScroll } from '../../../hooks/useMemberTabScroll';
import { MEMBER_TABS } from '../../../navigation/memberTabs';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-reanimated', () => ({
    ...jest.requireActual('react-native-reanimated/mock'),
    useSharedValue: (value: unknown) => jest.requireActual('react').useRef({ value }).current,
}));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockFocus: () => (() => void);
let mockBlur: () => void;
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => '/', useFocusEffect: (callback: any) => {
    jest.requireActual('react').useEffect(() => {
        mockFocus = callback;
        mockBlur = callback();
        return mockBlur;
    }, [callback]);
} }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'a' } }) }));
jest.mock('../../../hooks/useGlassPreferences', () => ({ useGlassPreferences: () => ({ reduceMotion: true, reduceTransparency: true }) }));
jest.mock('../../../hooks/useActiveWorkoutSummary', () => ({ useActiveWorkoutSummary: () => ({ hasActiveWorkout: false, label: null }) }));
let screen: any;
function ScrollProbe() {
    const onScroll = useMemberTabScroll();
    const { compact, inset } = useMemberChromeMeasurements();
    return <ScrollView testID="member-scroll" onScroll={onScroll}><Text testID="chrome-state">{`${compact}:${inset}`}</Text></ScrollView>;
}
const compact = () => screen.root.findByProps({ testID: 'chrome-state' }).props.children.startsWith('true:');
const scrollTo = async (y: number, contentHeight = 2000) => {
    await act(async () => screen.root.findByProps({ testID: 'member-scroll' }).props.onScroll({ nativeEvent: {
        contentOffset: { x: 0, y }, contentSize: { width: 390, height: contentHeight }, layoutMeasurement: { width: 390, height: 800 },
    } }));
};
const tabs = () => screen.root.findAll((node: any) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function');
afterEach(async () => { await act(async () => screen?.unmount()); });
async function mount(prevented = false, focused = 'index') {
    const navigation = { emit: jest.fn(() => ({ defaultPrevented: prevented })), navigate: jest.fn() };
    await act(async () => { screen = create(<MemberChromeProvider><ScrollProbe /><MemberTabBar {...{
        navigation, state: { index: focused === 'stats' ? 6 : 0, routes: [...MEMBER_TABS.map(tab => ({ key: tab.name, name: tab.name })), { key: 'learn', name: 'learn' }, { key: 'stats', name: 'stats' }] },
        insets: { bottom: 34, top: 0, left: 0, right: 0 }, descriptors: {},
    } as any} /></MemberChromeProvider>); });
    return navigation;
}
it('renders five labelled tabs and keeps compatibility routes hidden', async () => {
    await mount();
    expect(tabs().map((tab: any) => tab.props.accessibilityLabel)).toEqual(['Workout tab', 'Food tab', 'Gym tab', 'Friends tab', 'Profile tab']);
    expect(tabs()[0].props.accessibilityState.selected).toBe(true);
});
it('emits cancellable navigation events and does not reset a selected destination', async () => {
    const navigation = await mount();
    await act(async () => tabs()[0].props.onPress());
    expect(navigation.navigate).not.toHaveBeenCalled();
    await act(async () => tabs()[2].props.onPress());
    expect(navigation.emit).toHaveBeenLastCalledWith({ type: 'tabPress', target: 'gym', canPreventDefault: true });
    expect(navigation.navigate).toHaveBeenCalledWith('gym', undefined);
});
it('honours prevented presses and forwards long presses', async () => {
    const navigation = await mount(true);
    await act(async () => tabs()[1].props.onPress());
    expect(navigation.navigate).not.toHaveBeenCalled();
    await act(async () => tabs()[1].props.onLongPress());
    expect(navigation.emit).toHaveBeenLastCalledWith({ type: 'tabLongPress', target: 'food' });
});
it('previews a held tab without navigating and releases a cancelled press', async () => {
    const navigation = await mount();
    await act(async () => tabs()[1].props.onPressIn());
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(tabs()[0].props.accessibilityState.selected).toBe(true);
    await act(async () => tabs()[1].props.onPressOut());
    expect(navigation.navigate).not.toHaveBeenCalled();
    await act(async () => tabs()[1].props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('food', undefined);
});
it('keeps Profile selected while viewing Progress and lets its tab return to Profile', async () => {
    const navigation = await mount(false, 'stats');
    expect(tabs()[4].props.accessibilityState.selected).toBe(true);
    await act(async () => tabs()[4].props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('profile', undefined);
});

it('minimizes on downward scroll and restores after a deliberate upward scroll', async () => {
    await mount();
    await scrollTo(35);
    expect(compact()).toBe(false);
    await scrollTo(65);
    expect(compact()).toBe(true);
    await scrollTo(61);
    expect(compact()).toBe(true);
    await scrollTo(47);
    expect(compact()).toBe(false);
});

it('hides labels, retains accessible tabs and restores them on a tab press', async () => {
    const navigation = await mount();
    const inset = screen.root.findByProps({ testID: 'chrome-state' }).props.children.split(':')[1];
    await scrollTo(100);
    // The Reanimated mock reads shared values on render; layout supplies that render.
    await act(async () => screen.root.findByProps({ testID: 'member-tabbar' }).props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
    expect(StyleSheet.flatten(screen.root.findByProps({ testID: 'member-tabbar' }).props.style).height).toBe(54);
    expect(StyleSheet.flatten(screen.root.findByProps({ testID: 'member-tab-label-food' }).props.style)).toMatchObject({ opacity: 0, maxHeight: 0 });
    expect(tabs()).toHaveLength(5);
    expect(tabs().every((tab: any) => StyleSheet.flatten(tab.props.style).minHeight >= 44)).toBe(true);
    expect(screen.root.findByProps({ testID: 'chrome-state' }).props.children.split(':')[1]).toBe(inset);
    await act(async () => tabs()[1].props.onPress());
    expect(compact()).toBe(false);
    expect(navigation.navigate).toHaveBeenCalledWith('food', undefined);
    await act(async () => screen.root.findByProps({ testID: 'member-tabbar' }).props.onLayout({ nativeEvent: { layout: { width: 321 } } }));
    expect(StyleSheet.flatten(screen.root.findByProps({ testID: 'member-tab-label-food' }).props.style).opacity).toBe(1);
});

it('ignores edge bounce and leaves short pages expanded', async () => {
    await mount();
    await scrollTo(-30);
    await scrollTo(15);
    expect(compact()).toBe(false);
    await scrollTo(1200);
    expect(compact()).toBe(true);
    await scrollTo(1260);
    await scrollTo(1200);
    expect(compact()).toBe(true);
    await scrollTo(0);
    expect(compact()).toBe(false);
    await scrollTo(70, 400);
    expect(compact()).toBe(false);
});

it('ignores inactive screen scrolls and expands when the screen regains focus', async () => {
    await mount();
    await scrollTo(100);
    expect(compact()).toBe(true);
    await act(async () => mockBlur());
    await scrollTo(0);
    expect(compact()).toBe(true);
    await act(async () => { mockFocus(); });
    expect(compact()).toBe(false);
    await scrollTo(105);
    expect(compact()).toBe(false);
    await scrollTo(130);
    expect(compact()).toBe(true);
});
