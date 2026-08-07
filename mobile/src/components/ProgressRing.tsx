import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';

interface ProgressRingProps {
    /**
     * Percentage, 0-100. Non-finite values (null/undefined/NaN) are treated as 0.
     * Deliberately NOT auto-normalising a 0-1 range: the one producer of this
     * value returns Math.round(completed / total * 100), so a legitimate `1`
     * means one percent, and a "helpful" 0-1 heuristic would render it as 100%.
     */
    progress: number;
    size?: number;
    strokeWidth?: number;
    /** Hide the centre label when the ring is used purely as an indicator. */
    showLabel?: boolean;
    label?: string;
    /**
     * Rendered instead of the ring when there is no progress to show.
     *
     * At 0% with `showLabel` false the SVG draws a fully-offset arc and an
     * empty centre — a hollow circle containing nothing, which on a black
     * background reads as dead space. That state hits precisely the new
     * members this card exists to reach, so it shows an invitation instead of
     * an empty meter.
     */
    emptyIcon?: keyof typeof MaterialIcons.glyphMap;
}

/**
 * Circular progress indicator.
 *
 * Replaces the empty 96x80 "thumbnail" that the Continue Learning card used to
 * render — a 5%-white box holding an 8%-white circle, which on a pure-black
 * background read as a grey smudge and carried no information. Same footprint,
 * but it now shows how far along the unit is.
 *
 * Its own zero state was the same mistake in a different shape: at 0% with no
 * label it drew a hollow circle containing nothing. Pass `emptyIcon` to render
 * a solid tile there instead — an invitation rather than an empty meter.
 */
const ProgressRing: React.FC<ProgressRingProps> = ({
    progress,
    size = 72,
    strokeWidth = 4,
    showLabel = true,
    label,
    emptyIcon,
}) => {
    const pct = Number.isFinite(progress)
        ? Math.max(0, Math.min(100, Math.round(progress)))
        : 0;

    // Nothing to draw and nothing to label: render the icon instead of a
    // container that holds nothing.
    if (pct === 0 && !showLabel && emptyIcon) {
        return (
            <View style={[styles.emptyTile, { width: size, height: size, borderRadius: size / 2 }]}>
                <MaterialIcons name={emptyIcon} size={size * 0.42} color={colors.primary} />
            </View>
        );
    }

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - pct / 100);

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={colors.glass.borderLight}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={colors.primary}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    // Start the arc at 12 o'clock instead of 3 o'clock.
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            {showLabel && (
                <View style={styles.labelWrap} pointerEvents="none">
                    <Text style={[styles.label, { fontSize: size * 0.26 }]}>
                        {label ?? `${pct}%`}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    emptyTile: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    labelWrap: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
});

export default ProgressRing;
