import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import type { SharePayload } from '../SharePayload';
import { formatDate, hasMuscleVolume, pickSummaryRows, fitFontSize, HERO_CHAR_WIDTH_RATIO } from '../format';
import { typography } from '../../../styles/theme';
import AnatomyHeatmap, { MUSCLE_COLORS } from '../../AnatomyHeatmap';
import type { ShareThemeProps } from './index';

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
 * default size (bodyWidth/bodyHeight omitted -> 130/230, AnatomyHeatmap's
 * own default parameter values) inside a fixed pre-scale box, then scales
 * that ENTIRE box — SVGs and labels together — with
 * `transform: [{ scale: HERO_SCALE }]`. StatsScreen.tsx, the component's
 * only other consumer, does not actually use those defaults either — it
 * passes bodyWidth=120/bodyHeight=220 explicitly
 * (StatsScreen.tsx:211-212,221) — but that pair sits close enough to
 * 130/230 that both call sites are evidence the component is meant to be
 * driven somewhere in this size range, not tuned to one exact number.
 *
 * `transform: scale` is a NEW technique for this codebase, not one carried
 * over from Receipt.tsx: Receipt ports its own small-designed component by
 * arithmetic pre-multiplication instead — `SCALE = CARD_W / 360` then
 * `s = n => Math.round(n * SCALE)` applied to every measurement before
 * render (Receipt.tsx:29-30) — and its only `transform` is an unrelated
 * `rotate: '-0.6deg'` for the paper-tilt effect (Receipt.tsx:184), not a
 * scale. That arithmetic approach isn't available here: AnatomyHeatmap's
 * internal paddings/gaps/label size are opaque from outside (unlike
 * Receipt's own JSX, which this codebase's author could multiply measurement
 * by measurement), so the only lever from outside the component is scaling
 * its whole rendered subtree as one visual unit. AnatomyHeatmap.tsx itself
 * is untouched — it still has a live consumer in StatsScreen.tsx.
 *
 * Because a component tree cannot be rendered in this repo's test setup,
 * HEATMAP_NATURAL_W/H below are a reasoned-from-source estimate (see their
 * comment), not a measurement. HEATMAP_OUTER is deliberately sized larger
 * than that estimate and `overflow: 'hidden'`, so an estimate that runs a
 * little short clips a sliver of decorative margin rather than colliding
 * with the headline above or the legend below.
 *
 * HORIZONTAL FIT (fix round 2): a sibling review finding on Scoreboard.tsx
 * showed `adjustsFontSizeToFit` failing to shrink a literal fontSize on
 * react-native-web, overflowing its box. Both headlines here already fit a
 * long "1,23,456 KG"-style string comfortably at their literal max sizes
 * against this file's own frame width (108px headline: ~736px needed of
 * 936px available; 140px fallbackHeadline: borderline, ~947px needed of
 * 936px using a deliberately padded estimate, likely fits under the real
 * character width but close enough to be worth not trusting) — see
 * `fitFontSize`'s calibration comment in format.ts for where that estimate
 * comes from. Both now go through `fitFontSize` anyway, for the same
 * platform-independent guarantee Scoreboard needed and for consistency
 * across every hero-scale headline in this feature, not because either was
 * proven to overflow the way Scoreboard's did.
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

// Named (not a literal 72 inline in styles.frame below) specifically so the
// fitFontSize width calculation below can't silently drift from the frame's
// actual padding.
const H_PADDING = 72;
const HEADLINE_BOX_W = CARD_W - H_PADDING * 2; // 936
// One shared floor for both headlines (see "HORIZONTAL FIT" above) —
// comfortably below either target (108, 140) while staying clearly the
// most prominent text on the card whenever it has to shrink.
const HEADLINE_MIN_SIZE = 72;

/**
 * TASK 10 DECISION: Anatomy does NOT opt into a camera background — the
 * only one of the five themes that doesn't. `payload.background` is simply
 * never read below.
 *
 * Verified directly against AnatomyHeatmap.tsx before making this call (the
 * task brief's own standing accuracy warning): `MUSCLE_COLORS.untrained` is
 * `{ fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.14)' }`
 * (AnatomyHeatmap.tsx:18), and the neutral head/neck/pelvis shapes use an
 * even fainter `NEUTRAL = { fill: 'rgba(255,255,255,0.035)', stroke:
 * 'rgba(255,255,255,0.10)' }` (AnatomyHeatmap.tsx:29). Both are calibrated
 * to read as a faint silhouette against this theme's pure #000000 ground.
 * A 5%-alpha fill and a 14%-alpha stroke do not survive being placed over
 * photographic detail at any scrim short of one heavy enough to make the
 * photo itself unrecognisable — at that point the photo is no longer
 * serving the task's own motivating purpose (filling dead space with
 * visible content), so a heavier scrim is not actually the safer option it
 * looks like on paper. Every UNTRAINED muscle (routinely most of the
 * figure, for any one session) would render as a gap in the silhouette
 * rather than a deliberate "untrained" indication — reading as a broken
 * image, not a design choice. THE OTHER four themes all reach at least 50%
 * white/cream opacity on their most prominent text, which a scrim can
 * protect; Anatomy's hero content cannot be protected the same way without
 * defeating the photo entirely, so it is left out rather than shipped
 * half-working.
 *
 * `onBackgroundLoad` is accepted (ShareThemeProps, for structural
 * compatibility with the shared theme registry type) but never called —
 * correct, not an oversight: ShareComposerScreen's R30 share-gate checks
 * `THEMES[theme].supportsBackground` (themes/index.ts) before ever waiting
 * on this callback, specifically so a background staying set while the
 * user is on THIS theme can never disable sharing forever.
 */
export default function Anatomy({ payload }: ShareThemeProps) {
    const { muscleVolume } = payload;
    const hasVolume = hasMuscleVolume(muscleVolume);
    const eyebrowText = (payload.subtitle || formatDate(payload.date)).toUpperCase();

    // See "HORIZONTAL FIT" in the file doc comment above.
    const headlineFontSize = fitFontSize(payload.headline, HEADLINE_BOX_W, 108, HEADLINE_MIN_SIZE, HERO_CHAR_WIDTH_RATIO);
    const headlineLineHeight = Math.round(headlineFontSize * (118 / 108));

    return (
        <View style={styles.frame}>
            <Text style={styles.eyebrow} numberOfLines={1}>{eyebrowText}</Text>

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
    // See "HORIZONTAL FIT" in the file doc comment above.
    const fontSize = fitFontSize(payload.headline, HEADLINE_BOX_W, 140, HEADLINE_MIN_SIZE, HERO_CHAR_WIDTH_RATIO);
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
 *
 * Fix round 2 made both headlines' fontSize/lineHeight dynamic (see
 * "HORIZONTAL FIT" above), but `fitFontSize` never exceeds the maxFontSize
 * it's called with (108 / 140 respectively), so headlineLineHeight and
 * fallbackHeadline's lineHeight can only ever be <= the 118 / 152 this
 * budget already used. Both totals above remain valid exact worst cases.
 */
const styles = StyleSheet.create({
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
