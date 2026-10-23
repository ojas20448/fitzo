import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { borderRadius, colors, typography, spacing } from '../../styles/theme';
import ExerciseList from '../../components/ExerciseList';
import ExerciseDetailsModal from '../../components/ExerciseDetailsModal';
import ScreenBackdrop from '../../components/ScreenBackdrop';

type Exercise = React.ComponentProps<typeof ExerciseDetailsModal>['exercise'] & { id: string };
export default function ExerciseLibraryScreen() {
    const router = useRouter();
    const [selected, setSelected] = useState<Exercise | null>(null);
    return <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenBackdrop />
        <View style={styles.frame}>
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <Pressable accessibilityRole="button" accessibilityLabel="Back to workout" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backButton}><Ionicons name="arrow-back-outline" size={23} color={colors.text.primary} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Explore workouts" style={styles.workouts} onPress={() => router.push('/member/curated-workouts')}><Ionicons name="compass-outline" size={19} color={colors.text.secondary} /><Text style={styles.workoutsText}>Workouts</Text></Pressable>
            </View>
            <Text style={styles.eyebrow}>YOUR TRAINING</Text>
            <Text accessibilityRole="header" style={styles.headerTitle}>Exercise library</Text>
            <Text style={styles.headerSubtitle}>Find movements and check their technique.</Text>
        </View>
        <ExerciseList onSelect={setSelected} mode="view" />
        </View>
        {selected && <ExerciseDetailsModal exercise={selected} onClose={() => setSelected(null)}
            onAdd={/^[a-zA-Z0-9_-]{1,80}$/.test(String(selected.id)) ? () => {
                const id = String(selected.id); setSelected(null);
                router.push({ pathname: '/log/workout', params: { start: 'empty', addExerciseId: id } });
            } : undefined} />}
    </SafeAreaView>;
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    frame: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
    header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xl },
    backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full },
    workouts: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full },
    workoutsText: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 12 },
    eyebrow: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium, fontSize: 10, letterSpacing: 1.7, marginBottom: spacing.sm },
    headerTitle: { fontFamily: typography.fontFamily.semiBold, fontSize: 28, letterSpacing: -0.8, color: colors.text.primary },
    headerSubtitle: { fontFamily: typography.fontFamily.regular, fontSize: 13, color: colors.text.secondary, lineHeight: 20, marginTop: spacing.sm },
});
