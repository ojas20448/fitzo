import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { getWarmUp } from '../../data/warmups';

interface WarmUpCardProps {
    /** The day's workout type — decides which routine is shown. */
    workoutType: string | null | undefined;
    /** Hide for this session only. */
    onDismiss: () => void;
    /** Hide for this session AND stop suggesting it in future. */
    onNeverShowAgain: () => void;
}

/**
 * A suggestion, not a gate. It sits above the exercise list, collapses to a
 * single line, and never stands between someone and their first set — the whole
 * card can be dismissed in one tap.
 */
export default function WarmUpCard({ workoutType, onDismiss, onNeverShowAgain }: WarmUpCardProps) {
    const routine = getWarmUp(workoutType);
    const [expanded, setExpanded] = useState(true);
    // Ticking moves off is deliberately local and unsaved — a warm-up is not
    // training data, and persisting it would put it in volume/PR territory.
    const [done, setDone] = useState<Set<string>>(new Set());

    const toggleMove = (name: string) => {
        setDone(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const allDone = done.size === routine.moves.length;

    return (
        <View style={styles.card}>
            <Pressable
                style={styles.header}
                onPress={() => setExpanded(!expanded)}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Collapse warm-up' : 'Expand warm-up'}
            >
                <MaterialIcons
                    name={allDone ? 'check-circle' : 'self-improvement'}
                    size={18}
                    color={allDone ? colors.primary : colors.text.secondary}
                />
                <View style={styles.headerText}>
                    <Text style={styles.title}>WARM-UP</Text>
                    <Text style={styles.subtitle}>
                        {routine.title} · about 5 min
                        {done.size > 0 && !allDone ? `  ·  ${done.size}/${routine.moves.length}` : ''}
                    </Text>
                </View>
                <MaterialIcons
                    name={expanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={colors.text.muted}
                />
            </Pressable>

            {expanded && (
                <>
                    <View style={styles.moves}>
                        {routine.moves.map(move => {
                            const isDone = done.has(move.name);
                            return (
                                <Pressable
                                    key={move.name}
                                    style={styles.move}
                                    onPress={() => toggleMove(move.name)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: isDone }}
                                    accessibilityLabel={`${move.name}, ${move.dose}`}
                                >
                                    <MaterialIcons
                                        name={isDone ? 'check-box' : 'check-box-outline-blank'}
                                        size={18}
                                        color={isDone ? colors.primary : colors.text.muted}
                                    />
                                    <View style={styles.moveText}>
                                        <Text style={[styles.moveName, isDone && styles.moveNameDone]}>
                                            {move.name}
                                            <Text style={styles.moveDose}>{'  '}{move.dose}</Text>
                                        </Text>
                                        <Text style={styles.moveWhy}>{move.why}</Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity onPress={onNeverShowAgain} hitSlop={8}>
                            <Text style={styles.neverText}>DON&apos;T SHOW AGAIN</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onDismiss} style={styles.skipBtn}>
                            <Text style={styles.skipText}>
                                {allDone ? 'DONE' : 'SKIP'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    moves: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.md,
    },
    move: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    moveText: {
        flex: 1,
    },
    moveName: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    moveNameDone: {
        color: colors.text.muted,
        textDecorationLine: 'line-through',
    },
    moveDose: {
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
    },
    moveWhy: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    neverText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    skipBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
    },
    skipText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
        letterSpacing: 1,
    },
});
