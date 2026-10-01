import React from 'react';
import { CardText as Text } from '../CardText';
import { View, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import type { SharePayload } from '../SharePayload';
import { formatDate, hasMuscleVolume, pickSummaryRows, fitFontSize } from '../format';
import { typography } from '../../../styles/theme';
import AnatomyHeatmap, { MUSCLE_COLORS } from '../../AnatomyHeatmap';
import type { ShareThemeProps } from './index';
// Scale the map and its front/back labels together.
const HEATMAP_NATURAL_W = 280; // >= 2 * bodyWidth(130), rounded up from the two side-by-side SVGs' intrinsic width.
const HEATMAP_NATURAL_H = 300; // >= label(~16) + gap(8) + bodyHeight(230) + row paddingVertical(24), rounded up.
const HERO_SCALE = 2.3;
const HEATMAP_OUTER_W = HEATMAP_NATURAL_W * HERO_SCALE;
const HEATMAP_OUTER_H = HEATMAP_NATURAL_H * HERO_SCALE;

const MAX_FALLBACK_ROWS = 6;

const MUTED = 'rgba(255,255,255,0.55)';
const H_PADDING = 72;
const HEADLINE_BOX_W = CARD_W - H_PADDING * 2; // 936
const HEADLINE_MIN_SIZE = 54;

export default function Anatomy({ payload }: ShareThemeProps) {
    const { muscleVolume } = payload;
    const hasVolume = hasMuscleVolume(muscleVolume);
    const highlights = pickSummaryRows(payload, 2);
    const extraHighlights = pickSummaryRows(payload, Number.MAX_SAFE_INTEGER).length - highlights.length;
    const eyebrowText = (payload.subtitle || formatDate(payload.date)).toUpperCase();
    const headlineFontSize = fitFontSize(payload.headline, HEADLINE_BOX_W, 108, HEADLINE_MIN_SIZE);
    const headlineLineHeight = Math.round(headlineFontSize * (118 / 108));

    return (
        <View style={styles.frame}>
            <Text style={styles.eyebrow} numberOfLines={2}>{eyebrowText}</Text>
            {!!payload.contextLabel && <Text style={styles.context} numberOfLines={2}>{payload.contextLabel}</Text>}

            {hasVolume ? (
                <>
                    <Text
                        style={[styles.headline, { fontSize: headlineFontSize, lineHeight: headlineLineHeight }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.4}
                    >
                        {payload.headline}
                    </Text>
                    {!!payload.headlineLabel && <Text style={styles.eyebrow}>{payload.headlineLabel}</Text>}
                    <Text style={styles.mapLabel}>COMPLETED SETS · THIS SESSION</Text>

                    <View style={styles.heatmapOuter}>
                        <View style={styles.heatmapInner}>
                            <AnatomyHeatmap volume={muscleVolume} labelSize={16} allowFontScaling={false} />
                        </View>
                    </View>

                    <View style={styles.legendRow}>
                        <LegendItem color={MUSCLE_COLORS.untrained.stroke} label="0 SETS" />
                        <LegendItem color={MUSCLE_COLORS.underTarget.stroke} label="1–5 SETS" />
                        <LegendItem color={MUSCLE_COLORS.growthZone.stroke} label="6+ SETS" />
                    </View>
                    <View style={styles.rowsBlock}>
                        {highlights.map((row, i) => <View key={`${row.label}-${i}`} style={styles.row}>
                            <Text style={styles.rowLabel} numberOfLines={2}>{row.label}</Text>
                            <Text style={styles.rowValue} numberOfLines={2}>{row.value}</Text>
                        </View>)}
                    </View>
                    {extraHighlights > 0 && <Text style={styles.eyebrow}>{'+' + extraHighlights + ' more highlights'}</Text>}
                </>
            ) : (
                <FallbackBody payload={payload} />
            )}

            <View style={styles.spacer} />

            <Text style={styles.footerMark}>FITZO</Text>
        </View>
    );
}

function FallbackBody({ payload }: { payload: SharePayload }) {
    const rows = pickSummaryRows(payload, MAX_FALLBACK_ROWS);
    const overflow = pickSummaryRows(payload, Number.MAX_SAFE_INTEGER).length - rows.length;
    const fontSize = fitFontSize(payload.headline, HEADLINE_BOX_W, 140, HEADLINE_MIN_SIZE);
    const lineHeight = Math.round(fontSize * (152 / 140));
    return (
        <>
            <Text
                style={[styles.fallbackHeadline, { fontSize, lineHeight }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.4}
            >
                {payload.headline}
            </Text>
            {!!payload.headlineLabel && <Text style={styles.eyebrow}>{payload.headlineLabel}</Text>}
            {rows.length > 0 && (
                <View style={styles.rowsBlock}>
                    {rows.map((r, i) => (
                        <View key={`${r.label}-${i}`} style={styles.row}>
                            <Text style={styles.rowLabel} numberOfLines={2}>{r.label}</Text>
                            <Text style={styles.rowValue} numberOfLines={2}>{r.value}</Text>
                        </View>
                    ))}
                </View>
            )}
            {overflow > 0 && <Text style={styles.eyebrow}>{'+' + overflow + ' more highlights'}</Text>}
        </>
    );
}

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <View style={styles.legendItem}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.legendLabel} numberOfLines={1}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    mapLabel: { fontFamily: typography.fontFamily.semiBold, fontSize: 36, lineHeight: 44, color: MUTED, textAlign: 'center', marginTop: 20 },
    context: { fontFamily: typography.fontFamily.medium, fontSize: 42, lineHeight: 50, color: '#fff', textAlign: 'center', marginBottom: 20 },
    frame: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: '#000000',
        paddingTop: 84,
        paddingBottom: 56,
        paddingHorizontal: H_PADDING,
        overflow: 'hidden',
    },
    spacer: { flex: 1 },
    eyebrow: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 36,
        lineHeight: 44,
        letterSpacing: 3,
        color: MUTED,
        textAlign: 'center',
        marginBottom: 8,
    },
    headline: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 108,
        lineHeight: 118,
        letterSpacing: -1,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 32,
    },
    heatmapOuter: {
        alignSelf: 'center',
        width: HEATMAP_OUTER_W,
        height: HEATMAP_OUTER_H,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    heatmapInner: {
        width: HEATMAP_NATURAL_W,
        height: HEATMAP_NATURAL_H,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: HERO_SCALE }],
    },
    legendRow: {
        height: 52,
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 14,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    legendLabel: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 36,
        lineHeight: 44,
        letterSpacing: 1,
        color: MUTED,
    },
    fallbackHeadline: {
        fontFamily: typography.fontFamily.extraBold,
        fontSize: 140,
        lineHeight: 152,
        letterSpacing: -2,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 48,
    },
    rowsBlock: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.12)',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.12)',
    },
    rowLabel: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 42,
        lineHeight: 50,
        color: '#FFFFFF',
        flexShrink: 1,
        paddingRight: 16,
    },
    rowValue: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 40,
        lineHeight: 48,
        maxWidth: 360,
        textAlign: 'right',
        color: '#FFFFFF',
    },
    footerMark: {
        alignSelf: 'center',
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 36,
        lineHeight: 44,
        color: MUTED,
        opacity: 0.7,
        letterSpacing: 4,
    },
});
