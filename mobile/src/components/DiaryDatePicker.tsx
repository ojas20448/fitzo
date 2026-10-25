import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { localDiaryDate } from '../utils/foodDiary';
import { useLocalDay } from '../hooks/useLocalDay';

interface Props {
    visible: boolean;
    date: string;
    onSelect: (date: string) => void;
    onClose: () => void;
}

export default function DiaryDatePicker({ visible, date, onSelect, onClose }: Props) {
    const today = useLocalDay();
    const [month, setMonth] = useState(date.slice(0, 7));
    useEffect(() => { if (visible) setMonth(date.slice(0, 7)); }, [visible, date]);
    if (!visible) return null;
    const first = new Date(`${month}-01T12:00:00`);
    const padding = (first.getDay() + 6) % 7;
    const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const moveMonth = (offset: number) => {
        const next = new Date(first);
        next.setMonth(next.getMonth() + offset);
        setMonth(localDiaryDate(next).slice(0, 7));
    };
    const choose = (value: string) => { onSelect(value); onClose(); };
    return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close calendar" onPress={onClose} />
            <View style={styles.sheet} accessibilityViewIsModal><ScrollView>
                <View style={styles.header}>
                    <Pressable style={styles.control} accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)}><Ionicons name="chevron-back" size={22} color={colors.text.primary} /></Pressable>
                    <Text style={styles.title}>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
                    <Pressable style={styles.control} accessibilityRole="button" accessibilityLabel="Next month" disabled={month >= today.slice(0, 7)} accessibilityState={{ disabled: month >= today.slice(0, 7) }} onPress={() => moveMonth(1)}><Ionicons name="chevron-forward" size={22} color={month >= today.slice(0, 7) ? colors.text.subtle : colors.text.primary} /></Pressable>
                </View>
                <View style={styles.grid}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <View key={`label-${index}`} style={styles.day}><Text style={styles.muted}>{label}</Text></View>)}
                    {Array.from({ length: padding }, (_, index) => <View key={`empty-${index}`} style={styles.day} />)}
                    {Array.from({ length: count }, (_, index) => {
                        const value = `${month}-${String(index + 1).padStart(2, '0')}`;
                        const disabled = value > today;
                        return <Pressable key={value} style={[styles.day, value === date && styles.selected]} accessibilityRole="button" accessibilityLabel={`Choose ${value}`} accessibilityState={{ selected: value === date, disabled }} disabled={disabled} onPress={() => choose(value)}>
                            <Text style={[styles.text, disabled && styles.muted]}>{index + 1}</Text>
                        </Pressable>;
                    })}
                </View>
                <View style={styles.header}>
                    <Pressable style={styles.control} accessibilityRole="button" accessibilityLabel="Choose today" onPress={() => choose(today)}><Text style={styles.text}>Today</Text></Pressable>
                    <Pressable style={styles.control} accessibilityRole="button" accessibilityLabel="Cancel date selection" onPress={onClose}><Text style={styles.text}>Cancel</Text></Pressable>
                </View>
            </ScrollView></View>
        </View>
    </Modal>;
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.md },
    sheet: { width: '100%', maxWidth: 420, maxHeight: '90%', alignSelf: 'center', padding: spacing.md, borderRadius: borderRadius.xl, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.glass.border },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    title: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 16, flexShrink: 1 },
    control: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: spacing.sm },
    day: { width: `${100 / 7}%`, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md },
    selected: { backgroundColor: colors.glass.surfaceLight, borderWidth: 1, borderColor: colors.primary },
    text: { color: colors.text.primary, fontFamily: typography.fontFamily.regular, fontSize: 14 },
    muted: { color: colors.text.subtle, fontFamily: typography.fontFamily.regular, fontSize: 13 },
});
