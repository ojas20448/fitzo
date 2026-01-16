import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { workoutsAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import Celebration from '../../components/Celebration';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

const DURATION_OPTIONS = [15, 30, 45, 60, 90];
const ENERGY_LEVELS = ['😴', '😐', '😊', '💪', '🔥'];

const WorkoutLogScreen: React.FC = () => {
    const toast = useToast();
    const [duration, setDuration] = useState(45);
    const [energyLevel, setEnergyLevel] = useState(3);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [xpEarned, setXpEarned] = useState(0);

    // Get today's date formatted
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const handleLog = async () => {
        setLoading(true);
        try {
            const result = await workoutsAPI.log({
                workout_type: 'general',
                duration_minutes: duration,
                energy_level: energyLevel,
                notes: notes.trim() || undefined,
                visibility: 'friends',
            });

            if (result.xp_earned > 0) {
                setXpEarned(result.xp_earned);
                setShowCelebration(true);
            } else {
                toast.success('Workout Logged!', 'Great job staying consistent!');
                router.back();
            }
        } catch (error: any) {
            toast.error('Error', error.message || 'Failed to log workout');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Celebration
                visible={showCelebration}
                type="workout"
                title="Workout Logged!"
                subtitle="Keep up the great work!"
                value={`${xpEarned} XP`}
                onComplete={() => {
                    setShowCelebration(false);
                    router.back();
                }}
            />

            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                >
                    <MaterialIcons name="close" size={20} color={colors.text.muted} />
                </Pressable>
                <View style={styles.headerCenter}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>LOG</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>WORKOUT</Text>
                    </View>
                </View>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Date Display */}
                <View style={styles.dateSection}>
                    <Text style={styles.dayName}>{dayName}</Text>
                    <Text style={styles.dateStr}>{dateStr}</Text>
                </View>

                {/* Locked Intent Card */}
                <GlassCard variant="subtle" style={styles.intentCard}>
                    <View style={styles.intentHeader}>
                        <MaterialIcons name="lock" size={14} color={colors.text.muted} />
                        <Text style={styles.intentLabel}>LOCKED INTENT</Text>
                    </View>
                    <Text style={styles.intentValue}>Strength · Push</Text>
                </GlassCard>

                {/* Duration Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>DURATION</Text>
                    <View style={styles.durationRow}>
                        {DURATION_OPTIONS.map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={[
                                    styles.durationPill,
                                    duration === mins && styles.durationPillActive
                                ]}
                                onPress={() => setDuration(mins)}
                            >
                                <Text style={[
                                    styles.durationText,
                                    duration === mins && styles.durationTextActive
                                ]}>
                                    {mins}m
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Energy Level */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>ENERGY LEVEL</Text>
                    <View style={styles.energyRow}>
                        {ENERGY_LEVELS.map((emoji, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.energyPill,
                                    energyLevel === idx && styles.energyPillActive
                                ]}
                                onPress={() => setEnergyLevel(idx)}
                            >
                                <Text style={styles.energyEmoji}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Session Notes */}
                <TouchableOpacity style={styles.notesBtn}>
                    <MaterialIcons name="add" size={16} color={colors.text.muted} />
                    <Text style={styles.notesBtnText}>Add session note</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Confirm Button */}
            <View style={styles.footer}>
                <Button
                    title="Confirm Session"
                    onPress={handleLog}
                    loading={loading}
                    fullWidth
                />
            </View>
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
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
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
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing['2xl'],
    },
    dateSection: {
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    dayName: {
        fontSize: 48,
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: -1,
        lineHeight: 52,
    },
    dateStr: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 1,
        marginTop: spacing.xs,
    },
    intentCard: {
        marginBottom: spacing.xl,
    },
    intentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    intentLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 1.5,
    },
    intentValue: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.subtle,
        letterSpacing: 2,
        marginBottom: spacing.md,
    },
    durationRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    durationPill: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    durationPillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    durationText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 0.5,
    },
    durationTextActive: {
        color: colors.background,
    },
    energyRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    energyPill: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    energyPillActive: {
        backgroundColor: colors.glass.surfaceHover,
        borderColor: colors.glass.borderLight,
    },
    energyEmoji: {
        fontSize: 20,
    },
    notesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        marginTop: spacing.md,
    },
    notesBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 0.5,
    },
    footer: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        paddingBottom: spacing['2xl'],
    },
});

export default WorkoutLogScreen;
