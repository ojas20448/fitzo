import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { measurementsAPI } from '../../services/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { useToast } from '../../components/Toast';

export default function MeasurementsScreen() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Check-in Date
    const [checkInDate, setCheckInDate] = useState(new Date().toLocaleDateString());

    // Measurement States
    const [measurements, setMeasurements] = useState({
        weight: '',
        height: '', // Keep height here for display/update if needed, though usually static
        body_fat: '',
        neck: '',
        shoulders: '',
        chest: '',
        waist: '',
        hips: '',
        left_arm: '',
        right_arm: '',
        left_thigh: '',
        right_thigh: '',
        left_calf: '',
        right_calf: '',
    });

    useEffect(() => {
        loadLatestMeasurements();
    }, []);

    const loadLatestMeasurements = async () => {
        try {
            const { measurement } = await measurementsAPI.getLatest();
            if (measurement) {
                setMeasurements({
                    weight: String(measurement.weight || ''),
                    height: String(measurement.height || ''), // Height might be null in this table if we rely on profile
                    body_fat: String(measurement.body_fat || ''),
                    neck: String(measurement.neck || ''),
                    shoulders: String(measurement.shoulders || ''),
                    chest: String(measurement.chest || ''),
                    waist: String(measurement.waist || ''),
                    hips: String(measurement.hips || ''),
                    left_arm: String(measurement.left_arm || ''),
                    right_arm: String(measurement.right_arm || ''),
                    left_thigh: String(measurement.left_thigh || ''),
                    right_thigh: String(measurement.right_thigh || ''),
                    left_calf: String(measurement.left_calf || ''),
                    right_calf: String(measurement.right_calf || ''),
                });
            }
        } catch (error) {
            // Optional: fallback to profile weight/height if empty?
            // For now, let's keep it clean.
        } finally {
            setLoading(false);
        }
    };

    const updateMeasurement = (key: keyof typeof measurements, value: string) => {
        setMeasurements(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!measurements.weight) {
            toast.error('Missing Info', 'Please at least enter your current weight');
            return;
        }

        setSaving(true);
        try {
            // Convert strings to numbers where valid
            const payload: any = {};
            Object.entries(measurements).forEach(([key, value]) => {
                if (value && !isNaN(parseFloat(value))) {
                    payload[key] = parseFloat(value);
                }
            });

            await measurementsAPI.log(payload);

            toast.success('Measurements Logged', 'Your body stats have been updated.');
            router.back();
        } catch (error) {
            toast.error('Error', 'Failed to save measurements');
        } finally {
            setSaving(false);
        }
    };

    const renderInput = (label: string, key: keyof typeof measurements, unit = 'cm', placeholder = '0.0') => (
        <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{label}</Text>
            <View style={styles.inputWrapper}>
                <TextInput
                    style={styles.input}
                    value={measurements[key]}
                    onChangeText={(val) => updateMeasurement(key, val)}
                    keyboardType="numeric"
                    placeholder={placeholder}
                    placeholderTextColor={colors.text.subtle}
                />
                <Text style={styles.inputUnit}>{unit}</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Body Measurements</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>

                {/* Header Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="history" size={24} color={colors.primary} />
                        <Text style={styles.cardTitle}>Log Today's Stats</Text>
                    </View>
                    <Text style={styles.cardSubtitle}>{checkInDate}</Text>

                    {/* General Stats */}
                    <Text style={styles.sectionHeader}>General</Text>
                    <View style={styles.row}>
                        <View style={styles.halfWidth}>{renderInput('Weight', 'weight', 'kg')}</View>
                        <View style={styles.halfWidth}>{renderInput('Body Fat %', 'body_fat', '%')}</View>
                    </View>
                </View>

                {/* Torso */}
                <View style={styles.card}>
                    <Text style={styles.sectionHeader}>Torso</Text>
                    <View style={styles.row}>
                        <View style={styles.halfWidth}>{renderInput('Neck', 'neck')}</View>
                        <View style={styles.halfWidth}>{renderInput('Shoulders', 'shoulders')}</View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfWidth}>{renderInput('Chest', 'chest')}</View>
                        <View style={styles.halfWidth}>{renderInput('Waist', 'waist')}</View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfWidth}>{renderInput('Hips', 'hips')}</View>
                    </View>
                </View>

                {/* Arms */}
                <View style={styles.card}>
                    <Text style={styles.sectionHeader}>Arms</Text>
                    <View style={styles.row}>
                        <View style={styles.halfWidth}>{renderInput('Left Arm', 'left_arm')}</View>
                        <View style={styles.halfWidth}>{renderInput('Right Arm', 'right_arm')}</View>
                    </View>
                </View>

                {/* Legs */}
                <View style={styles.card}>
                    <Text style={styles.sectionHeader}>Legs</Text>
                    <View style={styles.row}>
                        <View style={styles.halfWidth}>{renderInput('Left Thigh', 'left_thigh')}</View>
                        <View style={styles.halfWidth}>{renderInput('Right Thigh', 'right_thigh')}</View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfWidth}>{renderInput('Left Calf', 'left_calf')}</View>
                        <View style={styles.halfWidth}>{renderInput('Right Calf', 'right_calf')}</View>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Log Measurements'}</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginBottom: spacing.xl,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    cardTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    cardSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        marginBottom: spacing.md,
        marginLeft: 32,
    },
    sectionHeader: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        marginBottom: spacing.md,
        marginTop: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    halfWidth: {
        flex: 1,
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    inputLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingHorizontal: spacing.md,
    },
    input: {
        flex: 1,
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        paddingVertical: spacing.md,
    },
    inputUnit: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    saveBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        padding: spacing.lg,
        alignItems: 'center',
        ...shadows.glow,
        marginBottom: spacing.xl,
    },
    saveBtnDisabled: {
        opacity: 0.7,
    },
    saveBtnText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },
});
