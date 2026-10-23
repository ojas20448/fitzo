import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import Avatar, { AVATAR_PRESETS, AVATAR_LABELS } from './Avatar';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface Props {
    value: string | null;
    onChange: (preset: string | null) => void;
    /** Used for the accessible label of the default profile picture. */
    name?: string;
    compact?: boolean;
    disabled?: boolean;
}

/**
 * Presets are bundled keys, so choosing a picture needs no network request.
 * The default silhouette remains an explicit choice alongside the presets.
 */
const AvatarPicker: React.FC<Props> = ({ value, onChange, name, compact, disabled = false }) => {
    const pick = (preset: string | null) => {
        if (disabled) return;
        Haptics.selectionAsync();
        // Tapping the current selection clears it — otherwise the only way out
        // of a choice you have made is to pick a different one you like less.
        onChange(value === preset ? null : preset);
    };

    const size = compact ? 56 : 64;

    return (
        <View style={disabled && styles.disabled}>
            <View style={styles.preview}>
                <Avatar uri={value} name={name} size="xl" />
                <Text style={styles.previewLabel}>
                    {value ? AVATAR_LABELS[value] ?? 'Current photo' : 'Default profile picture'}
                </Text>
            </View>

            <View style={styles.grid}>
                {[null, ...AVATAR_PRESETS].map((preset) => {
                    const selected = value === preset;
                    return (
                        <Pressable
                            key={preset ?? 'default'}
                            disabled={disabled}
                            onPress={() => pick(preset)}
                            style={[
                                styles.cell,
                                { width: size, height: size, borderRadius: size / 2 },
                                selected && styles.cellSelected,
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled }}
                            accessibilityLabel={`${preset ? `${AVATAR_LABELS[preset]} avatar` : 'Use default profile picture'}${selected ? ', selected' : ''}`}
                        >
                            <Avatar uri={preset} size={compact ? 'md' : 'lg'} />
                            {selected && (
                                <View style={styles.check}>
                                    <MaterialIcons name="check" size={12} color={colors.background} />
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    disabled: { opacity: 0.55 },
    preview: { alignItems: 'center', marginBottom: spacing.lg },
    previewLabel: {
        marginTop: spacing.sm,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    grid: {
        width: '100%', maxWidth: 256, alignSelf: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.md,
    },
    cell: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    cellSelected: { borderColor: colors.primary },
    check: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 20,
        height: 20,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default AvatarPicker;
