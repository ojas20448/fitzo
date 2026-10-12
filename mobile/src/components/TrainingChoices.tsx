import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';
import { EXPERIENCE_CHOICES, EQUIPMENT_CHOICES, TrainingPreferences } from '../utils/starterWorkout';

export type TrainingAnswers = { days: number | null; experience: TrainingPreferences['experience'] | null; equipment: TrainingPreferences['equipment'] | null; sessionMinutes: TrainingPreferences['session_minutes'] | null };
export default function TrainingChoices({ value, onChange, disabled = false }: {
    value: TrainingAnswers; onChange: (patch: Partial<TrainingAnswers>) => void; disabled?: boolean;
}) {
    const [open, setOpen] = useState<string | null>(null);
    const groups = [
        { key: 'experience', heading: 'Your training experience', label: 'Choose training experience', selected: value.experience, choices: EXPERIENCE_CHOICES },
        { key: 'equipment', heading: 'What can you train with?', label: 'Choose training equipment', selected: value.equipment, choices: EQUIPMENT_CHOICES },
        { key: 'sessionMinutes', heading: 'Time for each session', label: 'Choose session length', selected: value.sessionMinutes,
            choices: ([20, 35, 50] as const).map(id => ({ id, title: `About ${id} minutes`, detail: '' })) },
    ];
    return <View>
        <Text style={s.heading}>How many days can you train?</Text>
        <View style={s.days}>{[1, 2, 3, 4, 5, 6].map(day => <TouchableOpacity key={day} disabled={disabled}
            style={[s.day, value.days === day && s.selected]} onPress={() => onChange({ days: day })}
            accessibilityRole="radio" accessibilityLabel={`${day} training ${day === 1 ? 'day' : 'days'} per week`}
            accessibilityState={{ checked: value.days === day, selected: value.days === day, disabled }} aria-checked={value.days === day}>
            <Text style={s.title}>{day}</Text>
        </TouchableOpacity>)}</View>
        <Text style={s.detail}>Rest days fit between your sessions.</Text>
        {groups.map(group => <View key={group.key}>
            <Text style={s.heading}>{group.heading}</Text>
            <TouchableOpacity style={s.select} disabled={disabled} onPress={() => setOpen(open === group.key ? null : group.key)}
                accessibilityRole="button" accessibilityLabel={group.label} accessibilityState={{ expanded: open === group.key, disabled }} aria-expanded={open === group.key}>
                <Text style={[s.title, s.grow]}>{group.choices.find(item => item.id === group.selected)?.title || group.label}</Text>
                <MaterialIcons name={open === group.key ? 'expand-less' : 'expand-more'} size={22} color={colors.text.secondary} />
            </TouchableOpacity>
            {open === group.key && group.choices.map(item => <TouchableOpacity key={item.id} disabled={disabled}
                style={[s.option, group.selected === item.id && s.selected]}
                onPress={() => { onChange({ [group.key]: item.id }); setOpen(null); }}
                accessibilityRole="radio" accessibilityLabel={item.title} accessibilityState={{ checked: group.selected === item.id, selected: group.selected === item.id, disabled }} aria-checked={group.selected === item.id}>
                <Text style={s.title}>{item.title}</Text>{!!item.detail && <Text style={s.detail}>{item.detail}</Text>}
            </TouchableOpacity>)}
        </View>)}
        <Text style={s.detail}>Approximate time. Exercises and reps stay editable in the logger.</Text>
    </View>;
}
const s = StyleSheet.create({
    heading: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15, marginTop: 16, marginBottom: 8 },
    title: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15, lineHeight: 22 },
    detail: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, marginTop: 6 },
    days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, day: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#333', padding: 10 },
    select: { minHeight: 52, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#101010' },
    grow: { flex: 1 }, option: { minHeight: 48, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#333', borderRadius: 12, backgroundColor: '#101010' },
    selected: { borderColor: colors.decoration.accent, backgroundColor: '#151811' },
});
