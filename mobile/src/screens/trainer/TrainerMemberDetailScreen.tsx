import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { trainerAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

interface MemberDetail {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    joined_at: string;
    streak: number;
    xp_points: number;
    today_intent: {
        muscle_group: string;
        note: string | null;
        created_at: string;
    } | null;
    attendance_history: string[]; // ISO date strings
    workout_plan: {
        name: string;
        description: string;
    } | null;
    calorie_plan: {
        target: number;
    } | null;
    nutrition_history?: {
        date: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    }[];
}

const TrainerMemberDetailScreen: React.FC = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [member, setMember] = useState<MemberDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        if (id) {
            loadMemberDetail();
        }
    }, [id]);

    const loadMemberDetail = async () => {
        try {
            const response = await trainerAPI.getMemberDetail(id as string);
            // Fetch granular nutrition history separately
            try {
                const historyRes = await trainerAPI.getMemberNutritionHistory(id as string);
                setMember({ ...response, nutrition_history: historyRes.history });
            } catch (histErr) {
                console.warn('Failed to load nutrition history', histErr);
                setMember(response);
            }
        } catch (error) {
            console.error('Failed to load member detail:', error);
            toast.error('Error', 'Could not load member details');
        } finally {
            setLoading(false);
        }
    };

    const handleNudge = async (type: string, message: string) => {
        try {
            await trainerAPI.sendNudge(id as string, type, message);
            toast.success('Nudge Sent', `Sent "${message}" to ${member?.name}`);
        } catch (error) {
            console.error('Failed to send nudge:', error);
            toast.error('Error', 'Failed to send nudge');
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!member) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Member not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Member Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <Avatar uri={member.avatar_url} size="xl" />
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{member.streak} 🔥</Text>
                            <Text style={styles.statLabel}>Streak</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{member.xp_points} XP</Text>
                            <Text style={styles.statLabel}>Total XP</Text>
                        </View>
                    </View>
                </View>

                {/* Today's Intent */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Today's Focus</Text>
                    {member.today_intent ? (
                        <GlassCard style={styles.intentCard}>
                            <View style={styles.intentHeader}>
                                <Badge
                                    label={member.today_intent.muscle_group}
                                    variant="primary"
                                    size="md"
                                />
                                <Text style={styles.intentTime}>
                                    {new Date(member.today_intent.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            {member.today_intent.note && (
                                <Text style={styles.intentNote}>{member.today_intent.note}</Text>
                            )}
                        </GlassCard>
                    ) : (
                        <GlassCard style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No workout intent set for today</Text>
                        </GlassCard>
                    )}
                </View>

                {/* Plans */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Active Plans</Text>
                    <View style={styles.plansGrid}>
                        <GlassCard style={styles.planCard}>
                            <View style={styles.planIcon}>
                                <MaterialIcons name="fitness-center" size={24} color={colors.primary} />
                            </View>
                            <Text style={styles.planTitle}>Workout Plan</Text>
                            <Text style={styles.planValue}>
                                {member.workout_plan?.name || "No plan assigned"}
                            </Text>
                        </GlassCard>

                        <GlassCard style={styles.planCard}>
                            <View style={styles.planIcon}>
                                <MaterialIcons name="restaurant" size={24} color={colors.success} />
                            </View>
                            <Text style={styles.planTitle}>Calories</Text>
                            <Text style={styles.planValue}>
                                {member.calorie_plan ? `${member.calorie_plan.target} kcal` : "Not set"}
                            </Text>
                        </GlassCard>
                    </View>
                </View>

                {/* Nutrition History Chart */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Nutrition Trend (14 Days)</Text>
                    <GlassCard style={styles.chartCard}>
                        {/* Placeholder for chart - using simple bars for MVP if no library */}
                        <View style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
                            {member.nutrition_history && member.nutrition_history.length > 0 ? (
                                member.nutrition_history.map((day, i) => {
                                    const maxCals = 3000;
                                    const height = Math.min((day.calories / maxCals) * 100, 100);
                                    return (
                                        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                                            <View style={{ width: 8, height: `${height}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
                                        </View>
                                    )
                                })
                            ) : (
                                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <Text style={{ color: colors.text.muted }}>No sufficient data</Text>
                                </View>
                            )}
                        </View>
                    </GlassCard>
                </View>

                {/* Actions / Nudge */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Coach Actions</Text>
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleNudge('high_five', 'Great job this week! 🔥')}>
                            <View style={[styles.actionIcon, { backgroundColor: '#4ECDC420' }]}>
                                <Text style={{ fontSize: 24 }}>✋</Text>
                            </View>
                            <Text style={styles.actionLabel}>High Five</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleNudge('protein_alert', 'Watch your protein intake! 🥩')}>
                            <View style={[styles.actionIcon, { backgroundColor: '#FF6B6B20' }]}>
                                <Text style={{ fontSize: 24 }}>🥩</Text>
                            </View>
                            <Text style={styles.actionLabel}>Protein Alert</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleNudge('check_in', 'Haven\'t seen you lately! 👀')}>
                            <View style={[styles.actionIcon, { backgroundColor: '#FFEEAD20' }]}>
                                <Text style={{ fontSize: 24 }}>👀</Text>
                            </View>
                            <Text style={styles.actionLabel}>Check In</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Attendance History (Last 7 days simplified) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Attendance</Text>
                    <GlassCard style={styles.attendanceCard}>
                        <View style={styles.attendanceRow}>
                            {[...Array(7)].map((_, i) => {
                                const date = new Date();
                                date.setDate(date.getDate() - (6 - i));
                                const dateStr = date.toISOString().split('T')[0];
                                const isPresent = member.attendance_history.some(d => d.startsWith(dateStr));
                                const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' });

                                return (
                                    <View key={i} style={styles.attendanceDay}>
                                        <Text style={styles.dayName}>{dayName}</Text>
                                        <View style={[
                                            styles.attendanceDot,
                                            isPresent && styles.attendanceDotPresent
                                        ]}>
                                            {isPresent && (
                                                <MaterialIcons name="check" size={12} color={colors.background} />
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </GlassCard>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: colors.text.muted,
        fontSize: typography.sizes.base,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    profileHeader: {
        alignItems: 'center',
        marginVertical: spacing.xl,
    },
    memberName: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginTop: spacing.md,
    },
    memberEmail: {
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
        marginTop: spacing.xs,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        marginTop: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    statValue: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.text.secondary,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: colors.glass.border,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    intentCard: {
        padding: spacing.lg,
    },
    intentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    intentTime: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    intentNote: {
        fontSize: typography.sizes.sm,
        color: colors.text.primary,
        fontStyle: 'italic',
    },
    emptyCard: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    emptyText: {
        color: colors.text.muted,
        fontStyle: 'italic',
    },
    plansGrid: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    planCard: {
        flex: 1,
        padding: spacing.md,
        alignItems: 'center',
    },
    planIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    planTitle: {
        fontSize: typography.sizes.xs,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    planValue: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textAlign: 'center',
    },
    attendanceCard: {
        padding: spacing.lg,
    },
    attendanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    attendanceDay: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    dayName: {
        fontSize: typography.sizes.xs,
        color: colors.text.secondary,
    },
    attendanceDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    attendanceDotPresent: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    chartCard: {
        padding: spacing.lg,
    },
    actionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    actionButton: {
        flex: 1, // Distribute evenly
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    actionLabel: {
        fontSize: typography.sizes.xs,
        fontWeight: 'bold',
        color: colors.text.primary,
        textAlign: 'center',
    },
});

export default TrainerMemberDetailScreen;
