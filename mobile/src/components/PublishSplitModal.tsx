import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { workoutsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SavedSplit { id: string; name: string; days: string[]; training_plan?: unknown }
interface Props { visible: boolean; onClose: () => void; onSuccess: () => void }

export default function PublishSplitModal({ visible, onClose, onSuccess }: Props) {
    const { user, token } = useAuth();
    const identity = `${user?.id}:${token}`;
    const identityRef = useRef(identity); identityRef.current = identity;
    const generation = useRef(0);
    const submitting = useRef(false);
    const [splits, setSplits] = useState<SavedSplit[]>([]);
    const [selected, setSelected] = useState<SavedSplit | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [difficulty, setDifficulty] = useState('intermediate');

    useEffect(() => {
        const request = ++generation.current;
        if (!visible) return;
        setSelected(null); setSplits([]); setError(''); setLoading(true);
        setName(''); setDescription(''); setTags(''); setDifficulty('intermediate');
        workoutsAPI.getMySplits().then(result => {
            if (request === generation.current && identityRef.current === identity) setSplits(result.splits || []);
        }).catch(() => {
            if (request === generation.current && identityRef.current === identity) setError('Couldn’t load your saved plans. Try again.');
        }).finally(() => { if (request === generation.current) setLoading(false); });
        return () => { generation.current++; };
    }, [visible, identity, retry]);

    const close = () => { if (!submitting.current) onClose(); };
    const submit = async () => {
        if (submitting.current || !selected || !token) return;
        const cleanTags = [...new Set(tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))];
        if (!name.trim() || !description.trim()) { setError('Add a plan name and a description before publishing.'); return; }
        if (cleanTags.length > 5 || cleanTags.some(tag => tag.length > 30)) { setError('Use up to 5 tags, with no more than 30 characters each.'); return; }
        submitting.current = true; setSaving(true); setError('');
        try {
            await workoutsAPI.publishSplit({ source_split_id: selected.id, name: name.trim(), description: description.trim(), difficulty_level: difficulty, tags: cleanTags }, token);
            if (identityRef.current === identity) onSuccess();
        } catch (err: any) {
            if (identityRef.current === identity) setError(err?.message || 'Couldn’t publish. Your details are still here; try again.');
        } finally { submitting.current = false; setSaving(false); }
    };

    return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.header}>
                    {selected ? <TouchableOpacity style={styles.iconButton} onPress={() => { if (!submitting.current) { setSelected(null); setError(''); } }} disabled={saving} accessibilityRole="button" accessibilityLabel="Back to saved plans">
                        <Ionicons name="arrow-back" size={23} color={colors.text.primary} />
                    </TouchableOpacity> : <View style={styles.iconButton} />}
                    <Text style={styles.title}>Publish a workout</Text>
                    <TouchableOpacity style={styles.iconButton} onPress={close} disabled={saving} accessibilityRole="button" accessibilityLabel="Close publishing"><Ionicons name="close" size={22} color={colors.text.muted} /></TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                    {!selected ? <>
                        <Text style={styles.heading}>Share your split.</Text>
                        <Text style={styles.body}>Choose a saved plan. People can preview it, heart it and use it as their own routine.</Text>
                        {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading saved plans" />}
                        {!loading && !error && splits.length === 0 && <Text style={styles.body}>Save a plan in My plan first, then come back to publish it.</Text>}
                        {splits.map(split => <TouchableOpacity key={split.id} style={styles.card} onPress={() => { setSelected(split); setName(split.name); setError(''); }} accessibilityRole="button" accessibilityLabel={`Publish ${split.name}`}>
                            <View style={{ flex: 1, gap: 6 }}><Text style={styles.title}>{split.name}</Text><Text style={styles.body}>{split.training_plan ? 'Exercises, sets and rep targets included' : 'Weekly schedule only'}</Text></View>
                            <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
                        </TouchableOpacity>)}
                    </> : <>
                        <Text style={styles.heading}>Make it yours.</Text>
                        <Text style={styles.body}>Published under {user?.name || 'your name'}. Your schedule{selected.training_plan ? ', exercises and targets' : ''} will be public. Workout logs and lifted weights stay private.</Text>
                        <Text style={styles.label}>Plan name</Text>
                        <TextInput style={styles.input} accessibilityLabel="Published plan name" value={name} onChangeText={setName} editable={!saving} maxLength={100} />
                        <Text style={styles.label}>About this plan</Text>
                        <TextInput style={[styles.input, styles.textArea]} accessibilityLabel="Plan description" value={description} onChangeText={setDescription} editable={!saving} maxLength={1500} multiline placeholder="Who is it for? What does it help you work on?" placeholderTextColor={colors.text.muted} />
                        <Text style={styles.label}>Experience level</Text>
                        <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Published plan level">{['beginner', 'intermediate', 'advanced'].map(level => <TouchableOpacity key={level} accessibilityRole="radio" accessibilityLabel={level} accessibilityState={{ checked: difficulty === level }} style={[styles.chip, difficulty === level && styles.active]} onPress={() => setDifficulty(level)} disabled={saving}><Text style={[styles.chipText, difficulty === level && styles.activeText]}>{level[0].toUpperCase() + level.slice(1)}</Text></TouchableOpacity>)}</View>
                        <Text style={styles.label}>Tags · optional</Text>
                        <TextInput style={styles.input} accessibilityLabel="Plan tags" value={tags} onChangeText={setTags} editable={!saving} maxLength={154} placeholder="Strength, hypertrophy, dumbbells" placeholderTextColor={colors.text.muted} />
                        <Text style={styles.body}>Separate up to 5 tags with commas.</Text>
                        <Text style={styles.label}>Schedule from your saved plan</Text>
                        {selected.days.map((day, index) => <View key={index} style={styles.schedule}><Text style={styles.body}>Day {index + 1}</Text><Text style={[styles.title, { flex: 1 }]}>{day}</Text></View>)}
                        <Text style={styles.body}>This publishes a copy. Later edits to your saved routine won’t change the published copy.</Text>
                    </>}
                    {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
                    {!selected && !!error && <TouchableOpacity style={styles.chip} accessibilityRole="button" accessibilityLabel="Retry saved plans" onPress={() => setRetry(value => value + 1)}><Text style={styles.chipText}>Try again</Text></TouchableOpacity>}
                </ScrollView>
                {selected && <View style={styles.footer}><TouchableOpacity style={styles.primary} accessibilityRole="button" accessibilityLabel="Publish to community" disabled={saving} onPress={submit}>{saving ? <ActivityIndicator color={colors.text.dark} /> : <Text style={styles.primaryText}>Publish to community</Text>}</TouchableOpacity></View>}
            </KeyboardAvoidingView>
        </SafeAreaView>
    </Modal>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.glass.border },
    iconButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
    heading: { fontFamily: typography.fontFamily.bold, fontSize: 28, color: colors.text.primary, marginTop: spacing.md },
    title: { fontFamily: typography.fontFamily.semiBold, fontSize: 15, lineHeight: 22, color: colors.text.primary },
    body: { fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 21, color: colors.text.secondary },
    label: { fontFamily: typography.fontFamily.medium, fontSize: 14, color: colors.text.primary, marginTop: spacing.md },
    input: { minHeight: 50, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceLight, color: colors.text.primary, fontFamily: typography.fontFamily.regular, padding: spacing.md },
    textArea: { minHeight: 120, textAlignVertical: 'top' },
    card: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.glass.border, padding: spacing.lg, borderRadius: borderRadius.lg },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full, alignSelf: 'flex-start' },
    chipText: { fontFamily: typography.fontFamily.medium, fontSize: 12, color: colors.text.secondary },
    active: { backgroundColor: colors.primary, borderColor: colors.primary }, activeText: { color: colors.text.dark },
    schedule: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.sm },
    error: { color: '#FCA5A5', fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 21 },
    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.glass.border },
    primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.full },
    primaryText: { fontFamily: typography.fontFamily.semiBold, color: colors.text.dark, fontSize: 14 },
});
