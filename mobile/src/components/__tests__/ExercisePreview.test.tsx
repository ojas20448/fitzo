import React from 'react';
import { Image } from 'expo-image';
import { Text } from 'react-native';
import ExercisePreview from '../ExercisePreview';
const { create, act } = jest.requireActual('react-test-renderer');
let mockReduceMotion = false;
jest.mock('../../hooks/useGlassPreferences', () => ({ useGlassPreferences: () => ({ reduceMotion: mockReduceMotion, reduceTransparency: false }) }));
// Jest collapses every bundled image to the same URI; distinct fixtures let us verify playback transitions.
jest.mock('../../data/exerciseAnimations', () => ({ exerciseAnimations: [{ names: ['Push Up'], animation: 'file:///push-up.gif', poster: 'file:///push-up.jpg', author: 'Wensceslao', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Pushups.gif' }] }));
jest.mock('../../data/exerciseStaticPhotos', () => ({ exerciseStaticPhotos: { bench_press_barbell: 'file:///bench-press.jpg' } }));
let screen: any;
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; mockReduceMotion = false; });

it('falls back to an exact-match photo when a remote GIF fails', async () => {
    await act(async () => { screen = create(<ExercisePreview exercise={{ name: 'Air Bike', gifUrl: 'https://example.test/air.gif' }} large />); });
    expect(screen.root.findByType(Image).props.autoplay).toBe(true);
    await act(async () => screen.root.findByType(Image).props.onError());
    expect(screen.root.findByType(Image).props.source.uri).toContain('Air_Bike/0.jpg');
    expect(screen.root.findByType(Image).props.autoplay).toBe(false);
});
it('uses a bundled still for reduced motion, and shows source and license links', async () => {
    mockReduceMotion = true;
    await act(async () => { screen = create(<ExercisePreview exercise={{ name: 'Push Up' }} large />); });
    const image = screen.root.findByType(Image);
    expect(image.props.source.uri).toMatch(/push-up.*jpg/);
    expect(image.props.autoplay).toBe(false);
    expect(screen.root.findAllByProps({ accessibilityLabel: 'Pause exercise demo' })).toHaveLength(0);
    expect(screen.root.findAllByProps({ accessibilityLabel: 'Exercise demo license' }).length).toBeGreaterThan(0);
});
it('can pause and resume a bundled animation without losing its guide or credit', async () => {
    await act(async () => { screen = create(<ExercisePreview exercise={{ name: 'Push Up' }} large />); });
    const press = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => typeof n.props.onPress === 'function');
    expect(screen.root.findByType(Image).props.source.uri).toMatch(/push-up.*gif/);
    await act(async () => press('Pause exercise demo').props.onPress());
    expect(screen.root.findByType(Image).props.source.uri).toMatch(/push-up.*jpg/);
    await act(async () => press('Play exercise demo').props.onPress());
    expect(screen.root.findByType(Image).props.source.uri).toMatch(/push-up.*gif/);
});
it('uses a still thumbnail and only plays the animation in the expanded guide', async () => {
    await act(async () => { screen = create(<ExercisePreview exercise={{ name: 'Push Up' }} />); });
    expect(screen.root.findByType(Image).props.source.uri).toBe('file:///push-up.jpg');
    expect(screen.root.findByType(Image).props.autoplay).toBe(false);
    await act(async () => screen.update(<ExercisePreview exercise={{ name: 'Push Up' }} large />));
    expect(screen.root.findByType(Image).props.source.uri).toBe('file:///push-up.gif');
    expect(screen.root.findByType(Image).props.autoplay).toBe(true);
});
it('uses a bundled animation before an expired provider URL for the same exercise', async () => {
    await act(async () => { screen = create(<ExercisePreview exercise={{ name: 'Push Up', gifUrl: 'https://example.test/expired.gif' }} large />); });
    expect(screen.root.findByType(Image).props.source.uri).toBe('file:///push-up.gif');
});
it('moves a stalled GIF to its bundled photo rather than spinning indefinitely', async () => {
    jest.useFakeTimers();
    await act(async () => { screen = create(<ExercisePreview exercise={{ id: 'bench_press_barbell', name: 'Bench Press', gifUrl: 'https://example.test/stalled.gif' }} large />); });
    await act(async () => jest.advanceTimersByTime(12000));
    expect(screen.root.findByType(Image).props.source.uri).toBe('file:///bench-press.jpg');
    jest.useRealTimers();
});
it('explains missing media and lets a failed image be retried', async () => {
    await act(async () => { screen = create(<ExercisePreview exercise={{ name: 'Unlisted movement', custom: true, imageUrl: 'https://example.test/photo.jpg' }} large />); });
    await act(async () => screen.root.findByType(Image).props.onError());
    expect(screen.root.findAllByType(Text).some((node: any) => String(node.props.children).includes('Couldn’t load'))).toBe(true);
    const retry = screen.root.findAllByProps({ accessibilityLabel: 'Retry exercise media' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => retry.props.onPress());
    expect(screen.root.findByType(Image).props.source.uri).toBe('https://example.test/photo.jpg');
});
