/**
 * Fitzo Design System - Onyx & Snow Theme
 * 
 * Pure black backgrounds with white accents
 * Glassmorphism and transparency effects
 * Inspired by refined minimal dark UI patterns
 */

import { Platform, type ViewStyle } from 'react-native';

export const colors = {
    // Core colors
    background: '#000000',
    backgroundAlt: '#050505',
    surface: '#0A0A0A',
    surfaceLight: '#121212',
    surfaceLighter: '#1A1A1A',

    // Primary (White)
    primary: '#FFFFFF',
    primaryMuted: 'rgba(255, 255, 255, 0.8)',

    // Text colors - contrast ratios improved for accessibility
    text: {
        primary: '#FFFFFF',
        secondary: 'rgba(255, 255, 255, 0.7)',  // Improved from 0.6
        muted: 'rgba(255, 255, 255, 0.55)',     // Improved from 0.4 for better contrast
        subtle: 'rgba(255, 255, 255, 0.45)',    // Improved from 0.3 for better contrast
        dark: '#000000', // for white backgrounds
    },

    // Glass effects
    glass: {
        surface: 'rgba(255, 255, 255, 0.025)',
        surfaceLight: 'rgba(255, 255, 255, 0.05)',
        surfaceHover: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(255, 255, 255, 0.10)',
        borderLight: 'rgba(255, 255, 255, 0.15)',
        borderHover: 'rgba(255, 255, 255, 0.20)',
    },

    // Status colors (all white-based for theme consistency)
    crowd: {
        low: 'rgba(255, 255, 255, 0.45)',
        medium: 'rgba(255, 255, 255, 0.75)',
        high: '#FFFFFF',
    },

    // Additional
    active: '#FFFFFF',
    inactive: 'rgba(255, 255, 255, 0.3)',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Accent hues — decorative/categorical only. These carry NO good-vs-bad
    // meaning: if a value is a status or a judgement (grade, trend, difficulty,
    // BMI band), use success/warning/error above instead. Five hues, each with
    // a distinct job, and every one is legible on pure black.
    accent: {
        sky: '#60A5FA',    // protein, steps
        gold: '#FBBF24',   // carbs, achievements, flame core
        orange: '#F97316', // energy, streaks, active calories
        lilac: '#A78BFA',  // sleep, percentile
        rose: '#F472B6',   // fat, heart rate
    },

    // Semantic data colors — macros are the most-repeated concept in the app
    // (pie chart, weekly bars, insights, health report, onboarding). They get
    // ONE triad so protein is the same blue everywhere, not a different hue
    // per screen. Always use these instead of picking an accent by hand.
    macro: {
        protein: '#60A5FA', // accent.sky
        carbs: '#FBBF24',   // accent.gold
        fat: '#F472B6',     // accent.rose
    },
};

export const typography = {
    fontFamily: {
        light: 'Lexend_300Light',
        regular: 'Lexend_400Regular',
        medium: 'Lexend_500Medium',
        semiBold: 'Lexend_600SemiBold',
        bold: 'Lexend_700Bold',
        extraBold: 'Lexend_800ExtraBold',
    },

    sizes: {
        '2xs': 10,
        xs: 11,
        sm: 12,
        md: 14,
        base: 14,
        lg: 16,
        xl: 18,
        '2xl': 24,
        '3xl': 30,
        '4xl': 36,
        '5xl': 48,
        '6xl': 64,
    },

    lineHeight: {
        none: 0.9,
        tight: 1.1,
        normal: 1.4,
        relaxed: 1.6,
    },

    letterSpacing: {
        tighter: -0.04,
        tight: -0.03,
        normal: 0,
        wide: 0.1,
        wider: 0.15,
        widest: 0.2,
    },
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
};

export const borderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    full: 9999,
};

/**
 * Cross-platform shadow builder.
 *
 * WHY THIS EXISTS — do not "simplify" this back to plain shadow* + elevation:
 *
 * React Native's Android UIManager has NO handling for `shadowOffset`,
 * `shadowOpacity` or `shadowRadius` (verified: zero references in
 * ReactAndroid/.../uimanager). The only iOS shadow prop Android reads is
 * `shadowColor`, and it forwards it to `setOutlineAmbientShadowColor` /
 * `setOutlineSpotShadowColor` — i.e. it merely *tints the elevation shadow*.
 *
 * Net effect of the old `{ shadowColor:'#FFF', shadowOpacity:0.18, shadowRadius:8, elevation:8 }`:
 *   iOS     → soft, 18%-opacity white glow (intended)
 *   Android → opacity + radius discarded; a full-strength white Material
 *             outline shadow at elevation 8. Hard, boxy, bright halo. And
 *             because our surfaces are ~92% transparent, that white outline
 *             shadow shows straight THROUGH the card as a lighter inner box.
 *
 * Fix: on Android use `boxShadow` (natively implemented since RN 0.76 /
 * new arch — see OutsetBoxShadowDrawable.kt), which honours colour, opacity,
 * offset and blur exactly like iOS. `elevation` is deliberately omitted on
 * Android so no Material outline shadow is drawn at all.
 *
 * Note: CSS blur-radius ≈ 2× iOS shadowRadius, hence the `blur * 2` below —
 * that is what makes the two platforms match visually.
 */
export const shadow = (
    { x = 0, y = 0, blur, color, opacity }:
    { x?: number; y?: number; blur: number; color: string; opacity: number }
) => Platform.select({
    // iOS is already correct — keep the exact same values it renders today.
    ios: {
        shadowColor: color,
        shadowOffset: { width: x, height: y },
        shadowOpacity: opacity,
        shadowRadius: blur,
    },
    android: {
        boxShadow: `${x}px ${y}px ${blur * 2}px ${hexToRgba(color, opacity)}`,
    },
    default: {
        boxShadow: `${x}px ${y}px ${blur * 2}px ${hexToRgba(color, opacity)}`,
    },
}) as ViewStyle;

function hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const shadows = {
    glass:  shadow({ y: 4, blur: 30, color: '#000000', opacity: 0.5 }),
    glow:   shadow({ blur: 20, color: '#FFFFFF', opacity: 0.15 }),
    glowMd: shadow({ blur: 25, color: '#FFFFFF', opacity: 0.2 }),
    glowLg: shadow({ blur: 40, color: '#FFFFFF', opacity: 0.3 }),
    // Tight, contained glow — hugs the card border instead of bleeding outward
    glowCard: shadow({ blur: 8, color: '#FFFFFF', opacity: 0.18 }),
};

// Common style patterns
export const commonStyles = {
    glassPanel: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.xl,
    },

    glassPanelLight: {
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        borderRadius: borderRadius.xl,
    },

    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        ...shadows.glow,
    },

    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        borderRadius: borderRadius.full,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
    },

    cardActive: {
        backgroundColor: colors.primary,
        borderWidth: 0,
        ...shadows.glowMd,
    },

    cardInactive: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },

    // Pill/Badge styles
    pill: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },

    // Uppercase label style
    labelUppercase: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        letterSpacing: 2,
        textTransform: 'uppercase' as const,
        color: colors.text.muted,
    },
};

// Muscle group icons and colors
export const muscleGroups = {
    legs: { icon: 'directions-run', label: 'Legs' },
    chest: { icon: 'fitness-center', label: 'Chest' },
    back: { icon: 'accessibility-new', label: 'Back' },
    shoulders: { icon: 'emoji-people', label: 'Shoulders' },
    arms: { icon: 'sports-gymnastics', label: 'Arms' },
    cardio: { icon: 'monitor-heart', label: 'Cardio' },
    rest: { icon: 'battery-charging-full', label: 'Rest' },
};

export default {
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
    commonStyles,
    muscleGroups,
};
