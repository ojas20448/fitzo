import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import ExerciseList from '../../components/ExerciseList';

import GlassCard from '../../components/GlassCard';

export default function ExerciseLibraryScreen() {
    const router = useRouter();

    // Modal state
    const [selectedExercise, setSelectedExercise] = useState<any | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);

    const handleSelect = (item: any) => {
        // Open detail modal
        setImageError(null);
        setImageLoading(false);
        setSelectedExercise(item);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace('/home' as any);
                            }
                        }}
                    >
                        <GlassCard style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={20} color={colors.text.primary} />
                        </GlassCard>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Exercise Library</Text>
                </View>
                <Text style={styles.headerSubtitle}>1,300+ exercises with demos</Text>
            </View>

            {/* Exercise List Component */}
            <ExerciseList onSelect={handleSelect} mode="view" />

            {/* Exercise Detail Modal */}
            <Modal
                visible={!!selectedExercise}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSelectedExercise(null)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Exercise Detail</Text>
                        <TouchableOpacity
                            onPress={() => setSelectedExercise(null)}
                        >
                            <GlassCard style={styles.closeButton}>
                                <MaterialIcons name="close" size={20} color={colors.text.primary} />
                            </GlassCard>
                        </TouchableOpacity>
                    </View>

                    {selectedExercise && (
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <GlassCard style={styles.modalImageContainer}>
                                {imageLoading && (
                                    <View style={styles.modalImageLoader}>
                                        <ActivityIndicator size="large" color={colors.primary} />
                                    </View>
                                )}
                                {selectedExercise.gifUrl && !imageError ? (
                                    <Image
                                        source={{ uri: selectedExercise.gifUrl }}
                                        style={styles.modalGif}
                                        contentFit="contain"
                                        transition={200}
                                        cachePolicy="memory-disk"
                                        onLoadStart={() => setImageLoading(true)}
                                        onLoad={() => setImageLoading(false)}
                                        onError={() => {
                                            setImageError('Failed to load GIF');
                                            setImageLoading(false);
                                        }}
                                    />
                                ) : (
                                    <View style={styles.placeholderContainer}>
                                        <MaterialIcons name="fitness-center" size={60} color={colors.primary} />
                                        <Text style={styles.placeholderText}>{selectedExercise.target || selectedExercise.bodyPart}</Text>
                                    </View>
                                )}
                            </GlassCard>

                            <Text style={styles.modalExerciseName}>{selectedExercise.name}</Text>

                            <View style={styles.tags}>
                                <View style={styles.tag}>
                                    <Text style={styles.tagText}>{selectedExercise.bodyPart}</Text>
                                </View>
                                <View style={[styles.tag, styles.tagSecondary]}>
                                    <Text style={styles.tagText}>{selectedExercise.target}</Text>
                                </View>
                                <View style={[styles.tag, styles.tagEquipment]}>
                                    <Text style={styles.tagText}>{selectedExercise.equipment}</Text>
                                </View>
                            </View>

                            {selectedExercise.instructions && selectedExercise.instructions.length > 0 && (
                                <GlassCard style={styles.instructionsContainer}>
                                    <Text style={styles.sectionTitle}>Instructions</Text>
                                    {selectedExercise.instructions.map((instruction: string, index: number) => (
                                        <View key={index} style={styles.instructionStep}>
                                            <Text style={styles.stepNumber}>{index + 1}</Text>
                                            <Text style={styles.instructionText}>{instruction}</Text>
                                        </View>
                                    ))}
                                </GlassCard>
                            )}
                        </ScrollView>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.xs,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    headerSubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    // Modal Styles (Kept from original)
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.xl,
        // Remove border as header blends
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    modalImageContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        // Background color handled by GlassCard
    },
    modalGif: {
        width: '100%',
        height: '100%',
    },
    modalExerciseName: {
        fontSize: typography.sizes['3xl'], // Larger
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textTransform: 'capitalize',
        letterSpacing: -1,
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    tag: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    tagSecondary: {
        backgroundColor: colors.glass.surface,
    },
    tagEquipment: {
        backgroundColor: colors.glass.surface,
    },
    tagText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        textTransform: 'capitalize',
    },
    instructionsContainer: {
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        gap: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    instructionStep: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    stepNumber: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        width: 24,
    },
    instructionText: {
        flex: 1,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        lineHeight: 24,
    },
    modalImageLoader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.xl,
    },
    placeholderText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
        textTransform: 'capitalize',
    },
    errorText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});
