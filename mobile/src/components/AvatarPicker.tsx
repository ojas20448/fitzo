import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Avatar, { AVATAR_PRESETS, AVATAR_LABELS } from './Avatar';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface Props {
    value: string | null;
    onChange: (preset: string | null) => void;
    /** Falls back to initials when nothing is picked. */
    name?: string;
    compact?: boolean;
}

/**
 * Preset avatar chooser, shared by signup and the profile screen.
 *
 * Presets are KEYS, not URLs — the asset is bundled, so choosing one costs no
 * network request and works offline during signup, which matters because
 * signup is the one moment a member may be on gym wifi that barely resolves.
 *
 * Skipping is a first-class outcome. A member with no avatar gets their
 * initials, which is a perfectly good identity; forcing a choice here just adds
 * a step between someone and the app.
 */
const AvatarPicker: React.FC<Props> = ({ value, onChange, name, compact }) => {
    const pick = (preset: string) => {
        Haptics.selectionAsync();
        // Tapping the current selection clears it — otherwise the only way out
        // of a choice you have made is to pick a different one you like less.
        onChange(value === preset ? null : preset);
    };

    const size = compact ? 56 : 64;

    return (
        <View>
            <View style={styles.preview}>
                <Avatar uri={value} name={name} size="xl" />
                <Text style={styles.previewLabel}>
                    {value ? AVATAR_LABELS[value] ?? 'Selected' : 'Your initials'}
                </Text>
            </View>

            <View style={styles.grid}>
                {AVATAR_PRESETS.map((preset) => {
                    const selected = value === preset;
                    return (
                        <Pressable
                            key={preset}
                            onPress={() => pick(preset)}
                            style={[
                                styles.cell,
                                { width: size, height: size, borderRadius: size / 2 },
                                selected && styles.cellSelected,
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${AVATAR_LABELS[preset] ?? preset} avatar${selected ? ', selected' : ''}`}
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
    preview: { alignItems: 'center', marginBottom: spacing.lg },
    previewLabel: {
        marginTop: spacing.sm,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    grid: {
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
