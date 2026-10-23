import React from 'react';
import { Text } from 'react-native';
import { Image } from 'expo-image';
import ExerciseDetailsModal from '../ExerciseDetailsModal';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('../../data/exerciseStaticPhotos', () => ({ exerciseStaticPhotos: { chest_press_machine: 'file:///Machine_Bench_Press/0.jpg' } }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockHistory = { sessions: [] as any[], loading: false, error: false, retry: jest.fn() };
jest.mock('../../hooks/useExerciseHistory', () => ({ useExerciseHistory: () => mockHistory }));
beforeEach(() => { mockHistory.sessions = []; mockHistory.error = false; });

const exercise = { name: 'Dumbbell Row', instructions: 'Pull your elbow toward your hip.', gifUrl: 'https://example.test/row.gif' };
let screen: any;
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; });

test('switches between a guide and actual dated sets without leaving exercise details', async () => {
    mockHistory.sessions = [{ id: 's', date: '2026-10-21', workout: 'back', isUnilateral: true, sets: [{ weight_kg: 25, reps: 5, rir: 0 }, { weight_kg: 20, reps: 12 }] }];
    await act(async () => { screen = create(<ExerciseDetailsModal exercise={exercise} onClose={jest.fn()} />); });
    const tab = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function');
    await act(async () => tab('History').props.onPress());
    const text = () => screen.root.findAllByType(Text).map((n: any) => n.props.children).flat().join(' ').replace(/\s+/g, ' ');
    expect(text()).toContain('25 kg × 5 · 0 RIR'); expect(text()).toContain('20 kg × 12'); expect(text()).toContain('Weight and reps per side');
    await act(async () => tab('Guide').props.onPress()); expect(text()).toContain(exercise.instructions);
});

test('browsing a demo only adds an exercise after an explicit action', async () => {
    const add = jest.fn();
    await act(async () => { screen = create(<ExerciseDetailsModal exercise={exercise} onClose={jest.fn()} onAdd={add} />); });
    expect(add).not.toHaveBeenCalled();
    const action = screen.root.findAll((node: any) => node.props.title === 'Add to workout')[0];
    await act(async () => action.props.onPress());
    expect(add).toHaveBeenCalledTimes(1);
});

test('shows the available exercise GIF alongside its guide', async () => {
    await act(async () => { screen = create(<ExerciseDetailsModal exercise={exercise} onClose={jest.fn()} />); });
    const preview = screen.root.findByType(Image);
    expect(preview.props.source).toEqual({ uri: exercise.gifUrl });
    expect(preview.props.accessibilityLabel).toBe('Dumbbell Row demonstration');
    expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === exercise.instructions)).toBe(true);
});

test('keeps the guide compact when no exercise media is available', async () => {
    await act(async () => { screen = create(<ExerciseDetailsModal exercise={{ name: exercise.name, instructions: exercise.instructions }} onClose={jest.fn()} />); });
    expect(screen.root.findAllByType(Image)).toHaveLength(0);
    expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === exercise.instructions)).toBe(true);
});

test('an unavailable GIF keeps the guide readable and a different preview can still load', async () => {
    await act(async () => { screen = create(<ExerciseDetailsModal exercise={exercise} onClose={jest.fn()} />); });
    await act(async () => screen.root.findByType(Image).props.onError({ error: 'unavailable' }));
    expect(screen.root.findAllByType(Image)).toHaveLength(0);
    expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === exercise.instructions)).toBe(true);
    await act(async () => screen.update(<ExerciseDetailsModal exercise={{ ...exercise, gifUrl: 'https://example.test/another-row.gif' }} onClose={jest.fn()} />));
    expect(screen.root.findByType(Image).props.source.uri).toBe('https://example.test/another-row.gif');
});

test('uses explicit themed logging choices and only changes mode on a different choice', async () => {
    const toggle = jest.fn();
    await act(async () => { screen = create(<ExerciseDetailsModal exercise={{ ...exercise, is_unilateral: true }} onClose={jest.fn()} onToggleUnilateral={toggle} />); });
    const choices = () => screen.root.findAll((node: any) => node.props.accessibilityRole === 'radio' && typeof node.props.onPress === 'function');
    expect(choices().map((node: any) => node.props.accessibilityState.checked)).toEqual([false, true]);
    await act(async () => choices()[1].props.onPress());
    expect(toggle).not.toHaveBeenCalled();
    await act(async () => choices()[0].props.onPress());
    expect(toggle).toHaveBeenCalledTimes(1);
});

test('can recover existing catalog media for a saved exercise and distinguishes prescription notes', async () => {
    await act(async () => { screen = create(<ExerciseDetailsModal exercise={{ id: 'chest_press_machine', name: 'Chest Press', instructions: '2 working sets × 7–10 reps. Tempo 3-1-1-0.' }} onClose={jest.fn()} />); });
    expect(screen.root.findByType(Image).props.source.uri).toContain('Machine_Bench_Press');
    expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === 'Workout notes')).toBe(true);
    expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === 'A technique guide has not been added for this exercise yet.')).toBe(false);
});
