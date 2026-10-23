import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { borderRadius, colors, spacing, typography } from '../styles/theme';

export interface ConfirmationAction {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
}

// Native Alert has no web implementation. Use the same explicit confirmation everywhere.
export default function ConfirmationSheet({ action, busy = false, onCancel }: {
    action: ConfirmationAction | null; busy?: boolean; onCancel: () => void;
}) {
    const insets = useSafeAreaInsets();
    return <Modal visible={!!action} transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
        <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!busy) onCancel(); }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
                <View style={styles.handle} />
                <ScrollView bounces={false}>
                    <Ionicons name={action?.destructive ? 'trash-outline' : 'swap-horizontal-outline'} size={24} color={colors.text.secondary} style={styles.icon} />
                    <Text accessibilityRole="header" style={styles.title}>{action?.title}</Text>
                    <Text style={styles.message}>{action?.message}</Text>
                </ScrollView>
                <Button title={action?.cancelLabel || 'Cancel'} variant="secondary" onPress={onCancel} disabled={busy} />
                <Button title={action?.confirmLabel || 'Confirm'} accessibilityLabel={`Confirm ${action?.confirmLabel.toLowerCase() || 'action'}`} variant={action?.destructive ? 'danger' : 'primary'} onPress={() => action?.onConfirm()} loading={busy} style={styles.confirm} />
            </View>
        </View>
    </Modal>;
}
const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.68)', paddingHorizontal: spacing.sm },
    sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '85%', padding: spacing.xl, borderTopLeftRadius: borderRadius['2xl'], borderTopRightRadius: borderRadius['2xl'], backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.glass.borderLight },
    handle: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: colors.glass.borderHover, marginBottom: spacing.xl },
    icon: { marginBottom: spacing.md },
    title: { fontFamily: typography.fontFamily.semiBold, fontSize: typography.sizes['2xl'], color: colors.text.primary },
    message: { fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.md, lineHeight: 22, color: colors.text.secondary, marginTop: spacing.sm, marginBottom: spacing['2xl'] },
    confirm: { marginTop: spacing.sm },
});
