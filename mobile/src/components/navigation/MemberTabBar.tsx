import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import { router, usePathname } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useActiveWorkoutSummary } from '../../hooks/useActiveWorkoutSummary';
import { useGlassPreferences } from '../../hooks/useGlassPreferences';
import { MEMBER_TABS } from '../../navigation/memberTabs';
import { borderRadius, colors, shadow, spacing, typography } from '../../styles/theme';
import * as Haptics from '../../utils/haptics';
import { GlassSurface } from './GlassSurface';
import { useMemberChromeMeasurements } from './MemberChromeContext';

function TabIcon({ name, color, pressed, reduceMotion }: { name: React.ComponentProps<typeof Ionicons>['name']; color: string; pressed: boolean; reduceMotion: boolean }) {
    const scale = useSharedValue(1);
    useEffect(() => {
        scale.value = reduceMotion ? 1 : withSpring(pressed ? 1.14 : 1, { damping: 17, stiffness: 320, mass: 0.55 });
    }, [pressed, reduceMotion, scale]);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return <Animated.View style={animatedStyle}><Ionicons name={name} size={23} color={color} /></Animated.View>;
}

export function MemberTabBar({ state, navigation, insets }: BottomTabBarProps) {
    const { user } = useAuth();
    const pathname = usePathname();
    const { width, fontScale } = useWindowDimensions();
    const { reduceMotion, reduceTransparency } = useGlassPreferences();
    const active = useActiveWorkoutSummary(user?.id, pathname);
    const { compact, setCompact, setBarHeight, setBannerHeight } = useMemberChromeMeasurements();
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [barWidth, setBarWidth] = useState(0);
    const [pressedIndex, setPressedIndex] = useState<number | null>(null);
    const focusedName = state.routes[state.index]?.name;
    const selectedName = focusedName === 'stats' || focusedName === 'learn' ? 'profile' : focusedName === 'scan' ? 'index' : focusedName;
    const selectedIndex = MEMBER_TABS.findIndex(tab => tab.name === selectedName);
    const showResume = active.hasActiveWorkout && selectedName !== 'index';
    const barHeight = Math.max(64, 42 + 22 * fontScale);
    const position = useSharedValue(0);
    const stretch = useSharedValue(1);
    const pressure = useSharedValue(0);
    const collapse = useSharedValue(0);
    const previousIndex = useRef(selectedIndex);
    const column = Math.max(0, (barWidth - 10) / MEMBER_TABS.length);
    useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
        return () => { show.remove(); hide.remove(); };
    }, []);
    // Keep content padding stable so resizing near the list end cannot trigger more scrolls.
    useEffect(() => { setBarHeight(barHeight); }, [barHeight, setBarHeight]);
    useEffect(() => { if (!showResume) setBannerHeight(0); }, [showResume, setBannerHeight]);
    useEffect(() => { setCompact(false); }, [focusedName, setCompact]);
    useEffect(() => {
        collapse.value = reduceMotion ? Number(compact) : withTiming(Number(compact), { duration: 200 });
    }, [compact, reduceMotion, collapse]);
    useEffect(() => {
        const target = Math.max(0, reduceMotion ? selectedIndex : pressedIndex ?? selectedIndex) * column;
        const changed = previousIndex.current !== selectedIndex;
        previousIndex.current = selectedIndex;
        position.value = reduceMotion ? target : withSpring(target, { damping: 24, stiffness: 300, mass: 0.7, overshootClamping: true });
        stretch.value = reduceMotion || !changed ? 1 : withSequence(withTiming(1.06, { duration: 90 }), withSpring(1, { damping: 18, stiffness: 260 }));
        pressure.value = reduceMotion ? 0 : withSpring(pressedIndex === null ? 0 : 1, { damping: 18, stiffness: 320, mass: 0.55 });
    }, [column, selectedIndex, pressedIndex, reduceMotion, position, stretch, pressure]);
    const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value }, { scaleX: stretch.value * (1 + pressure.value * 0.06) }, { scaleY: 1 + pressure.value * 0.07 }] }));
    const capsuleStyle = useAnimatedStyle(() => ({ height: barHeight + (54 - barHeight) * collapse.value }));
    const labelStyle = useAnimatedStyle(() => ({ maxHeight: 32 * fontScale * (1 - collapse.value), marginTop: 3 * (1 - collapse.value), opacity: 1 - collapse.value, transform: [{ translateY: 4 * collapse.value }] }));
    if (keyboardVisible) return null;
    return <View pointerEvents="box-none" style={[styles.host, { bottom: Math.max(insets.bottom, 10), paddingHorizontal: width < 360 ? 12 : 16 }]}>
        <View style={styles.width} pointerEvents="box-none">
            {showResume && <Pressable accessibilityRole="button" accessibilityLabel="Resume workout" onPress={() => router.push('/log/workout')}
                onLayout={event => setBannerHeight(event.nativeEvent.layout.height)} style={styles.resume}>
                <Ionicons name="barbell-outline" size={22} color={colors.text.primary} />
                <View style={styles.resumeCopy}><Text style={styles.resumeTitle}>Resume workout</Text><Text numberOfLines={1} style={styles.resumeLabel}>{active.label}</Text></View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
            </Pressable>}
            <View style={styles.shadow}>
            <Animated.View accessibilityRole="tablist" testID="member-tabbar" onLayout={event => setBarWidth(event.nativeEvent.layout.width)} style={[styles.capsule, capsuleStyle]}>
                <GlassSurface reduceTransparency={reduceTransparency} />
                {barWidth > 0 && selectedIndex >= 0 && <Animated.View testID="member-tab-indicator" pointerEvents="none" style={[styles.lens, reduceTransparency && styles.solidLens, { width: Math.max(0, column - 2) }, lensStyle]}>
                    {!reduceTransparency && <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.025)', 'rgba(255,255,255,0.08)']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
                </Animated.View>}
                {MEMBER_TABS.map((tab, index) => {
                    const route = state.routes.find(candidate => candidate.name === tab.name);
                    if (!route) return null;
                    const selected = selectedName === tab.name;
                    return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={`${tab.title} tab`}
                        accessibilityState={{ selected }} aria-selected={selected} style={styles.tab}
                        onPressIn={() => setPressedIndex(index)} onPressOut={() => setPressedIndex(null)}
                        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                        onPress={() => {
                            setCompact(false);
                            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                            if (focusedName !== tab.name && !event.defaultPrevented) {
                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate(route.name, route.params);
                            }
                        }}>
                        <TabIcon name={tab.icon} pressed={pressedIndex === index} reduceMotion={reduceMotion} color={selected || pressedIndex === index ? colors.text.primary : colors.text.secondary} />
                        <Animated.View testID={`member-tab-label-${tab.name}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.labelClip, labelStyle]}>
                            <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.label, { color: selected ? colors.text.primary : colors.text.secondary }]}>{tab.title}</Text>
                        </Animated.View>
                    </Pressable>;
                })}
            </Animated.View>
            </View>
        </View>
    </View>;
}
const styles = StyleSheet.create({
    host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
    width: { width: '100%', maxWidth: 440 },
    shadow: { borderRadius: borderRadius.full, ...shadow({ y: 8, blur: 16, color: '#000000', opacity: 0.32 }) },
    capsule: { flexDirection: 'row', padding: 4, borderRadius: borderRadius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', borderTopColor: 'rgba(255,255,255,0.38)', borderBottomColor: 'rgba(255,255,255,0.13)', overflow: 'hidden' },
    lens: { position: 'absolute', left: 6, top: 5, bottom: 5, borderRadius: borderRadius.full, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', borderTopColor: 'rgba(255,255,255,0.38)' },
    solidLens: { backgroundColor: '#303030', borderColor: colors.glass.borderHover },
    tab: { flex: 1, minHeight: 44, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 3, paddingHorizontal: 2 },
    labelClip: { overflow: 'hidden' },
    label: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.xs, textAlign: 'center' },
    resume: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginBottom: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.glass.border },
    resumeCopy: { flex: 1, minWidth: 0 },
    resumeTitle: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.sm, color: colors.text.primary },
    resumeLabel: { fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.xs, color: colors.text.secondary },
});
