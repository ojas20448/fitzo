import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import type { SharePayload } from '../SharePayload';
import { formatDate } from '../format';
import { colors, typography } from '../../../styles/theme';

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
 */

const MICRO = 11;
// Explicit, hardcoded line-height per R20 (see Receipt.tsx) rather than a
// ratio of MICRO: at this size the multiplier matters less than having a
// single fixed number the worst-case budget below can be computed from.
const MICRO_LH = 16;

const HERO_SIZE = 320;
const HERO_LH = 336; // round(320 * 1.05) — headroom so the glyph's ascent/descent never clips the fixed box.
const HERO_BOX_W = 800;

const PANEL_PADDING = 28;
const BRACKET = 28;
const BRACKET_W = 3;
const BRACKET_COLOR = colors.accent.gold; // "achievements" hue in the design system — fits a scoreboard callout.

const MUTED = 'rgba(255,255,255,0.55)';

export default function Scoreboard({ payload }: { payload: SharePayload }) {
    const hasPr = payload.prs.length > 0;
    const pr = hasPr ? payload.prs[0] : undefined;

    // R4-adjacent trap avoided here too: nothing in this file reads
    // payload.muscleVolume or any lowercase-muscle-keyed record, so there is
    // no key-mismatch surface for this theme.
    const eyebrowText = (hasPr && pr ? pr.exercise : payload.subtitle || formatDate(payload.date)).toUpperCase();
    const belowText = hasPr && pr ? (pr.previous ? `PREV ${pr.previous}` : null) : payload.caption || null;

    return (
        <View style={styles.frame}>
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
                        <Text style={styles.hero} numberOfLines={1} adjustsFontSizeToFit>
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
