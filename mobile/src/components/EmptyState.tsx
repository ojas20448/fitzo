import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Button from './Button';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

type EmptyStateVariant =
    | 'no-data'
    | 'no-friends'
    | 'no-workouts'
    | 'no-calories'
    | 'no-notifications'
    | 'no-results'
    | 'error'
    | 'welcome'
    | 'offline';

interface EmptyStateProps {
    variant?: EmptyStateVariant;
    title?: string;
    message?: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    style?: ViewStyle;
}

const getVariantConfig = (variant: EmptyStateVariant) => {
    switch (variant) {
        case 'no-friends':
            return {
                icon: 'group-add' as const,
                title: 'No gym buddies yet',
                message: 'Add friends to see what they\'re training and stay motivated together!',
                actionLabel: 'Find Friends',
            };
        case 'no-workouts':
            return {
                icon: 'fitness-center' as const,
                title: 'No workouts logged',
                message: 'Start tracking your training to build your streak!',
                actionLabel: 'Log Workout',
            };
        case 'no-calories':
            return {
                icon: 'restaurant' as const,
                title: 'No meals logged today',
                message: 'Track your nutrition to stay on top of your goals.',
                actionLabel: 'Log Meal',
            };
        case 'no-notifications':
            return {
                icon: 'notifications-none' as const,
                title: 'All caught up!',
                message: 'You have no new notifications.',
                actionLabel: undefined,
            };
        case 'no-results':
            return {
                icon: 'search-off' as const,
                title: 'No results found',
                message: 'Try adjusting your search or filters.',
                actionLabel: 'Clear Filters',
            };
        case 'error':
            return {
                icon: 'error-outline' as const,
                title: 'Something went wrong',
                message: 'We couldn\'t load this content. Please try again.',
                actionLabel: 'Retry',
            };
        case 'offline':
            return {
                icon: 'cloud-off' as const,
                title: 'You\'re offline',
                message: 'Check your internet connection and try again.',
                actionLabel: 'Retry',
            };
        case 'welcome':
            return {
                icon: 'auto-awesome' as const,
                title: 'Welcome to Fitzo',
                message: 'Your fitness journey starts here. Let\'s make today count.',
                actionLabel: 'Log Your First Workout',
            };
        case 'no-data':
        default:
            return {
                icon: 'inbox' as const,
                title: 'Nothing here yet',
                message: 'Content will appear here once available.',
                actionLabel: undefined,
            };
    }
};

const EmptyState: React.FC<EmptyStateProps> = ({
    variant = 'no-data',
    title,
    message,
    icon,
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
    style,
}) => {
    const config = getVariantConfig(variant);

    const displayTitle = title || config.title;
    const displayMessage = message || config.message;
    const displayIcon = icon || config.icon;
    const displayActionLabel = actionLabel || config.actionLabel;

    return (
        <View style={[styles.container, style]}>
            <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                    <MaterialIcons
                        name={displayIcon}
                        size={48}
                        color={colors.text.muted}
                    />
                </View>
                {/* Decorative rings */}
                <View style={styles.ring1} />
                <View style={styles.ring2} />
            </View>

            <Text style={styles.title}>{displayTitle}</Text>
            <Text style={styles.message}>{displayMessage}</Text>

            {(displayActionLabel && onAction) && (
                <View style={styles.actions}>
                    <Button
                        title={displayActionLabel}
                        onPress={onAction}
                        variant="primary"
                        size="md"
                    />
                    {secondaryActionLabel && onSecondaryAction && (
                        <Button
                            title={secondaryActionLabel}
                            onPress={onSecondaryAction}
                            variant="ghost"
                            size="md"
                            style={{ marginTop: spacing.sm }}
                        />
                    )}
                </View>
            )}
        </View>
    );
};

// Compact inline empty state for lists
export const EmptyStateInline: React.FC<{
    message: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
    style?: ViewStyle;
}> = ({ message, icon = 'inbox', style }) => (
    <View style={[styles.inlineContainer, style]}>
        <MaterialIcons name={icon} size={20} color={colors.text.muted} />
        <Text style={styles.inlineMessage}>{message}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing['2xl'],
        paddingVertical: spacing['3xl'],
    },
    iconContainer: {
        position: 'relative',
        marginBottom: spacing.xl,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    ring1: {
        position: 'absolute',
        top: -10,
        left: -10,
        right: -10,
        bottom: -10,
        borderRadius: 60,
        borderWidth: 1,
        borderColor: colors.glass.border,
        opacity: 0.5,
    },
    ring2: {
        position: 'absolute',
        top: -20,
        left: -20,
        right: -20,
        bottom: -20,
        borderRadius: 70,
        borderWidth: 1,
        borderColor: colors.glass.border,
        opacity: 0.25,
    },
    title: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    message: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 280,
    },
    actions: {
        marginTop: spacing.xl,
        alignItems: 'center',
    },
    inlineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.sm,
    },
    inlineMessage: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default EmptyState;
