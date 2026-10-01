import type { RefObject } from 'react';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { CARD_W, CARD_H } from '../components/share/SharePayload';
import { logger } from './logger';

export async function shareCapturedImage(ref: RefObject<any>, dialogTitle: string) {
    if (!await Sharing.isAvailableAsync()) throw new Error('Image sharing is unavailable on this device');
    const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    try {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle, UTI: 'public.png' });
    } finally {
        try { releaseCapture(uri); }
        catch (error) { logger.error('[shareCapture] temporary image cleanup failed', error); }
    }
}

/** Native capture uses physical pixels; fit the design into density-adjusted layout units. */
export function getCaptureFrame(density: number) {
    const ratio = Number.isFinite(density) && density > 0 ? density : 1;
    return { width: CARD_W / ratio, height: CARD_H / ratio, scale: 1 / ratio };
}
