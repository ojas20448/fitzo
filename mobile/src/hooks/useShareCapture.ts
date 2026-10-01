import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Share, Alert, Platform } from 'react-native';
import { shareCapturedImage } from '../utils/shareCapture';
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
    const [shareError, setShareError] = useState<string | null>(null);

    const captureAndShare = useCallback(async (
        ref: RefObject<any>,
        opts?: { dialogTitle?: string; fallbackMessage?: string },
    ) => {
        if (!ref.current || isSharingRef.current) return;
        isSharingRef.current = true;
        setIsSharing(true);
        setShareError(null);
        try {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise((r) => setTimeout(r, PAINT_SETTLE_MS));

            await shareCapturedImage(ref, opts?.dialogTitle ?? 'Share');
        } catch (err) {
            logger.error('[useShareCapture] capture or share failed', err);
            setShareError(Platform.OS === 'web'
                ? 'Could not share this image in your browser. Try using Fitzo on your phone.'
                : 'Could not share the image. Your card is still here; please try again.');
            if (Platform.OS === 'web') return;
            const message = opts?.fallbackMessage;
            Alert.alert('Could not share image', 'Your card is still here. Try sharing again, or choose a text version.', [
                { text: 'OK', style: 'cancel' },
                ...(message ? [{ text: 'Share text', onPress: () => Alert.alert('Share this text?', message, [
                    { text: 'Cancel', style: 'cancel' as const },
                    { text: 'Share', onPress: () => {
                        Share.share({ message }).catch(() => Alert.alert('Could not share text', 'Please try again.'));
                    } },
                ]) }] : []),
            ]);
        } finally {
            isSharingRef.current = false;
            setIsSharing(false);
        }
    }, []);

    return { captureAndShare, isSharing, shareError };
}
