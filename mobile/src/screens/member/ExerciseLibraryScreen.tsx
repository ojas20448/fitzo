import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Modal,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import ExerciseList from '../../components/ExerciseList';

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
                        style={styles.backButton}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
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
                            style={styles.closeButton}
                        >
                            <MaterialIcons name="close" size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    </View>

                    {selectedExercise && (
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <View style={styles.modalImageContainer}>
                                {imageLoading && (
                                    <View style={styles.modalImageLoader}>
                                        <ActivityIndicator size="large" color={colors.primary} />
                                    </View>
                                )}
                                {selectedExercise.gifUrl && !imageError ? (
                                    <Image
                                        source={{ uri: selectedExercise.gifUrl }}
                                        style={styles.modalGif}
                                        resizeMode="contain"
                                        onLoadStart={() => setImageLoading(true)}
                                        onLoadEnd={() => setImageLoading(false)}
                                        onError={(e) => {
                                            console.log('Modal Image error:', e.nativeEvent.error);
                                            setImageError('Failed to load GIF');
                                            setImageLoading(false);
                                        }}
                                    />
                                ) : (
                                    <View style={styles.errorContainer}>
                                        <MaterialIcons name="broken-image" size={50} color={colors.text.muted} />
                                        <Text style={styles.errorText}>Image unavailable</Text>
                                    </View>
                                )}
                            </View>

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
                                <View style={styles.instructionsContainer}>
                                    <Text style={styles.sectionTitle}>Instructions</Text>
                                    {selectedExercise.instructions.map((instruction: string, index: number) => (
                                        <View key={index} style={styles.instructionStep}>
                                            <Text style={styles.stepNumber}>{index + 1}</Text>
                                            <Text style={styles.instructionText}>{instruction}</Text>
                                        </View>
                                    ))}
                                </View>
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
        padding: spacing.xs,
        marginLeft: -spacing.xs,
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
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    closeButton: {
        padding: spacing.sm,
    },
    modalContent: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    modalImageContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
    },
    modalGif: {
        width: '100%',
        height: '100%',
    },
    modalExerciseName: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textTransform: 'capitalize',
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    tag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.primary + '20',
    },
    tagSecondary: {
        backgroundColor: colors.primary + '30',
    },
    tagEquipment: {
        backgroundColor: colors.glass.surfaceLight,
    },
    tagText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        textTransform: 'capitalize',
    },
    instructionsContainer: {
        gap: spacing.md,
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
    errorText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});
