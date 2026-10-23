import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import type { ShareBackground } from './SharePayload';
import { CARD_W, CARD_H } from './SharePayload';
import { resolveBackgroundTransform } from '../../utils/backgroundTransform';

interface CardBackgroundProps {
    background: ShareBackground | null | undefined;
    /** 0-1. Each theme picks its own — see the theme files for reasoning per theme. */
    scrimOpacity: number;
    /**
     * RULING R30 — fires once the underlying <Image> has decoded, not on a
     * timer. useShareCapture's own paint-settle delay (180ms) is tuned for
     * font/SVG paint and can be shorter than a uri image decode; the
     * composer keeps sharing disabled until THIS fires for the capture
     * target specifically (see ShareComposerScreen.tsx's onBackgroundLoad
     * wiring) so a slow decode can never be captured as an empty background.
     */
    onLoad?: () => void;
    onError?: () => void;
}

/** Fixed photo layer, shared by preview and export. Gestures belong to ShareCard. */
export default function CardBackground({ background, scrimOpacity, onLoad, onError }: CardBackgroundProps) {
    if (!background) return null;

    const t = resolveBackgroundTransform(background, CARD_W, CARD_H);

    const imageStyle = {
        transform: [
            { translateX: t.translateX },
            { translateY: t.translateY },
            { scale: t.scale },
            { rotate: `${t.rotateDeg}deg` },
        ],
    };

    return (
        <>
            <Image
                source={{ uri: background.uri }}
                resizeMode="cover"
                onLoad={onLoad}
                onError={onError}
                style={[
                    StyleSheet.absoluteFill,
                    imageStyle,
                ]}
            />
            <View
                style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${scrimOpacity})` }]}
                pointerEvents="none"
            />
        </>
    );
}
