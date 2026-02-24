import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { workoutsAPI } from '../services/api';

interface ExercisePickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (exercise: any) => void;
}

export default function ExercisePicker({ visible, onClose, onSelect }: ExercisePickerProps) {
    const [search, setSearch] = useState('');
    const [exercises, setExercises] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            loadExercises();
        }
    }, [visible]);

    const loadExercises = async (query = '') => {
        setLoading(true);
        try {
            const res = await workoutsAPI.searchExercises(query);
            setExercises(res.exercises);
        } catch (error: any) {
            // Silently handle - parent screen manages error state
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (visible) loadExercises(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, visible]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Add Exercise</Text>
                    <Pressable onPress={onClose} style={styles.closeBtn}>
                        <MaterialIcons name="close" size={24} color={colors.text.primary} />
                    </Pressable>
                </View>

                <View style={styles.searchContainer}>
                    <MaterialIcons name="search" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search exercises..."
                        placeholderTextColor={colors.text.muted}
                        value={search}
                        onChangeText={setSearch}
                        autoFocus
                    />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={exercises}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <Pressable
                                style={styles.item}
                                onPress={() => onSelect(item)}
                            >
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemSub}>{item.category} • {item.muscle_groups?.join(', ')}</Text>
                                </View>
                                <MaterialIcons name="add" size={24} color={colors.primary} />
                            </Pressable>
                        )}
                    />
                )}
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
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    title: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    closeBtn: {
        position: 'absolute',
        right: spacing.md,
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        margin: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    searchInput: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: typography.sizes.base,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
    },
    listContent: {
        paddingHorizontal: spacing.md,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    itemSub: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        marginTop: 2,
    },
});
