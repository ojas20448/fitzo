/**
 * Fitzo Design System - Onyx & Snow Theme
 * 
 * Pure black backgrounds with white accents
 * Glassmorphism and transparency effects
 * Inspired by refined minimal dark UI patterns
 */

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
        surface: 'rgba(255, 255, 255, 0.03)',
        surfaceLight: 'rgba(255, 255, 255, 0.05)',
        surfaceHover: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(255, 255, 255, 0.08)',
        borderLight: 'rgba(255, 255, 255, 0.15)',
        borderHover: 'rgba(255, 255, 255, 0.20)',
    },

    // Status colors (all white-based for theme consistency)
    crowd: {
        low: '#22C55E', // green
        medium: '#F59E0B', // amber
        high: '#EF4444', // red
    },

    // Additional
    active: '#FFFFFF',
    inactive: 'rgba(255, 255, 255, 0.3)',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
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
        tighter: -0.05,
        tight: -0.025,
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

export const shadows = {
    glass: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 8,
    },
    glow: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    glowMd: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 25,
        elevation: 12,
    },
    glowLg: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 40,
        elevation: 15,
    },
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
