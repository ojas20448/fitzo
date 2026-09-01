import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import { formatDate, fitFontSize, HERO_CHAR_WIDTH_RATIO } from '../format';
import { colors, typography } from '../../../styles/theme';
import CardBackground from '../CardBackground';
import type { ShareThemeProps } from './index';

/**
 * SCOREBOARD — the single-stat jumbotron theme.
 *
 * Structurally the opposite of both Receipt and Spec: there is no card
 * shape, no itemized list, no table. One numeral (`payload.headline`) fills
 * almost the entire frame at up to HERO_SIZE=320, bracket-framed like a
 * scoreboard display panel; every other piece of text on the card is a
 * fixed MICRO=11 — an eyebrow above, an optional "NEW PR" callout and
 * comparison line flanking the panel, and the footer mark. That ~29x size
 * ratio (320 vs 11) is the theme's whole identity: everything that is not
 * THE number is deliberately reduced to fine print, unlike Spec's hero/body
 * ratio (156 vs 20-34, ~5-8x) which still reads as a data sheet.
 *
 * Registered with `singleSelectOnly: true` in themes/index.ts — a single
 * numeral has nothing sensible to draw for a second selection.
 *
 * `pickMoment` (shareMoment.ts) currently only ever routes here with a PR
 * pre-selected, but this component does not assume that — it degrades to a
 * plain date/subtitle eyebrow and an optional caption line when
 * `payload.prs` is empty, so it stays correct if a future composer selection
 * (e.g. "total") is ever pointed at this theme.
 *
 * HORIZONTAL FIT (fix round 2): the hero already had `numberOfLines={1}` +
 * `adjustsFontSizeToFit`, but a real react-native-web render measurement
 * showed the literal `fontSize: 320` being used un-shrunk regardless —
 * "12,480 KG" measured `scrollWidth: 1654` against the box's (then) 800px
 * `clientWidth`, clipped to "12,...". `adjustsFontSizeToFit`'s support in
 * react-native-web is weaker than native's, so the fix does not rely on it
 * alone: `heroFontSize` below is computed by `fitFontSize` (`../format`),
 * a pure width/length calculation that guarantees the LITERAL starting
 * fontSize already fits `HERO_BOX_W`, before either RN prop ever runs.
 * `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale` stay on
 * the Text as a secondary, native-only refinement layer, not the primary
 * guarantee.
 */

const MICRO = 11;
// Explicit, hardcoded line-height per R20 (see Receipt.tsx) rather than a
// ratio of MICRO: at this size the multiplier matters less than having a
// single fixed number the worst-case budget below can be computed from.
const MICRO_LH = 16;

const HERO_SIZE = 320;
const HERO_LH_RATIO = 1.05; // headroom so the glyph's ascent/descent never clips the fixed box.
const HERO_LH = 336; // round(HERO_SIZE * HERO_LH_RATIO) — the FIXED outer box height (heroBox), unaffected by dynamic shrinking below.
// Widened from 800 (fix round 2) — see "HORIZONTAL FIT" above. Still well
// inside the panel: panel width = HERO_BOX_W + PANEL_PADDING*2 = 916,
// against a 936px frame content width (CARD_W - paddingHorizontal*2), a
// 20px margin that keeps the panel off the frame's own padding edge.
const HERO_BOX_W = 860;
// Fit parameters for `fitFontSize` — see its doc comment in format.ts for
// what HERO_CHAR_WIDTH_RATIO is calibrated from. 100 is a floor comfortably
// below the ~126px `fitFontSize` computes for "1,23,456 KG" (11 chars,
// the longest realistic en-IN-grouped headline) at this box width, so
// there is real headroom for something even longer before the floor bites.
const HERO_MIN_SIZE = 100;

const PANEL_PADDING = 28;
const BRACKET = 28;
const BRACKET_W = 3;
const BRACKET_COLOR = colors.accent.gold; // "achievements" hue in the design system — fits a scoreboard callout.

const MUTED = 'rgba(255,255,255,0.55)';

export default function Scoreboard({ payload, onBackgroundLoad }: ShareThemeProps) {
    const hasPr = payload.prs.length > 0;
    const pr = hasPr ? payload.prs[0] : undefined;

    // R4-adjacent trap avoided here too: nothing in this file reads
    // payload.muscleVolume or any lowercase-muscle-keyed record, so there is
    // no key-mismatch surface for this theme.
    const eyebrowText = (hasPr && pr ? pr.exercise : payload.subtitle || formatDate(payload.date)).toUpperCase();
    const belowText = hasPr && pr ? (pr.previous ? `PREV ${pr.previous}` : null) : payload.caption || null;

    // See "HORIZONTAL FIT" in the file doc comment above.
    const heroFontSize = fitFontSize(payload.headline, HERO_BOX_W, HERO_SIZE, HERO_MIN_SIZE, HERO_CHAR_WIDTH_RATIO);
    const heroLineHeight = Math.round(heroFontSize * HERO_LH_RATIO);

    return (
        <View style={styles.frame}>
            {/* Task 10: full-bleed dark ground, photo + scrim drops straight
             * in — first child so the frame's own #000 background paints
             * first and every other node below stacks on top of it. */}
            <CardBackground background={payload.background} scrimOpacity={0.55} onLoad={onBackgroundLoad} />

            <Text style={styles.eyebrow} numberOfLines={1}>{eyebrowText}</Text>

            <View style={styles.spacer} />

            <View style={styles.heroGroup}>
                {hasPr && (
                    <Text style={styles.tag} numberOfLines={1}>NEW PR</Text>
                )}

                <View style={styles.panel}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                    <View style={styles.heroBox}>
                        <Text
                            style={[styles.hero, { fontSize: heroFontSize, lineHeight: heroLineHeight }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.4}
                        >
                            {payload.headline}
                        </Text>
                    </View>
                </View>

                {!!belowText && (
                    <Text style={styles.below} numberOfLines={1}>{belowText}</Text>
                )}
            </View>

            <View style={styles.spacer} />

            {/* Footer: small wordmark only — no user identity on the card */}
            <Text style={styles.footerMark}>FITZO</Text>
        </View>
    );
}

/**
 * WORST-CASE VERTICAL BUDGET (both optional micro-rows present at once):
 *   paddingTop 96 + paddingBottom 64                          = 160
 *   eyebrow (always present)              lineHeight 16       =  16
 *   tag "NEW PR"                lineHeight 16 + marginBottom20 =  36
 *   panel: PANEL_PADDING*2 (56) + heroBox HERO_LH (336)        = 392
 *   below-hero line              marginTop20 + lineHeight 16   =  36
 *   footer mark                            lineHeight 16       =  16
 *   ---------------------------------------------------------------
 *   fixed total                                                = 656 of 1920
 * The two `spacer` Views (flex:1 each) absorb the remaining >=1264px
 * between the eyebrow/footer and the hero group, split evenly — since fixed
 * content never exceeds ~34% of the frame, the spacers can never be pushed
 * to zero and overflow is structurally impossible regardless of which
 * optional lines render.
 *
 * Fix round 2 (horizontal fit) changed HERO_BOX_W (800->860, a WIDTH) and
 * made heroFontSize/heroLineHeight dynamic, but did not touch heroBox's
 * own `height: HERO_LH` (still the fixed 336 constant) — heroFontSize can
 * only ever be <= HERO_SIZE by construction (fitFontSize's own bound), so
 * heroLineHeight can only ever be <= HERO_LH too. This budget's 392-height
 * panel figure, and the 656 total, are therefore still valid as an exact
 * WORST case (reached when the string is short enough to need no
 * shrinking), not merely an estimate that fix round 2 could have
 * invalidated.
 */
const styles = StyleSheet.create({
    frame: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: '#000000',
        paddingTop: 96,
        paddingBottom: 64,
        paddingHorizontal: 72,
        alignItems: 'center',
        overflow: 'hidden',
    },
    spacer: { flex: 1 },
    eyebrow: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: MICRO,
        lineHeight: MICRO_LH,
        letterSpacing: 2,
        color: MUTED,
        textAlign: 'center',
    },
    heroGroup: {
        alignItems: 'center',
    },
    tag: {
        fontFamily: typography.fontFamily.bold,
        fontSize: MICRO,
        lineHeight: MICRO_LH,
        letterSpacing: 3,
        color: BRACKET_COLOR,
        marginBottom: 20,
    },
    panel: {
        position: 'relative',
        paddingHorizontal: PANEL_PADDING,
        paddingVertical: PANEL_PADDING,
        alignItems: 'center',
        justifyContent: 'center',
    },
    corner: {
        position: 'absolute',
        width: BRACKET,
        height: BRACKET,
        borderColor: BRACKET_COLOR,
        opacity: 0.8,
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: BRACKET_W, borderLeftWidth: BRACKET_W },
    cornerTR: { top: 0, right: 0, borderTopWidth: BRACKET_W, borderRightWidth: BRACKET_W },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: BRACKET_W, borderLeftWidth: BRACKET_W },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: BRACKET_W, borderRightWidth: BRACKET_W },
    heroBox: {
        height: HERO_LH,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hero: {
        width: HERO_BOX_W,
        fontFamily: typography.fontFamily.extraBold,
        fontSize: HERO_SIZE,
        lineHeight: HERO_LH,
        letterSpacing: -2,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    below: {
        fontFamily: typography.fontFamily.medium,
        fontSize: MICRO,
        lineHeight: MICRO_LH,
        letterSpacing: 1,
        color: MUTED,
        marginTop: 20,
        textAlign: 'center',
    },
    footerMark: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: MICRO,
        lineHeight: MICRO_LH,
        color: MUTED,
        opacity: 0.7,
        letterSpacing: 3,
    },
});
