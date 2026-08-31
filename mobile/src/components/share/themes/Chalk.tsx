import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import type { SharePayload } from '../SharePayload';
import { formatDate, pickSummaryRows } from '../format';
import { InkCircle } from '../ink';

/**
 * CHALK — the hand-drawn slate theme.
 *
 * Full-bleed dark slate ground (not a floating card like Receipt, not pure
 * black like Spec/Scoreboard/Anatomy) with VT323 throughout, reading as a
 * gym chalkboard someone scrawled today's number and exercise list onto.
 * Structurally distinct from Receipt — the one other theme that also uses
 * VT323 and InkCircle — in three ways: (1) no paper shape, no rotation, no
 * title bar, the slate IS the whole frame; (2) the InkCircle emphasizes the
 * HERO number directly, not a "Total" row at the bottom of an itemized
 * list; (3) content is left-aligned and unruled — no dashed dividers, no
 * boxed section bars, just spaced-out handwriting, unlike Receipt's
 * itemized receipt rows.
 *
 * Only one VT323 weight is registered app-wide (VT323_400Regular — see
 * app/_layout.tsx), so hierarchy here comes from size/opacity, never a bold
 * variant that doesn't exist.
 */

const MONO = 'VT323_400Regular';
const CHALK = '#F1EEE6';
const CHALK_DIM = 'rgba(241,238,230,0.6)';
const CHALK_FAINT = 'rgba(241,238,230,0.4)';
const SLATE = '#1B2A22';

const MAX_CHALK_ROWS = 6;

// Hero circle sized comfortably larger than the hero TEXT's own capped
// width/height (760x~210 at most) so the hand-drawn ellipse always encloses
// the number with margin, regardless of headline length — adjustsFontSizeToFit
// only ever shrinks the text to fit inside 760, never grows past it, so the
// circle can never end up smaller than the text it is meant to frame.
const HERO_TEXT_W = 760;
const HERO_SIZE = 200;
const HERO_LH = 210;
const HERO_CIRCLE_W = 860;
const HERO_CIRCLE_H = 230;

export default function Chalk({ payload }: { payload: SharePayload }) {
    const eyebrowText = (payload.subtitle || formatDate(payload.date)).toUpperCase();
    const rows = pickSummaryRows(payload, MAX_CHALK_ROWS);

    return (
        <View style={styles.frame}>
            <Text style={styles.header} numberOfLines={1}>{eyebrowText}</Text>

            <View style={styles.heroBox}>
                <InkCircle width={HERO_CIRCLE_W} height={HERO_CIRCLE_H} color={CHALK} />
                <Text style={styles.hero} numberOfLines={1} adjustsFontSizeToFit>
                    {payload.headline}
                </Text>
            </View>

            {rows.length > 0 && (
                <View>
                    {rows.map((r, i) => (
                        <View key={`${r.label}-${i}`} style={styles.row}>
                            <Text style={styles.rowLabel} numberOfLines={1}>{'✓  '}{r.label}</Text>
                            <Text style={styles.rowValue} numberOfLines={1}>{r.value}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.spacer} />

            {/* Footer: small wordmark only — no user identity on the card */}
            <Text style={styles.footerMark}>FITZO</Text>
        </View>
    );
}

/**
 * WORST-CASE VERTICAL BUDGET (checklist at its MAX_CHALK_ROWS=6 cap):
 *   paddingTop 90 + paddingBottom 64                            = 154
 *   header: lineHeight 40 + paddingBottom 12 + borderBottomWidth 2
 *           + marginBottom 56                                   = 110
 *   heroBox: fixed height 230 + marginBottom 56                 = 286
 *   checklist: 6 rows * (paddingVertical 28 + lineHeight 40)    = 408
 *   footer: lineHeight 32
 *   ------------------------------------------------------------------
 *   fixed total                                                 = 990 of 1920
 * `spacer` (flex:1, between the checklist and the footer) absorbs the
 * remaining >=930px, so the footer stays pinned toward the bottom instead
 * of sitting directly under a 6-row list. Fewer rows (or none — the
 * checklist block is omitted entirely when pickSummaryRows returns empty)
 * only shrinks the fixed total further.
 */
const styles = StyleSheet.create({
    frame: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: SLATE,
        paddingTop: 90,
        paddingBottom: 64,
        paddingHorizontal: 80,
        overflow: 'hidden',
    },
    spacer: { flex: 1 },
    header: {
        fontFamily: MONO,
        fontSize: 32,
        lineHeight: 40,
        letterSpacing: 2,
        color: CHALK_DIM,
        paddingBottom: 12,
        marginBottom: 56,
        borderBottomWidth: 2,
        borderBottomColor: 'rgba(241,238,230,0.25)',
    },
    heroBox: {
        alignSelf: 'center',
        width: HERO_CIRCLE_W,
        height: HERO_CIRCLE_H,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 56,
    },
    hero: {
        width: HERO_TEXT_W,
        fontFamily: MONO,
        fontSize: HERO_SIZE,
        lineHeight: HERO_LH,
        letterSpacing: 1,
        color: CHALK,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
    },
    rowLabel: {
        fontFamily: MONO,
        fontSize: 34,
        lineHeight: 40,
        color: CHALK,
        flexShrink: 1,
        paddingRight: 16,
    },
    rowValue: {
        fontFamily: MONO,
        fontSize: 34,
        lineHeight: 40,
        color: CHALK_DIM,
        letterSpacing: 1,
    },
    footerMark: {
        alignSelf: 'center',
        fontFamily: MONO,
        fontSize: 26,
        lineHeight: 32,
        color: CHALK_FAINT,
        letterSpacing: 5,
    },
});
