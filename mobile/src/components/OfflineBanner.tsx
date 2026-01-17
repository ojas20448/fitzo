import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../styles/theme';

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

const OfflineBanner: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [visible, setVisible] = useState(false);
    const heightAnim = useState(new Animated.Value(0))[0];

    useEffect(() => {
        if (!isOnline) {
            setVisible(true);
            Animated.spring(heightAnim, {
                toValue: 40,
                useNativeDriver: false,
                friction: 8
            }).start();
        } else {
            // Wait a moment before hiding to prevent flickering
            setTimeout(() => {
                Animated.timing(heightAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: false,
                }).start(() => setVisible(false));
            }, 2000);
        }
    }, [isOnline]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, { height: heightAnim }]}>
            <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'center' }}>
                <View style={styles.content}>
                    <Text style={styles.text}>
                        {isOnline ? 'Back Online' : 'No Internet Connection'}
                    </Text>
                </View>
            </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.error, // Red for offline
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        overflow: 'hidden',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.error,
        paddingTop: Platform.OS === 'ios' ? 0 : 0
    },
    text: {
        color: 'white',
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
});

export default OfflineBanner;
