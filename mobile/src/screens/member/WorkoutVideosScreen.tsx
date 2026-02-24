import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    TextInput,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';
import { videoAPI } from '../../services/api';

export default function WorkoutVideosScreen() {
    const [videos, setVideos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'trending' | 'search'>('trending');

    useEffect(() => {
        loadTrendingVideos();
    }, []);

    const loadTrendingVideos = async () => {
        setLoading(true);
        try {
            const response = await videoAPI.getTrending(20);
            setVideos(response.videos || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            loadTrendingVideos();
            return;
        }

        setLoading(true);
        setActiveTab('search');
        try {
            const response = await videoAPI.search(searchQuery, 20);
            setVideos(response.videos || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const openVideo = (url: string) => {
        Linking.openURL(url);
    };

    const renderVideoCard = ({ item }: { item: any }) => (
        <TouchableOpacity onPress={() => openVideo(item.url)}>
            <GlassCard style={styles.videoCard}>
                <Image
                    source={{ uri: item.thumbnail }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                />
                <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={2}>
                        {item.title}
                    </Text>
                    <View style={styles.channelInfo}>
                        <MaterialIcons name="person" size={14} color={colors.text.muted} />
                        <Text style={styles.channelName}>{item.channel}</Text>
                    </View>
                    <View style={styles.playButton}>
                        <MaterialIcons name="play-arrow" size={20} color={colors.background} />
                        <Text style={styles.playText}>Watch</Text>
                    </View>
                </View>
            </GlassCard>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <MaterialIcons name="play-circle-outline" size={28} color={colors.primary} />
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Workout Videos</Text>
                    <Text style={styles.headerSubtitle}>
                        {activeTab === 'trending' ? 'Trending this week' : `${videos.length} results`}
                    </Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialIcons name="search" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search workouts..."
                        placeholderTextColor={colors.text.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                setSearchQuery('');
                                setActiveTab('trending');
                                loadTrendingVideos();
                            }}
                        >
                            <MaterialIcons name="close" size={20} color={colors.text.muted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'trending' && styles.tabActive]}
                    onPress={() => {
                        setActiveTab('trending');
                        loadTrendingVideos();
                    }}
                >
                    <MaterialIcons
                        name="trending-up"
                        size={20}
                        color={activeTab === 'trending' ? colors.primary : colors.text.muted}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'trending' && styles.tabTextActive,
                        ]}
                    >
                        Trending
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'search' && styles.tabActive]}
                    onPress={() => {
                        if (searchQuery.trim()) {
                            handleSearch();
                        }
                    }}
                >
                    <MaterialIcons
                        name="search"
                        size={20}
                        color={activeTab === 'search' ? colors.primary : colors.text.muted}
                    />
                    <Text
                        style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}
                    >
                        Search
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Videos List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading videos...</Text>
                </View>
            ) : videos.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="video-library" size={64} color={colors.text.muted} />
                    <Text style={styles.emptyTitle}>No videos found</Text>
                    <Text style={styles.emptyText}>
                        {activeTab === 'search'
                            ? 'Try searching for a different workout'
                            : 'Unable to load trending videos. Check your connection.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={videos}
                    renderItem={renderVideoCard}
                    keyExtractor={(item, index) => item.id || `video-${index}`}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
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
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.md,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    headerSubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    searchContainer: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        paddingHorizontal: spacing.lg,
        height: 48,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.sm,
    },
    tabActive: {
        backgroundColor: colors.primary + '20',
        borderColor: colors.primary,
    },
    tabText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    tabTextActive: {
        color: colors.primary,
    },
    listContent: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    videoCard: {
        overflow: 'hidden',
    },
    thumbnail: {
        width: '100%',
        height: 200,
        backgroundColor: colors.glass.surfaceLight,
    },
    videoInfo: {
        padding: spacing.md,
    },
    videoTitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    channelInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    channelName: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    playText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    loadingText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginTop: spacing.lg,
    },
    emptyText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
});
