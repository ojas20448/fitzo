import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { CARD_W, CARD_H } from './SharePayload';
import CardBackground from './CardBackground';
import { THEMES, type ShareThemeProps } from './themes';
import type { ThemeId } from '../../utils/shareMoment';
import type { CardTransform } from '../../utils/cardTransform';

interface Props extends ShareThemeProps {
    theme: ThemeId;
    cardTransform: CardTransform;
    animatedCardStyle?: StyleProp<ViewStyle>;
}

/** The photo fills the story. Only the workout layer moves and resizes. */
export default function ShareCard({ theme, payload, cardTransform, animatedCardStyle, onBackgroundLoad, onBackgroundError, ...artworkProps }: Props) {
    const ActiveTheme = THEMES[theme].Component;
    const photoMode = !!payload.background && !!THEMES[theme].supportsBackground;
    if (!photoMode) return <ActiveTheme payload={payload} {...artworkProps} />;

    return (
        <View style={styles.canvas}>
            <CardBackground background={payload.background} scrimOpacity={0.18} onLoad={onBackgroundLoad} onError={onBackgroundError} />
            <Animated.View testID="workout-card-layer" style={[styles.layer, animatedCardStyle ?? {
                transform: [
                    { translateX: cardTransform.offsetX * CARD_W },
                    { translateY: cardTransform.offsetY * CARD_H },
                    { scale: cardTransform.scale },
                    { rotate: `${cardTransform.rotation * 180 / Math.PI}deg` },
                ],
            }]}>
                <ActiveTheme payload={{ ...payload, background: null }} photoMode {...artworkProps} />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    canvas: { width: CARD_W, height: CARD_H, backgroundColor: '#000', overflow: 'hidden' },
    layer: { width: CARD_W, height: CARD_H },
});
