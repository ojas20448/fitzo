import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { memberAPI, workoutsAPI } from '../../services/api';

const SquadFeedScreen = () => {
    const [feed, setFeed] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadFeed();
    }, []);

    const loadFeed = async () => {
        try {
            const data = await workoutsAPI.getFeed();
            if (data?.feed) {
                const mappedFeed = data.feed.map((item: any) => ({
                    id: item.id,
                    user: item.name,
                    avatar: item.avatar_url,
                    action: 'completed a workout',
                    detail: `${item.workout_type} • ${item.exercises ? JSON.parse(item.exercises).length + ' exercises' : 'No details'}`,
                    time: new Date(item.created_at).toLocaleDateString(), // Simplification
                    likes: 0, // Backend doesn't return likes yet
                    type: 'workout'
                }));
                setFeed(mappedFeed);
            }
        } catch (error) {
            console.error('Failed to load feed:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadFeed();
    };

    const renderItem = ({ item }: { item: any }) => (
        <GlassCard style={styles.feedItem}>
            <View style={styles.feedHeader}>
                <Avatar name={item.user} size="md" uri={item.avatar} />
                <View style={styles.feedText}>
                    <Text style={styles.feedTitle}>
                        <Text style={styles.userName}>{item.user}</Text> {item.action}
                    </Text>
                    <Text style={styles.feedTime}>{item.time}</Text>
                </View>
            </View>

            {item.detail ? (
                <View style={styles.feedContent}>
                    <View style={[styles.iconBox, item.type === 'pr' && styles.prIcon]}>
                        <MaterialIcons
                            name={item.type === 'workout' ? 'fitness-center' : item.type === 'pr' ? 'emoji-events' : 'school'}
                            size={20}
                            color={item.type === 'pr' ? '#FFD700' : colors.primary}
                        />
                    </View>
                    <Text style={styles.feedDetail}>{item.detail}</Text>
                </View>
            ) : null}

            <View style={styles.feedActions}>
                <TouchableOpacity style={styles.actionBtn}>
                    <MaterialIcons name="favorite-border" size={20} color={colors.text.muted} />
                    <Text style={styles.actionText}>{item.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                    <MaterialIcons name="chat-bubble-outline" size={20} color={colors.text.muted} />
                </TouchableOpacity>
            </View>
        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Squad Feed</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={feed}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                ListHeaderComponent={() => (
                    <Text style={styles.feedSubtitle}>Recent Activity</Text>
                )}
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
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    listContent: {
        padding: spacing.lg,
    },
    feedSubtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.lg,
        marginLeft: spacing.xs,
    },
    feedItem: {
        marginBottom: spacing.lg,
        padding: spacing.lg,
    },
    feedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    feedText: {
        flex: 1,
    },
    userName: {
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    feedTitle: {
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    feedTime: {
        fontSize: 10,
        color: colors.text.muted,
        marginTop: 2,
    },
    feedContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.glass.surfaceLight,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    prIcon: {
        backgroundColor: '#FFD70020',
    },
    feedDetail: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    feedActions: {
        flexDirection: 'row',
        gap: spacing.xl,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionText: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
    },
});

export default SquadFeedScreen;
