import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { readinessAPI } from '../services/api';
import { localDateString } from '../utils/healthDate';
import { colors, typography } from '../styles/theme';

type Answers = { energy_level: number | null; sleep_quality: number | null; soreness: number | null; sleep_hours: string };
type SavedCheckIn = { energy_level: number; sleep_quality: number; soreness: number; sleep_hours?: number | null; notes?: string | null };
const empty: Answers = { energy_level: null, sleep_quality: null, soreness: null, sleep_hours: '' };
const questions = [
    { key: 'energy_level', label: 'Energy', low: 'Very low', high: 'Very high' },
    { key: 'sleep_quality', label: 'Sleep quality', low: 'Poor', high: 'Great' },
    { key: 'soreness', label: 'Muscle soreness', low: 'None', high: 'Very sore' },
] as const;

export default function RecoveryCheckIn({ userId }: { userId?: string }) {
    const [expanded, setExpanded] = useState(false);
    const [answers, setAnswers] = useState<Answers>(empty);
    const [saved, setSaved] = useState<SavedCheckIn | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [message, setMessage] = useState('');
    const version = useRef(0);
    const busy = useRef(false);
    const day = useRef(localDateString());
    const mounted = useRef(true);
    useEffect(() => {
        const generation = version;
        mounted.current = true;
        return () => { mounted.current = false; generation.current++; };
    }, []);
    const load = useCallback(async () => {
        const requestVersion = ++version.current;
        setLoading(true);
        setLoadError(false);
        try {
            if (!userId) return;
            const requestedDay = localDateString();
            const response = await readinessAPI.getToday(requestedDay);
            if (version.current !== requestVersion) return;
            if (requestedDay !== localDateString()) throw new Error('The day changed while loading');
            const checkin = response.checked_in ? response.readiness as SavedCheckIn : null;
            day.current = requestedDay;
            setSaved(checkin);
            setAnswers(checkin ? { energy_level: checkin.energy_level, sleep_quality: checkin.sleep_quality,
                soreness: checkin.soreness, sleep_hours: checkin.sleep_hours == null ? '' : String(checkin.sleep_hours) } : empty);
            setMessage('');
        } catch { if (version.current === requestVersion) setLoadError(true); }
        finally { if (version.current === requestVersion) setLoading(false); }
    }, [userId]);
    useFocusEffect(useCallback(() => {
        if (!busy.current) void load();
    }, [load]));

    const complete = questions.every(question => answers[question.key] != null);
    const save = async () => {
        if (!userId || !complete || busy.current || loading || loadError) return;
        if (day.current !== localDateString()) {
            setExpanded(false);
            await load();
            setMessage('It is a new day. Add a fresh check-in when you are ready.');
            return;
        }
        const hoursText = answers.sleep_hours.trim().replace(',', '.');
        const hours = hoursText ? Number(hoursText) : undefined;
        if (hours !== undefined && (!Number.isFinite(hours) || hours < 0 || hours > 24)) {
            setMessage('Enter sleep hours between 0 and 24, or leave it blank.');
            return;
        }
        busy.current = true;
        setSaving(true);
        setMessage('');
        const requestVersion = version.current;
        try {
            const response = await readinessAPI.checkin({ energy_level: answers.energy_level!, sleep_quality: answers.sleep_quality!,
                soreness: answers.soreness!, sleep_hours: hours, date: day.current });
            if (!response.success || !response.readiness) throw new Error('Check-in was not saved');
            if (version.current !== requestVersion) return;
            setSaved(response.readiness);
            setExpanded(false);
            setMessage('Check-in saved for today.');
        } catch { if (version.current === requestVersion) setMessage('Could not save your check-in. Your answers are kept. Try again.'); }
        finally { busy.current = false; if (mounted.current) setSaving(false); }
    };

    return <View style={styles.card}>
        <View style={styles.header}>
            <View style={styles.flex}>
                <Text style={styles.title}>How do you feel today?</Text>
                <Text style={styles.detail}>Optional recovery check-in</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={expanded ? 'Close recovery check-in' : saved ? 'Edit recovery check-in' : 'Open recovery check-in'}
                accessibilityState={{ expanded, disabled: saving }} aria-expanded={expanded} disabled={saving}
                style={styles.link} onPress={() => { setExpanded(value => !value); setMessage(''); }}>
                <Text style={styles.linkText}>{expanded ? 'Close' : saved && !loadError ? 'Edit' : 'Check in'}</Text>
            </TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator accessibilityLabel="Loading recovery check-in" color={colors.primary} /> : loadError ? <View>
            <Text style={styles.detail}>Could not load today&apos;s check-in. You can still log a workout.</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.link} onPress={() => { void load(); }}><Text style={styles.linkText}>Try again</Text></TouchableOpacity>
        </View> : !expanded && saved ? <Text style={styles.detail}>Today: energy {saved.energy_level}/5 · sleep {saved.sleep_quality}/5 · soreness {saved.soreness}/5</Text> : null}
        {expanded && !loading && !loadError && <View style={styles.form}>
            <Text style={styles.detail}>Your own ratings. They can help your coach understand recent recovery; they do not measure your health.</Text>
            {questions.map(question => <View key={question.key} style={styles.question}>
                <Text style={styles.label}>{question.label}</Text>
                <View accessibilityRole="radiogroup" accessibilityLabel={question.label} style={styles.options}>
                    {[1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value} accessibilityRole="radio"
                        accessibilityLabel={`${question.label} ${value} of 5${value === 1 ? `, ${question.low}` : value === 5 ? `, ${question.high}` : ''}`}
                        accessibilityState={{ checked: answers[question.key] === value, disabled: saving }} aria-checked={answers[question.key] === value}
                        disabled={saving} onPress={() => setAnswers(current => ({ ...current, [question.key]: value }))}
                        style={[styles.option, answers[question.key] === value && styles.selected]}>
                        <Text style={[styles.optionText, answers[question.key] === value && styles.selectedText]}>{value}</Text>
                    </TouchableOpacity>)}
                </View>
                <View style={styles.scale}><Text style={styles.detail}>1 · {question.low}</Text><Text style={styles.detail}>5 · {question.high}</Text></View>
            </View>)}
            <Text style={styles.label}>Hours asleep (optional)</Text>
            <TextInput accessibilityLabel="Hours asleep, optional" editable={!saving} keyboardType="decimal-pad"
                value={answers.sleep_hours} onChangeText={sleep_hours => setAnswers(current => ({ ...current, sleep_hours }))}
                placeholder="e.g. 7.5" placeholderTextColor={colors.text.muted} style={styles.input} />
            {!complete && <Text style={styles.detail}>Choose one rating for each question to save.</Text>}
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !complete || saving, busy: saving }}
                disabled={!complete || saving} style={[styles.save, (!complete || saving) && styles.disabled]} onPress={() => { void save(); }}>
                {saving ? <ActivityIndicator color={colors.background} accessibilityLabel="Saving recovery check-in" /> : <Text style={styles.saveText}>Save check-in</Text>}
            </TouchableOpacity>
        </View>}
        {!!message && <Text accessibilityLiveRegion="polite" style={styles.detail}>{message}</Text>}
    </View>;
}
const styles = StyleSheet.create({
    card: { padding: 16, marginBottom: 20, borderRadius: 20, backgroundColor: colors.surface, gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1, minWidth: 0 },
    title: { color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 17 },
    detail: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20 },
    link: { minHeight: 48, paddingHorizontal: 10, justifyContent: 'center', alignSelf: 'flex-start' },
    linkText: { color: colors.primary, fontFamily: typography.fontFamily.medium, fontSize: 14 },
    form: { gap: 12 }, question: { gap: 8 }, label: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 14 },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    option: { flex: 1, minWidth: 44, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.glass.borderLight, alignItems: 'center', justifyContent: 'center' },
    selected: { backgroundColor: colors.primary, borderColor: colors.primary },
    optionText: { fontFamily: typography.fontFamily.medium, fontSize: 16, color: colors.text.primary }, selectedText: { color: colors.background },
    scale: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
    input: { minHeight: 48, borderWidth: 1, borderColor: colors.glass.borderLight, borderRadius: 12, padding: 12, color: colors.text.primary, fontSize: 16, fontFamily: typography.fontFamily.regular },
    save: { minHeight: 48, borderRadius: 12, padding: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    saveText: { color: colors.background, fontFamily: typography.fontFamily.semiBold, fontSize: 15 }, disabled: { opacity: 0.5 },
});
