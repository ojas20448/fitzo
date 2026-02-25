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
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, borderRadius } from '../../src/styles/theme';
import GlassCard from '../../src/components/GlassCard';

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

export default function BuddyActivityScreen() {
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

            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                setError('Authentication required');
                return;
            }

            const response = await fetch(
                `http://localhost:3000/api/buddy-activity/${friendId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load buddy activity');
            }

            const data = await response.json();
            setActivity(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
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
                    <Text style={styles.headerTitle}>Activity</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centerContent}>
                    <MaterialIcons name="error-outline" size={48} color={colors.error} />
                    <Text style={styles.errorText}>{error || 'Failed to load'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const { friend, today } = activity;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{friend.name}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                            </View>
                        )}
                    </View>
                </GlassCard>

                {!activity.can_view ? (
                    <GlassCard style={styles.privateCard}>
                        <MaterialIcons name="lock" size={40} color={colors.text.muted} />
                        <Text style={styles.privateTitle}>Logs are Private</Text>
                        <Text style={styles.privateText}>
                            {friend.name} hasn't shared their logs yet.
                        </Text>
                    </GlassCard>
                ) : (
                    <>
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

                        {today.workouts.length > 0 && (
                            <View>
                                <Text style={styles.sectionTitle}>Workouts</Text>
                                {today.workouts.map((workout) => (
                                    <GlassCard key={workout.id} style={styles.card}>
                                        <Text style={styles.workoutType}>{workout.type.toUpperCase()}</Text>
                                        {workout.exercises && (
                                            <Text style={styles.exercisesText}>{workout.exercises}</Text>
                                        )}
                                    </GlassCard>
                                ))}
                            </View>
                        )}

                        {today.food.meals.length > 0 && (
                            <View>
                                <Text style={styles.sectionTitle}>Nutrition</Text>
                                <GlassCard style={styles.nutritionCard}>
                                    <Text style={styles.calorieText}>
                                        {today.food.total_calories} kcal
                                    </Text>
                                    <Text style={styles.macroText}>
                                        P: {today.food.total_protein}g | C: {today.food.total_carbs}g | F: {today.food.total_fat}g
                                    </Text>
                                </GlassCard>
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

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
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
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
    },
    workoutType: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    exercisesText: {
        fontSize: typography.sizes.sm,
        color: colors.text.primary,
        marginTop: spacing.sm,
    },
    nutritionCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
        alignItems: 'center',
        gap: spacing.md,
    },
    calorieText: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    macroText: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
    },
    privateCard: {
        padding: spacing.xl,
        marginVertical: spacing.xl,
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
});
