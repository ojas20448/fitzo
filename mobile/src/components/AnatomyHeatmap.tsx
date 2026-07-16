import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { colors, typography, spacing } from '../styles/theme';

/**
 * AnatomyHeatmap — front/back muscle silhouettes colored by weekly volume.
 *
 * Organic muscle-shaped paths (PUSH-style mannequin) instead of blocky
 * rectangles. Left side is authored once; the right side is a mirror group,
 * so the figure is always perfectly symmetric.
 *
 * Zones: 0 sets = untrained (faint) · 1–5 = under target (amber)
 *        · 6+ = growth zone (green)
 */

export const MUSCLE_COLORS = {
    untrained: { fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.14)' },
    underTarget: { fill: 'rgba(253,201,13,0.16)', stroke: 'rgba(253,201,13,0.85)' },
    growthZone: { fill: 'rgba(52,209,89,0.18)', stroke: 'rgba(52,209,89,0.85)' },
};

export function getMuscleColors(sets: number) {
    if (!sets || sets === 0) return MUSCLE_COLORS.untrained;
    if (sets < 6) return MUSCLE_COLORS.underTarget;
    return MUSCLE_COLORS.growthZone;
}

const NEUTRAL = { fill: 'rgba(255,255,255,0.035)', stroke: 'rgba(255,255,255,0.10)' };
const SW = 1.4;

type Vol = Record<string, number>;

/* ─── Shared limb/torso path data (authored for the LEFT side, x<65) ─── */

// Deltoid cap
const DELT = 'M51 41 Q40 41 36.5 52 Q41 58 50 55 Q53 47 51 41 Z';
// Upper arm (bicep front / tricep back)
const UPPER_ARM = 'M36 56 Q29.5 61 29.5 74 Q30.5 86 37 89 Q42 83 41.5 70 Q41 60 36 56 Z';
// Forearm
const FOREARM = 'M32 92 Q26.5 97 25 110 Q24.5 121 28.5 127 Q34 124 35 111 Q36 98 32 92 Z';
// Hand (neutral)
const HAND = 'M26 130 Q22 131 22 136 Q22 141 26.5 141.5 Q30.5 141 30.5 136 Q30.5 131 26 130 Z';

/* Front-only */
const PEC = 'M52 54 Q42.5 57 44 71 Q50 80 63.5 76 L63.5 56 Q57.5 52 52 54 Z';
const OBLIQUE = 'M50 80 Q46.5 89 48.5 108 Q51 114 53.5 112 L53.5 82 Q51.5 80 50 80 Z';
const QUAD = 'M50 128 Q43.5 137 44.5 161 Q46 178 54 183 Q60.5 176 60 150 Q59.5 133 50 128 Z';
const SHIN = 'M50 189 Q45.5 195 46.5 209 Q48.5 221 54 223 Q58 216 56.5 201 Q55.5 191 50 189 Z';

/* Back-only */
const TRAP = 'M65 31 L47.5 45 Q65 55 82.5 45 Z'; // symmetric, drawn once
const LAT = 'M51.5 49 Q43 58 45.5 78 Q53 90 63.5 84 L63.5 51 Q57 46.5 51.5 49 Z';
const GLUTE = 'M63.5 113 Q48 112.5 47.5 125 Q47.5 137 63.5 135 Z';
const HAMSTRING = 'M50 139 Q44.5 147 45.5 167 Q47.5 181 55 185 Q60.5 178 59.5 153 Q59 141 50 139 Z';
const CALF = 'M50 191 Q45 197 46 210 Q48 221 54 223 Q58.5 215 57 201 Q56 192 50 191 Z';

const Mirrored: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <>
        {children}
        <G transform="translate(130,0) scale(-1,1)">{children}</G>
    </>
);

const BodyFront: React.FC<{ v: Vol; width: number; height: number; onPress?: (muscle: string) => void }> = ({ v, width, height, onPress }) => (
    <Svg width={width} height={height} viewBox="0 0 130 230">
        {/* Neutral: head, neck, pelvis */}
        <Circle cx={65} cy={15} r={10.5} {...NEUTRAL} strokeWidth={SW} />
        <Rect x={60} y={26} width={10} height={8} rx={3} {...NEUTRAL} strokeWidth={SW} />
        <Path d="M52 118 Q65 129 78 118 L74.5 130 Q65 136 55.5 130 Z" {...NEUTRAL} strokeWidth={SW} />
        <Mirrored>
            <Path d={DELT} {...getMuscleColors(v.shoulders)} strokeWidth={SW} onPress={() => onPress?.('shoulders')} />
            <Path d={PEC} {...getMuscleColors(v.chest)} strokeWidth={SW} onPress={() => onPress?.('chest')} />
            <Path d={UPPER_ARM} {...getMuscleColors(v.biceps ?? v.arms)} strokeWidth={SW} onPress={() => onPress?.('arms')} />
            <Path d={FOREARM} {...getMuscleColors(v.forearms ?? v.arms)} strokeWidth={SW} onPress={() => onPress?.('arms')} />
            <Path d={HAND} {...NEUTRAL} strokeWidth={SW} />
            <Path d={OBLIQUE} {...getMuscleColors(v.obliques ?? v.core)} strokeWidth={SW} onPress={() => onPress?.('core')} />
            <Path d={QUAD} {...getMuscleColors(v.quads ?? v.legs)} strokeWidth={SW} onPress={() => onPress?.('legs')} />
            <Path d={SHIN} {...getMuscleColors(v.calves ?? v.legs)} strokeWidth={SW} onPress={() => onPress?.('legs')} />
        </Mirrored>
        {/* Abs column (centered, not mirrored) */}
        <Rect x={56} y={80} width={18} height={36} rx={7} {...getMuscleColors(v.abs ?? v.core)} strokeWidth={SW} onPress={() => onPress?.('core')} />
    </Svg>
);

const BodyBack: React.FC<{ v: Vol; width: number; height: number; onPress?: (muscle: string) => void }> = ({ v, width, height, onPress }) => (
    <Svg width={width} height={height} viewBox="0 0 130 230">
        <Circle cx={65} cy={15} r={10.5} {...NEUTRAL} strokeWidth={SW} />
        <Rect x={60} y={26} width={10} height={7} rx={3} {...NEUTRAL} strokeWidth={SW} />
        <Path d={TRAP} {...getMuscleColors(v.traps ?? v.back)} strokeWidth={SW} onPress={() => onPress?.('back')} />
        <Mirrored>
            <Path d={DELT} {...getMuscleColors(v.shoulders)} strokeWidth={SW} onPress={() => onPress?.('shoulders')} />
            <Path d={LAT} {...getMuscleColors(v.lats ?? v.back)} strokeWidth={SW} onPress={() => onPress?.('back')} />
            <Path d={UPPER_ARM} {...getMuscleColors(v.triceps ?? v.arms)} strokeWidth={SW} onPress={() => onPress?.('arms')} />
            <Path d={FOREARM} {...getMuscleColors(v.forearms ?? v.arms)} strokeWidth={SW} onPress={() => onPress?.('arms')} />
            <Path d={HAND} {...NEUTRAL} strokeWidth={SW} />
            <Path d={GLUTE} {...getMuscleColors(v.glutes ?? v.legs)} strokeWidth={SW} onPress={() => onPress?.('legs')} />
            <Path d={HAMSTRING} {...getMuscleColors(v.hamstrings ?? v.legs)} strokeWidth={SW} onPress={() => onPress?.('legs')} />
            <Path d={CALF} {...getMuscleColors(v.calves ?? v.legs)} strokeWidth={SW} onPress={() => onPress?.('legs')} />
        </Mirrored>
        {/* Lower back (centered) */}
        <Rect x={57} y={88} width={16} height={22} rx={6} {...getMuscleColors(v['lower back'] ?? v.back)} strokeWidth={SW} onPress={() => onPress?.('back')} />
    </Svg>
);

interface AnatomyHeatmapProps {
    volume: Vol;
    bodyWidth?: number;
    bodyHeight?: number;
    onMusclePress?: (muscle: string) => void;
}

const AnatomyHeatmap: React.FC<AnatomyHeatmapProps> = ({ volume, bodyWidth = 130, bodyHeight = 230, onMusclePress }) => (
    <View style={styles.row}>
        <View style={styles.col}>
            <Text style={styles.label}>FRONT</Text>
            <BodyFront v={volume} width={bodyWidth} height={bodyHeight} onPress={onMusclePress} />
        </View>
        <View style={styles.col}>
            <Text style={styles.label}>BACK</Text>
            <BodyBack v={volume} width={bodyWidth} height={bodyHeight} onPress={onMusclePress} />
        </View>
    </View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'flex-start',
        paddingVertical: spacing.md,
    },
    col: { alignItems: 'center', gap: spacing.sm },
    label: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
});

export default AnatomyHeatmap;
