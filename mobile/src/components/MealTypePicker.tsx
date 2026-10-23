import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MEAL_TYPES, MealType } from '../utils/foodPortion';
import { borderRadius, colors, spacing, typography } from '../styles/theme';

export default function MealTypePicker({ value, onChange, labelPrefix = 'Add to ' }: { value: MealType; onChange: (meal: MealType) => void; labelPrefix?: string }) {
    const { width, fontScale } = useWindowDimensions();
    const twoRows = width < 360 || fontScale > 1.2;
    return <View accessibilityRole="radiogroup" accessibilityLabel={labelPrefix ? 'Add food to a meal' : 'Meal type'} style={styles.row}>
        {MEAL_TYPES.map(meal => <Pressable key={meal} accessibilityRole="radio" accessibilityLabel={`${labelPrefix}${meal}`}
            accessibilityState={{ checked: value === meal }} aria-checked={value === meal}
            onPress={() => onChange(meal)} style={[styles.option, { flexBasis: twoRows ? '45%' : '20%' }, value === meal && styles.selected]}>
            <Text style={[styles.label, value === meal && styles.selectedLabel]}>{meal === 'snack' ? 'Snacks' : meal[0].toUpperCase() + meal.slice(1)}</Text>
        </Pressable>)}
    </View>;
}
const styles = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    option: { flexGrow: 1, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.glass.border, backgroundColor: colors.glass.surface },
    selected: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { color: colors.text.secondary, fontSize: 12, fontFamily: typography.fontFamily.medium },
    selectedLabel: { color: colors.text.dark },
});
