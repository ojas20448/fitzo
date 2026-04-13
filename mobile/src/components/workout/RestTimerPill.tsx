import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface RestTimerPillProps {
    seconds: number;
    onDismiss: () => void;
    onChangeDuration: () => void;
}

const RestTimerPill: React.FC<RestTimerPillProps> = ({ seconds, onDismiss, onChangeDuration }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
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
            pointerEvents="box-none"
        >
            <Pressable onPress={onChangeDuration} style={styles.pillInner}>
                <MaterialIcons name="timer" size={18} color={colors.text.primary} />
                <Text style={styles.pillLabel}>REST</Text>
                <Text style={styles.pillTime}>{label}</Text>
            </Pressable>
            <TouchableOpacity onPress={onDismiss} hitSlop={12} style={styles.pillClose}>
                <MaterialIcons name="close" size={16} color={colors.text.muted} />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    pill: {
        position: 'absolute',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(20, 20, 20, 0.92)',
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        ...shadows.glass,
        zIndex: 100,
    },
    pillInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    pillLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    pillTime: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        minWidth: 44,
    },
    pillClose: {
        marginLeft: spacing.md,
        padding: spacing.xs,
    },
});

export default RestTimerPill;
