import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TextInput,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { learnAPI, settingsAPI, Lesson } from '../../services/api';
import { filterLessons, collectTopics } from '../../utils/lessonFilter';
import Skeleton, { SkeletonCard } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

const LearnScreen: React.FC = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [progress, setProgress] = useState<{ total_xp: number; lessons_completed: number; total_lessons: number }>({
        total_xp: 0,
        lessons_completed: 0,
        total_lessons: 0,
    });
    const [suggestedNextId, setSuggestedNextId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // Previously this screen had no error state at all: a failed request left
    // `units` as [] and rendered a blank ScrollView, making network failure
    // byte-identical to "you have no lessons yet".
    const [error, setError] = useState<'offline' | 'error' | null>(null);
    const [isStale, setIsStale] = useState(false);

    const [query, setQuery] = useState('');
    const [topic, setTopic] = useState<string | null>(null);
    const [startHereDismissed, setStartHereDismissed] = useState(true); // assume dismissed until known, so it cannot flash

    // Reload lessons whenever screen comes into focus (e.g. after completing a lesson)
    useFocusEffect(
        useCallback(() => {
            loadLessons();
        }, [])
    );

    const loadLessons = async () => {
        try {
            const response = await learnAPI.getLessons();
            setLessons(response.lessons || []);
            setProgress(response.progress || { total_xp: 0, lessons_completed: 0, total_lessons: 0 });
            setSuggestedNextId(response.suggested_next_id ?? null);
            // The API layer serves cached lessons when offline; say so rather than
            // presenting stale progress as live.
            setIsStale(Boolean(response.offline));
            setError(null);
        } catch (e: any) {
            const offline = e?.code === 'NETWORK_ERROR' || e?.code === 'TIMEOUT' || e?.status === 0;
            setError(offline ? 'offline' : 'error');
        } finally {
            setLoading(false);
        }

        // Loaded alongside the lessons fetch rather than a second effect.
        settingsAPI.getLearnPreferences()
            .then((p) => setStartHereDismissed(!!p.start_here_dismissed))
            .catch(() => setStartHereDismissed(true)); // fail closed — never flash a strip we cannot persist
    };

    const retry = () => {
        setLoading(true);
        setError(null);
        loadLessons();
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadLessons();
        setRefreshing(false);
    };

    const topics = useMemo(() => collectTopics(lessons), [lessons]);
    const visible = useMemo(() => filterLessons(lessons, { query, topic }), [lessons, query, topic]);
    const suggested = useMemo(
        () => lessons.find((l) => l.id === suggestedNextId) ?? null,
        [lessons, suggestedNextId],
    );

    const dismissStartHere = useCallback(() => {
        setStartHereDismissed(true);
        // Fire-and-forget: a failed preference write must never block browsing.
        // Worst case the strip returns next launch.
        settingsAPI.updateLearnPreferences({ start_here_dismissed: true }).catch(() => {});
    }, []);

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>LEARN</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>PATH</Text>
                    </View>
                    <Skeleton width={80} height={28} borderRadius={14} />
                </View>
                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                    <Skeleton width={160} height={16} style={{ marginBottom: spacing.lg }} />
                    <Skeleton width="100%" height={44} borderRadius={borderRadius.lg} style={{ marginBottom: spacing.lg }} />
                    <View style={styles.skeletonChipRow}>
                        <Skeleton width={70} height={30} borderRadius={borderRadius.full} />
                        <Skeleton width={90} height={30} borderRadius={borderRadius.full} />
                        <Skeleton width={60} height={30} borderRadius={borderRadius.full} />
                    </View>
                    {[1, 2, 3, 4, 5].map((_, idx) => (
                        <SkeletonCard key={idx} style={{ marginBottom: spacing.md }} />
                    ))}
                </ScrollView>
            </SafeAreaView>
        );
    }

    // A failed load with nothing cached is the one case where the library
    // cannot be drawn at all. Everything else falls through to the normal list.
    if (error && lessons.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>LEARN</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>PATH</Text>
                    </View>
                </View>
                <EmptyState variant={error} onAction={retry} />
            </SafeAreaView>
        );
    }

    // Brand-new user: lessons exist as a feature but none have loaded for them yet.
    if (!error && lessons.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>LEARN</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>PATH</Text>
                    </View>
                </View>
                <EmptyState
                    icon="school"
                    title="Your path starts soon"
                    message="Lessons on nutrition, training and recovery will appear here. Check back shortly."
                    actionLabel="Refresh"
                    onAction={retry}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>LEARN</Text>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerSubtitle}>PATH</Text>
                </View>
                <View style={styles.xpBadge}>
                    <MaterialIcons name="diamond" size={14} color={colors.primary} />
                    <Text style={styles.xpText}>{progress.total_xp ?? 0}</Text>
                </View>
            </View>

            {isStale && (
                <View style={styles.staleBanner}>
                    <MaterialIcons name="cloud-off" size={14} color={colors.text.muted} />
                    <Text style={styles.staleBannerText}>Offline — showing saved lessons</Text>
                </View>
            )}

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Progress line — never opens with a deficit. */}
                <Text style={styles.progressLine}>
                    {progress.lessons_completed === 0
                        ? `${progress.total_lessons} lessons · ${topics.length} topics`
                        : `${progress.lessons_completed} of ${progress.total_lessons} done`}
                </Text>

                <TextInput
                    style={styles.search}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search lessons"
                    placeholderTextColor={colors.text.muted}
                    accessibilityLabel="Search lessons"
                    returnKeyType="search"
                    autoCorrect={false}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {topics.map((t) => (
                        <Pressable
                            key={t}
                            onPress={() => setTopic(topic === t ? null : t)}
                            style={[styles.chip, topic === t && styles.chipActive]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: topic === t }}
                            accessibilityLabel={`Filter by ${t}`}
                        >
                            <Text style={[styles.chipText, topic === t && styles.chipTextActive]}>{t}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {!startHereDismissed && suggested && progress.lessons_completed < progress.total_lessons && (
                    <View style={styles.startHere}>
                        <Pressable
                            style={styles.startHereMain}
                            onPress={() => router.push(`/lesson/${suggested.id}` as any)}
                            accessibilityRole="button"
                            accessibilityLabel={`Start here: ${suggested.title}`}
                        >
                            <Text style={styles.startHereLabel}>START HERE</Text>
                            <Text style={styles.startHereTitle} numberOfLines={1}>{suggested.title}</Text>
                        </Pressable>
                        <Pressable
                            onPress={dismissStartHere}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel="Dismiss start here suggestion"
                        >
                            <MaterialIcons name="close" size={18} color={colors.text.muted} />
                        </Pressable>
                    </View>
                )}

                {/* Every row below is tappable — no disabled state, no lock icon, no dimming. */}
                {visible.length === 0 && lessons.length > 0 ? (
                    <View style={styles.noMatch}>
                        <Text style={styles.noMatchText}>No lessons match "{query}"</Text>
                        <Pressable
                            onPress={() => { setQuery(''); setTopic(null); }}
                            accessibilityRole="button"
                            accessibilityLabel="Clear search and filters"
                        >
                            <Text style={styles.noMatchClear}>CLEAR</Text>
                        </Pressable>
                    </View>
                ) : (
                    visible.map((l) => (
                        <Pressable
                            key={l.id}
                            style={styles.lessonRow}
                            onPress={() => router.push(`/lesson/${l.id}` as any)}
                            accessibilityRole="button"
                            accessibilityLabel={
                                `${l.title}. ${l.question_count} questions. ` +
                                `${Math.max(1, Math.round((l.read_seconds ?? 60) / 60))} minute read.` +
                                (l.completed ? ' Completed.' : '')
                            }
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.lessonTitle} numberOfLines={1}>{l.title}</Text>
                                {!!l.description && (
                                    <Text style={styles.lessonDesc} numberOfLines={1}>{l.description}</Text>
                                )}
                                <Text style={styles.lessonMeta}>
                                    {l.question_count} questions · {Math.max(1, Math.round((l.read_seconds ?? 60) / 60))} min
                                </Text>
                            </View>
                            {l.completed && <MaterialIcons name="check" size={18} color={colors.success} />}
                        </Pressable>
                    ))
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    staleBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.glass.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    staleBannerText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    headerTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        letterSpacing: 2,
    },
    headerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.text.subtle,
    },
    headerSubtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.glass.surface,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    xpText: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.sm,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['3xl'],
    },
    skeletonChipRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },

    // Progress line
    progressLine: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: spacing.lg,
    },

    // Search
    search: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },

    // Topic chips
    chipRow: {
        marginBottom: spacing.xl,
    },
    chip: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.full,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginRight: spacing.sm,
    },
    chipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    chipTextActive: {
        color: colors.text.dark,
    },

    // Start here strip
    startHere: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    startHereMain: {
        flex: 1,
        marginRight: spacing.md,
    },
    startHereLabel: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    startHereTitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },

    // Empty-search state
    noMatch: {
        alignItems: 'center',
        paddingVertical: spacing['3xl'],
        gap: spacing.md,
    },
    noMatchText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    noMatchClear: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 1,
    },

    // Lesson rows — every row is tappable, none are locked or dimmed.
    lessonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    lessonTitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    lessonDesc: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginBottom: spacing.xs,
    },
    lessonMeta: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.subtle,
        letterSpacing: 0.5,
    },
});

export default LearnScreen;
