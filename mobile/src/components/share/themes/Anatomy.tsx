import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import type { SharePayload } from '../SharePayload';
import { formatDate, hasMuscleVolume, pickSummaryRows } from '../format';
import { typography } from '../../../styles/theme';
import AnatomyHeatmap, { MUSCLE_COLORS } from '../../AnatomyHeatmap';

/**
 * ANATOMY — the body-heatmap theme.
 *
 * Hero is a pair of front/back muscle silhouettes (the existing
 * AnatomyHeatmap SVG component), not a number or a list — structurally
 * unlike every other theme in the registry. A short legend below it
 * explains the three color zones, since AnatomyHeatmap itself renders no
 * legend (it relies on StatsScreen's own surrounding UI for that context,
 * which this card does not have).
 *
 * SCALING DECISION (see task brief's two AnatomyHeatmap traps):
 * AnatomyHeatmap's "FRONT"/"BACK" labels are hardcoded at fontSize 10 with
 * theme `spacing` gaps, in a Text sibling to the SVGs — that style is NOT a
 * function of the `bodyWidth`/`bodyHeight` props. Passing large props
 * directly (e.g. bodyWidth=400) would enlarge only the SVG figures; the
 * labels would stay a fixed 10px, i.e. comically small next to a
 * 1080-wide card. Instead this file renders AnatomyHeatmap at its OWN
 * default size (bodyWidth/bodyHeight omitted -> 130/230, the exact
 * configuration StatsScreen.tsx already uses successfully) inside a fixed
 * pre-scale box, then scales that ENTIRE box — SVGs and labels together —
 * with `transform: [{ scale: HERO_SCALE }]`. This is the same technique
 * Receipt.tsx already uses to port a small-designed component onto the
 * 1080-wide card (its `SCALE = CARD_W / 360` constant), so the precedent is
 * established, not invented here. AnatomyHeatmap.tsx itself is untouched —
 * it still has a live consumer in StatsScreen.tsx.
 *
 * Because a component tree cannot be rendered in this repo's test setup,
 * HEATMAP_NATURAL_W/H below are a reasoned-from-source estimate (see their
 * comment), not a measurement. HEATMAP_OUTER is deliberately sized larger
 * than that estimate and `overflow: 'hidden'`, so an estimate that runs a
 * little short clips a sliver of decorative margin rather than colliding
 * with the headline above or the legend below.
 */

// AnatomyHeatmap's own default props (bodyWidth=130, bodyHeight=230) are
// used deliberately instead of custom dimensions — see file doc.
const HEATMAP_NATURAL_W = 280; // >= 2 * bodyWidth(130), rounded up from the two side-by-side SVGs' intrinsic width.
const HEATMAP_NATURAL_H = 300; // >= label(~16) + gap(8) + bodyHeight(230) + row paddingVertical(24), rounded up.
const HERO_SCALE = 3;
const HEATMAP_OUTER_W = HEATMAP_NATURAL_W * HERO_SCALE; // 840
const HEATMAP_OUTER_H = HEATMAP_NATURAL_H * HERO_SCALE; // 900

const MAX_FALLBACK_ROWS = 6;

const MUTED = 'rgba(255,255,255,0.55)';

export default function Anatomy({ payload }: { payload: SharePayload }) {
    const { muscleVolume } = payload;
    const hasVolume = hasMuscleVolume(muscleVolume);
    const eyebrowText = (payload.subtitle || formatDate(payload.date)).toUpperCase();

    return (
        <View style={styles.frame}>
            <Text style={styles.eyebrow} numberOfLines={1}>{eyebrowText}</Text>

            {hasVolume ? (
                <>
                    <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>
                        {payload.headline}
                    </Text>

                    <View style={styles.heatmapOuter}>
                        <View style={styles.heatmapInner}>
                            <AnatomyHeatmap volume={muscleVolume} />
                        </View>
                    </View>

                    <View style={styles.legendRow}>
                        <LegendItem color={MUSCLE_COLORS.untrained.stroke} label="UNTRAINED" />
                        <LegendItem color={MUSCLE_COLORS.underTarget.stroke} label="UNDER TARGET" />
                        <LegendItem color={MUSCLE_COLORS.growthZone.stroke} label="GROWTH ZONE" />
                    </View>
                </>
            ) : (
                <FallbackBody payload={payload} />
            )}

            <View style={styles.spacer} />

            {/* Footer: small wordmark only — no user identity on the card */}
            <Text style={styles.footerMark}>FITZO</Text>
        </View>
    );
}

/**
 * Degraded-path content when there is no usable muscleVolume. Deliberately
 * NOT a smaller/faded heatmap and NOT an apologetic "no data" message —
 * either would read as broken. Instead it leans on the same headline
 * treatment every other theme uses, plus whatever secondary content the
 * payload actually has (pickSummaryRows: PR > exercise > generic row),
 * so the card still looks like a considered layout, not an error state.
 */
function FallbackBody({ payload }: { payload: SharePayload }) {
    const rows = pickSummaryRows(payload, MAX_FALLBACK_ROWS);
    return (
        <>
            <Text style={styles.fallbackHeadline} numberOfLines={1} adjustsFontSizeToFit>
                {payload.headline}
            </Text>
            {rows.length > 0 && (
                <View style={styles.rowsBlock}>
                    {rows.map((r, i) => (
                        <View key={`${r.label}-${i}`} style={styles.row}>
                            <Text style={styles.rowLabel} numberOfLines={1}>{r.label}</Text>
                            <Text style={styles.rowValue} numberOfLines={1}>{r.value}</Text>
                        </View>
                    ))}
                </View>
            )}
        </>
    );
}

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <View style={styles.legendItem}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.legendLabel} numberOfLines={1}>{label}</Text>
    </View>
);

/**
 * WORST-CASE VERTICAL BUDGET — two mutually-exclusive paths (only one
 * ever renders), each proven independently:
 *
 * PRIMARY (hasVolume):
 *   paddingTop 84 + paddingBottom 56                     = 140
 *   eyebrow            lineHeight 30 + marginBottom 8     =  38
 *   headline            lineHeight 118 + marginBottom 32  = 150
 *   heatmapOuter                 fixed 840 x 900          = 900
 *   legendRow          marginTop 20 + fixed height 28     =  48
 *   footer                            lineHeight 28       =  28
 *   ------------------------------------------------------------
 *   fixed total                                           = 1304 of 1920
 *   `spacer` (flex:1) absorbs the remaining >=616px between the legend
 *   and the footer.
 *
 * FALLBACK (!hasVolume):
 *   paddingTop 84 + paddingBottom 56                      = 140
 *   eyebrow                                                =  38
 *   fallbackHeadline   lineHeight 152 + marginBottom 48    = 200
 *   rowsBlock: borderTopWidth 1 + MAX_FALLBACK_ROWS(6) *
 *              (paddingVertical 36 + lineHeight 38 +
 *               borderBottomWidth 1 = 75)                 = 451
 *   footer                                                 =  28
 *   ------------------------------------------------------------
 *   fixed total                                            = 857 of 1920
 *   `spacer` absorbs the remaining >=1063px. Strictly less content than
 *   the primary path, so if primary fits (it does, by 636px), every
 *   sparser combination inside the fallback (fewer than 6 rows, or zero)
 *   fits by an even larger margin.
 */
const styles = StyleSheet.create({
    frame: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: '#000000',
        paddingTop: 84,
        paddingBottom: 56,
        paddingHorizontal: 72,
        overflow: 'hidden',
    },
    spacer: { flex: 1 },
    eyebrow: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 24,
        lineHeight: 30,
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
        height: 28,
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
        fontSize: 16,
        lineHeight: 20,
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
        fontSize: 30,
        lineHeight: 38,
        color: '#FFFFFF',
        flexShrink: 1,
        paddingRight: 16,
    },
    rowValue: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 30,
        lineHeight: 38,
        color: '#FFFFFF',
    },
    footerMark: {
        alignSelf: 'center',
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 22,
        lineHeight: 28,
        color: MUTED,
        opacity: 0.7,
        letterSpacing: 4,
    },
});
