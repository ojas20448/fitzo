import React from 'react';
import { CardText as Text } from '../CardText';
import { View, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import { formatDate, pickSummaryRows, fitFontSize } from '../format';
import { InkCircle } from '../ink';
import CardBackground from '../CardBackground';
import type { ShareThemeProps } from './index';

const MONO = 'VT323_400Regular';
const CHALK = '#F1EEE6';
const CHALK_DIM = 'rgba(241,238,230,0.6)';
const SLATE = '#1B2A22';

const MAX_CHALK_ROWS = 6;
const HERO_TEXT_W = 820; // widened from 760 (fix round 2) — still a clear 40px margin inside HERO_CIRCLE_W.
const HERO_SIZE = 200;
const HERO_LH_RATIO = 1.05;
const HERO_LH = 210; // round(HERO_SIZE * HERO_LH_RATIO) — fixed outer heroBox height, unaffected by dynamic shrinking below.
const HERO_CIRCLE_W = 860;
const HERO_CIRCLE_H = 230;
const HERO_MIN_SIZE = 90;

export default function Chalk({ payload, onBackgroundLoad, onBackgroundError }: ShareThemeProps) {
    const eyebrowText = (payload.subtitle || formatDate(payload.date)).toUpperCase();
    const rows = pickSummaryRows(payload, MAX_CHALK_ROWS);
    const overflow = pickSummaryRows(payload, Number.MAX_SAFE_INTEGER).length - rows.length;
    const heroFontSize = fitFontSize(payload.headline, HERO_TEXT_W, HERO_SIZE, HERO_MIN_SIZE);
    const heroLineHeight = Math.round(heroFontSize * HERO_LH_RATIO);

    return (
        <View style={styles.frame}>

            <CardBackground background={payload.background} scrimOpacity={0.7} onLoad={onBackgroundLoad} onError={onBackgroundError} />

            <Text style={styles.header} numberOfLines={2}>{eyebrowText}</Text>
            {!!payload.contextLabel && <Text style={styles.context} numberOfLines={2}>{payload.contextLabel}</Text>}

            <View style={styles.heroBox}>
                <InkCircle width={HERO_CIRCLE_W} height={HERO_CIRCLE_H} color={CHALK} />
                <Text
                    style={[styles.hero, { fontSize: heroFontSize, lineHeight: heroLineHeight }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.4}
                >
                    {payload.headline}
                </Text>
            </View>

            {!!payload.headlineLabel && <Text style={styles.metric}>{payload.headlineLabel}</Text>}
            {rows.length > 0 && (
                <View>
                    {rows.map((r, i) => (
                        <View key={`${r.label}-${i}`} style={styles.row}>
                            <Text style={styles.rowLabel} numberOfLines={2}>{'✓  '}{r.label}</Text>
                            <Text style={styles.rowValue} numberOfLines={2}>{r.value}</Text>
                        </View>
                    ))}
                </View>
            )}
            {overflow > 0 && <Text style={styles.metric}>{'+' + overflow + ' more highlights'}</Text>}

            <View style={styles.spacer} />

            <Text style={styles.footerMark}>FITZO</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    context: { fontFamily: MONO, fontSize: 48, lineHeight: 54, color: CHALK, marginBottom: 20 },
    metric: { fontFamily: MONO, fontSize: 40, lineHeight: 48, color: CHALK, textAlign: 'center', marginBottom: 32 },
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
        fontSize: 40,
        lineHeight: 48,
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
        paddingVertical: 22,
    },
    rowLabel: {
        fontFamily: MONO,
        fontSize: 48,
        lineHeight: 54,
        color: CHALK,
        flexShrink: 1,
        paddingRight: 16,
    },
    rowValue: {
        fontFamily: MONO,
        fontSize: 46,
        lineHeight: 54,
        color: CHALK,
        maxWidth: 360,
        textAlign: 'right',
        letterSpacing: 1,
    },
    footerMark: {
        alignSelf: 'center',
        fontFamily: MONO,
        fontSize: 40,
        lineHeight: 48,
        color: CHALK_DIM,
        letterSpacing: 5,
    },
});
