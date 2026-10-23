import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { workoutsAPI } from '../../services/api';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import PublishSplitModal from '../../components/PublishSplitModal';
import { customSessionDraft } from '../../utils/savedWorkoutPlan';
import { starterSessionDraft } from '../../utils/starterWorkout';

interface PublishedSplit {
    id: string; name: string; description: string; days_per_week: number;
    difficulty_level: string; program_structure: Record<string, string>; tags: string[];
    author_name: string; is_official: boolean; download_count: number; heart_count: number;
    liked: boolean; created_at: string; has_exercises: boolean; training_plan?: unknown;
}
type Sort = 'most_liked' | 'newest' | 'most_used';
const sorts: { id: Sort; label: string }[] = [{ id: 'most_liked', label: 'Most liked' }, { id: 'newest', label: 'Newest' }, { id: 'most_used', label: 'Most used' }];
const titleCase = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : '';

export default function PublishedSplitsScreen() {
    const toast = useToast();
    const { collection: initialCollection } = useLocalSearchParams<{ collection?: string }>();
    const { user, token } = useAuth();
    const identity = `${user?.id}:${token}`;
    const identityRef = useRef(identity); identityRef.current = identity;
    const [collection, setCollection] = useState(initialCollection === 'community' ? 'community' : 'fitzo');
    const [days, setDays] = useState<number | undefined>();
    const [difficulty, setDifficulty] = useState<string | undefined>();
    const [sort, setSort] = useState<Sort>('most_liked');
    const sortRef = useRef(sort); sortRef.current = sort;
    const [refresh, setRefresh] = useState(0);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [splits, setSplits] = useState<PublishedSplit[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const request = useRef(0);
    const morePending = useRef(false);
    const [selected, setSelected] = useState<PublishedSplit | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const detailRequest = useRef(0);
    const adoptionPending = useRef(false);
    const [adopting, setAdopting] = useState(false);
    const heartsPending = useRef(new Set<string>());
    const [heartBusy, setHeartBusy] = useState<string[]>([]);

    useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
    const resetFilters = () => { setDays(undefined); setDifficulty(undefined); setSearch(''); setQuery(''); };
    const load = useCallback(async (nextPage = 0) => {
        const id = ++request.current;
        if (nextPage === 0) { setLoading(true); setSplits([]); setHasMore(false); }
        else setLoadingMore(true);
        setError('');
        try {
            const result = await workoutsAPI.getPublishedSplits({ official: collection === 'fitzo', days, difficulty, sort, search: query || undefined, page: nextPage }, token || undefined);
            if (request.current !== id || identityRef.current !== identity) return;
            setSplits(previous => nextPage ? [...new Map([...previous, ...result.splits].map(split => [split.id, split])).values()] : result.splits);
            setPage(nextPage); setHasMore(result.has_more === true);
        } catch {
            if (request.current === id && identityRef.current === identity) setError('Couldn’t load workouts. Check your connection and try again.');
        } finally {
            if (request.current === id) { setLoading(false); setLoadingMore(false); morePending.current = false; }
        }
    }, [collection, days, difficulty, sort, query, token, identity]);
    useEffect(() => { morePending.current = false; void load(); return () => { request.current++; }; }, [load, refresh]);
    useEffect(() => { setSelected(null); detailRequest.current++; heartsPending.current = new Set(); setHeartBusy([]); }, [identity]);
    useEffect(() => () => { detailRequest.current++; }, []);

    const openDetails = async (split: PublishedSplit) => {
        if (adoptionPending.current) return;
        const id = ++detailRequest.current;
        setSelected(split); setDetailLoading(true); setDetailError('');
        try {
            const result = await workoutsAPI.getPublishedSplit(split.id, token || undefined);
            if (id === detailRequest.current && identityRef.current === identity) setSelected(result.split);
        } catch {
            if (id === detailRequest.current && identityRef.current === identity) setDetailError('Couldn’t load the full routine. Try again before choosing this plan.');
        } finally { if (id === detailRequest.current) setDetailLoading(false); }
    };
    const closeDetails = () => { if (!adoptionPending.current) { detailRequest.current++; setSelected(null); } };
    const heart = async (split: PublishedSplit) => {
        if (!token || heartsPending.current.has(split.id)) return;
        const pending = heartsPending.current;
        pending.add(split.id); setHeartBusy([...pending]);
        try {
            const result = await workoutsAPI.setSplitHeart(split.id, !split.liked, token);
            if (identityRef.current !== identity) return;
            setSelected(current => current?.id === split.id ? { ...current, ...result } : current);
            setSplits(current => {
                const next = current.map(item => item.id === split.id ? { ...item, ...result } : item);
                next.sort((a, b) => (sortRef.current === 'most_used' ? b.download_count - a.download_count : 0)
                    || (sortRef.current !== 'newest' ? b.heart_count - a.heart_count : 0)
                    || Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id));
                return next;
            });
        } catch { if (identityRef.current === identity) toast.error('Heart not saved', 'Try again. Your previous choice is unchanged.'); }
        finally { pending.delete(split.id); if (identityRef.current === identity) setHeartBusy([...pending]); }
    };
    const adopt = async () => {
        if (!selected || !token || adoptionPending.current || detailLoading || detailError) return;
        adoptionPending.current = true; setAdopting(true);
        try {
            const result = await workoutsAPI.adoptSplit(selected.id, token);
            if (identityRef.current !== identity) return;
            const saved = result.user_split;
            router.replace({ pathname: '/workout-intent', params: { adoptedSplit: JSON.stringify({ id: saved.split_id, name: saved.name, days: saved.days, daysPerWeek: saved.days_per_week, pattern: 'custom', description: selected.description }) } } as any);
        } catch (err: any) { if (identityRef.current === identity) setDetailError(err?.message || 'Couldn’t use this plan. Your current plan is unchanged. Try again.'); }
        finally { adoptionPending.current = false; setAdopting(false); }
    };
    const filterCount = Number(!!days) + Number(!!difficulty);
    const renderHeart = (split: PublishedSplit) => <TouchableOpacity style={styles.heart} disabled={heartBusy.includes(split.id)} accessibilityRole="button" accessibilityLabel={`${split.liked ? 'Unheart' : 'Heart'} ${split.name}`} accessibilityState={{ selected: split.liked, disabled: heartBusy.includes(split.id) }} aria-pressed={split.liked} onPress={() => heart(split)}>
        {heartBusy.includes(split.id) ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={split.liked ? 'heart' : 'heart-outline'} size={20} color={colors.text.primary} />}
        <Text style={styles.meta}>{split.heart_count || 0}</Text>
    </TouchableOpacity>;

    return <SafeAreaView style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to my plan"><Ionicons name="arrow-back" size={23} color={colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Workouts</Text>
            <TouchableOpacity style={styles.publish} onPress={() => setPublishOpen(true)} accessibilityRole="button" accessibilityLabel="Publish a workout"><Ionicons name="add" size={19} color={colors.text.primary} /><Text style={styles.meta}>Publish</Text></TouchableOpacity>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Workout collections">{['fitzo', 'community'].map(tab => <TouchableOpacity key={tab} style={[styles.tab, collection === tab && styles.active]} onPress={() => setCollection(tab)} accessibilityRole="tab" accessibilityState={{ selected: collection === tab }} aria-selected={collection === tab} accessibilityLabel={`${titleCase(tab)} Workouts`}><Text style={[styles.tabText, collection === tab && styles.activeText]}>{titleCase(tab)}</Text></TouchableOpacity>)}</View>
        <Text style={styles.intro}>{collection === 'fitzo' ? 'Plans curated by Fitzo. Find a split that fits your week.' : 'Built by the community. Heart the routines you’d recommend.'}</Text>
        <View style={styles.search}>
            <Ionicons name="search-outline" size={20} color={colors.text.muted} />
            <TextInput style={styles.searchInput} accessibilityLabel="Search workouts" value={search} onChangeText={setSearch} placeholder="Search plans, people or tags" placeholderTextColor={colors.text.muted} maxLength={100} autoCorrect={false} returnKeyType="search" onSubmitEditing={() => setQuery(search.trim())} />
            {!!search && <TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Clear workout search" onPress={() => { setSearch(''); setQuery(''); }}><Ionicons name="close-circle" size={19} color={colors.text.muted} /></TouchableOpacity>}
        </View>
        <View style={styles.tools}>
            <TouchableOpacity style={styles.filterButton} accessibilityRole="button" accessibilityLabel={`Workout filters${filterCount ? `, ${filterCount} active` : ''}`} onPress={() => setFilterOpen(true)}><Ionicons name="options-outline" size={18} color={colors.text.primary} /><Text style={styles.meta}>Filters{filterCount ? ` · ${filterCount}` : ''}</Text></TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts}>{sorts.map(option => <TouchableOpacity key={option.id} style={styles.sortButton} accessibilityRole="radio" accessibilityLabel={`Sort by ${option.label.toLowerCase()}`} accessibilityState={{ checked: sort === option.id }} onPress={() => setSort(option.id)}><Text style={[styles.meta, sort !== option.id && { color: colors.text.muted }]}>{option.label}</Text>{sort === option.id && <View style={styles.sortDot} />}</TouchableOpacity>)}</ScrollView>
        </View>
        {(filterCount > 0 || !!query) && <View style={styles.summary}><Text style={[styles.body, { flex: 1 }]}>{[days && `${days} training ${days === 1 ? 'day' : 'days'}`, difficulty && titleCase(difficulty), query && `“${query}”`].filter(Boolean).join(' · ')}</Text><TouchableOpacity style={styles.filterButton} accessibilityRole="button" accessibilityLabel="Clear all workout filters" onPress={resetFilters}><Text style={styles.meta}>Clear all</Text></TouchableOpacity></View>}
        {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} accessibilityLabel="Loading workouts" /></View> : <FlatList style={{ flex: 1, minHeight: 0 }} data={splits} keyExtractor={item => item.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" renderItem={({ item }) => <View style={styles.card}>
            <TouchableOpacity onPress={() => openDetails(item)} accessibilityRole="button" accessibilityLabel={`Preview ${item.name}`} style={styles.cardPreview}>
                <View style={styles.cardTop}><Text style={styles.overline}>{item.days_per_week} DAYS / WEEK</Text><Ionicons name="chevron-forward" size={19} color={colors.text.muted} /></View>
                <Text style={styles.planName}>{item.name}</Text>
                <Text style={styles.body}>{item.is_official ? 'Fitzo' : item.author_name || 'Community member'} · {titleCase(item.difficulty_level)}</Text>
                {!!item.description && <Text style={styles.description} numberOfLines={2}>{item.description}</Text>}
                <View style={styles.tags}>{item.tags?.slice(0, 3).map(tag => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
            </TouchableOpacity>
            <View style={styles.cardBottom}><Text style={[styles.body, { flex: 1 }]}>{item.has_exercises ? 'Exercises & targets included' : 'Schedule only'} · {item.download_count || 0} uses</Text>{renderHeart(item)}</View>
        </View>} ListEmptyComponent={<View style={styles.empty}><Ionicons name="layers-outline" size={30} color={colors.text.muted} /><Text style={styles.planName}>{error ? 'Workouts couldn’t load' : filterCount || query ? 'No matching workouts' : 'No workouts here yet'}</Text><Text style={styles.body}>{error || (filterCount || query ? 'Try fewer filters or a different search.' : collection === 'community' ? 'Share your saved split to get the community started.' : 'Check back for new Fitzo plans.')}</Text>{!error && (filterCount > 0 || !!query) && <TouchableOpacity style={styles.filterButton} onPress={resetFilters} accessibilityRole="button" accessibilityLabel="Reset workout filters"><Text style={styles.meta}>Reset filters</Text></TouchableOpacity>}</View>} ListFooterComponent={<View style={styles.listFooter}>
            {!!error && <>{splits.length > 0 && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}<TouchableOpacity style={styles.filterButton} accessibilityRole="button" accessibilityLabel="Retry workouts" onPress={() => load(splits.length ? page + 1 : 0)}><Text style={styles.meta}>Try again</Text></TouchableOpacity></>}
            {!error && hasMore && <TouchableOpacity style={styles.filterButton} accessibilityRole="button" accessibilityLabel="Load more workouts" disabled={loadingMore} onPress={() => { if (!morePending.current) { morePending.current = true; void load(page + 1); } }}>{loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.meta}>Load more workouts</Text>}</TouchableOpacity>}
        </View>} />}

        <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
            <View style={styles.overlay}><SafeAreaView style={styles.sheet} edges={['bottom']}>
                <View style={styles.header}><Text style={styles.headerTitle}>Filter workouts</Text><TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close workout filters" onPress={() => setFilterOpen(false)}><Ionicons name="close" size={23} color={colors.text.primary} /></TouchableOpacity></View>
                <ScrollView contentContainerStyle={styles.sheetContent}>
                    <Text style={styles.sectionTitle}>Training days per week</Text><Text style={styles.body}>Rest days don’t count toward this number.</Text>
                    <View style={styles.choices}>{[undefined, 1, 2, 3, 4, 5, 6, 7].map(day => <TouchableOpacity key={day || 'all'} style={[styles.chip, days === day && styles.active]} accessibilityRole="radio" accessibilityLabel={day ? `${day} training days` : 'Any training days'} accessibilityState={{ checked: days === day }} onPress={() => setDays(day)}><Text style={[styles.meta, days === day && styles.activeText]}>{day || 'Any'}</Text></TouchableOpacity>)}</View>
                    <Text style={styles.sectionTitle}>Experience level</Text><View style={styles.choices}>{[undefined, 'beginner', 'intermediate', 'advanced'].map(level => <TouchableOpacity key={level || 'any'} style={[styles.chip, difficulty === level && styles.active]} accessibilityRole="radio" accessibilityLabel={level ? `${titleCase(level)} workouts` : 'Any experience level'} accessibilityState={{ checked: difficulty === level }} onPress={() => setDifficulty(level)}><Text style={[styles.meta, difficulty === level && styles.activeText]}>{level ? titleCase(level) : 'Any'}</Text></TouchableOpacity>)}</View>
                    <TouchableOpacity style={styles.filterButton} accessibilityRole="button" accessibilityLabel="Reset days and level" onPress={() => { setDays(undefined); setDifficulty(undefined); }}><Text style={styles.meta}>Reset days & level</Text></TouchableOpacity>
                </ScrollView>
                <TouchableOpacity style={styles.primary} accessibilityRole="button" accessibilityLabel="Show filtered workouts" onPress={() => setFilterOpen(false)}><Text style={styles.primaryText}>Show workouts</Text></TouchableOpacity>
            </SafeAreaView></View>
        </Modal>
        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetails}>
            <View style={styles.overlay}><SafeAreaView style={[styles.sheet, styles.detailSheet]} edges={['bottom']}>
                <View style={styles.header}><Text style={styles.headerTitle}>Plan preview</Text><TouchableOpacity style={styles.iconButton} disabled={adopting} accessibilityRole="button" accessibilityLabel="Close plan preview" onPress={closeDetails}><Ionicons name="close" size={23} color={colors.text.primary} /></TouchableOpacity></View>
                {selected && <><ScrollView contentContainerStyle={styles.sheetContent}>
                    <Text style={styles.planName}>{selected.name}</Text><Text style={styles.body}>By {selected.is_official ? 'Fitzo' : selected.author_name} · {selected.days_per_week} days/week · {titleCase(selected.difficulty_level)}</Text>
                    <Text style={styles.description}>{selected.description}</Text>{renderHeart(selected)}
                    {detailLoading ? <ActivityIndicator color={colors.primary} /> : detailError ? <><Text style={styles.error} accessibilityRole="alert">{detailError}</Text><TouchableOpacity style={styles.filterButton} accessibilityRole="button" accessibilityLabel="Retry plan preview" onPress={() => openDetails(selected)}><Text style={styles.meta}>Try again</Text></TouchableOpacity></> : <>
                        <Text style={styles.sectionTitle}>{selected.has_exercises ? 'Schedule & exercises' : 'Weekly schedule'}</Text>
                        {!selected.has_exercises && <Text style={styles.body}>This plan shares the split only. Choose exercises as you train.</Text>}
                        {Object.entries(selected.program_structure).map(([day, focus]) => {
                            const exercises = customSessionDraft(selected.training_plan, focus) || starterSessionDraft(selected.training_plan, focus);
                            return <View key={day} style={styles.day}><Text style={styles.overline}>{day}</Text><Text style={styles.sectionTitle}>{focus}</Text>{exercises?.map((exercise, index) => <View key={index} style={styles.exercise}><Text style={styles.meta}>{exercise.name}</Text><Text style={styles.body}>{exercise.instructions}</Text></View>)}</View>;
                        })}
                    </>}
                </ScrollView><View style={styles.detailFooter}><Text style={styles.body}>Makes this your active plan. Your existing plan stays saved.</Text><TouchableOpacity style={[styles.primary, (adopting || detailLoading || !!detailError) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Use this plan" disabled={adopting || detailLoading || !!detailError} onPress={adopt}>{adopting ? <ActivityIndicator color={colors.text.dark} /> : <Text style={styles.primaryText}>Use this plan</Text>}</TouchableOpacity></View></>}
            </SafeAreaView></View>
        </Modal>
        <PublishSplitModal visible={publishOpen} onClose={() => setPublishOpen(false)} onSuccess={() => { setPublishOpen(false); setCollection('community'); resetFilters(); setSort('newest'); setRefresh(value => value + 1); toast.success('Workout published', 'Your split is now in Community Workouts.'); }} />
    </SafeAreaView>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, minHeight: 58, gap: spacing.sm },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: typography.fontFamily.semiBold, fontSize: 17, color: colors.text.primary },
    publish: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
    tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, padding: 4, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full },
    tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, paddingHorizontal: 6 },
    tabText: { fontFamily: typography.fontFamily.semiBold, fontSize: 12, color: colors.text.secondary },
    active: { backgroundColor: colors.primary, borderColor: colors.primary }, activeText: { color: colors.text.dark },
    intro: { fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 20, color: colors.text.muted, marginHorizontal: spacing.lg, marginVertical: spacing.md },
    search: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.lg, paddingLeft: spacing.md, minHeight: 50 },
    searchInput: { flex: 1, minWidth: 0, color: colors.text.primary, fontFamily: typography.fontFamily.regular, fontSize: 13, padding: spacing.sm, minHeight: 48 },
    tools: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.sm },
    filterButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
    sorts: { gap: spacing.md }, sortButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 5 }, sortDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
    summary: { marginHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    list: { padding: spacing.lg, gap: spacing.md }, card: { borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: colors.surface },
    cardPreview: { padding: spacing.lg, gap: spacing.sm }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    overline: { fontFamily: typography.fontFamily.medium, fontSize: 10, letterSpacing: 1.2, color: colors.text.muted },
    planName: { fontFamily: typography.fontFamily.semiBold, fontSize: 21, lineHeight: 29, color: colors.text.primary },
    meta: { fontFamily: typography.fontFamily.medium, fontSize: 12, lineHeight: 19, color: colors.text.primary },
    body: { fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 20, color: colors.text.secondary },
    description: { fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 22, color: colors.text.secondary },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, tag: { fontFamily: typography.fontFamily.regular, fontSize: 10, color: colors.text.muted, backgroundColor: colors.surfaceLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm },
    cardBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 4, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glass.border },
    heart: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: 60, minHeight: 44, gap: 7, alignSelf: 'flex-start' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, empty: { paddingVertical: spacing.xl, gap: spacing.md, alignItems: 'center' },
    listFooter: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.lg },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.glass.border, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', paddingBottom: spacing.md },
    detailSheet: { height: '90%' }, sheetContent: { padding: spacing.lg, gap: spacing.md }, sectionTitle: { fontFamily: typography.fontFamily.semiBold, fontSize: 15, lineHeight: 23, color: colors.text.primary },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { minHeight: 44, minWidth: 44, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full },
    primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.full, marginHorizontal: spacing.lg }, primaryText: { color: colors.text.dark, fontFamily: typography.fontFamily.semiBold, fontSize: 14 },
    day: { borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm }, exercise: { gap: 4, marginTop: spacing.sm },
    detailFooter: { borderTopWidth: 1, borderTopColor: colors.glass.border, padding: spacing.md, gap: spacing.md, alignItems: 'stretch' },
    error: { color: '#FCA5A5', fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 21 },
});
