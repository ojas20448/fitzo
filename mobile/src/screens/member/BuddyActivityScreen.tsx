import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { buddyActivityAPI } from '../../services/api';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';

interface BuddyActivity {
    can_view: boolean;
    blocked_reason: string | null;
    friend: {
        id: string;
        name: string;
        avatar_url: string;
        xp_points: number;
        shares_logs_by_default: boolean;
    };
    today: {
        intent: {
            training_pattern: string;
            emphasis: string[];
            session_label: string;
            display: string;
        } | null;
        workouts: Array<{
            id: string;
            type: string;
            exercises: string;
            notes: string;
            logged_at: string;
        }>;
        food: {
            total_calories: number;
            total_protein: number;
            total_carbs: number;
            total_fat: number;
            meals: Array<{
                id: string;
                name: string;
                calories: number;
                protein: number;
                carbs: number;
                fat: number;
                logged_at: string;
            }>;
        };
        checked_in: boolean;
        checked_in_at: string | null;
    };
}

const BuddyActivityScreen = () => {
    const { friendId } = useLocalSearchParams<{ friendId: string }>();
    const [activity, setActivity] = useState<BuddyActivity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBuddyActivity();
    }, [friendId]);

    const fetchBuddyActivity = async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await buddyActivityAPI.getActivity(friendId);
            setActivity(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load buddy activity');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !activity) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Buddy Activity</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centerContent}>
                    <MaterialIcons name="error-outline" size={48} color={colors.error} />
                    <Text style={styles.errorText}>{error || 'Failed to load'}</Text>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={fetchBuddyActivity}
                    >
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const { friend, today } = activity;
    const canView = activity.can_view;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{friend.name}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Friend Info Card */}
                <GlassCard style={styles.friendCard}>
                    <View style={styles.friendHeader}>
                        <View style={styles.avatarContainer}>
                            <Text style={styles.avatarText}>
                                {friend.name.slice(0, 2).toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.friendInfo}>
                            <Text style={styles.friendName}>{friend.name}</Text>
                            <View style={styles.xpBadge}>
                                <MaterialIcons name="star" size={14} color={colors.primary} />
                                <Text style={styles.xpText}>{friend.xp_points} XP</Text>
                            </View>
                        </View>
                        {today.checked_in && (
                            <View style={styles.checkinBadge}>
                                <MaterialIcons name="check-circle" size={20} color={colors.success} />
                                <Text style={styles.checkinText}>At Gym</Text>
                            </View>
                        )}
                    </View>
                </GlassCard>

                {!canView ? (
                    // Private logs message
                    <GlassCard style={styles.privateCard}>
                        <View style={styles.privateContent}>
                            <MaterialIcons name="lock" size={40} color={colors.text.muted} />
                            <Text style={styles.privateTitle}>Logs are Private</Text>
                            <Text style={styles.privateText}>
                                {friend.name} hasn't shared their workout and meal logs with you.
                            </Text>
                            <Text style={styles.privateSubtext}>
                                You can still see their workout intent and check-in status.
                            </Text>
                        </View>
                    </GlassCard>
                ) : (
                    <>
                        {/* Workout Intent */}
                        {today.intent && (
                            <View>
                                <Text style={styles.sectionTitle}>Today's Plan</Text>
                                <GlassCard style={styles.card}>
                                    <View style={styles.intentContainer}>
                                        <MaterialIcons name="fitness-center" size={24} color={colors.primary} />
                                        <Text style={styles.intentText}>{today.intent.display}</Text>
                                    </View>
                                </GlassCard>
                            </View>
                        )}

                        {/* Workouts */}
                        {today.workouts.length > 0 && (
                            <View>
                                <Text style={styles.sectionTitle}>Workouts</Text>
                                {today.workouts.map((workout) => (
                                    <GlassCard key={workout.id} style={styles.card}>
                                        <View style={styles.workoutItem}>
                                            <View style={styles.workoutHeader}>
                                                <Text style={styles.workoutType}>
                                                    {workout.type.toUpperCase()}
                                                </Text>
                                                <Text style={styles.logTime}>
                                                    {new Date(workout.logged_at).toLocaleTimeString()}
                                                </Text>
                                            </View>
                                            {workout.exercises && (
                                                <Text style={styles.exercisesText}>
                                                    {workout.exercises}
                                                </Text>
                                            )}
                                            {workout.notes && (
                                                <Text style={styles.notesText}>
                                                    {workout.notes}
                                                </Text>
                                            )}
                                        </View>
                                    </GlassCard>
                                ))}
                            </View>
                        )}

                        {/* Food Summary */}
                        {today.food.meals.length > 0 && (
                            <View>
                                <Text style={styles.sectionTitle}>Nutrition</Text>
                                <GlassCard style={styles.nutritionSummary}>
                                    <View style={styles.macroRow}>
                                        <MacroCard
                                            label="Calories"
                                            value={today.food.total_calories}
                                            unit="kcal"
                                            icon="local-fire-department"
                                            color={colors.error}
                                        />
                                        <MacroCard
                                            label="Protein"
                                            value={today.food.total_protein}
                                            unit="g"
                                            icon="egg"
                                            color={colors.primary}
                                        />
                                    </View>
                                    <View style={styles.macroRow}>
                                        <MacroCard
                                            label="Carbs"
                                            value={today.food.total_carbs}
                                            unit="g"
                                            icon="grain"
                                            color={colors.warning}
                                        />
                                        <MacroCard
                                            label="Fat"
                                            value={today.food.total_fat}
                                            unit="g"
                                            icon="opacity"
                                            color={colors.info}
                                        />
                                    </View>
                                </GlassCard>

                                {/* Meals List */}
                                {today.food.meals.map((meal) => (
                                    <GlassCard key={meal.id} style={styles.card}>
                                        <View style={styles.mealItem}>
                                            <View style={styles.mealHeader}>
                                                <Text style={styles.mealName}>{meal.name}</Text>
                                                <Text style={styles.mealCalories}>{meal.calories} cal</Text>
                                            </View>
                                            <View style={styles.mealMacros}>
                                                <Text style={styles.mealMacroText}>
                                                    P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g
                                                </Text>
                                                <Text style={styles.logTime}>
                                                    {new Date(meal.logged_at).toLocaleTimeString()}
                                                </Text>
                                            </View>
                                        </View>
                                    </GlassCard>
                                ))}
                            </View>
                        )}

                        {today.workouts.length === 0 && today.food.meals.length === 0 && !today.intent && (
                            <GlassCard style={styles.emptyCard}>
                                <MaterialIcons name="today" size={40} color={colors.text.muted} />
                                <Text style={styles.emptyText}>No activity today</Text>
                            </GlassCard>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const MacroCard = ({ label, value, unit, icon, color }: any) => (
    <View style={styles.macroCard}>
        <MaterialIcons name={icon} size={20} color={color} />
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{value}</Text>
        <Text style={styles.macroUnit}>{unit}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backBtn: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    errorText: {
        fontSize: typography.sizes.base,
        color: colors.text.muted,
        textAlign: 'center',
    },
    retryBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
    },
    retryBtnText: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
    },
    friendCard: {
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    friendHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    avatarContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },
    friendInfo: {
        flex: 1,
        gap: spacing.xs,
    },
    friendName: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    xpText: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        fontFamily: typography.fontFamily.medium,
    },
    checkinBadge: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    checkinText: {
        fontSize: typography.sizes.xs,
        color: colors.success,
        fontFamily: typography.fontFamily.bold,
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        letterSpacing: 0.5,
    },
    card: {
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    intentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    intentText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        flex: 1,
    },
    workoutItem: {
        gap: spacing.sm,
    },
    workoutHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    workoutType: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    logTime: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    exercisesText: {
        fontSize: typography.sizes.sm,
        color: colors.text.primary,
        marginTop: spacing.sm,
    },
    notesText: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        fontStyle: 'italic',
        marginTop: spacing.xs,
    },
    nutritionSummary: {
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    macroRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    macroCard: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.xs,
        padding: spacing.md,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.sm,
    },
    macroLabel: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    macroValue: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    macroUnit: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    mealItem: {
        gap: spacing.sm,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mealName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    mealCalories: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    mealMacros: {
        gap: spacing.xs,
    },
    mealMacroText: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    privateCard: {
        padding: spacing.xl,
        marginVertical: spacing.xl,
        alignItems: 'center',
    },
    privateContent: {
        alignItems: 'center',
        gap: spacing.md,
    },
    privateTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    privateText: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        textAlign: 'center',
    },
    privateSubtext: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    emptyCard: {
        padding: spacing.xl,
        alignItems: 'center',
        gap: spacing.md,
        marginVertical: spacing.xl,
    },
    emptyText: {
        fontSize: typography.sizes.base,
        color: colors.text.muted,
    },
});

export default BuddyActivityScreen;
