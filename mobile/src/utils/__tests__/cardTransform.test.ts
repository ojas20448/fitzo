import { constrainCardTransform, DEFAULT_CARD_TRANSFORM } from '../cardTransform';

test('keeps a dragged card inside the story instead of losing it beyond an edge', () => {
    expect(constrainCardTransform({ offsetX: 2, offsetY: -2, scale: 0.6, rotation: 0 })).toEqual({
        offsetX: 0.2, offsetY: -0.2, scale: 0.6, rotation: 0,
    });
});

test('keeps a rotated card inside the story, including its wider rotated bounds', () => {
    const result = constrainCardTransform({ offsetX: 2, offsetY: 2, scale: 1, rotation: Math.PI / 2 });
    expect(result.scale).toBeCloseTo(0.5625);
    expect(result.offsetX).toBeCloseTo(0);
    expect(result.offsetY).toBeCloseTo(0.341796875);
});

test('prevents pinch gestures from collapsing the card or exceeding the canvas', () => {
    expect(constrainCardTransform({ ...DEFAULT_CARD_TRANSFORM, scale: 0 }).scale).toBe(0.3);
    expect(constrainCardTransform({ ...DEFAULT_CARD_TRANSFORM, scale: 5 }).scale).toBe(1);
    expect(constrainCardTransform({ ...DEFAULT_CARD_TRANSFORM, scale: NaN }).scale).toBe(0.7);
});
