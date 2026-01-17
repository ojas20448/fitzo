import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { workoutsAPI } from '../../services/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { useToast } from '../../components/Toast';
import GlassCard from '../../components/GlassCard';
import PublishSplitModal from '../../components/PublishSplitModal';

interface PublishedSplit {
    id: string;
    name: string;
    description: string;
    days_per_week: number;
    difficulty_level: 'beginner' | 'intermediate' | 'advanced';
    program_structure: Record<string, string>;
    tags: string[];
    author_name: string;
    is_official: boolean;
    download_count: number;
}

export default function PublishedSplitsScreen() {
    const toast = useToast();
    const [splits, setSplits] = useState<PublishedSplit[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSplit, setSelectedSplit] = useState<PublishedSplit | null>(null);
    const [adopting, setAdopting] = useState(false);
    const [publishModalVisible, setPublishModalVisible] = useState(false);

    // Filters
    const [filterDays, setFilterDays] = useState<number | null>(null);
    const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null);

    useEffect(() => {
        loadSplits();
    }, [filterDays, filterDifficulty]);

    const loadSplits = async () => {
        setLoading(true);
        try {
            const result = await workoutsAPI.getPublishedSplits({
                days: filterDays || undefined,
                difficulty: filterDifficulty || undefined
            });
            setSplits(result.splits);
        } catch (error) {
            console.error(error);
            toast.error('Error', 'Failed to load splits');
        } finally {
            setLoading(false);
        }
    };

    const handleAdopt = async () => {
        if (!selectedSplit) return;
        setAdopting(true);
        try {
            await workoutsAPI.adoptSplit(selectedSplit.id);
            toast.success('Workout Plan Adopted!', `You are now following ${selectedSplit.name}`);
            setSelectedSplit(null);
            router.back(); // Go back to intent/home screen
        } catch (error) {
            console.error(error);
            toast.error('Error', 'Failed to adopt plan');
        } finally {
            setAdopting(false);
        }
    };

    const getDifficultyColor = (level: string) => {
        switch (level) {
            case 'beginner': return '#4ECDC4';
            case 'intermediate': return '#FFE66D';
            case 'advanced': return '#FF6B6B';
            default: return colors.text.muted;
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Discover Workouts</Text>
                <TouchableOpacity onPress={() => setPublishModalVisible(true)} style={styles.backBtn}>
                    <MaterialIcons name="add" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* ... rest of UI ... */}

            <PublishSplitModal
                visible={publishModalVisible}
                onClose={() => setPublishModalVisible(false)}
                onSuccess={() => {
                    setPublishModalVisible(false);
                    loadSplits(); // Refresh list
                }}
            />


            {/* Filters */}
            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    <TouchableOpacity
                        style={[styles.filterChip, !filterDays && !filterDifficulty && styles.filterChipActive]}
                        onPress={() => { setFilterDays(null); setFilterDifficulty(null); }}
                    >
                        <Text style={[styles.filterText, !filterDays && !filterDifficulty && styles.filterTextActive]}>All</Text>
                    </TouchableOpacity>

                    {[3, 4, 5, 6].map(days => (
                        <TouchableOpacity
                            key={days}
                            style={[styles.filterChip, filterDays === days && styles.filterChipActive]}
                            onPress={() => setFilterDays(filterDays === days ? null : days)}
                        >
                            <Text style={[styles.filterText, filterDays === days && styles.filterTextActive]}>{days} Days</Text>
                        </TouchableOpacity>
                    ))}

                    {['beginner', 'intermediate', 'advanced'].map(diff => (
                        <TouchableOpacity
                            key={diff}
                            style={[styles.filterChip, filterDifficulty === diff && styles.filterChipActive]}
                            onPress={() => setFilterDifficulty(filterDifficulty === diff ? null : diff)}
                        >
                            <Text style={[styles.filterText, filterDifficulty === diff && styles.filterTextActive]}>
                                {diff.charAt(0).toUpperCase() + diff.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContent}>
                    {splits.map(split => (
                        <TouchableOpacity
                            key={split.id}
                            activeOpacity={0.9}
                            onPress={() => setSelectedSplit(split)}
                        >
                            <GlassCard style={styles.splitCard} padding="lg">
                                <View style={styles.splitHeader}>
                                    <View>
                                        <Text style={styles.splitName}>{split.name}</Text>
                                        <Text style={styles.authorName}>by {split.author_name} {split.is_official && '✓'}</Text>
                                    </View>
                                    <View style={styles.daysBadge}>
                                        <Text style={styles.daysText}>{split.days_per_week} Days</Text>
                                    </View>
                                </View>

                                <Text style={styles.description} numberOfLines={2}>{split.description}</Text>

                                <View style={styles.tagsRow}>
                                    <View style={[styles.tag, { backgroundColor: getDifficultyColor(split.difficulty_level) + '20' }]}>
                                        <Text style={[styles.tagText, { color: getDifficultyColor(split.difficulty_level) }]}>
                                            {split.difficulty_level.toUpperCase()}
                                        </Text>
                                    </View>
                                    {split.tags?.slice(0, 2).map((tag, i) => (
                                        <View key={i} style={styles.tag}>
                                            <Text style={styles.tagText}>{tag.toUpperCase()}</Text>
                                        </View>
                                    ))}
                                    <View style={{ flex: 1 }} />
                                    <View style={styles.downloadRow}>
                                        <MaterialIcons name="file-download" size={16} color={colors.text.muted} />
                                        <Text style={styles.downloadCount}>{split.download_count}</Text>
                                    </View>
                                </View>
                            </GlassCard>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Detail Modal */}
            <Modal
                visible={!!selectedSplit}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedSplit(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedSplit && (
                            <>
                                <View style={styles.modalHeader}>
                                    <TouchableOpacity onPress={() => setSelectedSplit(null)}>
                                        <MaterialIcons name="close" size={24} color={colors.text.primary} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <Text style={styles.modalTitle}>{selectedSplit.name}</Text>
                                    <View style={styles.modalMetaRow}>
                                        <Text style={[styles.modalMeta, { color: getDifficultyColor(selectedSplit.difficulty_level) }]}>
                                            {selectedSplit.difficulty_level.toUpperCase()}
                                        </Text>
                                        <Text style={styles.modalMeta}>•</Text>
                                        <Text style={styles.modalMeta}>{selectedSplit.days_per_week} DAYS / WEEK</Text>
                                    </View>

                                    <Text style={styles.modalDescription}>{selectedSplit.description}</Text>

                                    <Text style={styles.sectionTitle}>SCHEDULE</Text>
                                    <View style={styles.scheduleContainer}>
                                        {Object.entries(selectedSplit.program_structure).map(([day, focus], index) => (
                                            <View key={index} style={styles.scheduleRow}>
                                                <View style={styles.dayCircle}>
                                                    <Text style={styles.dayNumber}>{index + 1}</Text>
                                                </View>
                                                <View style={styles.dayInfo}>
                                                    <Text style={styles.dayLabel}>{day}</Text>
                                                    <Text style={styles.dayFocus}>{focus}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>

                                <View style={styles.modalFooter}>
                                    <TouchableOpacity
                                        style={styles.adoptBtn}
                                        onPress={handleAdopt}
                                        disabled={adopting}
                                    >
                                        {adopting ? (
                                            <ActivityIndicator color={colors.text.dark} />
                                        ) : (
                                            <Text style={styles.adoptBtnText}>ADOPT THIS PLAN</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    filterContainer: {
        marginBottom: spacing.md,
    },
    filterScroll: {
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
        paddingBottom: spacing.sm,
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.text.dark,
    },
    listContent: {
        padding: spacing.lg,
        paddingBottom: 100,
    },
    splitCard: {
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    splitHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    splitName: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    authorName: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    daysBadge: {
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.md,
    },
    daysText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    description: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginVertical: spacing.md,
        lineHeight: 20,
    },
    tagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    tag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: colors.surfaceLight,
    },
    tagText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
    },
    downloadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    downloadCount: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background, // Full screen modal-like sheet
        height: '90%',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    modalMetaRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    modalMeta: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    modalDescription: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        lineHeight: 24,
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },
    scheduleContainer: {
        gap: spacing.md,
        marginBottom: 100,
    },
    scheduleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        padding: spacing.md,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayNumber: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },
    dayInfo: {
        flex: 1,
    },
    dayLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginBottom: 2,
    },
    dayFocus: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    modalFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        backgroundColor: colors.background,
    },
    adoptBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        padding: spacing.lg,
        alignItems: 'center',
        ...shadows.glow,
    },
    adoptBtnText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },
});
