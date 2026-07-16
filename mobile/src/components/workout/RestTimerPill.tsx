import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface RestTimerPillProps {
    seconds: number;
    onDismiss: () => void;
    onAddSeconds: (secs: number) => void;
}

const RestTimerPill: React.FC<RestTimerPillProps> = ({ seconds, onDismiss, onAddSeconds }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, []);

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const label = `${mins}:${secs.toString().padStart(2, '0')}`;

    return (
        <Animated.View
            style={[
                styles.pill,
                { bottom: insets.bottom + 80, opacity: fadeAnim },
            ]}
        >
            {/* Timer Display block */}
            <View style={styles.timerBlock}>
                <MaterialIcons name="timer" size={16} color={colors.primary} />
                <Text style={styles.pillTime}>{label}</Text>
            </View>

            <View style={styles.divider} />

            {/* Actions block */}
            <View style={styles.actionBlock}>
                <TouchableOpacity onPress={() => onAddSeconds(30)} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>+30S</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onDismiss} style={styles.skipBtn} accessibilityLabel="Skip rest">
                    <MaterialIcons name="skip-next" size={18} color={colors.text.muted} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    pill: {
        position: 'absolute',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        ...shadows.glass,
        zIndex: 100,
        gap: spacing.md,
    },
    timerBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingLeft: spacing.xs,
    },
    pillTime: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        minWidth: 36,
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    actionBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    actionBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    actionBtnText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    skipBtn: {
        padding: spacing.xs,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default RestTimerPill;
