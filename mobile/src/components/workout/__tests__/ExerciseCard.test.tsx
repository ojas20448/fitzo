import React from 'react';
import { Text } from 'react-native';
import ExerciseCard from '../ExerciseCard';
const { create, act } = jest.requireActual('react-test-renderer');
test('shows zero external weight and exposes labelled set controls with a completion checkbox', async () => {
    const update = jest.fn(); let screen: any;
    await act(async () => { screen = create(<ExerciseCard exercise={{ id: 'squat', name: 'Bodyweight Squat', instructions: 'Bend your hips and knees, then stand.', sets: [{ id: 'set', weight_kg: 0, reps: 10, completed: false }] }} exerciseIndex={2} showRir={false}
        onUpdateSet={update} onAddSet={jest.fn()} onRemoveExercise={jest.fn()} onRemoveSet={jest.fn()} onToggleUnilateral={jest.fn()} onOpenPicker={jest.fn()} />); });
    try {
        const weight = screen.root.findAllByProps({ accessibilityLabel: 'Weight for Bodyweight Squat, set 1: 0 kilograms' }).find((node: any) => typeof node.props.onPress === 'function');
        expect(weight.props.accessibilityRole).toBe('button');
        expect(weight.findAllByType(Text).some((node: any) => node.props.children === '0')).toBe(true);
        const checkbox = screen.root.findAllByProps({ accessibilityLabel: 'Complete Bodyweight Squat set 1' }).find((node: any) => typeof node.props.onPress === 'function');
        expect(checkbox.props.accessibilityRole).toBe('checkbox'); expect(checkbox.props.accessibilityState.checked).toBe(false);
        await act(async () => checkbox.props.onPress()); expect(update).toHaveBeenCalledWith(2, 0, 'completed', true);
        expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === 'Bend your hips and knees, then stand.')).toBe(true);
    } finally { await act(async () => screen.unmount()); }
});
