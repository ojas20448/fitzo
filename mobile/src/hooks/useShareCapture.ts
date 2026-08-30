import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { logger } from '../utils/logger';

/**
 * One capture+share path, replacing three near-duplicates.
 *
 * Why the delay: react-native-svg and custom fonts can take an extra frame to
 * paint. Capturing immediately yields a card with the heatmap or the VT323 text
 * missing — which reads as a capture bug and is very hard to trace. Waiting two
 * frames plus a short settle is cheap insurance against a broken share.
 */
const PAINT_SETTLE_MS = 180;

export function useShareCapture() {
    const isSharingRef = useRef(false);
    const [isSharing, setIsSharing] = useState(false);

    const captureAndShare = useCallback(async (
        ref: RefObject<any>,
        opts?: { dialogTitle?: string; fallbackMessage?: string },
    ) => {
        if (!ref.current || isSharingRef.current) return;
        isSharingRef.current = true;
        setIsSharing(true);
        try {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise((r) => setTimeout(r, PAINT_SETTLE_MS));

            const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: opts?.dialogTitle ?? 'Share',
                    UTI: 'public.png',
                });
                return;
            }
            throw new Error('sharing unavailable');
        } catch (err) {
            logger.error('[useShareCapture] capture or share failed', err);
            // Sharing is unavailable on some Android builds and on web. Text is
            // a worse share but a better outcome than a dead button.
            if (opts?.fallbackMessage) {
                await Share.share({ message: opts.fallbackMessage }).catch(() => {});
            }
        } finally {
            isSharingRef.current = false;
            setIsSharing(false);
        }
    }, []);

    return { captureAndShare, isSharing };
}
