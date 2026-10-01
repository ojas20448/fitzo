import React from 'react';
import { CardText as Text } from '../CardText';
import { View, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import { formatDate, fitFontSize } from '../format';
import { colors, typography } from '../../../styles/theme';
import CardBackground from '../CardBackground';
import type { ShareThemeProps } from './index';

const MICRO = 42;
const MICRO_LH = 54;

const HERO_SIZE = 320;
const HERO_LH_RATIO = 1.05; // headroom so the glyph's ascent/descent never clips the fixed box.
const HERO_LH = 336; // round(HERO_SIZE * HERO_LH_RATIO) — the FIXED outer box height (heroBox), unaffected by dynamic shrinking below.
const HERO_BOX_W = 860;
const HERO_MIN_SIZE = 54;

const PANEL_PADDING = 28;
const BRACKET = 28;
const BRACKET_W = 3;
const BRACKET_COLOR = colors.accent.gold; // "achievements" hue in the design system — fits a scoreboard callout.

const MUTED = 'rgba(255,255,255,0.55)';

export default function Scoreboard({ payload, onBackgroundLoad, onBackgroundError }: ShareThemeProps) {
    const hasPr = payload.prs.length === 1;
    const pr = hasPr ? payload.prs[0] : undefined;
    const eyebrowText = (hasPr && pr ? pr.exercise : payload.contextLabel || payload.subtitle || formatDate(payload.date)).toUpperCase();
    const belowText = hasPr && pr ? (pr.previous ? `PREV ${pr.previous}` : null) : payload.caption || null;
    const heroFontSize = fitFontSize(payload.headline, HERO_BOX_W, HERO_SIZE, HERO_MIN_SIZE);
    const heroLineHeight = Math.round(heroFontSize * HERO_LH_RATIO);

    return (
        <View style={styles.frame}>

            <CardBackground background={payload.background} scrimOpacity={0.65} onLoad={onBackgroundLoad} onError={onBackgroundError} />

            <Text style={styles.eyebrow} numberOfLines={3}>{eyebrowText}</Text>

            <View style={styles.spacer} />

            <View style={styles.heroGroup}>
                {!hasPr && !!payload.headlineLabel && <Text style={styles.tag}>{payload.headlineLabel}</Text>}
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
                    <Text style={styles.below} numberOfLines={3}>{belowText}</Text>
                )}
            </View>

            <View style={styles.spacer} />

            <Text style={styles.footerMark}>FITZO</Text>
        </View>
    );
}

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
