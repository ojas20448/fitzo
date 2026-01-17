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
    Alert,
    ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import GlassCard from './GlassCard';
import { exerciseAPI } from '../services/api';
import { cacheData, getCachedData, CACHE_KEYS, CACHE_DURATION } from '../utils/cache';

interface ExerciseListProps {
    mode?: 'view' | 'select';
    onSelect?: (exercise: any) => void;
    initialFilter?: string; // e.g., 'legs', 'push' (mapped to bodies)
}

export default function ExerciseList({ mode = 'view', onSelect, initialFilter }: ExerciseListProps) {
    const [exercises, setExercises] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(initialFilter || null);
    const [bodyParts, setBodyParts] = useState<string[]>([]);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        loadBodyParts();
        loadExercises();
    }, []);

    const loadBodyParts = async () => {
        try {
            const cached = await getCachedData(CACHE_KEYS.EXERCISE_FILTERS);
            if (cached) {
                setBodyParts(cached);
                return;
            }
            const response = await exerciseAPI.getBodyParts();
            const parts = response.bodyParts || [];
            setBodyParts(parts);
            await cacheData(CACHE_KEYS.EXERCISE_FILTERS, parts, CACHE_DURATION.LONG);
        } catch (error) {
            console.error('Error loading body parts:', error);
        }
    };

    const loadExercises = async () => {
        setLoading(true);
        try {
            if (selectedBodyPart) {
                await handleBodyPartFilter(selectedBodyPart);
                return;
            }

            const cached = await getCachedData(CACHE_KEYS.EXERCISES);
            if (cached && !searchQuery && !selectedBodyPart) {
                setExercises(cached);
                setIsOffline(true);
                setLoading(false);
                return;
            }

            const response = await exerciseAPI.getAll(50, 0);
            const exerciseData = response.exercises || [];
            setExercises(exerciseData);
            setIsOffline(false);

            if (!searchQuery && !selectedBodyPart) {
                await cacheData(CACHE_KEYS.EXERCISES, exerciseData, CACHE_DURATION.LONG);
            }
        } catch (error: any) {
            console.error('Error loading exercises:', error);
            Alert.alert('Connection Error', 'Failed to load exercises.');
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

    const handlePress = (item: any) => {
        if (mode === 'select' && onSelect) {
            onSelect(item);
        } else {
            // If view mode, we probably want to show details. 
            // Since this is a component, we can emit an 'onDetail' event or handle modal internally.
            // For now, let's bubble up if onSelect is provided, otherwise ignore or TODO.
            // Actually, best to expose onSelect for both, and parent decides what to do.
            if (onSelect) onSelect(item);
        }
    };

    const renderExerciseCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handlePress(item)}
        >
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
                    </View>
                </View>
                {mode === 'select' && (
                    <View style={styles.addIcon}>
                        <MaterialIcons name="add-circle" size={24} color={colors.primary} />
                    </View>
                )}
            </GlassCard>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
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

            {/* Filters */}
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
                        setSearchQuery('');
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

            {/* List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading...</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        flexGrow: 0,
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
        height: 40,
        justifyContent: 'center',
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
        paddingBottom: 100,
    },
    exerciseCard: {
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.md,
        alignItems: 'center',
    },
    exerciseGif: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surfaceLight,
    },
    exerciseInfo: {
        flex: 1,
        justifyContent: 'space-between',
        height: 80,
        paddingVertical: spacing.xs,
    },
    exerciseName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        textTransform: 'capitalize',
        marginBottom: spacing.xs,
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    tag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.primary + '20',
    },
    tagSecondary: {
        backgroundColor: colors.primary + '30',
    },
    tagText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        textTransform: 'capitalize',
    },
    addIcon: {
        padding: spacing.sm,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    loadingText: {
        color: colors.text.muted,
    },
});
