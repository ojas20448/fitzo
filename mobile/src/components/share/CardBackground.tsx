import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
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
}

/**
 * Camera photo behind a theme's own content — Task 10.
 *
 * One implementation, reused by every theme that opts in: <Image
 * resizeMode="cover"> under a scrim View, both StyleSheet.absoluteFill.
 * Renders nothing when `background` is absent/null, so every theme's
 * existing look is untouched by default (binding constraint) — there is no
 * conditional branch a theme needs to add beyond placing this component.
 *
 * Positioning math is entirely resolveBackgroundTransform's job
 * (utils/backgroundTransform.ts, R29) — this component resolves the
 * NORMALIZED `background` to pixels for the box it renders in and nothing
 * more. It hardcodes CARD_W/CARD_H rather than accepting a size prop
 * because every call site places it inside a theme's own `frame`, which
 * every theme declares at a literal `width: CARD_W, height: CARD_H`
 * (verified against Scoreboard.tsx/Chalk.tsx/Spec.tsx/Receipt.tsx) — true
 * in BOTH the composer's hero preview and its hidden capture target,
 * because the hero achieves its visual shrink with an outer
 * `transform: [{ scale: heroScale }]` wrapper (ShareComposerScreen.tsx's
 * heroInner, itself fixed at `width: CARD_W, height: CARD_H`) rather than
 * by laying the theme tree out at a smaller size. So `frame`, and every
 * child inside it including this component, always measures itself against
 * true CARD_W x CARD_H — resolveBackgroundTransform never needs to know
 * which of the two trees it is resolving for.
 */
export default function CardBackground({ background, scrimOpacity, onLoad }: CardBackgroundProps) {
    if (!background) return null;

    const t = resolveBackgroundTransform(background, CARD_W, CARD_H);

    return (
        <>
            <Image
                source={{ uri: background.uri }}
                resizeMode="cover"
                onLoad={onLoad}
                style={[
                    StyleSheet.absoluteFill,
                    {
                        transform: [
                            { translateX: t.translateX },
                            { translateY: t.translateY },
                            { scale: t.scale },
                            { rotate: `${t.rotateDeg}deg` },
                        ],
                    },
                ]}
            />
            <View
                style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${scrimOpacity})` }]}
                pointerEvents="none"
            />
        </>
    );
}
