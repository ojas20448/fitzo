import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList, FlashListProps, FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, colors, spacing, typography } from '../styles/theme';
import { bodyPartsList, defaultExercises } from '../data/defaultExercises';
import { exerciseAPI } from '../services/api';
import { useOfflineStore } from '../stores/offlineStore';
import { apiBodyParts, canonicalBodyPart, exerciseMatches, isExerciseSelected, mergeExerciseResults, SearchExercise } from '../utils/exerciseSearch';
import { exerciseMediaCandidates, withExerciseMedia } from '../utils/exerciseMedia';
import Button from './Button';
import GlassCard from './GlassCard';
import ExercisePreview from './ExercisePreview';
import ExerciseDetailsModal from './ExerciseDetailsModal';

const TypedFlashList = FlashList as React.ComponentType<FlashListProps<SearchExercise> & React.RefAttributes<FlashListRef<SearchExercise>> & { estimatedItemSize?: number }>;
const PAGE_SIZE = 50;
const builtInIds = new Set(defaultExercises.map(exercise => exercise.id));
interface Props { mode?: 'view' | 'select'; onSelect?: (exercise: any) => void; initialFilter?: string; allowedBodyParts?: string[]; selectedExercises?: Pick<SearchExercise, 'id' | 'name'>[]; selectionAction?: 'Add' | 'Replace' }

export default function ExerciseList({ mode = 'view', onSelect, initialFilter, allowedBodyParts, selectedExercises = [], selectionAction = 'Add' }: Props) {
    const insets = useSafeAreaInsets();
    const [exercises, setExercises] = useState<SearchExercise[]>(() => mergeExerciseResults([], defaultExercises).map(withExerciseMedia));
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(initialFilter ? canonicalBodyPart(initialFilter) : null);
    const [bodyParts, setBodyParts] = useState(bodyPartsList);
    const [loading, setLoading] = useState(true);
    const [limited, setLimited] = useState(false);
    const [retry, setRetry] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [pageError, setPageError] = useState(false);
    const [detailsExercise, setDetailsExercise] = useState<SearchExercise | null>(null);
    const generation = useRef(0);
    const paging = useRef(false);
    const apiPages = useRef<SearchExercise[]>([]);
    const list = useRef<FlashListRef<SearchExercise>>(null);
    const allowedKey = allowedBodyParts?.map(canonicalBodyPart).sort().join('|') || '';
    useEffect(() => { list.current?.scrollToOffset({ offset: 0, animated: false }); }, [searchQuery, selectedBodyPart, allowedKey]);

    useEffect(() => {
        let active = true;
        void exerciseAPI.getBodyParts().then(response => {
            if (active && Array.isArray(response.bodyParts)) setBodyParts([...new Set([...bodyPartsList, ...response.bodyParts.map(canonicalBodyPart)])]);
        }).catch(() => {});
        return () => { active = false; };
    }, []);
    useEffect(() => { setSelectedBodyPart(initialFilter ? canonicalBodyPart(initialFilter) : null); }, [initialFilter, allowedKey]);

    useEffect(() => {
        const version = ++generation.current;
        const query = searchQuery.trim();
        const store = useOfflineStore.getState();
        const cached = store.getExercises() || [];
        const base = mergeExerciseResults(defaultExercises, cached);
        setExercises(base.map(withExerciseMedia));
        setLoading(true); setLimited(false); setHasMore(false); setPageError(false); setLoadingMore(false); paging.current = false;
        const timer = setTimeout(async () => {
            try {
                let incoming: SearchExercise[] = [];
                if (query.length > 2) {
                    incoming = (await exerciseAPI.search(query)).exercises || [];
                } else if (!query && selectedBodyPart) {
                    const responses = await Promise.allSettled(apiBodyParts(selectedBodyPart).map(part => exerciseAPI.getByBodyPart(part)));
                    if (version !== generation.current) return;
                    setLimited(responses.some(response => response.status === 'rejected'));
                    incoming = responses.flatMap(response => response.status === 'fulfilled' ? response.value.exercises || [] : []);
                } else if (!query) {
                    const fresh = cached.length > 0 && !store.isExercisesStale();
                    incoming = fresh ? cached : (await exerciseAPI.getAll(PAGE_SIZE, 0)).exercises || [];
                    if (version !== generation.current) return;
                    apiPages.current = incoming;
                    setOffset(incoming.length); setHasMore(incoming.length >= PAGE_SIZE);
                    if (!fresh && !allowedKey && incoming.length) store.cacheExercises(incoming);
                }
                if (version !== generation.current) return;
                setExercises(mergeExerciseResults(base, incoming).map(withExerciseMedia));
            } catch {
                if (version === generation.current) setLimited(true);
            } finally {
                if (version === generation.current) setLoading(false);
            }
        }, 300);
        return () => {
            clearTimeout(timer);
            // This ref is a request counter; incrementing it rejects pending network responses.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            generation.current++;
        };
    }, [searchQuery, selectedBodyPart, allowedKey, retry]);

    const loadMore = useCallback(async (explicitRetry = false) => {
        if (paging.current || loading || !hasMore || searchQuery.trim() || selectedBodyPart || (pageError && !explicitRetry)) return;
        const version = generation.current;
        paging.current = true; setLoadingMore(true); setPageError(false);
        try {
            const next = (await exerciseAPI.getAll(PAGE_SIZE, offset)).exercises || [];
            if (version !== generation.current) return;
            apiPages.current = mergeExerciseResults(apiPages.current, next);
            if (!allowedKey) useOfflineStore.getState().cacheExercises(apiPages.current);
            setExercises(current => mergeExerciseResults(current, next).map(withExerciseMedia));
            setOffset(offset + next.length); setHasMore(next.length >= PAGE_SIZE);
        } catch { if (version === generation.current) setPageError(true); }
        finally { if (version === generation.current) { paging.current = false; setLoadingMore(false); } }
    }, [loading, hasMore, searchQuery, selectedBodyPart, pageError, offset, allowedKey]);

    const visible = exercises.filter(exercise => exerciseMatches(exercise, searchQuery, selectedBodyPart, allowedBodyParts)).sort((a, b) =>
        (mode === 'select' ? Number(builtInIds.has(b.id)) - Number(builtInIds.has(a.id)) : 0) || a.name.localeCompare(b.name));
    const parts = bodyParts.filter(part => !allowedBodyParts?.length || allowedBodyParts.some(allowed => canonicalBodyPart(allowed) === part));
    const clearFilters = () => { setSearchQuery(''); setSelectedBodyPart(null); };
    const viewGuide = (exercise: SearchExercise) => {
        if (mode === 'view' && onSelect) onSelect(exercise);
        else setDetailsExercise(exercise);
    };
    const renderExercise = ({ item }: { item: SearchExercise }) => {
        const selected = isExerciseSelected(item, selectedExercises);
        const media = exerciseMediaCandidates(item)[0];
        return <GlassCard style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.name} guide`} onPress={() => viewGuide(item)} style={({ pressed }) => [styles.mainAction, pressed && styles.pressed]}>
            <ExercisePreview exercise={item} style={styles.preview} />
            <View style={styles.copy}><Text style={styles.name} numberOfLines={3}>{item.name}</Text>
                <Text style={styles.meta} numberOfLines={2}>{[item.bodyPart && canonicalBodyPart(item.bodyPart), item.target].filter(Boolean).join(' · ')}</Text>
                {!!item.equipment && <Text style={styles.equipment} numberOfLines={2}>{item.equipment}</Text>}
                <Text style={styles.guideLink}>{media?.kind === 'animation' ? 'View demo' : media ? 'View photo & guide' : 'View guide'}</Text>
            </View>
        </Pressable>
        <View style={styles.actions}>
            {mode === 'select' && <Pressable accessibilityRole="button" accessibilityLabel={selected ? `${item.name} already in workout` : `${selectionAction} ${item.name} ${selectionAction === 'Add' ? 'to' : 'in'} workout`} accessibilityState={{ disabled: selected }} disabled={selected} style={[styles.addButton, selected && styles.addedButton]} onPress={() => { if (!selected) onSelect?.(item); }}>
                <Ionicons name={selected ? 'checkmark-outline' : selectionAction === 'Replace' ? 'swap-horizontal-outline' : 'add-outline'} size={18} color={selected ? colors.text.secondary : colors.text.primary} /><Text style={styles.addLabel}>{selected ? 'Added' : selectionAction}</Text>
            </Pressable>}
        </View>
    </GlassCard>;
    };

    return <View style={styles.container}>
        {detailsExercise && <ExerciseDetailsModal exercise={detailsExercise} onClose={() => setDetailsExercise(null)} onAdd={mode === 'select' && !isExerciseSelected(detailsExercise, selectedExercises) ? () => { onSelect?.(detailsExercise); setDetailsExercise(null); } : undefined} addLabel={selectionAction === 'Replace' ? 'Replace exercise' : undefined} />}
        <View style={styles.searchContainer}><View style={[styles.searchBar, searchFocused && styles.searchFocused]}>
            <Ionicons name="search-outline" size={20} color={colors.text.secondary} />
            <TextInput accessibilityLabel="Search exercises" placeholder="Search exercises..." placeholderTextColor={colors.text.muted} style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} autoCorrect={false} maxLength={100} returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} />
            {!!searchQuery && <Pressable accessibilityRole="button" accessibilityLabel="Clear exercise search" onPress={() => setSearchQuery('')} style={styles.iconButton}><Ionicons name="close-circle-outline" size={21} color={colors.text.secondary} /></Pressable>}
        </View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterContent} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" accessibilityLabel={allowedKey ? 'Filter session muscles' : 'Filter all muscles'} aria-pressed={!selectedBodyPart} accessibilityState={{ selected: !selectedBodyPart }} style={[styles.chip, !selectedBodyPart && styles.selectedChip]} onPress={() => setSelectedBodyPart(null)}><Text style={[styles.chipText, !selectedBodyPart && styles.selectedChipText]}>{allowedKey ? 'Session muscles' : 'All muscles'}</Text></Pressable>
            {parts.map(part => <Pressable key={part} accessibilityRole="button" accessibilityLabel={`Filter ${part}`} aria-pressed={selectedBodyPart === part} accessibilityState={{ selected: selectedBodyPart === part }} style={[styles.chip, selectedBodyPart === part && styles.selectedChip]} onPress={() => setSelectedBodyPart(current => current === part ? null : part)}><Text style={[styles.chipText, selectedBodyPart === part && styles.selectedChipText]}>{part}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.resultsHeader}><View style={styles.grow}>
            <Text style={styles.resultsTitle} accessibilityLiveRegion="polite">{loading && !visible.length ? 'Searching exercises…' : `${visible.length} ${visible.length === 1 ? 'exercise' : 'exercises'}`}</Text>
            <Text style={styles.hint}>{mode === 'select' ? selectionAction === 'Replace' ? 'Choose the exercise you want to use instead.' : 'Tap Add for each exercise, then Done to start logging.' : 'Tap an exercise to see its movement guide.'}</Text>
        </View>{loading ? <ActivityIndicator accessibilityLabel="Searching exercise library" size="small" color={colors.text.secondary} /> : null}
            {(!!searchQuery || !!selectedBodyPart) && <Pressable accessibilityRole="button" accessibilityLabel="Clear exercise filters" style={styles.reset} onPress={clearFilters}><Text style={styles.resetText}>Reset</Text></Pressable>}
        </View>
        {limited && <View style={styles.notice}><Text style={styles.noticeText}>More exercises couldn’t load. You can use the available exercises.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry exercise loading" style={styles.reset} onPress={() => setRetry(value => value + 1)}><Text style={styles.resetText}>Retry</Text></Pressable></View>}
        <TypedFlashList ref={list} data={visible} renderItem={renderExercise} keyExtractor={item => item.id} estimatedItemSize={112} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} maintainVisibleContentPosition={{ disabled: !!searchQuery || !!selectedBodyPart }}
            contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, spacing.xl) + spacing.xl }]} ItemSeparatorComponent={() => <View style={styles.separator} />}
            onEndReached={() => void loadMore()} onEndReachedThreshold={0.4}
            ListFooterComponent={<View style={styles.footer}>{loadingMore ? <ActivityIndicator accessibilityLabel="Loading more exercises" color={colors.text.secondary} /> : hasMore && !searchQuery.trim() && !selectedBodyPart ? <Button title={pageError ? 'Try loading more again' : 'Load more exercises'} variant="ghost" onPress={() => void loadMore(true)} /> : null}</View>}
            ListEmptyComponent={!loading ? <View style={styles.empty}>
                <Ionicons name="search-outline" size={28} color={colors.text.secondary} /><Text style={styles.emptyTitle}>{limited ? 'Search is limited' : selectedBodyPart ? `No matches in ${selectedBodyPart}` : 'No matching exercises'}</Text><Text style={styles.emptyHint}>Try another exercise name or search across all muscles.</Text>
                {!!selectedBodyPart && <Button title="Search all muscles" onPress={() => setSelectedBodyPart(null)} />}
                <Button title="Reset search & filters" variant="secondary" onPress={clearFilters} />
                {mode === 'select' && !selectedBodyPart && !allowedKey && searchQuery.trim().length > 1 && <Button title={`Add “${searchQuery.trim()}” as custom`} variant="ghost" onPress={() => onSelect?.({ id: `custom-${Date.now()}`, name: searchQuery.trim(), bodyPart: 'other', target: 'custom', custom: true })} />}
            </View> : null}
        />
    </View>;
}
const styles = StyleSheet.create({
    container: { flex: 1 },
    searchContainer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    searchBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.lg, paddingRight: spacing.xs, borderWidth: 1, borderColor: colors.glass.borderLight, borderRadius: borderRadius.full, backgroundColor: colors.glass.surface },
    searchFocused: { borderColor: colors.primaryMuted, backgroundColor: colors.glass.surfaceLight },
    searchInput: { flex: 1, minWidth: 0, minHeight: 52, fontFamily: typography.fontFamily.regular, fontSize: 14, color: colors.text.primary, outlineWidth: 0 },
    filters: { flexGrow: 0 },
    filterContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
    chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.glass.border, backgroundColor: colors.glass.surface },
    selectedChip: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontFamily: typography.fontFamily.medium, fontSize: 12, color: colors.text.secondary, textTransform: 'capitalize' },
    selectedChipText: { color: colors.text.dark },
    resultsHeader: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    grow: { flex: 1, minWidth: 0 },
    resultsTitle: { fontFamily: typography.fontFamily.medium, fontSize: 13, color: colors.text.primary },
    hint: { fontFamily: typography.fontFamily.regular, fontSize: 11, lineHeight: 18, color: colors.text.secondary, marginTop: spacing.xs },
    reset: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
    resetText: { fontFamily: typography.fontFamily.medium, fontSize: 12, color: colors.text.primary },
    notice: { marginHorizontal: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.glass.surfaceLight },
    noticeText: { flex: 1, fontFamily: typography.fontFamily.regular, fontSize: 11, lineHeight: 18, color: colors.text.secondary },
    listContent: { paddingHorizontal: spacing.xl },
    separator: { height: spacing.md },
    card: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.xs, minHeight: 96 },
    mainAction: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.xs, borderRadius: borderRadius.md, minHeight: 80 },
    pressed: { backgroundColor: colors.glass.surfaceHover },
    preview: { width: 56, height: 64, borderRadius: borderRadius.md },
    copy: { flex: 1, minWidth: 0, gap: 5 },
    name: { fontFamily: typography.fontFamily.medium, fontSize: 14, lineHeight: 21, color: colors.text.primary, textTransform: 'capitalize' },
    meta: { fontFamily: typography.fontFamily.regular, fontSize: 11, lineHeight: 17, color: colors.text.secondary, textTransform: 'capitalize' },
    equipment: { fontFamily: typography.fontFamily.regular, fontSize: 10, lineHeight: 16, color: colors.text.muted, textTransform: 'capitalize' },
    guideLink: { fontFamily: typography.fontFamily.medium, fontSize: 11, lineHeight: 18, color: colors.text.secondary },
    addButton: { minWidth: 64, minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.glass.borderLight },
    addedButton: { borderColor: 'transparent', backgroundColor: colors.surfaceLight },
    addLabel: { fontFamily: typography.fontFamily.medium, fontSize: 11, color: colors.text.primary },
    actions: { justifyContent: 'center' },
    iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    footer: { paddingTop: spacing.lg },
    empty: { paddingVertical: spacing['2xl'], gap: spacing.lg, alignItems: 'stretch' },
    emptyTitle: { fontFamily: typography.fontFamily.medium, fontSize: 18, color: colors.text.primary },
    emptyHint: { fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 21, color: colors.text.secondary },
});
