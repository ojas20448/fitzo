import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../styles/theme';

export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(!!state.isConnected);
        });
        return unsubscribe;
    }, []);

    return isOnline;
};

const BAR_HEIGHT = 28;

const OfflineBanner: React.FC = () => {
    const isOnline = useOnlineStatus();
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    // Latch the reconnect message so the bar can say "Back online" on its way
    // out instead of flipping to the offline copy mid-animation.
    const [reconnected, setReconnected] = useState(false);

    const total = BAR_HEIGHT + insets.top;
    const slide = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const firstRun = useRef(true);

    useEffect(() => {
        // Don't flash "back online" on a cold start that was never offline.
        if (firstRun.current) {
            firstRun.current = false;
            if (isOnline) return;
        }

        // Any state change cancels a pending hide — going offline again inside
        // the grace window must not collapse the bar we just re-opened.
        if (hideTimer.current) {
            clearTimeout(hideTimer.current);
            hideTimer.current = null;
        }

        if (!isOnline) {
            setReconnected(false);
            setVisible(true);
            Animated.timing(slide, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
            }).start();
            return;
        }

        setReconnected(true);
        hideTimer.current = setTimeout(() => {
            Animated.timing(slide, {
                toValue: 0,
                duration: 260,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setVisible(false);
            });
        }, 1600);
    }, [isOnline, slide]);

    useEffect(() => () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
    }, []);

    if (!visible) return null;

    return (
        <Animated.View
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            style={[
                styles.container,
                {
                    height: total,
                    paddingTop: insets.top,
                    backgroundColor: reconnected ? colors.success : colors.error,
                    transform: [
                        {
                            translateY: slide.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-total, 0],
                            }),
                        },
                    ],
                },
            ]}
        >
            <View style={styles.content}>
                <Text style={styles.text} numberOfLines={1}>
                    {reconnected ? 'Back online' : 'No internet connection'}
                </Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        elevation: 9999,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: colors.text.dark,
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});

export default OfflineBanner;
