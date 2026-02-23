import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import WeeklyCharts from '../../components/WeeklyCharts';
import { colors, typography, spacing } from '../../styles/theme';

export default function NutritionInsightsScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nutrition Insights</Text>
                <TouchableOpacity onPress={() => router.push('/log/calories' as any)} style={styles.logBtn}>
                    <MaterialIcons name="add" size={22} color={colors.text.primary} />
                </TouchableOpacity>
            </Animated.View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
                    <WeeklyCharts />
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.xl, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary,
    },
    logBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] },
});
