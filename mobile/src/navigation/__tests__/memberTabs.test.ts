import { MEMBER_TABS, getMemberChromeInset } from '../memberTabs';
import { resolveGlassMode } from '../glassPolicy';

it('keeps five stable destinations with consistent outline icons', () => {
    expect(MEMBER_TABS.map(tab => tab.title)).toEqual(['Workout', 'Food', 'Gym', 'Friends', 'Profile']);
    expect(MEMBER_TABS.map(tab => tab.icon)).toEqual(['barbell-outline', 'restaurant-outline', 'business-outline', 'people-outline', 'person-outline']);
});

it('reserves the safe area once, including an active workout banner', () => {
    expect(getMemberChromeInset({ barHeight: 64, bottomInset: 34, bannerHeight: 0 })).toBe(114);
    expect(getMemberChromeInset({ barHeight: 64, bottomInset: 34, bannerHeight: 48 })).toBe(170);
    expect(getMemberChromeInset({ barHeight: 64, bottomInset: 0, bannerHeight: 0 })).toBe(90);
});

it('uses native glass only when available and honours reduced transparency', () => {
    expect(resolveGlassMode({ platform: 'ios', nativeAvailable: true, reduceTransparency: false })).toBe('native');
    expect(resolveGlassMode({ platform: 'ios', nativeAvailable: false, reduceTransparency: false })).toBe('blur');
    expect(resolveGlassMode({ platform: 'ios', nativeAvailable: true, reduceTransparency: true })).toBe('opaque');
    expect(resolveGlassMode({ platform: 'android', nativeAvailable: false, reduceTransparency: false })).toBe('opaque');
});
