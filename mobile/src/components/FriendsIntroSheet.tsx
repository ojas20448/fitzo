import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface Props {
    visible: boolean;
    onDismiss: () => void;
    onOpenSharingSettings?: () => void;
}

/**
 * Shown once, the first time a member opens Friends.
 *
 * This is a disclosure, not marketing. Every line below was checked against
 * what buddy-activity.js actually returns, because a privacy notice that
 * overstates OR understates is worse than none:
 *
 *   - check-ins have NO visibility filter — an accepted buddy always sees them
 *   - today's training plan is shown when its visibility is public/friends,
 *     independently of the share_logs_default toggle
 *   - workouts and meals are public-always, friends-only-if-sharing-is-on,
 *     and private never
 *
 * So the copy deliberately separates "always" from "only if you share", rather
 * than flattening it into "buddies can see your activity".
 */
const ROWS = [
    {
        icon: 'place' as const,
        title: 'Gym check-ins',
        body: 'Buddies always see when you checked in today.',
        always: true,
    },
    {
        icon: 'fitness-center' as const,
        title: "Today's training plan",
        body: 'Shown if you set the plan to buddies or public.',
        always: false,
    },
    {
        icon: 'restaurant' as const,
        title: 'Workouts and meals',
        body: 'Only the ones you share. Private logs are never shown.',
        always: false,
    },
];

const FriendsIntroSheet: React.FC<Props> = ({ visible, onDismiss, onOpenSharingSettings }) => {
    if (!visible) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <MaterialIcons name="people" size={26} color={colors.primary} />
                    </View>

                    <Text style={styles.title}>Buddies see each other</Text>
                    <Text style={styles.lede}>
                        Adding a gym buddy goes both ways — they see your activity and you see theirs.
                    </Text>

                    <View style={styles.rows}>
                        {ROWS.map((r) => (
                            <View key={r.title} style={styles.row}>
                                <MaterialIcons name={r.icon} size={18} color={colors.text.secondary} style={styles.rowIcon} />
                                <View style={{ flex: 1 }}>
                                    <View style={styles.rowHead}>
                                        <Text style={styles.rowTitle}>{r.title}</Text>
                                        {r.always && <Text style={styles.alwaysTag}>ALWAYS</Text>}
                                    </View>
                                    <Text style={styles.rowBody}>{r.body}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.foot}>
                        You can change what you share at any time, and blocking someone stops it entirely.
                    </Text>

                    <Pressable
                        onPress={onDismiss}
                        style={styles.primaryBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Got it"
                    >
                        <Text style={styles.primaryBtnText}>Got it</Text>
                    </Pressable>

                    {onOpenSharingSettings && (
                        <Pressable
                            onPress={onOpenSharingSettings}
                            style={styles.secondaryBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Open sharing settings"
                        >
                            <Text style={styles.secondaryBtnText}>Sharing settings</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.xl,
    },
    iconWrap: {
        width: 48, height: 48, borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    lede: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginTop: spacing.xs,
        lineHeight: 20,
    },
    rows: { marginTop: spacing.lg, gap: spacing.md },
    row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    rowIcon: { marginTop: 2 },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rowTitle: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    alwaysTag: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 0.8,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.sm,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    rowBody: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 1,
        lineHeight: 18,
    },
    foot: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.lg,
        lineHeight: 18,
    },
    primaryBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    primaryBtnText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.background,
    },
    secondaryBtn: { paddingVertical: spacing.md, alignItems: 'center' },
    secondaryBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
});

export default FriendsIntroSheet;
