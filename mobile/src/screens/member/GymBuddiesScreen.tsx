import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { friendsAPI, intentAPI, workoutsAPI, caloriesAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface Friend {
    id: string;
    name: string;
    avatar_url: string | null;
    xp_points: number;
    today_intent: {
        training_pattern?: string;
        emphasis?: string[];
        session_label?: string;
        display?: string;
    } | null;
    checked_in_today: boolean;
}

interface FeedItem {
    id: string;
    type: 'workout' | 'calorie' | 'intent';
    user_id: string;
    user_name: string;
    avatar_url: string | null;
    data: any;
    created_at: string;
    liked: boolean;
}

const GymBuddiesScreen: React.FC = () => {
    const toast = useToast();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'feed' | 'friends'>('feed');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showSearch, setShowSearch] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [likedItems, setLikedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [friendsRes, intentFeedRes, workoutFeedRes] = await Promise.all([
                friendsAPI.getFriends(),
                intentAPI.getFeed().catch(() => ({ intents: [] })),
                workoutsAPI.getFeed().catch(() => ({ feed: [] })),
            ]);

            setFriends(friendsRes.friends || []);
            setPendingRequests(friendsRes.pending_requests || []);

            // Combine feeds
            const combinedFeed: FeedItem[] = [];

            // Add intents to feed
            (intentFeedRes.intents || []).forEach((intent: any) => {
                combinedFeed.push({
                    id: `intent-${intent.id}`,
                    type: 'intent',
                    user_id: intent.user.id,
                    user_name: intent.user.name,
                    avatar_url: intent.user.avatar_url,
                    data: intent,
                    created_at: intent.created_at || new Date().toISOString(),
                    liked: false,
                });
            });

            // Add workouts to feed
            (workoutFeedRes.feed || []).forEach((workout: any) => {
                combinedFeed.push({
                    id: `workout-${workout.id}`,
                    type: 'workout',
                    user_id: workout.user_id,
                    user_name: workout.name,
                    avatar_url: workout.avatar_url,
                    data: workout,
                    created_at: workout.created_at,
                    liked: false,
                });
            });

            // Sort by created_at
            combinedFeed.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setFeed(combinedFeed.slice(0, 20)); // Limit to 20 items
        } catch (error) {
            console.error('Failed to load buddies data:', error);
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
            toast.success('Friend added', 'You\'re now gym buddies!');
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
            } catch (error) {
                console.error('Search failed:', error);
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleSendRequest = async (userId: string) => {
        try {
            await friendsAPI.sendRequest(userId);
            // Using Alert temporarily - can be replaced with toast when available
            setSearchQuery('');
            setSearchResults([]);
            setShowSearch(false);
            loadData(); // Refresh to show updated state
        } catch (error: any) {
            console.error('Failed to send request:', error);
        }
    };

    const handleLike = (itemId: string) => {
        setLikedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const formatMuscleGroup = (group: string | undefined, display?: string) => {
        if (display) return display;
        if (!group) return 'Training';
        return group.charAt(0).toUpperCase() + group.slice(1).replace('_', ' ');
    };

    const getTimeAgo = (dateStr: string) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffHrs < 1) return 'Just now';
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        if (diffDays === 1) return 'Yesterday';
        return `${diffDays}d ago`;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>Buddies</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>FRIENDS ONLY</Text>
                    </View>
                    <TouchableOpacity style={styles.filterBtn}>
                        <MaterialIcons name="tune" size={20} color={colors.text.muted} />
                    </TouchableOpacity>
                </View>
                <View style={styles.content}>
                    <SkeletonList count={5} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Refined Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>Buddies</Text>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerSubtitle}>FRIENDS ONLY</Text>
                </View>
                <TouchableOpacity 
                    style={styles.filterBtn}
                    onPress={() => setShowSearch(!showSearch)}
                >
                    <MaterialIcons name={showSearch ? "close" : "tune"} size={20} color={colors.text.muted} />
                </TouchableOpacity>
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

            {/* Tabs */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
                    onPress={() => setActiveTab('feed')}
                >
                    <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>
                        Activity
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
                    onPress={() => setActiveTab('friends')}
                >
                    <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
                        Friends ({friends.length})
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Pending Requests */}
                {pendingRequests.length > 0 && activeTab === 'friends' && (
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

                {/* Activity Feed */}
                {activeTab === 'feed' && (
                    <>
                        {feed.length === 0 ? (
                            <EmptyState
                                variant="no-friends"
                                title="No Activity Yet"
                                description="Add gym buddies to see their workouts and progress!"
                                actionLabel="Find Buddies"
                                onAction={() => router.push('/member/add-buddy' as any)}
                            />
                        ) : (
                            feed.map((item) => (
                                <GlassCard key={item.id} style={styles.feedCard}>
                                    <View style={styles.feedHeader}>
                                        <Avatar uri={item.avatar_url} size="md" />
                                        <View style={styles.feedInfo}>
                                            <Text style={styles.feedName}>{item.user_name}</Text>
                                            <Text style={styles.feedTime}>{getTimeAgo(item.created_at)}</Text>
                                        </View>
                                        {item.type === 'workout' && (
                                            <Badge label="Workout" variant="primary" size="sm" />
                                        )}
                                        {item.type === 'intent' && (
                                            <Badge label="Intent" size="sm" />
                                        )}
                                    </View>

                                    <View style={styles.feedContent}>
                                        {item.type === 'workout' && (
                                            <View style={styles.workoutContent}>
                                                <Text style={styles.workoutType}>
                                                    💪 {formatMuscleGroup(item.data.workout_type)}
                                                </Text>
                                                {item.data.exercises && (
                                                    <Text style={styles.workoutExercises}>{item.data.exercises}</Text>
                                                )}
                                            </View>
                                        )}
                                        {item.type === 'intent' && (
                                            <View style={styles.intentContent}>
                                                <Text style={styles.intentText}>
                                                    🎯 {item.data.display || 'Training'}
                                                </Text>
                                                {item.data.note && (
                                                    <Text style={styles.intentNote}>{item.data.note}</Text>
                                                )}
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.feedActions}>
                                        <TouchableOpacity
                                            style={styles.likeBtn}
                                            onPress={() => handleLike(item.id)}
                                        >
                                            <MaterialIcons
                                                name={likedItems.has(item.id) ? 'favorite' : 'favorite-border'}
                                                size={20}
                                                color={likedItems.has(item.id) ? '#FF4757' : colors.text.muted}
                                            />
                                            <Text style={[
                                                styles.likeText,
                                                likedItems.has(item.id) && styles.likeTextActive
                                            ]}>
                                                {likedItems.has(item.id) ? 'Liked' : 'Like'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.fireBtn}>
                                            <Text style={styles.fireEmoji}>🔥</Text>
                                        </TouchableOpacity>
                                    </View>
                                </GlassCard>
                            ))
                        )}
                    </>
                )}

                {/* Friends List */}
                {activeTab === 'friends' && (
                    <>
                        {friends.length === 0 ? (
                            <EmptyState
                                variant="no-friends"
                                title="No Gym Buddies Yet"
                                description="Find friends to train together and stay motivated!"
                                actionLabel="Add Buddy"
                                onAction={() => router.push('/member/add-buddy' as any)}
                            />
                        ) : (
                            friends.map((friend) => (
                                <GlassCard key={friend.id} style={styles.friendCard}>
                                    <Avatar
                                        uri={friend.avatar_url}
                                        size="lg"
                                        showOnline={friend.checked_in_today}
                                    />
                                    <View style={styles.friendInfo}>
                                        <Text style={styles.friendName}>{friend.name}</Text>
                                        <View style={styles.friendMeta}>
                                            <Text style={styles.friendXP}>{friend.xp_points} XP</Text>
                                            {friend.today_intent && (
                                                <Badge
                                                    label={friend.today_intent.display || 'Training'}
                                                    size="sm"
                                                    variant="primary"
                                                />
                                            )}
                                        </View>
                                    </View>
                                    {friend.checked_in_today && (
                                        <View style={styles.atGymBadge}>
                                            <Text style={styles.atGymText}>At Gym</Text>
                                        </View>
                                    )}
                                </GlassCard>
                            ))
                        )}
                    </>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: colors.text.muted,
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
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    pendingBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: colors.primary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingBadgeText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
    },
    searchContainer: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
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
    tabRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surface,
    },
    tabActive: {
        backgroundColor: colors.primary,
    },
    tabText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
    },
    tabTextActive: {
        color: colors.background,
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
    emptyCard: {
        alignItems: 'center',
        paddingVertical: spacing['2xl'],
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    emptySubtext: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        textAlign: 'center',
    },
    feedCard: {
        marginBottom: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius['2xl'],
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.lg,
    },
    feedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    feedAvatar: {
        opacity: 0.9,
    },
    feedInfo: {
        flex: 1,
    },
    feedName: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    feedTime: {
        fontSize: typography.sizes.xs,
        color: colors.text.subtle,
        marginTop: 2,
        letterSpacing: 0.5,
    },
    feedContent: {
        marginBottom: spacing.md,
    },
    workoutContent: {
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    workoutType: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    workoutExercises: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        marginTop: spacing.xs,
        letterSpacing: 0.3,
    },
    intentContent: {
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    intentText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    intentNote: {
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
        marginTop: spacing.xs,
        fontStyle: 'italic',
    },
    feedActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    likeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    likeText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 0.5,
    },
    likeTextActive: {
        color: '#FF4757',
    },
    fireBtn: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    fireEmoji: {
        fontSize: 14,
    },
    commentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
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
    friendXP: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    atGymBadge: {
        backgroundColor: colors.success,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.lg,
    },
    atGymText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
    },
});

export default GymBuddiesScreen;
