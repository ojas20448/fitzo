import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';
import { EXPERIENCE_CHOICES, EQUIPMENT_CHOICES, SESSION_MINUTES, TrainingPreferences } from '../utils/starterWorkout';

export type TrainingAnswers = { days: number | null; experience: TrainingPreferences['experience'] | null; equipment: TrainingPreferences['equipment'] | null; sessionMinutes: TrainingPreferences['session_minutes'] | null };
export default function TrainingChoices({ value, onChange, disabled = false }: {
    value: TrainingAnswers; onChange: (patch: Partial<TrainingAnswers>) => void; disabled?: boolean;
}) {
    const [open, setOpen] = useState<string | null>(null);
    const { width, fontScale } = useWindowDimensions();
    const compact = width < 380 || fontScale > 1.2;
    const groups = [
        { key: 'experience', heading: 'Your training experience', label: 'Choose training experience', selected: value.experience, choices: EXPERIENCE_CHOICES },
        { key: 'equipment', heading: 'What can you train with?', label: 'Choose training equipment', selected: value.equipment, choices: EQUIPMENT_CHOICES },
    ];
    return <View>
        <Text style={s.heading}>How many days can you train?</Text>
        <View style={s.days}>{[1, 2, 3, 4, 5, 6].map(day => <TouchableOpacity key={day} disabled={disabled}
            style={[s.day, compact && s.compactDay, value.days === day && s.selected]} onPress={() => onChange({ days: day })}
            accessibilityRole="radio" accessibilityLabel={`${day} training ${day === 1 ? 'day' : 'days'} per week`}
            accessibilityState={{ checked: value.days === day, selected: value.days === day, disabled }} aria-checked={value.days === day}>
            <Text style={s.title}>{day}</Text>
        </TouchableOpacity>)}</View>
        <Text style={s.detail}>Rest days fit between your sessions.</Text>
        {groups.map(group => <View key={group.key}>
            <Text style={s.heading}>{group.heading}</Text>
            <TouchableOpacity style={s.select} disabled={disabled} onPress={() => setOpen(open === group.key ? null : group.key)}
                accessibilityRole="button" accessibilityLabel={group.label} accessibilityState={{ expanded: open === group.key, disabled }} aria-expanded={open === group.key}>
                <View style={s.grow}><Text style={s.title}>{group.choices.find(item => item.id === group.selected)?.title || group.label}</Text>
                    {!!group.selected && <Text style={s.detail}>{group.choices.find(item => item.id === group.selected)?.detail}</Text>}
                </View>
                <MaterialIcons name={open === group.key ? 'expand-less' : 'expand-more'} size={22} color={colors.text.secondary} />
            </TouchableOpacity>
            {open === group.key && group.choices.map(item => <TouchableOpacity key={item.id} disabled={disabled}
                style={[s.option, group.selected === item.id && s.selected]}
                onPress={() => { onChange({ [group.key]: item.id }); setOpen(null); }}
                accessibilityRole="radio" accessibilityLabel={item.title} accessibilityState={{ checked: group.selected === item.id, selected: group.selected === item.id, disabled }} aria-checked={group.selected === item.id}>
                <View style={s.optionRow}><View style={s.grow}><Text style={s.title}>{item.title}</Text>{!!item.detail && <Text style={s.detail}>{item.detail}</Text>}</View>
                    <MaterialIcons name={group.selected === item.id ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={group.selected === item.id ? colors.text.primary : colors.text.muted} />
                </View>
            </TouchableOpacity>)}
        </View>)}
        <Text style={s.heading}>Time for each session</Text>
        <View style={s.sessions}>{SESSION_MINUTES.map(minutes => <TouchableOpacity key={minutes} disabled={disabled}
            style={[s.session, compact && s.compactSession, value.sessionMinutes === minutes && s.selected]} onPress={() => onChange({ sessionMinutes: minutes })}
            accessibilityRole="radio" accessibilityLabel={`About ${minutes} minutes`} accessibilityState={{ checked: value.sessionMinutes === minutes, selected: value.sessionMinutes === minutes, disabled }} aria-checked={value.sessionMinutes === minutes}>
            <Text style={s.title}>{minutes} min</Text>
        </TouchableOpacity>)}</View>
        <Text style={s.detail}>Approximate time. Exercises and reps stay editable in the logger.</Text>
    </View>;
}
const s = StyleSheet.create({
    heading: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15, marginTop: 16, marginBottom: 8 },
    title: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15, lineHeight: 22 },
    detail: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, marginTop: 6 },
    days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, day: { flexGrow: 1, flexBasis: '13%', minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#333', padding: 10 }, compactDay: { flexBasis: '28%' },
    select: { minHeight: 52, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#101010' },
    grow: { flex: 1, minWidth: 0 }, option: { minHeight: 48, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#333', borderRadius: 12, backgroundColor: '#101010' }, optionRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    sessions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, session: { flex: 1, flexBasis: 70, minWidth: 70, minHeight: 52, padding: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333', borderRadius: 12, backgroundColor: '#101010' },
    compactSession: { flexBasis: '45%' },
    selected: { borderColor: colors.text.primary, backgroundColor: colors.surfaceLighter },
});
