import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/theme';

interface AvatarProps {
    uri?: string | null;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showOnline?: boolean;
    grayscale?: boolean;
    style?: ViewStyle;
}

// BlurHash placeholder - neutral gray pattern
const PLACEHOLDER_BLURHASH = 'L5H2EC=PM+yV0g-mq.wG9c010J}I';

const LOCAL_AVATARS: Record<string, any> = {
    avatar_zeus: require('../../assets/avatar_zeus.png'),
    avatar_discobolus: require('../../assets/avatar_discobolus.png'),
    avatar_lion: require('../../assets/avatar_lion.png'),
    avatar_kettlebell: require('../../assets/avatar_kettlebell.png'),
    avatar_trophy: require('../../assets/avatar_trophy.png'),
    avatar_runner: require('../../assets/avatar_runner.png'),
    avatar_heart: require('../../assets/avatar_heart.png'),
    avatar_barbell: require('../../assets/avatar_barbell.png'),
};

/**
 * The pickable presets, DERIVED from the asset map above rather than written
 * out again. The signup picker and the profile picker both read this, so a
 * preset can never exist in one list and not the other.
 *
 * Mirrored server-side in backend/src/utils/avatarPresets.js, which is the
 * allow-list that stops arbitrary URLs being stored. Adding a preset means
 * adding the asset here AND the key there.
 */
export const AVATAR_PRESETS: string[] = Object.keys(LOCAL_AVATARS);

/** A friendly label for each preset, for accessibility. */
export const AVATAR_LABELS: Record<string, string> = {
    avatar_zeus: 'Zeus',
    avatar_discobolus: 'Discus thrower',
    avatar_lion: 'Lion',
    avatar_kettlebell: 'Kettlebell',
    avatar_trophy: 'Trophy',
    avatar_runner: 'Runner',
    avatar_heart: 'Heart',
    avatar_barbell: 'Barbell',
};

const Avatar: React.FC<AvatarProps> = ({
    uri,
    name,
    size = 'md',
    showOnline = false,
    grayscale = false,
    style,
}) => {
    const getSize = (): number => {
        switch (size) {
            case 'sm':
                return 32;
            case 'lg':
                return 56;
            case 'xl':
                return 80;
            default:
                return 48;
        }
    };

    const dimension = getSize();
    const onlineIndicatorSize = Math.max(dimension / 5, 10);
    
    const imageSource = uri && LOCAL_AVATARS[uri] ? LOCAL_AVATARS[uri] : { uri };

    return (
        <View
            style={[
                styles.container,
                { width: dimension, height: dimension },
                style
            ]}
            accessibilityLabel={name ? `${name}'s avatar` : 'User avatar'}
        >
            {/* Default profile silhouette also sits beneath loading photos. */}
            <View style={[
                styles.placeholder,
                {
                    width: dimension,
                    height: dimension,
                    borderRadius: dimension / 2,
                },
                grayscale && styles.grayscale,
            ]}>
                <Ionicons name="person" size={dimension * 0.64} color={colors.text.muted} accessible={false} />
            </View>

            {/* Image overlay - using expo-image for automatic caching */}
            {uri && (
                <Image
                    source={imageSource}
                    style={[
                        styles.image,
                        {
                            width: dimension,
                            height: dimension,
                            borderRadius: dimension / 2,
                        },
                        grayscale && styles.grayscale,
                    ]}
                    placeholder={PLACEHOLDER_BLURHASH}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                />
            )}

            {/* Online indicator */}
            {showOnline && (
                <View
                    style={[
                        styles.onlineIndicator,
                        {
                            width: onlineIndicatorSize,
                            height: onlineIndicatorSize,
                            borderRadius: onlineIndicatorSize / 2,
                            borderWidth: dimension > 40 ? 2 : 1.5,
                        },
                    ]}
                    accessibilityLabel="Online"
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    placeholder: {
        position: 'absolute',
        backgroundColor: colors.surfaceLighter,
        borderWidth: 2,
        borderColor: colors.glass.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: colors.primary,
    },
    grayscale: {
        opacity: 0.7,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.crowd.low,
        borderColor: colors.background,
    },
});

export default Avatar;
