import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import GlassCard from './GlassCard';
import { exerciseAPI } from '../services/api';
import useOfflineStore from '../stores/offlineStore';

// FlashList wrapper to handle typing issues
const TypedFlashList = FlashList as React.ComponentType<FlashListProps<any> & { estimatedItemSize?: number }>;

interface ExerciseListProps {
    mode?: 'view' | 'select';
    onSelect?: (exercise: any) => void;
    initialFilter?: string; // e.g., 'legs', 'push' (mapped to bodies)
    allowedBodyParts?: string[];
}

// Helper function to get icon based on body part
const PAGE_SIZE = 50;

const getExerciseIcon = (bodyPart: string): keyof typeof MaterialIcons.glyphMap => {
    const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
        'chest': 'fitness-center',
        'back': 'fitness-center',
        'shoulders': 'fitness-center',
        'upper arms': 'fitness-center',
        'lower arms': 'fitness-center',
        'upper legs': 'directions-run',
        'lower legs': 'directions-run',
        'waist': 'accessibility-new',
        'cardio': 'favorite',
        'neck': 'accessibility-new',
    };
    return iconMap[bodyPart?.toLowerCase()] || 'fitness-center';
};

export default function ExerciseList({ mode = 'view', onSelect, initialFilter, allowedBodyParts }: ExerciseListProps) {
    const [exercises, setExercises] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(initialFilter || null);
    const [bodyParts, setBodyParts] = useState<string[]>([]);
    const [isOffline, setIsOffline] = useState(false);
    // Pagination. The catalogue is ~1,300 exercises but the API is offset-based
    // and returns them grouped by body part, so fetching only the first page
    // yields nothing but "back" — alphabetically first. Keep paging on scroll.
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Load initial data
    useEffect(() => {
        loadBodyParts();
    }, [allowedBodyParts]);

    // Reload when filter or search changes (with 300ms debounce to avoid spamming searches)
    useEffect(() => {
        const timer = setTimeout(() => {
            loadExercises();
        }, 300);

        return () => clearTimeout(timer);
    }, [selectedBodyPart, searchQuery, allowedBodyParts]);

    const loadBodyParts = async () => {
        try {
            // Use local body parts + any from API if needed
            const { bodyPartsList } = require('../data/defaultExercises');
            let list = [...bodyPartsList];

            // Optionally fetch more from API
            const response = await exerciseAPI.getBodyParts();
            if (response.bodyParts) {
                list = Array.from(new Set([...list, ...response.bodyParts]));
            }

            if (allowedBodyParts && allowedBodyParts.length > 0) {
                const allowedSet = new Set(allowedBodyParts.map(b => b.toLowerCase()));
                list = list.filter(b => allowedSet.has(b.toLowerCase()));
            }

            setBodyParts(list);
        } catch (error: any) {
            // Silently handle - parent screen manages error state
        }
    };

    const loadExercises = async () => {
        setLoading(true);
        // Any change of filter or search rebuilds the list from scratch, so the
        // paging cursor has to go back to the start with it.
        setOffset(0);
        setHasMore(true);
        try {
            const { defaultExercises } = require('../data/defaultExercises');
            // Check offline store first
            const cachedExercises = useOfflineStore.getState().getExercises();
            const isStale = useOfflineStore.getState().isExercisesStale();

            let baseExercises = [];

            if (cachedExercises && cachedExercises.length > 0 && !isStale && !searchQuery) {
                baseExercises = cachedExercises;
            } else {
                // If no cache or stale, start with default/local
                baseExercises = [...defaultExercises];
            }

            let results = [...baseExercises];

            // Helper to map UI body parts to API body parts
            const getApiBodyParts = (uiPart: string): string[] => {
                const part = uiPart.toLowerCase();
                if (part === 'arms') return ['upper arms', 'lower arms'];
                if (part === 'legs') return ['upper legs', 'lower legs'];
                if (part === 'core') return ['waist'];
                return [part];
            };

            // 1. Filter by Body Part (Local)
            if (selectedBodyPart) {
                const mappedParts = new Set([selectedBodyPart.toLowerCase(), ...getApiBodyParts(selectedBodyPart)]);
                results = results.filter((ex: any) =>
                    mappedParts.has(ex.bodyPart?.toLowerCase())
                );
            } else if (allowedBodyParts && allowedBodyParts.length > 0) {
                const allowedSet = new Set<string>();
                allowedBodyParts.forEach(b => {
                    allowedSet.add(b.toLowerCase());
                    getApiBodyParts(b).forEach(apiPart => allowedSet.add(apiPart));
                });
                results = results.filter((ex: any) =>
                    allowedSet.has((ex.bodyPart || ex.category || '').toLowerCase())
                );
            }

            // 2. Filter by Search Query (Local)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                results = results.filter((ex: any) =>
                    ex.name.toLowerCase().includes(q) ||
                    ex.target.toLowerCase().includes(q)
                );
            }

            // 3. If local results are few, TRY fetching from API to supplement
            // Only if we are online and have a search query (to avoid fetching ALL)
            if (searchQuery.trim().length > 2) {
                try {
                    const apiRes = await exerciseAPI.search(searchQuery);
                    if (apiRes.exercises) {
                        // Merge API results, avoiding duplicates by ID or Name
                        const existingIds = new Set(results.map(r => r.id));
                        const existingNames = new Set(results.map(r => r.name.toLowerCase()));

                        const newFromApi = apiRes.exercises.filter((ex: any) =>
                            !existingIds.has(ex.id) && !existingNames.has(ex.name.toLowerCase())
                        );
                        results = [...results, ...newFromApi];
                    }
                } catch (e: any) {
                    // Silently handle - parent screen manages error state
                }
            } else if (!searchQuery && (!cachedExercises || cachedExercises.length === 0 || isStale || selectedBodyPart)) {
                // Fetch from API and update list live (includes gifUrl)
                try {
                    let apiExercises: any[] = [];
                    if (selectedBodyPart) {
                        const apiParts = getApiBodyParts(selectedBodyPart);
                        for (const p of apiParts) {
                            try {
                                const res = await exerciseAPI.getByBodyPart(p);
                                if (res.exercises) apiExercises = [...apiExercises, ...res.exercises];
                            } catch (e) {
                                // Skip failing parts silently
                            }
                        }
                    } else {
                        const res = await exerciseAPI.getAll(PAGE_SIZE, 0);
                        if (res.exercises) apiExercises = res.exercises;
                    }

                    if (apiExercises.length > 0) {
                        if (!selectedBodyPart && (!allowedBodyParts || allowedBodyParts.length === 0)) {
                            useOfflineStore.getState().cacheExercises(apiExercises);
                        }
                        
                        let apiResults = apiExercises;
                        // Apply allowedBodyParts if necessary
                        if (allowedBodyParts && allowedBodyParts.length > 0) {
                             const allowedSet = new Set(allowedBodyParts.map(b => b.toLowerCase()));
                             apiResults = apiResults.filter((ex: any) =>
                                 allowedSet.has((ex.bodyPart || ex.category || '').toLowerCase())
                             );
                        }

                        results = apiResults;
                        
                        setOffset(apiExercises.length);
                        setHasMore(!selectedBodyPart && apiExercises.length >= PAGE_SIZE);
                    } else {
                        setHasMore(false);
                    }
                } catch (err: any) {
                    // Silently handle - parent screen manages error state
                }
            } else if (!searchQuery && !selectedBodyPart && cachedExercises && cachedExercises.length > 0) {
                // If we are using cache and not fetching from API right now, set offset correctly
                setOffset(cachedExercises.length);
                setHasMore(cachedExercises.length >= PAGE_SIZE);
            }

            setExercises(results);
            setLoading(false);
        } catch (error: any) {
            // Silently handle - parent screen manages error state
            setLoading(false);
        }
    };

    // Fetch the next page and append. Guarded so an in-flight page, an
    // exhausted catalogue, or a filtered/searched list cannot trigger a fetch —
    // those paths are resolved entirely client-side.
    const loadMoreExercises = async () => {
        if (loadingMore || loading || !hasMore) return;
        if (searchQuery.trim() || selectedBodyPart) return;

        setLoadingMore(true);
        try {
            const apiRes = await exerciseAPI.getAll(PAGE_SIZE, offset);
            const next = apiRes?.exercises || [];

            if (next.length === 0) {
                setHasMore(false);
            } else {
                setExercises(prev => {
                    // The API paginates over a live dataset, so a page can repeat
                    // an item that already arrived. De-dupe on id before appending.
                    const seen = new Set(prev.map((e: any) => e.id));
                    let newItems = next.filter((e: any) => !seen.has(e.id));
                    
                    if (allowedBodyParts && allowedBodyParts.length > 0) {
                        const allowedSet = new Set(allowedBodyParts.map(b => b.toLowerCase()));
                        newItems = newItems.filter((ex: any) =>
                            allowedSet.has((ex.bodyPart || ex.category || '').toLowerCase())
                        );
                    }
                    
                    const merged = [...prev, ...newItems];
                    if (!allowedBodyParts || allowedBodyParts.length === 0) {
                        useOfflineStore.getState().cacheExercises(merged);
                    }
                    return merged;
                });
                setOffset(offset + next.length);
                setHasMore(next.length >= PAGE_SIZE);
            }
        } catch {
            // Offline or API failure — stop paging rather than spinning forever.
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleSearch = () => {
        loadExercises();
    };

    const handleBodyPartFilter = (bodyPart: string) => {
        if (selectedBodyPart === bodyPart) {
            setSelectedBodyPart(null);
        } else {
            setSelectedBodyPart(bodyPart);
        }
        // useEffect will trigger loadExercises
    };

    const handlePress = (item: any) => {
        if (mode === 'select' && onSelect) {
            onSelect(item);
        } else {
            if (onSelect) onSelect(item);
        }
    };

    const renderExerciseCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handlePress(item)}
        >
            <GlassCard style={styles.exerciseCard}>
                {item.gifUrl ? (
                    <Image
                        source={{ uri: item.gifUrl }}
                        style={styles.exerciseGif}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={styles.exerciseIconContainer}>
                        <MaterialIcons 
                            name={getExerciseIcon(item.bodyPart)} 
                            size={32} 
                            color={colors.primary} 
                        />
                    </View>
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
                    // Set state only, then let the debounced effect below do the
                    // reload. This used to call loadExercises() inline, which ran
                    // in the same tick as the setters and so still closed over the
                    // *previous* selectedBodyPart: it refetched the body part the
                    // user was leaving and, through `!selectedBodyPart && ...`,
                    // wrote hasMore=false. That write raced ahead of the correct
                    // reload and killed infinite scroll, capping "All" at a single
                    // 50-exercise page instead of paging through the catalogue.
                    onPress={() => {
                        setSelectedBodyPart(null);
                        setSearchQuery('');
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
                <View style={{ padding: spacing.xl, gap: spacing.md }}>
                    {[0, 1, 2, 3].map(i => (
                        <GlassCard key={i} style={[styles.exerciseCard, { opacity: 0.4 }]}>
                            <View style={[styles.exerciseIconContainer, { backgroundColor: colors.glass.border }]} />
                            <View style={styles.exerciseInfo}>
                                <View style={{ width: 120 + (i * 20), height: 14, borderRadius: 4, backgroundColor: colors.glass.border }} />
                                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
                                    <View style={{ width: 50, height: 16, borderRadius: 4, backgroundColor: colors.glass.border }} />
                                    <View style={{ width: 60, height: 16, borderRadius: 4, backgroundColor: colors.glass.border }} />
                                </View>
                            </View>
                        </GlassCard>
                    ))}
                </View>
            ) : (
                <TypedFlashList
                    data={exercises}
                    renderItem={renderExerciseCard}
                    keyExtractor={(item: any, index: number) => `${item.id}-${index}`}
                    contentContainerStyle={styles.listContent}
                    estimatedItemSize={100}
                    showsVerticalScrollIndicator={false}
                    onEndReached={loadMoreExercises}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.footerLoader}>
                                <ActivityIndicator size="small" color={colors.text.muted} />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        !loading && searchQuery.trim().length > 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No exercises found for "{searchQuery}"</Text>
                                <TouchableOpacity
                                    style={styles.createBtn}
                                    onPress={() => {
                                        const newExercise = {
                                            id: `custom-${Date.now()}`,
                                            name: searchQuery,
                                            bodyPart: 'other',
                                            target: 'custom',
                                            gifUrl: null,
                                            custom: true
                                        };
                                        handlePress(newExercise);
                                    }}
                                >
                                    <MaterialIcons name="add" size={20} color={colors.primary} />
                                    <Text style={styles.createBtnText}>Create "{searchQuery}"</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            !loading ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No exercises found.</Text>
                                </View>
                            ) : null
                        )
                    }
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
    exerciseIconContainer: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
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
    footerLoader: {
        paddingVertical: spacing.xl,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        gap: spacing.md,
    },
    emptyText: {
        color: colors.text.muted,
        fontSize: typography.sizes.base,
        textAlign: 'center',
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
    },
    createBtnText: {
        color: colors.primary,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
    },
});
