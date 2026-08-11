import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import type { VoiceStage } from '../hooks/useVoiceCapture';

/**
 * VoiceCaptureSheet — the recording surface.
 *
 * One job: make it obvious that the mic is live, how long it has been live,
 * and that there are two ways out (discard / done). Everything else the app
 * does with the audio happens behind this sheet.
 */

interface Props {
    visible: boolean;
    stage: VoiceStage;
    durationLabel: string;
    durationProgress: number;
    hint: string;
    onCancel: () => void;
    onDone: () => void;
}

const STAGE_COPY: Record<VoiceStage, string> = {
    idle: '',
    recording: 'Listening',
    transcribing: 'Writing it down',
    thinking: 'Reading your log',
};

export default function VoiceCaptureSheet({
    visible,
    stage,
    durationLabel,
    durationProgress,
    hint,
    onCancel,
    onDone,
}: Props) {
    const pulse = useRef(new Animated.Value(0)).current;
    const busy = stage === 'transcribing' || stage === 'thinking';
    const recording = stage === 'recording';

    useEffect(() => {
        if (!recording) {
            pulse.stopAnimation();
            pulse.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [recording, pulse]);

    const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
    const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    {/* Live mic with breathing halo */}
                    <View style={styles.micWrap}>
                        {recording && (
                            <Animated.View
                                style={[
                                    styles.halo,
                                    { transform: [{ scale: haloScale }], opacity: haloOpacity },
                                ]}
                            />
                        )}
                        <View style={[styles.micCircle, recording && styles.micCircleLive]}>
                            <MaterialIcons
                                name={busy ? 'auto-awesome' : 'mic'}
                                size={34}
                                color={recording ? colors.background : colors.text.primary}
                            />
                        </View>
                    </View>

                    {/* Stage + duration */}
                    <Text style={styles.stageText}>{STAGE_COPY[stage] || 'Listening'}</Text>
                    {recording ? (
                        <Text style={styles.duration}>{durationLabel}</Text>
                    ) : (
                        <Text style={styles.durationMuted}>a moment…</Text>
                    )}

                    {/* Time-remaining bar — only while recording */}
                    {recording && (
                        <View style={styles.track}>
                            <View style={[styles.trackFill, { width: `${Math.max(2, durationProgress * 100)}%` }]} />
                        </View>
                    )}

                    <Text style={styles.hint}>{recording ? hint : 'Hang tight — no need to hold the phone.'}</Text>

                    {/* Two exits, always visible while recording */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnGhost]}
                            onPress={onCancel}
                            disabled={busy}
                            accessibilityLabel="Discard recording"
                        >
                            <Text style={[styles.btnGhostText, busy && styles.disabledText]}>Discard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
                            onPress={onDone}
                            disabled={busy}
                            accessibilityLabel="Finish and process recording"
                        >
                            <MaterialIcons name="check" size={18} color={colors.background} />
                            <Text style={styles.btnPrimaryText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.82)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderTopWidth: 1,
        borderColor: colors.glass.border,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing['2xl'],
        paddingBottom: spacing['2xl'] + spacing.lg,
        alignItems: 'center',
    },
    micWrap: {
        width: 96,
        height: 96,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    halo: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.primary,
    },
    micCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    micCircleLive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    stageText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    duration: {
        fontSize: 46,
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: -1,
        marginTop: spacing.xs,
        fontVariant: ['tabular-nums'],
    },
    durationMuted: {
        fontSize: 22,
        fontFamily: typography.fontFamily.light,
        color: colors.text.muted,
        marginTop: spacing.sm,
    },
    track: {
        width: '60%',
        height: 3,
        borderRadius: 2,
        backgroundColor: colors.glass.surfaceLight,
        marginTop: spacing.md,
        overflow: 'hidden',
    },
    trackFill: {
        height: '100%',
        backgroundColor: colors.text.muted,
        borderRadius: 2,
    },
    hint: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing['2xl'],
        width: '100%',
    },
    btn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.full,
        minHeight: 52,
    },
    btnGhost: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    btnGhostText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    btnPrimary: {
        backgroundColor: colors.primary,
    },
    btnPrimaryText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
    },
    btnDisabled: {
        opacity: 0.5,
    },
    disabledText: {
        opacity: 0.5,
    },
});
