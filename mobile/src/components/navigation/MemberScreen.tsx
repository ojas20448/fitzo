import React from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenBackdrop from '../ScreenBackdrop';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';
import { useMemberContentInset } from './MemberChromeContext';
import { useMemberTabScroll } from '../../hooks/useMemberTabScroll';

export function MemberScreen({ title, subtitle, children, refreshing = false, onRefresh, headerRight }: {
    title: string; subtitle: string; children: React.ReactNode; refreshing?: boolean;
    onRefresh?: () => void; headerRight?: React.ReactNode;
}) {
    const bottom = useMemberContentInset();
    const onScroll = useMemberTabScroll();
    return <SafeAreaView style={memberStyles.screen} edges={['top']}>
        <ScreenBackdrop />
        <View style={memberStyles.header}>
            <View style={memberStyles.headerInner}>
            <View style={memberStyles.headerCopy}><Text style={memberStyles.subtitle}>{subtitle}</Text><Text accessibilityRole="header" style={memberStyles.headerTitle}>{title}</Text></View>
            {headerRight}
            </View>
        </View>
        <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[memberStyles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
            {children}
        </ScrollView>
    </SafeAreaView>;
}

export function MemberAction({ icon, title, detail, onPress }: {
    icon: keyof typeof Ionicons.glyphMap; title: string; detail?: string; onPress: () => void;
}) {
    return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [memberStyles.action, pressed && memberStyles.pressed]}>
        <View style={memberStyles.actionIcon}><Ionicons name={icon} size={21} color={colors.text.secondary} /></View>
        <View style={memberStyles.grow}><Text style={memberStyles.title}>{title}</Text>{detail ? <Text style={memberStyles.detail}>{detail}</Text> : null}</View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
    </Pressable>;
}

export const memberStyles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
    headerInner: { width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    headerCopy: { gap: spacing.sm, flex: 1, minWidth: 0 },
    headerTitle: { fontFamily: typography.fontFamily.semiBold, fontSize: 28, letterSpacing: -0.8, color: colors.text.primary },
    subtitle: { fontFamily: typography.fontFamily.medium, fontSize: 10, letterSpacing: 1.7, color: colors.text.secondary },
    content: { padding: spacing.xl, paddingTop: spacing.sm, gap: spacing['2xl'], width: '100%', maxWidth: 600, alignSelf: 'center' },
    title: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.lg, color: colors.text.primary },
    detail: { fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, color: colors.text.secondary, marginTop: spacing.xs },
    section: { fontFamily: typography.fontFamily.semiBold, fontSize: typography.sizes.lg, color: colors.text.primary },
    grow: { flex: 1, minWidth: 0 },
    action: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', minHeight: 72, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glass.border },
    actionIcon: { width: 36, height: 36, borderRadius: borderRadius.md, backgroundColor: colors.glass.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    pressed: { backgroundColor: colors.glass.surfaceHover },
    card: { padding: spacing.xl, gap: spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    number: { fontFamily: typography.fontFamily.semiBold, fontSize: typography.sizes['3xl'], color: colors.text.primary },
    iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    input: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.glass.borderLight, borderRadius: borderRadius.md, color: colors.text.primary, fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.md },
});
