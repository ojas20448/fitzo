import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Svg, { Rect, Ellipse, Line } from 'react-native-svg';

/**
 * ReceiptShareCard — thermal-receipt style shareable (PUSH-inspired).
 *
 * Cream paper on black, monospace type, black section bars, line-art barbell,
 * a fun "weight of X" equivalence, and a hand-drawn ink circle around the total.
 * Captured via the same ViewShot pipeline as WorkoutShareCard.
 */

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.min(SW - 48, 360);

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });

// Indian-flavored weight equivalences — pick the one that lands in a fun range
const EQUIVALENTS: { kg: number; singular: string; plural: string }[] = [
    { kg: 4000, singular: 'elephant', plural: 'elephants' },
    { kg: 700, singular: 'auto-rickshaw', plural: 'auto-rickshaws' },
    { kg: 195, singular: 'Royal Enfield', plural: 'Royal Enfields' },
    { kg: 30, singular: 'gas cylinder', plural: 'gas cylinders' },
    { kg: 5, singular: 'watermelon', plural: 'watermelons' },
];

export function weightEquivalence(totalKg: number): string {
    if (totalKg <= 0) return '';
    for (const eq of EQUIVALENTS) {
        const count = Math.round(totalKg / eq.kg);
        if (count >= 2 && count <= 999) {
            return `The weight of ${count.toLocaleString()} ${count === 1 ? eq.singular : eq.plural}`;
        }
    }
    const count = Math.max(1, Math.round(totalKg / EQUIVALENTS[EQUIVALENTS.length - 1].kg));
    return `The weight of ${count.toLocaleString()} watermelons`;
}

// Bold line-art barbell (1-bit look, no dithering needed)
const BarbellArt: React.FC = () => (
    <Svg width={180} height={72} viewBox="0 0 180 72">
        {/* bar */}
        <Rect x={10} y={33} width={160} height={6} rx={3} fill="#141414" />
        {/* inner plates */}
        <Rect x={40} y={12} width={12} height={48} rx={4} fill="#141414" />
        <Rect x={128} y={12} width={12} height={48} rx={4} fill="#141414" />
        {/* outer plates */}
        <Rect x={26} y={20} width={10} height={32} rx={4} fill="#141414" />
        <Rect x={144} y={20} width={10} height={32} rx={4} fill="#141414" />
        {/* collars */}
        <Rect x={56} y={28} width={6} height={16} rx={2} fill="#141414" />
        <Rect x={118} y={28} width={6} height={16} rx={2} fill="#141414" />
    </Svg>
);

// Trophy line-art for PR receipts
const TrophyArt: React.FC = () => (
    <Svg width={120} height={90} viewBox="0 0 120 90">
        <Rect x={38} y={8} width={44} height={38} rx={10} fill="#141414" />
        <Rect x={26} y={12} width={12} height={22} rx={6} fill="none" stroke="#141414" strokeWidth={5} />
        <Rect x={82} y={12} width={12} height={22} rx={6} fill="none" stroke="#141414" strokeWidth={5} />
        <Rect x={54} y={46} width={12} height={14} fill="#141414" />
        <Rect x={42} y={60} width={36} height={8} rx={2} fill="#141414" />
        <Rect x={34} y={70} width={52} height={9} rx={2} fill="#141414" />
    </Svg>
);

// Hand-drawn ink circle (two offset ellipses = sketchy pen look)
const InkCircle: React.FC<{ width: number; height: number; color?: string }> = ({ width, height, color = '#2B5CE6' }) => (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 3} ry={height / 2 - 3}
            fill="none" stroke={color} strokeWidth={2} opacity={0.9} />
        <Ellipse cx={width / 2 + 2} cy={height / 2 - 1} rx={width / 2 - 4} ry={height / 2 - 4}
            fill="none" stroke={color} strokeWidth={1.5} opacity={0.55} />
    </Svg>
);

const DashedLine: React.FC = () => (
    <Svg width="100%" height={2} style={{ marginVertical: 8 }}>
        <Line x1="0" y1="1" x2="100%" y2="1" stroke="#141414" strokeWidth={1.4} strokeDasharray="4,4" />
    </Svg>
);

interface ReceiptRow {
    label: string;
    value: string;
}

interface ReceiptShareCardProps {
    /** Black bar title, e.g. "TOTAL WEIGHT MOVED" or "CHEST DAY" */
    title: string;
    /** Big number, e.g. "1,240 KG" */
    headlineValue: string;
    /** Line under the number — pass weightEquivalence(totalKg) or custom */
    headlineCaption?: string;
    /** Section under BREAKDOWN bar */
    rows: ReceiptRow[];
    /** Circled bottom line */
    total: ReceiptRow;
    /** PR receipt variant: shows trophy + these stats instead of barbell */
    prs?: { name: string; current: string; previous?: string }[];
    date?: Date;
}

const ReceiptShareCard = React.forwardRef<View, ReceiptShareCardProps>(
    ({ title, headlineValue, headlineCaption, rows, total, prs, date = new Date() }, ref) => {
        const d = date;
        const dateStr = `${String(d.getDate()).padStart(2, '0')} ${d
            .toLocaleString('en', { month: 'short' })
            .toUpperCase()} ${d.getFullYear()}`;
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const hasPrs = !!prs && prs.length > 0;

        return (
            <View ref={ref} style={styles.stage} collapsable={false}>
                <View style={styles.paper}>
                    {/* Header: wordmark + timestamp */}
                    <View style={styles.headerRow}>
                        <Text style={styles.wordmark}>
                            FITZO<Text style={styles.reg}>®</Text>
                        </Text>
                        <View style={styles.timestamp}>
                            <Text style={styles.tsText}>{dateStr}</Text>
                            <Text style={styles.tsText}>{timeStr}</Text>
                        </View>
                    </View>

                    {/* Title bar */}
                    <View style={styles.bar}>
                        <Text style={styles.barText}>{title.toUpperCase()}</Text>
                    </View>

                    {/* Art + headline */}
                    <View style={styles.artWrap}>
                        {hasPrs ? <TrophyArt /> : <BarbellArt />}
                        <Text style={styles.headline}>{headlineValue}</Text>
                        {!!headlineCaption && <Text style={styles.caption}>{headlineCaption}</Text>}
                    </View>

                    {/* Breakdown / stats */}
                    <View style={styles.bar}>
                        <Text style={styles.barText}>{hasPrs ? '*STATS' : 'BREAKDOWN'}</Text>
                    </View>

                    {hasPrs ? (
                        <View style={styles.rows}>
                            {prs!.map((pr, i) => (
                                <View key={i}>
                                    <View style={styles.row}>
                                        <Text style={styles.rowLabel}>{pr.name}</Text>
                                        <Text style={styles.rowValue}>{pr.current}</Text>
                                    </View>
                                    {!!pr.previous && (
                                        <View style={styles.row}>
                                            <Text style={styles.rowSub}>Previous</Text>
                                            <Text style={styles.rowSub}>{pr.previous}</Text>
                                        </View>
                                    )}
                                    {i < prs!.length - 1 && <DashedLine />}
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.rows}>
                            {rows.map((r, i) => (
                                <View key={i} style={styles.row}>
                                    <Text style={styles.rowLabel}>{r.label}</Text>
                                    <Text style={styles.rowValue}>{r.value}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <DashedLine />

                    {/* Total with hand-drawn ink circle */}
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>{total.label}</Text>
                        <View style={styles.circledWrap}>
                            <InkCircle width={96} height={34} />
                            <Text style={styles.rowValue}>{total.value}</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }
);

ReceiptShareCard.displayName = 'ReceiptShareCard';

const styles = StyleSheet.create({
    stage: {
        backgroundColor: '#000000',
        paddingVertical: 36,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    paper: {
        width: CARD_W,
        backgroundColor: '#F1EEE6',
        borderRadius: 10,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 26,
        transform: [{ rotate: '-0.6deg' }],
        shadowColor: '#000',
        shadowOpacity: 0.55,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    wordmark: {
        fontFamily: MONO,
        fontSize: 26,
        fontWeight: '900',
        color: '#141414',
        letterSpacing: -1,
    },
    reg: { fontSize: 10, fontWeight: '700' },
    timestamp: { alignItems: 'flex-end' },
    tsText: { fontFamily: MONO, fontSize: 11, color: '#141414' },
    bar: {
        backgroundColor: '#1A1A1A',
        paddingVertical: 4,
        paddingHorizontal: 8,
        alignSelf: 'flex-start',
        marginBottom: 6,
        marginTop: 4,
    },
    barText: {
        fontFamily: MONO,
        fontSize: 12,
        color: '#F1EEE6',
        letterSpacing: 2,
    },
    artWrap: { alignItems: 'center', paddingVertical: 22 },
    headline: {
        fontFamily: MONO,
        fontSize: 32,
        fontWeight: '700',
        color: '#141414',
        marginTop: 14,
        letterSpacing: 1,
    },
    caption: {
        fontFamily: MONO,
        fontSize: 12.5,
        color: '#141414',
        marginTop: 6,
        textAlign: 'center',
    },
    rows: { paddingTop: 6 },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    rowLabel: { fontFamily: MONO, fontSize: 14.5, color: '#141414' },
    rowValue: { fontFamily: MONO, fontSize: 14.5, color: '#141414', fontWeight: '700' },
    rowSub: { fontFamily: MONO, fontSize: 12, color: '#5A5850' },
    circledWrap: {
        paddingHorizontal: 18,
        paddingVertical: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ReceiptShareCard;
