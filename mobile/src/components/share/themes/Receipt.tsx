import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import type { SharePayload } from '../SharePayload';
import { DITHER_BY_MUSCLE, ditherForExercise } from '../../../utils/ditherForExercise';
import { weightEquivalence } from '../../ReceiptShareCard';
import { InkCircle, DashedLine } from '../ink';
import { shadow } from '../../../styles/theme';

/**
 * RECEIPT — the thermal-receipt theme (PUSH-inspired).
 *
 * Ports ReceiptShareCard's visual language (cream paper, ink, black inverted
 * bars, VT323, the -0.6deg tilt, dashed rules) into a fixed 1080x1920 story
 * frame. ReceiptShareCard.tsx itself is untouched; this is a sibling, not a
 * refactor of it, so the existing recap screen cannot regress.
 */

// Bundled retro bitmap font, registered globally in app/_layout.tsx — not an
// npm package, do not swap for a family string that isn't loaded there.
const MONO = 'VT323_400Regular';

// ReceiptShareCard was designed at a 360px on-screen preview width (R17).
// This theme renders at story resolution — CARD_W is 1080, exactly 3x that.
// Scaling every original measurement by the same factor keeps the receipt's
// proportions intact instead of it reading as a tiny slip adrift in a much
// larger canvas.
const SCALE = CARD_W / 360;
const s = (n: number) => Math.round(n * SCALE);

const PAPER_MARGIN = s(24);
const PAPER_W = CARD_W - PAPER_MARGIN * 2;

// Defensive caps: nothing in SharePayload bounds prs.length or rows.length,
// and this card is captured at a fixed 1920px height with no scroll. A
// receipt-style summary realistically shows a handful of PRs or stat rows;
// capping keeps a pathological payload from pushing the circled total off
// the bottom of the frame instead of silently cropping it mid-row.
//
// MAX_PRS=3 is deliberately tight: the worst case is every PR carrying a
// "Previous" sub-line plus a dashed divider, which by hand-measured estimate
// (row height x count) lands close to the 1920px ceiling at 4 and clears it
// with margin at 3.
const MAX_PRS = 3;
const MAX_ROWS = 5;

export default function Receipt({ payload }: { payload: SharePayload }) {
    const d = payload.date;
    const dateStr = `${String(d.getDate()).padStart(2, '0')} ${d
        .toLocaleString('en', { month: 'short' })
        .toUpperCase()} ${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const prs = payload.prs.slice(0, MAX_PRS);
    const rows = payload.rows.slice(0, MAX_ROWS);
    const hasPrs = prs.length > 0;

    // R5: trophy-on-PR precedence beats every other art rule. Guard the
    // empty-exercises case explicitly — ditherForExercise() reads
    // exercises[0], and payload.exercises is not guaranteed non-empty.
    const ditherImage = hasPrs
        ? DITHER_BY_MUSCLE.trophy
        : payload.exercises.length > 0
            ? ditherForExercise(payload.exercises[0])
            : DITHER_BY_MUSCLE.default;

    // payload.exercises carries RAW (unrounded) per-exercise volume by
    // design (see buildShareExercises.ts ruling R12) so an arbitrary subset
    // still sums correctly — round once, here, at render time.
    const totalVolumeKg = payload.exercises.reduce((sum, ex) => sum + ex.volumeKg, 0);
    const caption = payload.caption || weightEquivalence(totalVolumeKg);

    const titleText = (payload.subtitle || 'Workout summary').toUpperCase();

    return (
        <View style={styles.frame}>
            <View style={styles.paper}>
                {/* Header: timestamp only — the wordmark lives in the footer */}
                <View style={styles.headerRow}>
                    <Text style={styles.tsText}>{dateStr}</Text>
                    <Text style={styles.tsText}>{timeStr}</Text>
                </View>

                {/* Title bar */}
                <View style={styles.bar}>
                    <Text style={styles.barText} numberOfLines={1}>{titleText}</Text>
                </View>

                {/* Art + headline */}
                <View style={styles.artWrap}>
                    <Image source={ditherImage} style={styles.ditherArt} resizeMode="contain" />
                    <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>
                        {payload.headline}
                    </Text>
                    {!!caption && (
                        <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
                    )}
                </View>

                {/* Breakdown / stats */}
                <View style={styles.bar}>
                    <Text style={styles.barText}>{hasPrs ? '*STATS' : 'BREAKDOWN'}</Text>
                </View>

                {hasPrs ? (
                    <View style={styles.rows}>
                        {prs.map((pr, i) => (
                            <View key={`${pr.exercise}-${i}`}>
                                <View style={styles.row}>
                                    <Text style={styles.rowLabel} numberOfLines={1}>{pr.exercise}</Text>
                                    <Text style={styles.rowValue} numberOfLines={1}>{pr.current}</Text>
                                </View>
                                {!!pr.previous && (
                                    <View style={styles.row}>
                                        <Text style={styles.rowSub}>Previous</Text>
                                        <Text style={styles.rowSub}>{pr.previous}</Text>
                                    </View>
                                )}
                                {i < prs.length - 1 && (
                                    <DashedLine strokeWidth={s(1.4)} dashLength={s(4)} marginVertical={s(8)} />
                                )}
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.rows}>
                        {rows.map((r, i) => (
                            <View key={`${r.label}-${i}`} style={styles.row}>
                                <Text style={styles.rowLabel} numberOfLines={1}>{r.label}</Text>
                                <Text style={styles.rowValue} numberOfLines={1}>{r.value}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <DashedLine strokeWidth={s(1.4)} dashLength={s(4)} marginVertical={s(8)} />

                {/* Total, hand-circled */}
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Total</Text>
                    <View style={styles.circledWrap}>
                        <InkCircle width={s(96)} height={s(34)} />
                        <Text style={styles.rowValue} numberOfLines={1}>{payload.headline}</Text>
                    </View>
                </View>

                {/* Footer: small wordmark only — no user identity on the card */}
                <View style={styles.footer}>
                    <Text style={styles.footerMark}>FITZO</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    frame: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    paper: {
        width: PAPER_W,
        backgroundColor: '#F1EEE6',
        borderRadius: s(10),
        paddingHorizontal: s(18),
        paddingTop: s(18),
        paddingBottom: s(26),
        transform: [{ rotate: '-0.6deg' }],
        ...shadow({ y: s(8), blur: s(18), color: '#000000', opacity: 0.55 }),
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: s(14),
    },
    tsText: { fontFamily: MONO, fontSize: s(11), color: '#141414' },
    bar: {
        backgroundColor: '#1A1A1A',
        paddingVertical: s(4),
        paddingHorizontal: s(8),
        alignSelf: 'flex-start',
        marginBottom: s(6),
        marginTop: s(4),
    },
    barText: {
        fontFamily: MONO,
        fontSize: s(12),
        color: '#F1EEE6',
        letterSpacing: s(2),
    },
    artWrap: { alignItems: 'center', paddingVertical: s(14) },
    ditherArt: {
        width: s(140),
        height: s(80),
    },
    headline: {
        fontFamily: MONO,
        fontSize: s(34),
        color: '#141414',
        marginTop: s(10),
        letterSpacing: s(1),
    },
    caption: {
        fontFamily: MONO,
        fontSize: s(14),
        color: '#141414',
        marginTop: s(6),
        textAlign: 'center',
        paddingHorizontal: s(10),
    },
    rows: { paddingTop: s(6) },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: s(4),
    },
    rowLabel: { fontFamily: MONO, fontSize: s(15), color: '#141414', flexShrink: 1, paddingRight: s(8) },
    rowValue: { fontFamily: MONO, fontSize: s(15), color: '#141414' },
    rowSub: { fontFamily: MONO, fontSize: s(12), color: '#5A5850' },
    circledWrap: {
        paddingHorizontal: s(18),
        paddingVertical: s(7),
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        marginTop: s(16),
        alignItems: 'center',
    },
    footerMark: {
        fontFamily: MONO,
        fontSize: s(15),
        color: '#141414',
        opacity: 0.5,
        letterSpacing: s(3),
    },
});
