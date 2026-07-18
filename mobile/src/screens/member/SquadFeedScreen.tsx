import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import CommentModal from '../../components/CommentModal';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { workoutsAPI } from '../../services/api';

/**
 * Squad Feed — the one social feed.
 * Minimal mono: glass cards, one real action (comments), no decoration.
 */

interface FeedItem {
    id: string;
    user: string;
    avatar: string | null;
    type: string;
    exerciseNames: string[];
    setCount: number;
    volumeKg: number;
    commentCount: number;
    createdAt: Date;
}

// "2h ago" style relative time — feeds live on recency, not dates
function relativeTime(date: Date): string {
    const s = Math.max(0, (Date.now() - date.getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'yesterday' : `${d}d ago`;
}

function parseWorkout(raw: string | null): { names: string[]; sets: number; volume: number } {
    try {
        const exercises = JSON.parse(raw || '[]');
        if (!Array.isArray(exercises)) return { names: [], sets: 0, volume: 0 };
        const names: string[] = [];
        let sets = 0;
        let volume = 0;
        for (const ex of exercises) {
            if (ex?.name) names.push(ex.name);
            for (const s of ex?.sets || []) {
                const reps = parseFloat(s?.reps) || 0;
                const w = parseFloat(s?.weight_kg) || 0;
                if (reps > 0 || w > 0) sets++;
                if (reps > 0 && w > 0) volume += reps * w;
            }
        }
        return { names, sets, volume: Math.round(volume) };
    } catch {
        return { names: [], sets: 0, volume: 0 };
    }
}

const SquadFeedScreen = () => {
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [commentTarget, setCommentTarget] = useState<string | null>(null);

    const loadFeed = useCallback(async () => {
        try {
            const data = await workoutsAPI.getFeed();
            const mapped: FeedItem[] = (data?.feed || []).map((item: any) => {
                const parsed = parseWorkout(item.exercises);
                return {
                    id: item.id,
                    user: item.name,
                    avatar: item.avatar_url,
                    type: item.workout_type,
                    exerciseNames: parsed.names,
                    setCount: parsed.sets,
                    volumeKg: parsed.volume,
                    commentCount: item.comment_count || 0,
                    createdAt: new Date(item.created_at),
                };
            });
            setFeed(mapped);
        } catch {
            // network errors leave the last-known feed in place
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadFeed();
    }, [loadFeed]);

    const onRefresh = () => {
        setRefreshing(true);
        loadFeed();
    };

    const renderItem = ({ item }: { item: FeedItem }) => {
        const shownNames = item.exerciseNames.slice(0, 2).join(' · ');
        const moreCount = Math.max(0, item.exerciseNames.length - 2);

        return (
            <View style={styles.card}>
                {/* Who + when + what */}
                <View style={styles.cardHeader}>
                    <Avatar name={item.user} size="md" uri={item.avatar} />
                    <View style={styles.headerText}>
                        <Text style={styles.userName}>{item.user}</Text>
                        <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                    </View>
                    <View style={styles.typePill}>
                        <Text style={styles.typePillText}>{item.type.toUpperCase()}</Text>
                    </View>
                </View>

                {/* What they did */}
                {item.exerciseNames.length > 0 && (
                    <Text style={styles.exerciseLine} numberOfLines={1}>
                        {shownNames}
                        {moreCount > 0 && <Text style={styles.moreText}>  +{moreCount} more</Text>}
                    </Text>
                )}
                {(item.setCount > 0 || item.volumeKg > 0) && (
                    <Text style={styles.statLine}>
                        {item.setCount > 0 ? `${item.setCount} sets` : ''}
                        {item.setCount > 0 && item.volumeKg > 0 ? '  ·  ' : ''}
                        {item.volumeKg > 0 ? `${item.volumeKg.toLocaleString()} kg` : ''}
                    </Text>
                )}

                {/* One real action */}
                <TouchableOpacity
                    style={styles.commentBtn}
                    onPress={() => setCommentTarget(item.id)}
                    accessibilityLabel={`Comments on ${item.user}'s workout`}
                >
                    <MaterialIcons name="chat-bubble-outline" size={16} color={colors.text.muted} />
                    <Text style={styles.commentText}>
                        {item.commentCount > 0 ? item.commentCount : 'Comment'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header — app-standard letterspaced pattern */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
                    <MaterialIcons name="arrow-back" size={20} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>SQUAD</Text>
                    <Text style={styles.headerDot}>·</Text>
                    <Text style={styles.headerSubtitle}>FEED</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.listContent}>
                    <SkeletonList count={4} />
                </View>
            ) : feed.length === 0 ? (
                <EmptyState
                    title="Nothing here yet"
                    message="When your gym buddies log workouts, they show up here."
                    icon="groups"
                    actionLabel="Find buddies"
                    onAction={() => router.push('/member/add-buddy' as any)}
                />
            ) : (
                <FlatList
                    data={feed}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    ListHeaderComponent={
                        <Text style={styles.listCaption}>LAST 7 DAYS</Text>
                    }
                />
            )}

            {/* Comments */}
            <CommentModal
                visible={commentTarget !== null}
                onClose={() => {
                    setCommentTarget(null);
                    loadFeed(); // refresh counts after commenting
                }}
                itemId={commentTarget || ''}
                type="workout"
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: typography.letterSpacing.wider,
    },
    headerDot: {
        fontSize: typography.sizes.sm,
        color: colors.text.subtle,
    },
    headerSubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.light,
        color: colors.text.secondary,
        letterSpacing: typography.letterSpacing.wide,
    },
    listContent: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['2xl'],
    },
    listCaption: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.subtle,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },
    card: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    headerText: {
        flex: 1,
    },
    userName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    time: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 1,
    },
    typePill: {
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    typePillText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
        letterSpacing: 1.5,
    },
    exerciseLine: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        marginTop: spacing.md,
    },
    moreText: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.regular,
    },
    statLine: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 4,
    },
    commentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        marginTop: spacing.md,
        paddingVertical: 4,
        paddingRight: spacing.md,
    },
    commentText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default SquadFeedScreen;
