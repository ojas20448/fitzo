import React from 'react';
import { Text, TextInput } from 'react-native';
import WorkoutSetEditor from '../WorkoutSetEditor';
import ScrollWheelPicker from '../ScrollWheelPicker';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let screen: any;
const save = jest.fn();
const close = jest.fn();
const select = jest.fn();
const props = { exerciseName: 'Dumbbell Row', setIndex: 1, set: { id: 's', completed: false, weight_kg: '', reps: '' },
    initialField: 'weight' as const, showRir: false, inputMode: 'typing' as const, onSelectMode: select, onSave: save, onClose: close };
const input = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => n.type === TextInput);
const button = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => typeof n.props.onPress === 'function');
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
const type = async (label: string, value: string) => { await act(async () => input(label).props.onChangeText(value)); };
const mount = async (extra = {}) => { await act(async () => { screen = create(<WorkoutSetEditor {...props} {...extra} />); }); };
beforeEach(() => jest.clearAllMocks());
afterEach(async () => { await act(async () => screen?.unmount()); });

test('edits cardio time and effort without weight, reps or RIR, including decimal minutes', async () => {
    await mount({ exerciseName: 'Treadmill Run', isCardio: true, showRir: true, initialField: 'duration' });
    expect(screen.root.findAllByType(TextInput)).toHaveLength(2);
    expect(input('Weight value')).toBeUndefined(); expect(input('Reps value')).toBeUndefined(); expect(input('Reps in reserve value')).toBeUndefined();
    await type('Duration in minutes', '20,5'); await type('Effort out of 10', '6');
    await press('Mark set complete');
    expect(save).toHaveBeenCalledWith({ duration_minutes: 20.5, rpe: 6 }, true);
});

test('retains a cardio draft after validation errors and allows an empty effort rating', async () => {
    await mount({ isCardio: true, initialField: 'duration' });
    await type('Duration in minutes', '0'); await press('Mark set complete'); expect(save).not.toHaveBeenCalled();
    await type('Duration in minutes', '25'); await type('Effort out of 10', '11');
    await press('Mark set complete'); expect(save).not.toHaveBeenCalled();
    expect(input('Duration in minutes').props.value).toBe('25');
    await type('Effort out of 10', ''); await press('Save without completing');
    expect(save).toHaveBeenCalledWith({ duration_minutes: 25, rpe: '' }, false);
});

test('uses duration and effort wheels and only copies the previous duration', async () => {
    await mount({ isCardio: true, initialField: 'duration', inputMode: 'wheel', previousSet: { id: 'p', duration_minutes: 15, rpe: 8, completed: true } });
    await press('Copy previous set');
    expect(screen.root.findByType(ScrollWheelPicker).props.selectedValue).toBe(15);
    await press('Effort out of 10');
    expect(screen.root.findByType(ScrollWheelPicker).props.values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await act(async () => screen.root.findByType(ScrollWheelPicker).props.onValueChange(5));
    await press('Save without completing');
    expect(save).toHaveBeenCalledWith({ duration_minutes: 15, rpe: 5 }, false);
});

test('edits both values together and explicitly completes only once, including a bodyweight set', async () => {
    await mount();
    expect(screen.root.findAllByType(TextInput)).toHaveLength(2);
    await type('Weight value', '0'); await type('Reps value', '12');
    await press('Mark set complete'); await press('Mark set complete');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ weight_kg: 0, reps: 12 }, true);
});

test.each([
    ['', '8', 'Enter a weight'], ['40abc', '8', 'Enter a weight'], ['-10', '8', 'Enter a weight'],
    ['40', '0', 'whole number of reps'], ['40', '8.5', 'whole number of reps'], ['40', '8reps', 'whole number of reps'],
])('rejects invalid weight %s / reps %s without losing typed values', async (weight, reps, message) => {
    await mount(); await type('Weight value', weight); await type('Reps value', reps); await press('Mark set complete');
    expect(save).not.toHaveBeenCalled();
    expect(screen.root.findAllByType(Text).some((n: any) => String(n.props.children).includes(message))).toBe(true);
    expect(input('Weight value').props.value).toBe(weight);
    expect(input('Reps value').props.value).toBe(reps);
});

test('copying a previous set is a draft until saved and does not copy effort or completion', async () => {
    await mount({ showRir: true, isUnilateral: true, previousSet: { id: 'p', weight_kg: 22.5, reps: 10, rir: 0, completed: true } });
    await press('Copy previous set');
    expect(save).not.toHaveBeenCalled();
    expect(input('Weight value').props.value).toBe('22.5');
    expect(input('Reps in reserve value').props.value).toBe('');
    await press('Save without completing');
    expect(save).toHaveBeenCalledWith({ weight_kg: 22.5, reps: 10, rir: '' }, false);
});

test('hides copy when the previous set has no usable values and cancel never saves', async () => {
    await mount({ previousSet: { id: 'p', reps: 8, completed: false } });
    expect(button('Copy previous set')).toBeUndefined();
    await type('Weight value', '45'); await press('Close set editor');
    expect(close).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled();
});

test('validates optional RIR, accepts 0, and preserves decimal comma weights', async () => {
    await mount({ showRir: true });
    await type('Weight value', '22,5'); await type('Reps value', '10'); await type('Reps in reserve value', '6');
    await press('Mark set complete'); expect(save).not.toHaveBeenCalled();
    await type('Reps in reserve value', '0'); await press('Mark set complete');
    expect(save).toHaveBeenCalledWith({ weight_kg: 22.5, reps: 10, rir: 0 }, true);
});

test('switching to the wheel preserves both draft values and updates only the selected field', async () => {
    await mount(); await type('Weight value', '62.5'); await type('Reps value', '8');
    await press('Use scroll wheel'); expect(select).toHaveBeenCalledWith('wheel');
    await act(async () => screen.update(<WorkoutSetEditor {...props} inputMode="wheel" />));
    expect(screen.root.findByType(ScrollWheelPicker).props.selectedValue).toBe(62.5);
    await press('Reps value');
    await act(async () => screen.root.findByType(ScrollWheelPicker).props.onValueChange(10));
    await press('Save without completing');
    expect(save).toHaveBeenCalledWith({ weight_kg: 62.5, reps: 10 }, false);
});

test('editing a completed set saves values without requesting another completion', async () => {
    await mount({ set: { id: 's', weight_kg: 40, reps: 8, rir: 2, completed: true } });
    expect(button('Mark set complete')).toBeUndefined();
    await type('Weight value', '42.5'); await press('Save changes');
    expect(save).toHaveBeenCalledWith({ weight_kg: 42.5, reps: 8 }, false);
});

test.each([['.5', 0.5], ['22.', 22]])('accepts normal decimal entry %s', async (typed, expected) => {
    await mount(); await type('Weight value', typed); await type('Reps value', '8'); await press('Save without completing');
    expect(save).toHaveBeenCalledWith({ weight_kg: expected, reps: 8 }, false);
});
