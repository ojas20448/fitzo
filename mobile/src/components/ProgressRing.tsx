import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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
}

/**
 * Circular progress indicator.
 *
 * Replaces the empty 96x80 "thumbnail" that the Continue Learning card used to
 * render — a 5%-white box holding an 8%-white circle, which on a pure-black
 * background read as a grey smudge and carried no information. Same footprint,
 * but it now shows how far along the lesson is.
 */
const ProgressRing: React.FC<ProgressRingProps> = ({
    progress,
    size = 72,
    strokeWidth = 4,
    showLabel = true,
    label,
}) => {
    const pct = Number.isFinite(progress)
        ? Math.max(0, Math.min(100, Math.round(progress)))
        : 0;

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
