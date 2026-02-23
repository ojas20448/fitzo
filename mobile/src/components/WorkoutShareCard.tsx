import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW;
const CARD_H = CARD_W * (16 / 9);

interface WorkoutShareCardProps {
    recap: {
        duration: number;
        volume: number;
        sets: number;
        prs?: any[];
    };
    user?: { name: string; streak?: number };
    intent?: { emphasis?: string[]; session_label?: string } | null;
    progressPct?: number | null;
    date: Date;
}

const WorkoutShareCard = React.forwardRef<View, WorkoutShareCardProps>(
    ({ recap, user, intent, progressPct, date }, ref) => {
        const hrs = Math.floor(recap.duration / 60);
        const mins = recap.duration % 60;
        const time = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}min`;

        const title = intent?.session_label?.toUpperCase()
            || intent?.emphasis?.[0]?.toUpperCase()
            || 'WORKOUT';

        const vol = recap.volume || 0;
        const volText = vol >= 10000
            ? `${(vol / 1000).toFixed(1).replace(/\.0$/, '')}k`
            : vol > 0 ? vol.toLocaleString() : '—';

        const hasProgress = progressPct != null && progressPct !== 0;
        const up = (progressPct ?? 0) >= 0;
        const sign = up ? '+' : '';
        const streak = user?.streak ?? 0;

        const dateStr = date.toLocaleDateString('en', {
            day: 'numeric', month: 'short', year: 'numeric',
        }).toUpperCase();

        return (
            <View ref={ref} style={s.card} collapsable={false}>
                {/* Subtle radial accent */}
                <View style={s.radial} />

                {/* ── Top ── */}
                <View style={s.top}>
                    <View style={s.topRow}>
                        <Text style={s.brand}>FITZO</Text>
                        <Text style={s.dateText}>{dateStr}</Text>
                    </View>
                    <View style={s.accent} />
                    <Text style={s.label}>WORKOUT COMPLETE</Text>
                </View>

                {/* ── Hero Title ── */}
                <View style={s.hero}>
                    <Text style={s.heroTitle}>{title}</Text>
                    <Text style={s.heroTitle}>DAY</Text>
                </View>

                {/* ── Glass Stats ── */}
                <View style={s.glassRow}>
                    <View style={s.glassCard}>
                        <Text style={s.glassValue}>{time}</Text>
                        <Text style={s.glassLabel}>DURATION</Text>
                    </View>
                    <View style={s.glassCard}>
                        <Text style={s.glassValue}>{volText}</Text>
                        <Text style={s.glassLabel}>KG LIFTED</Text>
                    </View>
                    <View style={s.glassCard}>
                        <Text style={s.glassValue}>{recap.sets || '—'}</Text>
                        <Text style={s.glassLabel}>SETS</Text>
                    </View>
                </View>

                {/* ── Progress + PRs row ── */}
                <View style={s.infoRow}>
                    {hasProgress && (
                        <View style={[s.chip, { backgroundColor: up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                            <MaterialIcons
                                name={up ? 'trending-up' : 'trending-down'}
                                size={14}
                                color={up ? '#22C55E' : '#EF4444'}
                            />
                            <Text style={[s.chipText, { color: up ? '#22C55E' : '#EF4444' }]}>
                                {sign}{Math.abs(progressPct!).toFixed(1)}%
                            </Text>
                        </View>
                    )}
                    {(recap.prs?.length ?? 0) > 0 && (
                        <View style={[s.chip, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
                            <MaterialIcons name="emoji-events" size={14} color="#FBBF24" />
                            <Text style={[s.chipText, { color: '#FBBF24' }]}>
                                {recap.prs!.length} PR{recap.prs!.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                    )}
                    {streak > 0 && (
                        <View style={[s.chip, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                            <MaterialIcons name="local-fire-department" size={14} color="#F97316" />
                            <Text style={[s.chipText, { color: '#F97316' }]}>
                                {streak} day streak
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── Footer ── */}
                <View style={s.footer}>
                    <View style={s.footerLine} />
                    <Text style={s.footerBrand}>FITZO</Text>
                </View>
            </View>
        );
    }
);

export default WorkoutShareCard;

const GLASS = {
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
};

const s = StyleSheet.create({
    card: {
        width: CARD_W,
        height: CARD_H,
        backgroundColor: '#000',
        paddingHorizontal: 28,
        paddingTop: 52,
        paddingBottom: 36,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    radial: {
        position: 'absolute',
        top: '15%',
        left: '10%',
        width: SW * 0.8,
        height: SW * 0.8,
        borderRadius: SW * 0.4,
        backgroundColor: 'rgba(255,255,255,0.015)',
    },

    // Top
    top: { gap: 12 },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    brand: {
        fontSize: 15,
        fontFamily: typography.fontFamily.extraBold,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 6,
    },
    dateText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: 'rgba(255,255,255,0.25)',
        letterSpacing: 1,
    },
    accent: {
        width: 28,
        height: 3,
        backgroundColor: '#fff',
        borderRadius: 2,
    },
    label: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 4,
    },

    // Hero
    hero: {},
    heroTitle: {
        fontSize: 64,
        fontFamily: typography.fontFamily.extraBold,
        color: '#FFFFFF',
        letterSpacing: -3,
        lineHeight: 68,
    },

    // Glass stats
    glassRow: {
        flexDirection: 'row',
        gap: 8,
    },
    glassCard: {
        flex: 1,
        backgroundColor: GLASS.bg,
        borderWidth: 1,
        borderColor: GLASS.border,
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 12,
        alignItems: 'center',
        gap: 6,
    },
    glassValue: {
        fontSize: 22,
        fontFamily: typography.fontFamily.bold,
        color: '#FFFFFF',
    },
    glassLabel: {
        fontSize: 9,
        fontFamily: typography.fontFamily.bold,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 2,
    },

    // Info chips
    infoRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 100,
    },
    chipText: {
        fontSize: 12,
        fontFamily: typography.fontFamily.semiBold,
    },

    // Footer
    footer: {
        alignItems: 'center',
        gap: 10,
    },
    footerLine: {
        width: 20,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 1,
    },
    footerBrand: {
        fontSize: 11,
        fontFamily: typography.fontFamily.extraBold,
        color: 'rgba(255,255,255,0.15)',
        letterSpacing: 8,
    },
});
