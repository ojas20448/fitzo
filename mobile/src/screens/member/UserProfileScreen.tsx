import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { friendsAPI, buddyActivityAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

type FriendshipStatus = 'none' | 'friend' | 'pending_sent' | 'pending_received' | 'blocked';

interface BuddyData {
    can_view: boolean;
    friend: {
        id: string;
        name: string;
        avatar_url: string | null;
        xp_points: number;
    };
    today: {
        intent: { display: string } | null;
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
    };
}

export default function UserProfileScreen() {
    const params = useLocalSearchParams<{
        userId: string;
        userName: string;
        userAvatar: string;
    }>();

    const userId = params.userId;
    const userName = params.userName || 'User';
    const userAvatar = params.userAvatar || null;

    const [status, setStatus] = useState<FriendshipStatus>('none');
    const [buddyData, setBuddyData] = useState<BuddyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        if (!userId) return;
        try {
            const [statusRes, activityRes] = await Promise.all([
                friendsAPI.getFriendshipStatus(userId).catch(() => ({ status: 'none' })),
                buddyActivityAPI.getActivity(userId).catch(() => null),
            ]);

            setStatus(statusRes.status as FriendshipStatus);
            if (activityRes) setBuddyData(activityRes);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleAddFriend = async () => {
        setActionLoading(true);
        try {
            const res = await friendsAPI.sendRequest(userId);
            if (res.status === 'accepted') {
                setStatus('friend');
            } else {
                setStatus('pending_sent');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to send request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcceptRequest = async () => {
        setActionLoading(true);
        try {
            await friendsAPI.acceptRequest(userId);
            setStatus('friend');
            loadData(); // reload activity
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to accept');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFriend = async () => {
        Alert.alert(
            'Remove Friend',
            `Remove ${userName} from your gym buddies?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            await friendsAPI.removeFriend(userId);
                            setStatus('none');
                            setBuddyData(null);
                        } catch (e: any) {
                            Alert.alert('Error', e.message || 'Failed');
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleBlock = async () => {
        Alert.alert(
            'Block User',
            `Block ${userName}? They won't be able to see your activity or send you friend requests.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            await friendsAPI.blockUser(userId);
                            setStatus('blocked');
                            setBuddyData(null);
                        } catch (e: any) {
                            Alert.alert('Error', e.message || 'Failed');
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/' as any);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const isFriend = status === 'friend';
    const activity = buddyData?.today;
    const xp = buddyData?.friend?.xp_points ?? 0;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{userName}</Text>
                <TouchableOpacity onPress={handleBlock} style={styles.backBtn} disabled={status === 'blocked'}>
                    <MaterialIcons name="more-vert" size={24} color={colors.text.muted} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {/* Profile Card */}
                <View style={styles.profileSection}>
                    <Avatar uri={userAvatar} name={userName} size="xl" showOnline={activity?.checked_in} />
                    <Text style={styles.profileName}>{userName}</Text>
                    {xp > 0 && (
                        <View style={styles.xpRow}>
                            <MaterialIcons name="star" size={16} color={colors.primary} />
                            <Text style={styles.xpText}>{xp} XP</Text>
                        </View>
                    )}
                    {activity?.checked_in && (
                        <View style={styles.atGymBadge}>
                            <MaterialIcons name="location-on" size={14} color={colors.success} />
                            <Text style={styles.atGymText}>At Gym Now</Text>
                        </View>
                    )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                    {status === 'none' && (
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={handleAddFriend}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <ActivityIndicator size="small" color={colors.text.dark} />
                            ) : (
                                <>
                                    <MaterialIcons name="person-add" size={18} color={colors.text.dark} />
                                    <Text style={styles.primaryBtnText}>Add Friend</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {status === 'pending_sent' && (
                        <View style={styles.secondaryBtn}>
                            <MaterialIcons name="hourglass-empty" size={18} color={colors.text.secondary} />
                            <Text style={styles.secondaryBtnText}>Request Sent</Text>
                        </View>
                    )}

                    {status === 'pending_received' && (
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={handleAcceptRequest}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <ActivityIndicator size="small" color={colors.text.dark} />
                            ) : (
                                <>
                                    <MaterialIcons name="check" size={18} color={colors.text.dark} />
                                    <Text style={styles.primaryBtnText}>Accept Request</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {status === 'friend' && (
                        <>
                            <View style={[styles.secondaryBtn, { flex: 1 }]}>
                                <MaterialIcons name="check-circle" size={18} color={colors.success} />
                                <Text style={[styles.secondaryBtnText, { color: colors.success }]}>Friends</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.outlineBtn, { flex: 1 }]}
                                onPress={handleRemoveFriend}
                                disabled={actionLoading}
                            >
                                <MaterialIcons name="person-remove" size={18} color={colors.error} />
                                <Text style={[styles.outlineBtnText, { color: colors.error }]}>Remove</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {status === 'blocked' && (
                        <View style={[styles.secondaryBtn, { borderColor: 'rgba(239,68,68,0.3)' }]}>
                            <MaterialIcons name="block" size={18} color={colors.error} />
                            <Text style={[styles.secondaryBtnText, { color: colors.error }]}>Blocked</Text>
                        </View>
                    )}
                </View>

                {/* Block option for non-blocked states */}
                {status !== 'blocked' && (
                    <TouchableOpacity style={styles.blockLink} onPress={handleBlock}>
                        <MaterialIcons name="block" size={14} color={colors.text.muted} />
                        <Text style={styles.blockLinkText}>Block this user</Text>
                    </TouchableOpacity>
                )}

                {/* Today's Activity - only for friends */}
                {isFriend && activity && buddyData?.can_view && (
                    <View style={styles.activitySection}>
                        <Text style={styles.sectionTitle}>TODAY'S ACTIVITY</Text>

                        {/* Intent */}
                        {activity.intent && (
                            <GlassCard style={styles.card}>
                                <View style={styles.intentRow}>
                                    <MaterialIcons name="fitness-center" size={20} color={colors.primary} />
                                    <Text style={styles.intentText}>{activity.intent.display}</Text>
                                </View>
                            </GlassCard>
                        )}

                        {/* Workouts */}
                        {activity.workouts.length > 0 && (
                            <>
                                <Text style={styles.subLabel}>Workouts</Text>
                                {activity.workouts.map((w) => (
                                    <GlassCard key={w.id} style={styles.card}>
                                        <Text style={styles.workoutType}>{w.type.toUpperCase()}</Text>
                                        {w.exercises && <Text style={styles.exercisesText}>{w.exercises}</Text>}
                                        {w.notes && <Text style={styles.notesText}>"{w.notes}"</Text>}
                                    </GlassCard>
                                ))}
                            </>
                        )}

                        {/* Nutrition Summary */}
                        {activity.food.meals.length > 0 && (
                            <>
                                <Text style={styles.subLabel}>Nutrition</Text>
                                <GlassCard style={styles.nutritionCard}>
                                    <View style={styles.macroGrid}>
                                        <View style={styles.macroItem}>
                                            <Text style={styles.macroValue}>{activity.food.total_calories}</Text>
                                            <Text style={styles.macroLabel}>kcal</Text>
                                        </View>
                                        <View style={styles.macroItem}>
                                            <Text style={styles.macroValue}>{activity.food.total_protein}g</Text>
                                            <Text style={styles.macroLabel}>Protein</Text>
                                        </View>
                                        <View style={styles.macroItem}>
                                            <Text style={styles.macroValue}>{activity.food.total_carbs}g</Text>
                                            <Text style={styles.macroLabel}>Carbs</Text>
                                        </View>
                                        <View style={styles.macroItem}>
                                            <Text style={styles.macroValue}>{activity.food.total_fat}g</Text>
                                            <Text style={styles.macroLabel}>Fat</Text>
                                        </View>
                                    </View>
                                </GlassCard>

                                {activity.food.meals.map((meal) => (
                                    <GlassCard key={meal.id} style={styles.card}>
                                        <View style={styles.mealRow}>
                                            <Text style={styles.mealName}>{meal.name}</Text>
                                            <Text style={styles.mealCal}>{meal.calories} cal</Text>
                                        </View>
                                        <Text style={styles.mealMacros}>
                                            P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g
                                        </Text>
                                    </GlassCard>
                                ))}
                            </>
                        )}

                        {/* Empty state */}
                        {!activity.intent && activity.workouts.length === 0 && activity.food.meals.length === 0 && (
                            <GlassCard style={styles.emptyCard}>
                                <MaterialIcons name="today" size={36} color={colors.text.muted} />
                                <Text style={styles.emptyText}>No activity today</Text>
                            </GlassCard>
                        )}
                    </View>
                )}

                {/* Private logs notice */}
                {isFriend && buddyData && !buddyData.can_view && (
                    <View style={styles.activitySection}>
                        <GlassCard style={styles.privateCard}>
                            <MaterialIcons name="lock" size={32} color={colors.text.muted} />
                            <Text style={styles.privateTitle}>Logs are Private</Text>
                            <Text style={styles.privateText}>
                                {userName} hasn't shared their workout and meal logs.
                            </Text>
                        </GlassCard>
                    </View>
                )}

                {/* Not friends notice */}
                {!isFriend && status !== 'blocked' && (
                    <View style={styles.activitySection}>
                        <GlassCard style={styles.privateCard}>
                            <MaterialIcons name="people-outline" size={32} color={colors.text.muted} />
                            <Text style={styles.privateTitle}>Add as friend</Text>
                            <Text style={styles.privateText}>
                                Become gym buddies to see {userName}'s workouts and nutrition.
                            </Text>
                        </GlassCard>
                    </View>
                )}

                <View style={{ height: 60 }} />
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
        width: 40,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    scroll: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Profile
    profileSection: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.sm,
    },
    profileName: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginTop: spacing.md,
    },
    xpRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    xpText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    atGymBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(34,197,94,0.1)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    atGymText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.success,
    },

    // Actions
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    primaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: borderRadius.full,
    },
    primaryBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        paddingVertical: 14,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.full,
    },
    secondaryBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
    },
    outlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        paddingVertical: 14,
        borderRadius: borderRadius.full,
    },
    outlineBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
    },
    blockLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        marginBottom: spacing.lg,
    },
    blockLinkText: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
    },

    // Activity
    activitySection: {
        marginTop: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.md,
    },
    subLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    card: {
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    intentRow: {
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
    workoutType: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    exercisesText: {
        fontSize: typography.sizes.sm,
        color: colors.text.primary,
    },
    notesText: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        fontStyle: 'italic',
        marginTop: spacing.xs,
    },

    // Nutrition
    nutritionCard: {
        padding: spacing.lg,
        marginBottom: spacing.sm,
    },
    macroGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    macroItem: {
        alignItems: 'center',
        gap: 2,
    },
    macroValue: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    macroLabel: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    mealRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mealName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    mealCal: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    mealMacros: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },

    // Empty / Private
    emptyCard: {
        padding: spacing.xl,
        alignItems: 'center',
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.sizes.base,
        color: colors.text.muted,
    },
    privateCard: {
        padding: spacing.xl,
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
