import { CARD_H, CARD_W } from '../components/share/SharePayload';

/** Offsets are fractions of the story, so preview and export share placement. */
export interface CardTransform {
    offsetX: number;
    offsetY: number;
    scale: number;
    rotation: number;
}

export const DEFAULT_CARD_TRANSFORM: CardTransform = { offsetX: 0, offsetY: 0.1, scale: 0.7, rotation: 0 };
export const MIN_CARD_SCALE = 0.3;
export const MAX_CARD_SCALE = 1;

/** Keep the entire card reachable, including the bounds added by rotation. */
export function constrainCardTransform(placement: CardTransform): CardTransform {
    'worklet';
    const rotation = Number.isFinite(placement.rotation) ? placement.rotation : 0;
    const cos = Math.abs(Math.cos(rotation));
    const sin = Math.abs(Math.sin(rotation));
    const width = cos + sin * CARD_H / CARD_W;
    const height = cos + sin * CARD_W / CARD_H;
    const requestedScale = Number.isFinite(placement.scale) ? placement.scale : DEFAULT_CARD_TRANSFORM.scale;
    const scale = Math.min(MAX_CARD_SCALE, 1 / width, 1 / height, Math.max(MIN_CARD_SCALE, requestedScale));
    const maxX = Math.max(0, (1 - width * scale) / 2);
    const maxY = Math.max(0, (1 - height * scale) / 2);
    return {
        offsetX: Math.max(-maxX, Math.min(maxX, Number.isFinite(placement.offsetX) ? placement.offsetX : 0)),
        offsetY: Math.max(-maxY, Math.min(maxY, Number.isFinite(placement.offsetY) ? placement.offsetY : 0)),
        scale,
        rotation,
    };
}
