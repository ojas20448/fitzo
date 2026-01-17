import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';
import { exerciseAPI } from '../../services/api';
import { cacheData, getCachedData, CACHE_KEYS, CACHE_DURATION } from '../../utils/cache';

export default function ExerciseLibraryScreen() {
    const [exercises, setExercises] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'bodypart' | 'equipment'>('all');
    const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
    const [bodyParts, setBodyParts] = useState<string[]>([]);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        loadBodyParts();
        loadExercises();
    }, []);

    const loadBodyParts = async () => {
        try {
            // Try cache first
            const cached = await getCachedData(CACHE_KEYS.EXERCISE_FILTERS);
            if (cached) {
                setBodyParts(cached);
                return;
            }

            const response = await exerciseAPI.getBodyParts();
            const parts = response.bodyParts || [];
            setBodyParts(parts);

            // Cache for 24 hours
            await cacheData(CACHE_KEYS.EXERCISE_FILTERS, parts, CACHE_DURATION.LONG);
        } catch (error) {
            console.error('Error loading body parts:', error);
        }
    };

    const loadExercises = async () => {
        setLoading(true);
        try {
            // Try cache first
            const cached = await getCachedData(CACHE_KEYS.EXERCISES);
            if (cached) {
                setExercises(cached);
                setIsOffline(true);
                setLoading(false);
                return;
            }

            const response = await exerciseAPI.getAll(50, 0);
            const exerciseData = response.exercises || [];
            setExercises(exerciseData);
            setIsOffline(false);

            // Cache for 24 hours
            await cacheData(CACHE_KEYS.EXERCISES, exerciseData, CACHE_DURATION.LONG);
            setExercises(response.exercises || []);
        } catch (error: any) {
            console.error('Error loading exercises:', error);
            // Show user-friendly error
            Alert.alert(
                'Connection Error',
                'Failed to load exercises. Please check your internet connection and try again.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Retry', onPress: loadExercises }
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            loadExercises();
            return;
        }

        setLoading(true);
        try {
            const response = await exerciseAPI.search(searchQuery);
            setExercises(response.exercises || []);
        } catch (error) {
            console.error('Error searching exercises:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBodyPartFilter = async (bodyPart: string) => {
        setSelectedBodyPart(bodyPart);
        setLoading(true);
        try {
            const response = await exerciseAPI.getByBodyPart(bodyPart);
            setExercises(response.exercises || []);
        } catch (error) {
            console.error('Error filtering by body part:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderExerciseCard = ({ item }: { item: any }) => (
        <GlassCard style={styles.exerciseCard}>
            {item.gifUrl && (
                <Image
                    source={{ uri: item.gifUrl }}
                    style={styles.exerciseGif}
                    resizeMode="cover"
                />
            )}
            <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                <View style={styles.tags}>
                    {item.bodyPart && (
                        <View style={styles.tag}>
                            <Text style={styles.tagText}>{item.bodyPart}</Text>
                        </View>
                    )}
                    {item.target && (
                        <View style={[styles.tag, styles.tagSecondary]}>
                            <Text style={styles.tagText}>{item.target}</Text>
                        </View>
                    )}
                    {item.equipment && (
                        <View style={[styles.tag, styles.tagEquipment]}>
                            <Text style={styles.tagText}>{item.equipment}</Text>
                        </View>
                    )}
                </View>
            </View>
        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Exercise Library</Text>
                <Text style={styles.headerSubtitle}>1,300+ exercises with demos</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialIcons name="search" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search exercises..."
                        placeholderTextColor={colors.text.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => {
                            setSearchQuery('');
                            loadExercises();
                        }}>
                            <MaterialIcons name="close" size={20} color={colors.text.muted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Body Part Filters */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersContainer}
                contentContainerStyle={styles.filtersContent}
            >
                <TouchableOpacity
                    style={[styles.filterChip, !selectedBodyPart && styles.filterChipActive]}
                    onPress={() => {
                        setSelectedBodyPart(null);
                        loadExercises();
                    }}
                >
                    <Text style={[styles.filterText, !selectedBodyPart && styles.filterTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>
                {bodyParts.map((part) => (
                    <TouchableOpacity
                        key={part}
                        style={[styles.filterChip, selectedBodyPart === part && styles.filterChipActive]}
                        onPress={() => handleBodyPartFilter(part)}
                    >
                        <Text style={[styles.filterText, selectedBodyPart === part && styles.filterTextActive]}>
                            {part}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Exercise List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading exercises...</Text>
                </View>
            ) : (
                <FlatList
                    data={exercises}
                    renderItem={renderExerciseCard}
                    keyExtractor={(item, index) => item.id || `exercise-${index}`}
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
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
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
    filtersContainer: {
        marginBottom: spacing.md,
    },
    filtersContent: {
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
    },
    filterChip: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
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
        textTransform: 'capitalize',
    },
    filterTextActive: {
        color: colors.background,
    },
    listContent: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    exerciseCard: {
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.md,
    },
    exerciseGif: {
        width: 100,
        height: 100,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surfaceLight,
    },
    exerciseInfo: {
        flex: 1,
        justifyContent: 'space-between',
    },
    exerciseName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        textTransform: 'capitalize',
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    tag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.primary + '20',
    },
    tagSecondary: {
        backgroundColor: colors.primary + '30',
    },
    tagEquipment: {
        backgroundColor: colors.glass.surfaceLight,
    },
    tagText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        textTransform: 'capitalize',
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
});
