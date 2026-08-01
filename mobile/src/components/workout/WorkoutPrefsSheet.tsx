import React from 'react';
import { View, Text, Modal, Pressable, Switch, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

interface WorkoutPrefsSheetProps {
    visible: boolean;
    rirEnabled: boolean;
    onChangeRir: (enabled: boolean) => void;
    onDismiss: () => void;
}

const WorkoutPrefsSheet: React.FC<WorkoutPrefsSheetProps> = ({
    visible,
    rirEnabled,
    onChangeRir,
    onDismiss,
}) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
        <View style={styles.backdrop}>
            <View style={styles.sheet}>
                <Text style={styles.title}>TWO THINGS BEFORE YOU LOG</Text>

                <View style={styles.row}>
                    <Text style={styles.rowTitle}>One side at a time</Text>
                    <Text style={styles.rowBody}>
                        Doing single-arm rows or split squats? Tap 1 SIDE on the exercise and
                        enter what you did on one side. We'll count both.
                    </Text>
                </View>

                <View style={styles.row}>
                    <View style={styles.switchRow}>
                        <Text style={styles.rowTitle}>Track RIR</Text>
                        <Switch
                            value={rirEnabled}
                            onValueChange={onChangeRir}
                            accessibilityLabel="Track reps in reserve"
                        />
                    </View>
                    <Text style={styles.rowBody}>
                        Reps in reserve — how many you had left. 0 means you went to failure.
                        Off by default; change it any time in Settings.
                    </Text>
                </View>

                <Pressable style={styles.dismiss} onPress={onDismiss} accessibilityRole="button">
                    <Text style={styles.dismissText}>GOT IT</Text>
                </Pressable>
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
        borderTopWidth: 1,
        borderColor: colors.glass.border,
    },
    title: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
        letterSpacing: 1.2,
        marginBottom: spacing.lg,
    },
    row: { marginBottom: spacing.lg },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    rowBody: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        lineHeight: 20,
    },
    dismiss: {
        marginTop: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surfaceLight,
        alignItems: 'center',
    },
    dismissText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 1,
    },
});

export default WorkoutPrefsSheet;
