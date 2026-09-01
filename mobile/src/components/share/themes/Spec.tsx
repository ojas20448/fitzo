import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import type { ShareExercise } from '../SharePayload';
import { formatDate, formatTopSet, formatVolumeKg } from '../format';
import { typography } from '../../../styles/theme';
import CardBackground from '../CardBackground';
import type { ShareThemeProps } from './index';

/**
 * SPEC — the technical spec-sheet theme.
 *
 * Pure black ground, Lexend, hairline rules, letterspaced uppercase labels.
 * Structure: eyebrow -> hero number -> a rule-separated data table, one row
 * per exercise. Deliberately typographic and columnar with NO dither art —
 * Receipt already owns the illustrated-paper motif. The two themes must
 * differ in structure, not just palette, and a table is the structural
 * opposite of a receipt: crisp hairline borders instead of hand-drawn SVG
 * dashes, a fixed-width numeric grid instead of a single stacked column.
 *
 * formatDate/formatTopSet/formatVolumeKg live in ../format (R19) — Receipt
 * needs formatDate too, and duplicating pure formatting logic across the two
 * theme files is the same defect class R16 already named for InkCircle and
 * DashedLine.
 */

const RULE = 'rgba(255,255,255,0.12)';
const MUTED = 'rgba(255,255,255,0.5)';
const DIM = 'rgba(255,255,255,0.34)';

const H_PADDING = 72;

// Nothing bounds payload.exercises.length, and this card renders at a fixed
// 1920px-tall frame with no scroll. A full workout session comfortably fits
// in 8 rows; beyond that, further rows collapse into a single "+N more" line
// instead of growing past the bottom of the card.
const MAX_EXERCISE_ROWS = 8;

export default function Spec({ payload, onBackgroundLoad }: ShareThemeProps) {
    const eyebrow = (payload.subtitle || formatDate(payload.date)).toUpperCase();
    const exercises = payload.exercises.slice(0, MAX_EXERCISE_ROWS);
    const overflowCount = payload.exercises.length - exercises.length;
    const hasExercises = payload.exercises.length > 0;

    return (
        <View style={styles.frame}>
            {/* Task 10: full-bleed black ground, photo + scrim drops
             * straight in. Scrim is heavier than Scoreboard's 0.55 — the
             * column headers (DIM, 34% white alpha) and hairline rules
             * (12% alpha) are the lowest-contrast text/lines of any theme
             * here and need the extra margin to stay legible over a photo. */}
            <CardBackground background={payload.background} scrimOpacity={0.6} onLoad={onBackgroundLoad} />

            <View>
                <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>

                <View style={styles.hero}>
                    <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>
                        {payload.headline}
                    </Text>
                </View>

                {hasExercises && (
                    <View style={styles.table}>
                        <View style={[styles.row, styles.headerRow]}>
                            <Text style={[styles.colLabel, styles.nameCol]} numberOfLines={1}>Exercise</Text>
                            <Text style={[styles.colLabel, styles.topSetCol]} numberOfLines={1}>Top set</Text>
                            <Text style={[styles.colLabel, styles.volumeCol]} numberOfLines={1}>Volume</Text>
                        </View>
                        {exercises.map((ex: ShareExercise) => {
                            const topSet = formatTopSet(ex.topSet);
                            return (
                                <View key={ex.id} style={styles.row}>
                                    <Text style={[styles.name, styles.nameCol]} numberOfLines={1}>{ex.name}</Text>
                                    <Text style={[styles.value, styles.topSetCol, styles.topSetValue]} numberOfLines={1}>
                                        {topSet || '—'}
                                    </Text>
                                    <Text style={[styles.value, styles.volumeCol]} numberOfLines={1}>
                                        {formatVolumeKg(ex.volumeKg)} KG
                                    </Text>
                                </View>
                            );
                        })}
                        {overflowCount > 0 && (
                            <View style={styles.row}>
                                <Text style={styles.overflow}>+{overflowCount} MORE</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Footer: small wordmark only — no user identity on the card */}
            <Text style={styles.footerMark}>FITZO</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    frame: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: '#000000',
        paddingHorizontal: H_PADDING,
        paddingTop: 100,
        paddingBottom: 64,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    eyebrow: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 26,
        letterSpacing: 4,
        color: MUTED,
    },
    hero: {
        marginTop: 28,
        marginBottom: 64,
    },
    headline: {
        fontFamily: typography.fontFamily.extraBold,
        fontSize: 156,
        letterSpacing: -2,
        color: '#FFFFFF',
    },
    table: {
        borderTopWidth: 1,
        borderTopColor: RULE,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 28,
        borderBottomWidth: 1,
        borderBottomColor: RULE,
    },
    headerRow: {
        paddingVertical: 16,
    },
    nameCol: { flex: 1, paddingRight: 16 },
    topSetCol: { width: 190, textAlign: 'right' },
    volumeCol: { width: 190, textAlign: 'right' },
    colLabel: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 20,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: DIM,
    },
    name: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 34,
        color: '#FFFFFF',
    },
    value: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 28,
        color: '#FFFFFF',
    },
    topSetValue: {
        color: MUTED,
        fontFamily: typography.fontFamily.regular,
        fontSize: 26,
    },
    overflow: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 24,
        letterSpacing: 1,
        color: MUTED,
    },
    footerMark: {
        alignSelf: 'center',
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 26,
        letterSpacing: 6,
        color: DIM,
    },
});
