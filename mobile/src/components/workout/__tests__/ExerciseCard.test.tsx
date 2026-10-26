import React from 'react';
import { Text, TextInput } from 'react-native';
import ExerciseCard from '../ExerciseCard';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockHistory = { sessions: [] as any[], loading: false, error: false, retry: jest.fn() };
jest.mock('../../../hooks/useExerciseHistory', () => ({ useExerciseHistory: () => mockHistory }));
beforeEach(() => { mockHistory.sessions = []; });

test('uses real last-session cardio time without copying its effort rating', async () => {
    mockHistory.sessions = [{ id: 'h', date: '2026-10-25', workout: 'cardio', isUnilateral: false, isCardio: true, sets: [{ duration_minutes: 20, rpe: 8 }] }];
    const update = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'running_treadmill', name: 'Treadmill Run', sets: [{ id: 's', completed: false }] }} exerciseIndex={0} showRir={false}
        onUpdateSet={update} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={jest.fn()} onToggleUnilateral={jest.fn()} onOpenPicker={jest.fn()} />); });
    try {
        const use = screen.root.findAllByProps({ accessibilityLabel: 'Use last session for Treadmill Run set 1' }).find((node: any) => typeof node.props.onPress === 'function');
        expect(use.props.disabled).toBe(false);
        await act(async () => use.props.onPress());
        expect(update.mock.calls).toEqual([[0, 0, 'duration_minutes', 20]]);
    } finally { await act(async () => screen.unmount()); }
});

test.each([['', '6', false], ['20', '11', false], ['20', '', true], ['20.5', '6', true]])('logs cardio with time %s and effort %s, without strength inputs', async (duration, effort, valid) => {
    const update = jest.fn(), open = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'running_treadmill', name: 'Treadmill Run', sets: [{ id: 's', duration_minutes: duration, rpe: effort, completed: false }] }} exerciseIndex={0} showRir
        onUpdateSet={update} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={jest.fn()} onToggleUnilateral={jest.fn()} onOpenPicker={open} />); });
    try {
        const labels = screen.root.findAllByType(TextInput).map((node: any) => node.props.accessibilityLabel);
        expect(labels).toEqual(['Duration in minutes for Treadmill Run, set 1', 'Effort out of 10 for Treadmill Run, set 1']);
        const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => button('Complete Treadmill Run set 1').props.onPress());
        if (valid) expect(update).toHaveBeenCalledWith(0, 0, 'completed', true);
        else expect(update).not.toHaveBeenCalled();
        await act(async () => button('Edit Treadmill Run set 1').props.onPress());
        expect(open).toHaveBeenCalledWith(0, 0, 'duration');
    } finally { await act(async () => screen.unmount()); }
});

test.each(['', 0, 6])('keeps RIR inline, optional and within range (%s)', async rir => {
    const update = jest.fn(), open = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'row', name: 'Cable Row', sets: [{ id: 's', weight_kg: 40, reps: 8, rir, completed: false }] }} exerciseIndex={0} showRir
        onUpdateSet={update} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={jest.fn()} onToggleUnilateral={jest.fn()} onOpenPicker={open} />); });
    try {
        const input = screen.root.findAllByType(TextInput).find((n: any) => n.props.accessibilityLabel === 'Reps in reserve for Cable Row, set 1');
        expect(input.props.value).toBe(String(rir));
        const checkbox = screen.root.findAllByProps({ accessibilityLabel: 'Complete Cable Row set 1' }).find((n: any) => typeof n.props.onPress === 'function');
        await act(async () => checkbox.props.onPress());
        if (rir === 6) { expect(update).not.toHaveBeenCalled(); expect(screen.root.findAllByType(Text).some((n: any) => n.props.children === 'RIR must be 0–5, or left empty.')).toBe(true); }
        else expect(update).toHaveBeenCalledWith(0, 0, 'completed', true);
        expect(open).not.toHaveBeenCalled();
    } finally { await act(async () => screen.unmount()); }
});

test('edits inline and reuses real last-session weight/reps without copying effort or completion', async () => {
    mockHistory.sessions = [{ id: 'h', date: '2026-10-21', workout: 'back', isUnilateral: false, sets: [{ weight_kg: 42.5, reps: 8, rir: 0 }] }];
    const update = jest.fn(), open = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'row', name: 'Cable Row', sets: [{ id: 's', weight_kg: '', reps: '', completed: false }] }} exerciseIndex={1} showRir={false}
        onUpdateSet={update} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={jest.fn()} onToggleUnilateral={jest.fn()} onOpenPicker={open} />); });
    try {
        const fields = screen.root.findAllByType(TextInput);
        await act(async () => fields[0].props.onChangeText('22,5'));
        expect(update).toHaveBeenCalledWith(1, 0, 'weight_kg', '22.5');
        const use = screen.root.findAllByProps({ accessibilityLabel: 'Use last session for Cable Row set 1' }).find((n: any) => typeof n.props.onPress === 'function');
        update.mockClear(); await act(async () => use.props.onPress());
        expect(update.mock.calls).toEqual([[1, 0, 'weight_kg', 42.5], [1, 0, 'reps', 8]]);
        const fullEdit = screen.root.findAllByProps({ accessibilityLabel: 'Edit Cable Row set 1' }).find((n: any) => typeof n.props.onPress === 'function');
        await act(async () => fullEdit.props.onPress()); expect(open).toHaveBeenCalledWith(1, 0, 'weight');
    } finally { await act(async () => screen.unmount()); }
});

test.each([
    ['', 8, 'weight'], [40, '', 'reps'], [40, 0, 'reps'], [40, 8.5, 'reps'],
])('explains invalid inline values before checking off a set (%s kg, %s reps)', async (weight, reps, field) => {
    const update = jest.fn(), open = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'row', name: 'Cable Row', sets: [{ id: 's', weight_kg: weight, reps, completed: false }] }} exerciseIndex={0} showRir={false}
        onUpdateSet={update} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={jest.fn()} onToggleUnilateral={jest.fn()} onOpenPicker={open} />); });
    try {
        const checkbox = screen.root.findAllByProps({ accessibilityLabel: 'Complete Cable Row set 1' }).find((n: any) => typeof n.props.onPress === 'function');
        await act(async () => checkbox.props.onPress());
        expect(update).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
        const text = screen.root.findAllByType(Text).map((n: any) => n.props.children).flat().join(' ');
        expect(text).toContain(field === 'weight' ? 'Enter a weight. Use 0 kg for bodyweight.' : 'Enter a whole number of reps greater than 0.');
    } finally { await act(async () => screen.unmount()); }
});

test('exposes set removal through Edit sets and restores completion controls afterwards', async () => {
    const remove = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'row', name: 'Cable Row', sets: [{ id: 's', weight_kg: 40, reps: 8, completed: true }] }} exerciseIndex={2} showRir={false}
        onUpdateSet={jest.fn()} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={remove} onToggleUnilateral={jest.fn()} onOpenPicker={jest.fn()} />); });
    const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => typeof n.props.onPress === 'function');
    try {
        expect(button('Remove Cable Row set 1')).toBeUndefined();
        await act(async () => button('Edit sets for Cable Row').props.onPress());
        expect(button('Complete Cable Row set 1')).toBeUndefined();
        await act(async () => button('Remove Cable Row set 1').props.onPress());
        expect(remove).toHaveBeenCalledWith(2, 0);
        await act(async () => button('Done editing Cable Row').props.onPress());
        expect(button('Complete Cable Row set 1').props.accessibilityState.checked).toBe(true);
    } finally { await act(async () => screen.unmount()); }
});
test('shows zero external weight and exposes labelled set controls with a completion checkbox', async () => {
    const update = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'squat', name: 'Bodyweight Squat', instructions: 'Bend your hips and knees, then stand.', sets: [{ id: 'set', weight_kg: 0, reps: 10, completed: false }] }} exerciseIndex={2} showRir={false}
        onUpdateSet={update} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={jest.fn()} onToggleUnilateral={jest.fn()} onOpenPicker={jest.fn()} />); });
    try {
        expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === 'REPS / SIDE')).toBe(false);
        const weight = screen.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'Weight for Bodyweight Squat, set 1');
        expect(weight.props.value).toBe('0');
        const checkbox = screen.root.findAllByProps({ accessibilityLabel: 'Complete Bodyweight Squat set 1' }).find((node: any) => typeof node.props.onPress === 'function');
        expect(checkbox.props.accessibilityRole).toBe('checkbox'); expect(checkbox.props.accessibilityState.checked).toBe(false);
        await act(async () => checkbox.props.onPress()); expect(update).toHaveBeenCalledWith(2, 0, 'completed', true);
        const instructionsVisible = () => screen.root.findAllByType(Text).some((node: any) => node.props.children === 'Bend your hips and knees, then stand.');
        expect(instructionsVisible()).toBe(false);
        const details = screen.root.findAllByProps({ accessibilityLabel: 'View Bodyweight Squat demo and guide' }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => details.props.onPress());
        expect(instructionsVisible()).toBe(true);
        const close = screen.root.findAllByProps({ accessibilityLabel: 'Close exercise details' }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => close.props.onPress());
        expect(instructionsVisible()).toBe(false);
    } finally { await act(async () => screen.unmount()); }
});

test('keeps side tracking in exercise details and preserves the toggle', async () => {
    const toggle = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'row', name: 'Dumbbell Row', is_unilateral: true, sets: [{ id: 's', reps: 12, weight_kg: 22.5, completed: false }] }} exerciseIndex={1} showRir={false}
        onUpdateSet={jest.fn()} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={jest.fn()} onToggleUnilateral={toggle} onOpenPicker={jest.fn()} />); });
    try {
        expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === '1 SIDE')).toBe(false);
        expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === 'REPS / SIDE')).toBe(true);
        expect(screen.root.findAllByProps({ accessibilityLabel: 'Reps for Dumbbell Row, set 1 per side' }).length).toBeGreaterThan(0);
        const details = screen.root.findAllByProps({ accessibilityLabel: 'View Dumbbell Row demo and guide' }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => details.props.onPress());
        const eachSide = screen.root.findAllByProps({ accessibilityLabel: 'Each side' }).find((node: any) => typeof node.props.onPress === 'function');
        expect(eachSide.props.accessibilityState.checked).toBe(true);
        const whole = screen.root.findAllByProps({ accessibilityLabel: 'Whole movement' }).find((node: any) => typeof node.props.onPress === 'function');
        await act(async () => whole.props.onPress());
        expect(toggle).toHaveBeenCalledWith(1);
    } finally { await act(async () => screen.unmount()); }
});
