import React from 'react';
import { CardText as Text } from '../CardText';
import { View, StyleSheet, Image } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import { RECEIPT_DITHER_BY_MUSCLE as DITHER_BY_MUSCLE, ditherForExercise } from '../../../utils/ditherForExercise';
import { InkCircle, DashedLine } from '../ink';
import { formatDate, pickSummaryRows, fitFontSize } from '../format';
import { shadow } from '../../../styles/theme';
import CardBackground from '../CardBackground';
import type { ShareThemeProps } from './index';

const MONO = 'VT323_400Regular';
const MAX_CONTENT_ROWS = 4;

export default function Receipt({ payload, onBackgroundLoad, onBackgroundError, onArtworkLoad, onArtworkError }: ShareThemeProps) {
    const allRows = pickSummaryRows(payload, Number.MAX_SAFE_INTEGER);
    const detailRows = payload.prs.length || payload.exercises.length ? allRows : [];
    const rows = detailRows.slice(0, MAX_CONTENT_ROWS);
    const overflow = detailRows.length - rows.length;
    const art = payload.prs.length ? DITHER_BY_MUSCLE.trophy
        : payload.exercises.length ? ditherForExercise(payload.exercises[0], DITHER_BY_MUSCLE) : DITHER_BY_MUSCLE.default;
    const label = payload.headlineLabel || 'Summary';
    const headlineSize = fitFontSize(payload.headline, 810, 110, 54);
    const totalValue = payload.prs.length > 1 && !payload.exercises.length ? String(payload.prs.length) : payload.headline;
    return (
        <View style={styles.frame}>
            <CardBackground background={payload.background} scrimOpacity={0.35} onLoad={onBackgroundLoad} onError={onBackgroundError} />
            <View style={styles.paper}>
                <View style={styles.headerRow}>
                    <Text style={styles.timestamp}>{formatDate(payload.date)}</Text>
                    <Text style={styles.timestamp}>{String(payload.date.getHours()).padStart(2, '0') + ':' + String(payload.date.getMinutes()).padStart(2, '0')}</Text>
                </View>
                <View style={styles.bar}><Text style={styles.barText} numberOfLines={2}>{(payload.subtitle || 'Workout summary').toUpperCase()}</Text></View>
                <View style={styles.hero}>
                    <Image source={art} style={styles.art} resizeMode="contain" onLoad={onArtworkLoad} onError={onArtworkError} />
                    {!!payload.contextLabel && <Text style={styles.context} numberOfLines={2}>{payload.contextLabel}</Text>}
                    <Text style={[styles.headline, { fontSize: headlineSize, lineHeight: headlineSize * 1.15 }]} numberOfLines={1} adjustsFontSizeToFit>{payload.headline}</Text>
                    <Text style={styles.metric}>{label}</Text>
                    {!!payload.caption && <Text style={styles.caption} numberOfLines={2}>{payload.caption}</Text>}
                </View>
                <DashedLine strokeWidth={3} dashLength={12} marginVertical={16} />
                {payload.rows.slice(0, 5).map((row, i) => (
                    <View style={styles.stat} key={row.label + i}>
                        <Text style={styles.statText} numberOfLines={1}>{row.label}</Text>
                        <Text style={styles.statText} numberOfLines={1}>{row.value}</Text>
                    </View>
                ))}
                {payload.rows.length > 5 && <Text style={styles.overflow}>{'+' + (payload.rows.length - 5) + ' more stats'}</Text>}
                {!!rows.length && <View style={styles.bar}><Text style={styles.barText}>WORKOUT HIGHLIGHTS</Text></View>}
                {rows.map((row, i) => (
                    <View style={styles.detail} key={row.label + i}>
                        <Text style={styles.detailName} numberOfLines={2}>{row.label}</Text>
                        <Text style={styles.detailValue} numberOfLines={2}>{row.value}</Text>
                    </View>
                ))}
                {overflow > 0 && <Text style={styles.overflow}>{'+' + overflow + ' more highlights'}</Text>}
                <View style={styles.spacer} />
                <DashedLine strokeWidth={3} dashLength={12} marginVertical={16} />
                <View style={styles.total}>
                    <Text style={styles.totalLabel} numberOfLines={2}>{label}</Text>
                    <View style={styles.circled}>
                        <InkCircle width={390} height={106} />
                        <Text style={[styles.totalValue, { fontSize: fitFontSize(totalValue, 350, 46, 28) }]} numberOfLines={1} adjustsFontSizeToFit>{totalValue}</Text>
                    </View>
                </View>
                <Text style={styles.brand}>FITZO</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    frame: { width: CARD_W, height: CARD_H, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    paper: { width: 936, height: 1740, padding: 54, borderRadius: 28, backgroundColor: '#F1EEE6', transform: [{ rotate: '-0.6deg' }], ...shadow({ y: 24, blur: 54, color: '#000', opacity: 0.55 }) },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    timestamp: { fontFamily: MONO, fontSize: 36, lineHeight: 42, color: '#36342e' },
    bar: { alignSelf: 'flex-start', backgroundColor: '#1a1a1a', paddingVertical: 10, paddingHorizontal: 20, marginTop: 12 },
    barText: { fontFamily: MONO, fontSize: 38, lineHeight: 42, color: '#F1EEE6', letterSpacing: 2 },
    hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 12 },
    art: { width: 320, height: 150 },
    context: { fontFamily: MONO, fontSize: 44, lineHeight: 48, color: '#141414', textAlign: 'center', marginTop: 14 },
    headline: { fontFamily: MONO, color: '#141414', textAlign: 'center', width: 810, marginTop: 12 },
    metric: { fontFamily: MONO, fontSize: 38, lineHeight: 44, color: '#454238', textAlign: 'center' },
    caption: { fontFamily: MONO, fontSize: 38, lineHeight: 42, color: '#454238', textAlign: 'center', marginTop: 14 },
    stat: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 20 },
    statText: { fontFamily: MONO, fontSize: 42, lineHeight: 48, color: '#141414', flexShrink: 1 },
    detail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#b1aea4' },
    detailName: { flex: 1, fontFamily: MONO, fontSize: 42, lineHeight: 46, color: '#141414' },
    detailValue: { width: 330, textAlign: 'right', fontFamily: MONO, fontSize: 42, lineHeight: 46, color: '#141414' },
    overflow: { fontFamily: MONO, fontSize: 36, lineHeight: 42, color: '#454238', marginTop: 12 },
    spacer: { flex: 1 },
    total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    totalLabel: { flex: 1, fontFamily: MONO, fontSize: 38, lineHeight: 42, color: '#141414' },
    circled: { width: 400, height: 112, justifyContent: 'center', alignItems: 'center' },
    totalValue: { width: 350, textAlign: 'center', fontFamily: MONO, fontSize: 46, lineHeight: 54, color: '#141414' },
    brand: { fontFamily: MONO, fontSize: 42, lineHeight: 48, color: '#59564f', textAlign: 'center', letterSpacing: 8, marginTop: 20 },
});
