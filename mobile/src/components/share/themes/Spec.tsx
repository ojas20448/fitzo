import React from 'react';
import { CardText as Text } from '../CardText';
import { View, StyleSheet } from 'react-native';
import { CARD_W, CARD_H } from '../SharePayload';
import { formatDate, formatVolumeKg, formatTopSet, fitFontSize } from '../format';
import { typography } from '../../../styles/theme';
import CardBackground from '../CardBackground';
import type { ShareThemeProps } from './index';

const MAX_ROWS = 6;
export default function Spec({ payload, onBackgroundLoad, onBackgroundError }: ShareThemeProps) {
    // Records include a previous value, so reserve more vertical space per row.
    const rowLimit = payload.prs.length ? 4 : MAX_ROWS;
    const prs = payload.prs.slice(0, rowLimit);
    const exercises = payload.exercises.slice(0, rowLimit - prs.length);
    const generic = !payload.prs.length && !payload.exercises.length;
    const rows = generic ? payload.rows.slice(0, MAX_ROWS) : [];
    const overflow = generic ? payload.rows.length - rows.length : payload.prs.length + payload.exercises.length - prs.length - exercises.length;
    const headlineSize = fitFontSize(payload.headline, 936, 140, 56);
    return (
        <View style={styles.frame}>
            <CardBackground background={payload.background} scrimOpacity={0.72} onLoad={onBackgroundLoad} onError={onBackgroundError} />
            <View>
                <Text style={styles.eyebrow} numberOfLines={2}>{(payload.subtitle || formatDate(payload.date)).toUpperCase()}</Text>
                {!!payload.contextLabel && <Text style={styles.context} numberOfLines={2}>{payload.contextLabel}</Text>}
                <Text style={[styles.headline, { fontSize: headlineSize, lineHeight: headlineSize * 1.15 }]} numberOfLines={1} adjustsFontSizeToFit>{payload.headline}</Text>
                {!!payload.headlineLabel && <Text style={styles.metric}>{payload.headlineLabel}</Text>}
                <View style={styles.table}>
                    {prs.map((pr, i) => (
                        <View style={styles.record} key={pr.exercise + i}>
                            <View style={styles.recordTop}>
                                <Text style={styles.name} numberOfLines={2}>{pr.exercise}</Text>
                                <Text style={styles.prTag} numberOfLines={1}>NEW PR</Text>
                            </View>
                            <Text style={styles.recordValue} numberOfLines={1}>{pr.current}</Text>
                            {!!pr.previous && <Text style={styles.previous} numberOfLines={1}>{'Previous: ' + pr.previous}</Text>}
                        </View>
                    ))}
                    {!!exercises.length && <View style={styles.columns}>
                        <Text style={[styles.columnLabel, styles.nameCol]}>EXERCISE</Text>
                        <Text style={[styles.columnLabel, styles.numberCol]}>TOP SET</Text>
                        <Text style={[styles.columnLabel, styles.numberCol]}>KG VOLUME</Text>
                    </View>}
                    {exercises.map(ex => (
                        <View style={styles.row} key={ex.id}>
                            <Text style={[styles.name, styles.nameCol]} numberOfLines={2}>{ex.name}</Text>
                            <Text style={[styles.value, styles.numberCol]} numberOfLines={2}>{formatTopSet(ex.topSet) || '—'}</Text>
                            <Text style={[styles.value, styles.numberCol]} numberOfLines={2}>{ex.volumeKg > 0 ? formatVolumeKg(ex.volumeKg) : '—'}</Text>
                        </View>
                    ))}
                    {rows.map((row, i) => <View style={styles.row} key={row.label + i}>
                        <Text style={[styles.name, styles.nameCol]} numberOfLines={2}>{row.label}</Text>
                        <Text style={styles.value} numberOfLines={2}>{row.value}</Text>
                    </View>)}
                    {overflow > 0 && <Text style={styles.overflow}>{'+' + overflow + ' MORE'}</Text>}
                </View>
            </View>
            <Text style={styles.brand}>FITZO</Text>
        </View>
    );
}
const styles = StyleSheet.create({
    frame: { width: CARD_W, height: CARD_H, backgroundColor: '#000', paddingHorizontal: 72, paddingTop: 110, paddingBottom: 90, justifyContent: 'space-between', overflow: 'hidden' },
    eyebrow: { fontFamily: typography.fontFamily.semiBold, fontSize: 36, lineHeight: 44, letterSpacing: 2, color: '#bfbfbf' },
    context: { fontFamily: typography.fontFamily.medium, fontSize: 44, lineHeight: 52, color: '#fff', marginTop: 24 },
    headline: { fontFamily: typography.fontFamily.extraBold, letterSpacing: -2, color: '#fff', marginTop: 28 },
    metric: { fontFamily: typography.fontFamily.medium, fontSize: 36, lineHeight: 44, color: '#bfbfbf', marginTop: 12 },
    table: { marginTop: 60, borderTopWidth: 2, borderTopColor: '#777' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 136, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#555' },
    record: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#555' },
    recordTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
    recordValue: { fontFamily: typography.fontFamily.semiBold, fontSize: 44, lineHeight: 52, color: '#fff', marginTop: 6 },
    previous: { fontFamily: typography.fontFamily.regular, fontSize: 34, lineHeight: 42, color: '#bfbfbf', marginTop: 4 },
    prTag: { fontFamily: typography.fontFamily.bold, fontSize: 30, lineHeight: 38, color: '#fdd90d', minWidth: 128, flexShrink: 0, textAlign: 'right' },
    columns: { flexDirection: 'row', gap: 12, paddingVertical: 22 },
    columnLabel: { fontFamily: typography.fontFamily.semiBold, fontSize: 30, lineHeight: 38, color: '#bfbfbf' },
    nameCol: { flex: 1 },
    numberCol: { width: 208, textAlign: 'right' },
    name: { fontFamily: typography.fontFamily.medium, fontSize: 42, lineHeight: 50, color: '#fff', flexShrink: 1 },
    value: { fontFamily: typography.fontFamily.semiBold, fontSize: 40, lineHeight: 48, color: '#fff' },
    overflow: { fontFamily: typography.fontFamily.medium, fontSize: 36, lineHeight: 44, color: '#bfbfbf', marginTop: 24 },
    brand: { alignSelf: 'center', fontFamily: typography.fontFamily.semiBold, fontSize: 36, lineHeight: 44, color: '#bfbfbf', letterSpacing: 6 },
});
