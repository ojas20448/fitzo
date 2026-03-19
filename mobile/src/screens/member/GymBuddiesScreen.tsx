import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { friendsAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

interface Friend {
    id: string;
    name: string;
    avatar_url: string | null;
    xp_points: number;
    streak: number;
    last_workout_date: string | null;
    last_workout_type: string | null;
    worked_out_today: boolean;
    logged_food_today: boolean;
    checked_in_today: boolean;
}

const GymBuddiesScreen: React.FC = () => {
    const toast = useToast();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [suggested, setSuggested] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showSearch, setShowSearch] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [nudgingId, setNudgingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        try {
            const [friendsRes, suggestedRes] = await Promise.all([
                friendsAPI.getFriends().catch(() => ({ friends: [], pending_requests: [], sent_requests: [] })),
                friendsAPI.getSuggested(5).catch(() => ({ suggested: [] })),
            ]);

            setFriends(friendsRes.friends || []);
            setPendingRequests(friendsRes.pending_requests || []);
            setSuggested(suggestedRes.suggested || []);
        } catch (error: any) {
            toast.error('Error', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleAcceptRequest = async (friendId: string) => {
        try {
            await friendsAPI.acceptRequest(friendId);
            toast.success('Friend added', "You're now gym buddies!");
            await loadData();
        } catch (error: any) {
            toast.error('Failed to accept request', error.message);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length >= 2) {
            try {
                const result = await friendsAPI.search(query);
                setSearchResults(result.users || []);
            } catch (error: any) {
                toast.error('Error', error.message || 'Something went wrong');
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleSendRequest = async (userId: string) => {
        try {
            await friendsAPI.sendRequest(userId);
            toast.success('Request sent', 'Friend request sent successfully!');
            setSearchQuery('');
            setSearchResults([]);
            setShowSearch(false);
            setSuggested(prev => prev.filter(u => u.id !== userId));
            loadData();
        } catch (error: any) {
            toast.error('Failed', 'Could not send friend request');
        }
    };

    const handleNudge = async (friendId: string, friendName: string) => {
        setNudgingId(friendId);
        try {
            await friendsAPI.sendNudge(friendId);
            toast.success('Nudge sent!', `${friendName} will get a push notification`);
        } catch (error: any) {
            const msg = error?.response?.data?.error || error.message || 'Could not send nudge';
            toast.error('Nudge failed', msg);
        } finally {
            setNudgingId(null);
        }
    };

    const getDaysAgo = (dateStr: string | null) => {
        if (!dateStr) return null;
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        return `${diffDays}d ago`;
    };

    const formatWorkoutType = (type: string | null) => {
        if (!type) return '';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    const getFriendStatus = (friend: Friend): { label: string; color: string } => {
        if (friend.worked_out_today) return { label: 'Worked out today', color: colors.success };
        if (friend.logged_food_today) return { label: 'Logged food today', color: colors.primary };
        return { label: 'Inactive today', color: colors.text.subtle };
    };

    const shouldShowNudge = (friend: Friend): boolean => {
        if (friend.worked_out_today || friend.logged_food_today) return false;
        if (!friend.last_workout_date) return true;
        const daysSince = Math.floor(
            (Date.now() - new Date(friend.last_workout_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSince >= 3;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>Friends</Text>
                    </View>
                </View>
                <View style={styles.content}>
                    <SkeletonList count={5} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>Friends</Text>
                    {friends.length > 0 && (
                        <>
                            <View style={styles.headerDot} />
                            <Text style={styles.headerSubtitle}>{friends.length}</Text>
                        </>
                    )}
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.filterBtn}
                        onPress={() => router.push('/member/add-buddy?tab=scan' as any)}
                    >
                        <MaterialIcons name="qr-code-scanner" size={22} color={colors.text.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.filterBtn}
                        onPress={() => setShowSearch(!showSearch)}
                    >
                        <MaterialIcons name={showSearch ? "close" : "person-add"} size={22} color={colors.text.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Bar */}
            {showSearch && (
                <View style={styles.searchContainer}>
                    <GlassCard style={styles.searchCard}>
                        <MaterialIcons name="search" size={20} color={colors.text.muted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Find gym buddies..."
                            placeholderTextColor={colors.text.muted}
                            value={searchQuery}
                            onChangeText={handleSearch}
                            autoFocus
                        />
                    </GlassCard>

                    {searchResults.length > 0 && (
                        <View style={styles.searchResults}>
                            {searchResults.map((user) => (
                                <TouchableOpacity
                                    key={user.id}
                                    style={styles.searchResultItem}
                                    onPress={() => handleSendRequest(user.id)}
                                >
                                    <Avatar uri={user.avatar_url} size="sm" />
                                    <Text style={styles.searchResultName}>{user.name}</Text>
                                    <MaterialIcons name="person-add" size={20} color={colors.primary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            )}

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Suggested Friends */}
                {suggested.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Suggested For You</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedList}>
                            {suggested.map((user) => (
                                <GlassCard key={user.id} style={styles.suggestedCard}>
                                    <Avatar uri={user.avatar_url} size="md" />
                                    <Text style={styles.suggestedName} numberOfLines={1}>{user.name}</Text>
                                    {user.last_checkin && (
                                        <Text style={styles.suggestedSubtext}>Recently at gym</Text>
                                    )}
                                    <TouchableOpacity
                                        style={styles.addSuggestedBtn}
                                        onPress={() => handleSendRequest(user.id)}
                                    >
                                        <MaterialIcons name="person-add" size={16} color={colors.text.primary} />
                                        <Text style={styles.addSuggestedText}>Add</Text>
                                    </TouchableOpacity>
                                </GlassCard>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Pending Requests */}
                {pendingRequests.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Friend Requests</Text>
                        {pendingRequests.map((request) => (
                            <GlassCard key={request.id} style={styles.requestCard}>
                                <View style={styles.requestInfo}>
                                    <Avatar uri={request.avatar_url} size="md" />
                                    <View style={styles.requestText}>
                                        <Text style={styles.requestName}>{request.name}</Text>
                                        <Text style={styles.requestTime}>Wants to be your gym buddy</Text>
                                    </View>
                                </View>
                                <View style={styles.requestActions}>
                                    <TouchableOpacity
                                        style={styles.acceptBtn}
                                        onPress={() => handleAcceptRequest(request.id)}
                                    >
                                        <MaterialIcons name="check" size={20} color={colors.background} />
                                    </TouchableOpacity>
                                </View>
                            </GlassCard>
                        ))}
                    </View>
                )}

                {/* Friends List */}
                {friends.length === 0 ? (
                    <EmptyState
                        variant="no-friends"
                        title="No Gym Buddies Yet"
                        message="Find friends to train together and stay motivated!"
                        actionLabel="Add Buddy"
                        onAction={() => setShowSearch(true)}
                    />
                ) : (
                    friends.map((friend) => {
                        const status = getFriendStatus(friend);
                        const showNudge = shouldShowNudge(friend);

                        return (
                            <GlassCard key={friend.id} style={styles.friendCard}>
                                <TouchableOpacity
                                    style={styles.friendTap}
                                    onPress={() => router.push({
                                        pathname: '/member/user-profile',
                                        params: { userId: friend.id, userName: friend.name, userAvatar: friend.avatar_url || '' }
                                    })}
                                    activeOpacity={0.7}
                                >
                                    <Avatar
                                        uri={friend.avatar_url}
                                        size="lg"
                                        showOnline={friend.worked_out_today || friend.logged_food_today}
                                    />
                                    <View style={styles.friendInfo}>
                                        <Text style={styles.friendName}>{friend.name}</Text>
                                        <View style={styles.friendMeta}>
                                            {friend.streak > 0 && (
                                                <View style={styles.streakBadge}>
                                                    <Text style={styles.streakText}>{friend.streak}d streak</Text>
                                                </View>
                                            )}
                                            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                                            <Text style={styles.statusText}>{status.label}</Text>
                                        </View>
                                        {friend.last_workout_date && (
                                            <Text style={styles.lastWorkout}>
                                                Last: {formatWorkoutType(friend.last_workout_type)} {getDaysAgo(friend.last_workout_date)}
                                            </Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                                {showNudge && (
                                    <TouchableOpacity
                                        style={[styles.nudgeBtn, nudgingId === friend.id && styles.nudgeBtnDisabled]}
                                        onPress={() => handleNudge(friend.id, friend.name)}
                                        disabled={nudgingId === friend.id}
                                    >
                                        <MaterialIcons name="notifications-active" size={18} color={colors.background} />
                                    </TouchableOpacity>
                                )}
                            </GlassCard>
                        );
                    })
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
        textTransform: 'uppercase',
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
    filterBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    searchContainer: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
    },
    searchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
    },
    searchInput: {
        flex: 1,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.base,
    },
    searchResults: {
        marginTop: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.sm,
    },
    searchResultName: {
        flex: 1,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.xl,
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
    suggestedList: {
        gap: spacing.md,
        paddingRight: spacing.xl,
    },
    suggestedCard: {
        width: 140,
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.sm,
    },
    suggestedName: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        textAlign: 'center',
    },
    suggestedSubtext: {
        fontSize: 10,
        color: colors.text.muted,
        textAlign: 'center',
    },
    addSuggestedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.glass.surfaceLight,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        marginTop: 4,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    addSuggestedText: {
        fontSize: 11,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    requestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    requestInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
    },
    requestText: {
        flex: 1,
    },
    requestName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    requestTime: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    requestActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    acceptBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
        padding: spacing.md,
    },
    friendTap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    friendMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    streakBadge: {
        backgroundColor: 'rgba(255, 149, 0, 0.15)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    streakText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: '#FF9500',
        letterSpacing: 0.5,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    lastWorkout: {
        fontSize: 10,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.subtle,
        marginTop: 2,
    },
    nudgeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nudgeBtnDisabled: {
        opacity: 0.5,
    },
});

export default GymBuddiesScreen;
