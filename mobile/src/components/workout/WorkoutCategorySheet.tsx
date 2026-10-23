import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WORKOUT_TYPES } from './types';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import Button from '../Button';

export default function WorkoutCategorySheet({ visible, onChoose, onClose }: {
    visible: boolean; onChoose: (type: typeof WORKOUT_TYPES[number]) => void; onClose: () => void;
}) {
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.backdrop}><View style={styles.sheet}>
            <Text style={styles.title}>Choose your primary focus</Text>
            <Text style={styles.detail}>All your exercises and sets stay together. Choose the main focus for your history.</Text>
            <ScrollView>{WORKOUT_TYPES.map(type => <Pressable key={type} accessibilityRole="button" accessibilityLabel={`Primary focus: ${type}`} style={styles.option} onPress={() => onChoose(type)}><Text style={styles.label}>{type[0].toUpperCase() + type.slice(1)}</Text></Pressable>)}</ScrollView>
            <Button title="Keep editing" variant="ghost" onPress={onClose} />
        </View></View>
    </Modal>;
}
const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: { maxHeight: '85%', padding: spacing.xl, paddingBottom: spacing['3xl'], backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.glass.border },
    title: { fontFamily: typography.fontFamily.semiBold, fontSize: typography.sizes.xl, color: colors.text.primary },
    detail: { fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20, marginVertical: spacing.md },
    option: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.glass.border },
    label: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.md, color: colors.text.primary },
});
