import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { useShareComposerStore } from '../../stores/shareComposerStore';
import { pickMoment, TOTAL_ID, EX_PREFIX, PR_PREFIX, MUSCLES_ID } from '../../utils/shareMoment';
import type { ThemeId } from '../../utils/shareMoment';
import { THEMES, THEME_ORDER } from '../../components/share/themes';
import { buildSharePayload, deriveMuscleVolume } from '../../utils/buildSharePayload';
import { hasMuscleVolume } from '../../components/share/format';
import { CARD_W, CARD_H } from '../../components/share/SharePayload';
import type { SharePayload } from '../../components/share/SharePayload';
import { useShareCapture } from '../../hooks/useShareCapture';
import * as Haptics from '../../utils/haptics';

interface Chip {
    id: string;
    label: string;
    isPr: boolean;
}

/**
 * The composer screen — picks which lifts from the just-finished workout to
 * feature on a shareable 9:16 card, in one of five themes.
 *
 * Layout, top to bottom: content chips -> hero preview -> theme picker ->
 * Share button. See the two render blocks below for why the hero and the
 * capture target are two SEPARATE renders of the active theme, not one.
 */
export default function ShareComposerScreen() {
    const source = useShareComposerStore((s) => s.source);
    const isStale = useShareComposerStore((s) => s.isStale);
    const isSession = source?.kind === 'session';
    const session = source && source.kind === 'session' ? source.session : null;

    const [selection, setSelection] = useState<string[]>([]);
    const [theme, setTheme] = useState<ThemeId | null>(null);
    const [heroWidth, setHeroWidth] = useState(0);

    const cardRef = useRef<View>(null);
    const { captureAndShare, isSharing } = useShareCapture();

    // Open on the detected moment for a session source; a static source has
    // no "moment" to pick from a payload that already carries fixed content,
    // so it opens straight onto RECEIPT — the same theme pickMoment itself
    // falls back to when a session carries nothing chip-worthy either. No
    // source, or one too old to trust (see STALE_AFTER_MS in
    // shareComposerStore.ts), bounces back rather than showing a composer
    // with nothing — or stale, wrong — content. That staleness check is the
    // composer STORE's own clock (time since setSource), not the session's
    // own completedAt — see shareComposerStore.ts's doc comment for why
    // those are different checks, and WorkoutRecapScreen.tsx for where a
    // session's own freshness is verified before it ever reaches this store.
    useEffect(() => {
        if (!source || isStale()) {
            router.back();
            return;
        }
        if (source.kind === 'session') {
            const m = pickMoment(source.session);
            setSelection(m.selection);
            setTheme(m.theme);
        } else {
            setTheme('receipt');
        }
    }, []);

    // R3/R4: derived locally from the WHOLE session, independent of which
    // chips are selected — a heatmap of "what you trained today" does not
    // shrink because the card happens to feature one exercise. The actual
    // reduction (and its lowercase-key correctness) lives in
    // deriveMuscleVolume, which has test coverage this screen cannot.
    // A static source has no session to derive from, so this is always {}
    // for one — same as any workout with no muscle-tagged exercises.
    const muscleVolume = useMemo(
        () => deriveMuscleVolume(session?.exercises ?? []),
        [session],
    );
    const showMusclesChip = hasMuscleVolume(muscleVolume);

    // Empty for a static source — and the chip row that maps this is hidden
    // entirely below — there is nothing in a finished SharePayload to select
    // between.
    const chips: Chip[] = useMemo(() => {
        if (!session) return [];
        const list: Chip[] = [{ id: TOTAL_ID, label: 'Total', isPr: false }];
        for (const pr of session.prs) {
            list.push({ id: `${PR_PREFIX}${pr.exercise}`, label: pr.exercise, isPr: true });
        }
        for (const ex of session.exercises) {
            list.push({ id: `${EX_PREFIX}${ex.id}`, label: ex.name, isPr: false });
        }
        if (showMusclesChip) {
            list.push({ id: MUSCLES_ID, label: 'Muscles', isPr: false });
        }
        return list;
    }, [session, showMusclesChip]);

    // The one place selection + session become what a theme renders — for a
    // session source. A static source has no selection to derive from: it
    // renders source.payload exactly as handed to the composer (the chip
    // row that would mutate selection is hidden for it below, so selection
    // can never move out of the [] it starts at).
    // muscleVolume is spread on AFTER buildSharePayload, not passed into
    // it — see buildSharePayload.ts's own doc comment for why that field
    // stays outside its 2-argument (session, selection) contract.
    // Gated on the MUSCLES_ID chip being in `selection` (not spread
    // unconditionally): Anatomy's hasMuscleVolume check treats an absent
    // muscleVolume the same as an empty one and falls back to its own
    // designed FallbackBody, so leaving the chip OFF has to actually mean
    // something — otherwise toggling "Muscles" would produce no observable
    // change in any theme.
    const payload: SharePayload | null = useMemo(() => {
        if (!source || !theme) return null;
        if (source.kind === 'static') return source.payload;
        if (!session || selection.length === 0) return null;
        const base = buildSharePayload(session, selection);
        return selection.includes(MUSCLES_ID) ? { ...base, muscleVolume } : base;
    }, [source, session, theme, selection, muscleVolume]);

    if (!source || !theme || !payload) {
        // Either the effect above is about to call router.back(), or the
        // moment hasn't been seeded yet (a single tick after mount) — both
        // are momentary, so a bare background avoids flashing a zeroed-out
        // composer. Same idiom as app/_layout.tsx's own loadingContainer.
        return <View style={styles.container} />;
    }

    const ActiveTheme = THEMES[theme].Component;
    const heroScale = heroWidth > 0 ? heroWidth / CARD_W : 0;

    // Step 3 of the task brief, essentially verbatim: SCOREBOARD (the only
    // singleSelectOnly theme) can only ever draw one figure. Switching TO it
    // with more than one chip selected collapses to the first; adding a
    // second chip while it's already active moves the theme to SPEC, the
    // layout built to handle a list, rather than silently dropping the chip.
    // Gated on isSession: a static source's selection can never grow past
    // the [] it starts at (its chip row is never rendered, so nothing can
    // ever push into it), so this collapse is a no-op for it either way —
    // the guard makes that explicit rather than relying on selection
    // happening to stay empty.
    const onSelectTheme = (id: ThemeId) => {
        Haptics.selectionAsync();
        if (isSession && THEMES[id].singleSelectOnly && selection.length > 1) {
            setSelection([selection[0]]);
        }
        setTheme(id);
    };

    const onToggleChip = (id: string) => {
        const next = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
        if (next.length === 0) return; // never an empty selection
        if (next.length > 1 && THEMES[theme].singleSelectOnly) setTheme('spec');
        Haptics.selectionAsync();
        setSelection(next);
    };

    const handleShare = () => {
        // A static source can hand the composer a purpose-built fallback
        // (Stats' weekly-recap text references summary_text / streak_days —
        // fields no SharePayload carries); the session path keeps the same
        // generic message it has always used.
        const fallbackMessage =
            source.kind === 'static' && source.fallbackMessage
                ? source.fallbackMessage
                : `${payload.headline} — shared from Fitzo`;
        captureAndShare(cardRef, {
            dialogTitle: 'Share your workout',
            fallbackMessage,
        });
    };

    return (
        <View style={styles.container}>
            {/*
             * Hidden capture target at true 1080x1920. The scaled hero below is
             * for reading; capturing IT would export at preview resolution.
             *
             * Do NOT use opacity:0 — Android skips rendering it entirely and
             * captureRef returns a blank image. Do NOT use display:'none' — the
             * tree never lays out. Sitting it behind an opaque background at
             * negative z keeps it painted and capturable while invisible.
             * Always mounted (never conditionally rendered past the guard
             * above) so it has already painted by the time Share is tappable;
             * useShareCapture's own double-rAF + settle delay is a second
             * layer of the same guarantee, not the only one.
             */}
            <View style={styles.captureHost} pointerEvents="none">
                <ViewShot ref={cardRef} style={{ width: CARD_W, height: CARD_H }}>
                    <ActiveTheme payload={payload} />
                </ViewShot>
            </View>

            <SafeAreaView style={styles.screenBody} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
                        <MaterialIcons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Share workout</Text>
                    <View style={styles.headerBtn} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/*
                     * Content chips — session source only. A static source
                     * (e.g. Stats' weekly recap) has no selectable content to
                     * chip between, so the whole section — label included —
                     * is hidden rather than left showing an empty row.
                     */}
                    {isSession && (
                        <>
                            <Text style={styles.sectionLabel}>WHAT TO FEATURE</Text>
                            <View style={styles.chipRow}>
                                {chips.map((chip) => {
                                    const active = selection.includes(chip.id);
                                    return (
                                        <TouchableOpacity
                                            key={chip.id}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => onToggleChip(chip.id)}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: active }}
                                        >
                                            {chip.isPr && (
                                                <MaterialIcons
                                                    name="emoji-events"
                                                    size={14}
                                                    color={active ? colors.background : colors.accent.gold}
                                                    style={styles.chipIcon}
                                                />
                                            )}
                                            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                                                {chip.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    {/*
                     * Hero preview — the active theme rendered ONCE at
                     * transform:scale(heroScale), heroScale = measured width /
                     * CARD_W. heroOuter is centered flex content sized exactly
                     * to the scaled footprint; heroInner is the natural
                     * CARD_W x CARD_H box. Scaling defaults to the element's
                     * OWN center, which flexbox centering has already aligned
                     * with heroOuter's center, so the scaled-down result lands
                     * exactly inside heroOuter with no extra offset math —
                     * same technique Anatomy.tsx already uses for its own
                     * inner heatmap scale. (transformOrigin is deliberately
                     * not used here — BrandIntro.tsx already found it has
                     * patchy support on this RN/Expo setup and compensates
                     * with translate math instead; centered flex layout
                     * sidesteps needing either.)
                     */}
                    <View style={styles.heroSection} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
                        {heroScale > 0 && (
                            <View
                                style={[
                                    styles.heroOuter,
                                    { width: heroWidth, height: heroWidth * (CARD_H / CARD_W) },
                                ]}
                            >
                                <View style={[styles.heroInner, { transform: [{ scale: heroScale }] }]}>
                                    <ActiveTheme payload={payload} />
                                </View>
                            </View>
                        )}
                    </View>

                    {/*
                     * Theme picker — LABELS ONLY, not a carousel of live
                     * previews. At the ~0.4 scale a five-up row would need,
                     * VT323 text and exercise names are illegible, so a row of
                     * tiny cards could not actually serve as confirmation —
                     * the hero above is the one place that reads the card.
                     */}
                    <Text style={styles.sectionLabel}>STYLE</Text>
                    <View style={styles.themeRow}>
                        {THEME_ORDER.map((id) => {
                            const active = theme === id;
                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={[styles.themePill, active && styles.themePillActive]}
                                    onPress={() => onSelectTheme(id)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                >
                                    <Text style={[styles.themePillText, active && styles.themePillTextActive]}>
                                        {THEMES[id].label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.shareBtn, isSharing && styles.shareBtnDisabled]}
                        onPress={handleShare}
                        disabled={isSharing}
                    >
                        {isSharing ? (
                            <ActivityIndicator color={colors.background} size="small" />
                        ) : (
                            <>
                                <MaterialIcons name="share" size={18} color={colors.background} />
                                <Text style={styles.shareBtnText}>SHARE</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    // The fragile part — see the JSX comment above the ViewShot for the
    // full explanation of why these exact properties, not opacity/display.
    captureHost: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -1,
        elevation: -1, // Android draws by elevation, not zIndex
    },
    screenBody: {
        flex: 1,
        backgroundColor: colors.background, // opaque, covers the capture host
        zIndex: 1,
        elevation: 1,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },

    scrollContent: {
        padding: spacing.xl,
        paddingBottom: spacing['4xl'],
    },

    sectionLabel: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: colors.text.muted,
        marginBottom: spacing.md,
    },

    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing['3xl'],
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: 240,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    chipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipIcon: {
        marginRight: 6,
    },
    chipText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    chipTextActive: {
        color: colors.background,
    },

    heroSection: {
        width: '100%',
        alignItems: 'center',
        marginBottom: spacing['3xl'],
    },
    heroOuter: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: borderRadius.lg,
        backgroundColor: colors.background,
    },
    heroInner: {
        width: CARD_W,
        height: CARD_H,
    },

    themeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    themePill: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    themePillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    themePillText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    themePillTextActive: {
        color: colors.background,
    },

    footer: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.full,
    },
    shareBtnDisabled: {
        opacity: 0.6,
    },
    shareBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
        letterSpacing: 1,
    },
});
