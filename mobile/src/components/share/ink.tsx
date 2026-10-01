import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Ellipse, Line } from 'react-native-svg';

/**
 * Shared hand-drawn SVG marks for the share themes.
 *
 * Both of these were module-local, unexported `const`s inside
 * ReceiptShareCard.tsx (the legacy recap card). Receipt and Chalk both need
 * the same marks, so they live here instead of being duplicated into every
 * theme or exported from a component that exists only to serve the old
 * recap flow. ReceiptShareCard.tsx itself is untouched — it keeps its own
 * copies, so its shipped behaviour cannot regress from this move.
 */

/** Hand-drawn ink circle (two offset ellipses = sketchy pen look). */
export const InkCircle: React.FC<{ width: number; height: number; color?: string }> = ({
    width,
    height,
    color = '#2B5CE6',
}) => (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 3} ry={height / 2 - 3}
            fill="none" stroke={color} strokeWidth={2} opacity={0.9} />
        <Ellipse cx={width / 2 + 2} cy={height / 2 - 1} rx={width / 2 - 4} ry={height / 2 - 4}
            fill="none" stroke={color} strokeWidth={1.5} opacity={0.55} />
    </Svg>
);

/**
 * Dashed horizontal rule, receipt-style section divider.
 *
 * Every prop is optional and defaults to the exact hardcoded values the
 * legacy component used (`strokeWidth` 1.4, `dashLength` 4 i.e. "4,4",
 * `marginVertical` 8, ink `#141414`), so a caller that passes nothing gets
 * pixel-identical output. The props exist because every new theme renders at
 * 1080px story width instead of the legacy 360px preview width — a caller
 * scaled up 3x needs a proportionally thicker rule, not just a wider one.
 */
export const DashedLine: React.FC<{
    color?: string;
    strokeWidth?: number;
    dashLength?: number;
    marginVertical?: number;
}> = ({ color = '#141414', strokeWidth = 1.4, dashLength = 4, marginVertical = 8 }) => {
    const height = Math.max(2, strokeWidth + 0.6);
    return (
        <Svg width="100%" height={height} style={{ marginVertical }}>
            <Line
                x1="0" y1={height / 2} x2="100%" y2={height / 2}
                stroke={color} strokeWidth={strokeWidth} strokeDasharray={`${dashLength},${dashLength}`}
            />
        </Svg>
    );
};
