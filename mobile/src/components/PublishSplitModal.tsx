import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { workoutsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

interface PublishSplitModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PublishSplitModal({ visible, onClose, onSuccess }: PublishSplitModalProps) {
    const toast = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // User Splits
    const [mySplits, setMySplits] = useState<any[]>([]);
    const [selectedSplit, setSelectedSplit] = useState<any>(null);

    // Form Data
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [difficulty, setDifficulty] = useState('intermediate');
    const [dayDescriptions, setDayDescriptions] = useState<Record<string, string>>({});

    useEffect(() => {
        if (visible) {
            loadMySplits();
            setStep(1);
        }
    }, [visible]);

    const loadMySplits = async () => {
        try {
            const res = await workoutsAPI.getMySplits();
            setMySplits(res.splits);
        } catch (error) {

        }
    };

    const handleSelectSplit = (split: any) => {
        setSelectedSplit(split);
        setName(split.name);
        // Initialize day descriptions
        const initialDays: Record<string, string> = {};
        split.days.forEach((day: string, index: number) => {
            initialDays[`Day ${index + 1}`] = day; // Default to existing day name like "Push"
        });
        setDayDescriptions(initialDays);
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!name || !description) {
            toast.error('Missing Fields', 'Please add a name and description');
            return;
        }

        setLoading(true);
        try {
            await workoutsAPI.publishSplit({
                name,
                description,
                days_per_week: selectedSplit.days_per_week,
                difficulty_level: difficulty,
                program_structure: dayDescriptions,
                tags: tags.split(',').map(t => t.trim()).filter(t => t),
            });
            toast.success('Success', 'Workout plan published to community!');
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Error', 'Failed to publish plan');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select a Plan to Publish</Text>
            <ScrollView contentContainerStyle={styles.listContent}>
                {mySplits.length === 0 ? (
                    <Text style={styles.emptyText}>You haven't created any custom plans yet.</Text>
                ) : (
                    mySplits.map((split) => (
                        <TouchableOpacity
                            key={split.id}
                            style={styles.splitItem}
                            onPress={() => handleSelectSplit(split)}
                        >
                            <View>
                                <Text style={styles.splitName}>{split.name}</Text>
                                <Text style={styles.splitDays}>{split.days_per_week} Days / Week</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );

    const renderStep2 = () => (
        <ScrollView style={styles.stepContainer} contentContainerStyle={{ paddingBottom: 100 }}>
            <Text style={styles.stepTitle}>Add Details</Text>

            <Text style={styles.label}>Plan Name</Text>
            <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ultimate PPL"
                placeholderTextColor={colors.text.subtle}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Explain the goal of this program..."
                placeholderTextColor={colors.text.subtle}
            />

            <Text style={styles.label}>Difficulty</Text>
            <View style={styles.diffRow}>
                {['beginner', 'intermediate', 'advanced'].map((lvl) => (
                    <TouchableOpacity
                        key={lvl}
                        style={[styles.diffChip, difficulty === lvl && styles.diffChipActive]}
                        onPress={() => setDifficulty(lvl)}
                    >
                        <Text style={[styles.diffText, difficulty === lvl && styles.diffTextActive]}>
                            {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Tags (comma separated)</Text>
            <TextInput
                style={styles.input}
                value={tags}
                onChangeText={setTags}
                placeholder="hypertrophy, strength, aesthetic..."
                placeholderTextColor={colors.text.subtle}
            />

            <Text style={styles.sectionHeader}>Daily Schedule Focus</Text>
            <Text style={styles.subtext}>Describe the focus for each day</Text>

            {Object.keys(dayDescriptions).sort().map((dayKey) => (
                <View key={dayKey} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{dayKey}</Text>
                    <TextInput
                        style={styles.dayInput}
                        value={dayDescriptions[dayKey]}
                        onChangeText={(text) => setDayDescriptions(prev => ({ ...prev, [dayKey]: text }))}
                    />
                </View>
            ))}
        </ScrollView>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => step === 2 ? setStep(1) : onClose()}>
                        <MaterialIcons name={step === 2 ? "arrow-back" : "close"} size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Publish Plan</Text>
                    {step === 2 ? (
                        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
                            {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.publishBtn}>PUBLISH</Text>}
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 40 }} />
                    )}
                </View>

                {step === 1 ? renderStep1() : renderStep2()}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    publishBtn: {
        color: colors.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.sm,
    },
    stepContainer: {
        flex: 1,
        padding: spacing.lg,
    },
    stepTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.xl,
    },
    listContent: {
        paddingBottom: spacing.xl,
    },
    emptyText: {
        color: colors.text.muted,
        textAlign: 'center',
        marginTop: spacing.xl,
    },
    splitItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    splitName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    splitDays: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        marginBottom: spacing.xs,
        marginTop: spacing.md,
    },
    input: {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.regular,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    diffRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    diffChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.text.muted,
    },
    diffChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    diffText: {
        color: colors.text.muted,
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
    },
    diffTextActive: {
        color: colors.text.dark,
    },
    sectionHeader: {
        marginTop: spacing.xl,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    subtext: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        marginBottom: spacing.md,
    },
    dayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.md,
    },
    dayLabel: {
        width: 60,
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },
    dayInput: {
        flex: 1,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
        color: colors.text.primary,
    },
});
