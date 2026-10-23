import React from 'react';
import { Text, TextInput } from 'react-native';
import ExerciseList from '../ExerciseList';
import ExerciseDetailsModal from '../ExerciseDetailsModal';
import { exerciseAPI } from '../../services/api';
import { FlashList } from '@shopify/flash-list';
const { create, act } = jest.requireActual('react-test-renderer');
const mockCache = jest.fn();
jest.mock('../../hooks/useExerciseHistory', () => ({ useExerciseHistory: () => ({ sessions: [], loading: false, error: false, retry: jest.fn() }) }));
jest.mock('@shopify/flash-list', () => {
    const React = jest.requireActual('react'), { View } = jest.requireActual('react-native');
    return { FlashList: ({ data, renderItem, ListEmptyComponent, ListFooterComponent }: any) => React.createElement(View, null, ...data.map((item: any, index: number) => React.createElement(View, { key: item.id }, renderItem({ item, index }))), !data.length ? ListEmptyComponent : null, ListFooterComponent) };
});
jest.mock('../../data/defaultExercises', () => ({ bodyPartsList: ['chest', 'back', 'arms'], defaultExercises: [
    { id: 'press', name: 'Barbell Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell' },
    { id: 'row', name: 'Dumbbell Row', bodyPart: 'back', target: 'lats', equipment: 'dumbbell' },
    { id: 'curl', name: 'Arm Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell' },
] }));
jest.mock('../ExercisePreview', () => () => null);
jest.mock('../ExerciseDetailsModal', () => () => null);
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('../../utils/exerciseMedia', () => ({ withExerciseMedia: (exercise: any) => exercise, exerciseMediaCandidates: () => [] }));
jest.mock('../../stores/offlineStore', () => ({ useOfflineStore: { getState: () => ({ getExercises: () => [], isExercisesStale: () => true, cacheExercises: mockCache }) } }));
jest.mock('../../services/api', () => ({ exerciseAPI: { getBodyParts: jest.fn(async () => ({ bodyParts: [] })), getAll: jest.fn(), search: jest.fn(), getByBodyPart: jest.fn() } }));
let screen: any;
const text = () => screen.root.findAllByType(Text).map((n: any) => n.props.children).flat().join(' ');
const control = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((n: any) => typeof n.props.onPress === 'function');
const press = async (label: string) => { await act(async () => control(label).props.onPress()); };
const deferred = () => { let resolve!: (data: any) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function mount(props = {}) { await act(async () => { screen = create(<ExerciseList {...props} />); }); }
async function tick() { await act(async () => { jest.advanceTimersByTime(350); }); }
async function search(query: string) { await act(async () => screen.root.findByType(TextInput).props.onChangeText(query)); await tick(); }
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); (exerciseAPI.getAll as jest.Mock).mockResolvedValue({ exercises: [] }); (exerciseAPI.search as jest.Mock).mockResolvedValue({ exercises: [] }); (exerciseAPI.getByBodyPart as jest.Mock).mockResolvedValue({ exercises: [] }); });
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; jest.useRealTimers(); });
test('keeps built-in matches visible while the online search is pending', async () => {
    (exerciseAPI.search as jest.Mock).mockReturnValue(new Promise(() => {}));
    await mount(); await search('barbell');
    expect(text()).toContain('Barbell Press');
    expect(control('View Barbell Press guide')).toBeTruthy();
});
test('a late response cannot replace a newer search', async () => {
    const old = deferred();
    (exerciseAPI.search as jest.Mock).mockImplementation((query: string) => query === 'row' ? old.promise : Promise.resolve({ exercises: [{ id: 'latest', name: 'Latest Remote Press', bodyPart: 'chest' }] }));
    await mount(); await search('row'); await search('press');
    expect(text()).toContain('Latest Remote Press');
    await act(async () => old.resolve({ exercises: [{ id: 'old', name: 'Old Remote Row', bodyPart: 'back' }] }));
    expect(text()).toContain('Latest Remote Press'); expect(text()).not.toContain('Old Remote Row');
});
test('applies allowed muscle groups to online search results', async () => {
    (exerciseAPI.search as jest.Mock).mockResolvedValue({ exercises: [{ id: 'allowed', name: 'Arm Cable Curl', bodyPart: 'upper arms' }, { id: 'wrong', name: 'Arm Chest Press', bodyPart: 'chest' }] });
    await mount({ allowedBodyParts: ['arms'] }); await search('arm');
    expect(text()).toContain('Arm Cable Curl'); expect(text()).not.toContain('Arm Chest Press');
});
test('select mode separates preview from explicitly adding an exercise', async () => {
    const onSelect = jest.fn(); await mount({ mode: 'select', onSelect }); await tick();
    await press('View Barbell Press guide'); expect(onSelect).not.toHaveBeenCalled();
    expect(screen.root.findByType(ExerciseDetailsModal).props.exercise.name).toBe('Barbell Press');
    await act(async () => screen.root.findByType(ExerciseDetailsModal).props.onClose());
    await press('Add Barbell Press to workout'); expect(onSelect).toHaveBeenCalledTimes(1);
});
test('marks selected exercises without allowing a duplicate and makes replacement explicit', async () => {
    const onSelect = jest.fn();
    await mount({ mode: 'select', onSelect, selectedExercises: [{ id: 'other-id', name: 'Barbell Press' }] }); await tick();
    expect(control('Barbell Press already in workout').props.disabled).toBe(true);
    await press('Barbell Press already in workout'); expect(onSelect).not.toHaveBeenCalled();
    await act(async () => screen.update(<ExerciseList mode="select" onSelect={onSelect} selectionAction="Replace" />));
    await press('Replace Barbell Press in workout'); expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'press' }));
});
test('online failure preserves the local library and offers a retry', async () => {
    (exerciseAPI.getAll as jest.Mock).mockRejectedValueOnce(new Error('Unavailable'));
    await mount(); await tick(); expect(text()).toContain('Barbell Press');
    await press('Retry exercise loading'); await tick();
    expect(exerciseAPI.getAll).toHaveBeenCalledTimes(2);
});
test('select mode lists the built-in exercises before additional online results', async () => {
    (exerciseAPI.getAll as jest.Mock).mockResolvedValue({ exercises: [{ id: 'remote', name: 'Aaa Remote Exercise' }] });
    await mount({ mode: 'select' }); await tick();
    expect(screen.root.findByType(FlashList).props.data[0].id).not.toBe('remote');
});
test('a pending page cannot leak into a new search or overwrite its cache', async () => {
    const next = deferred();
    (exerciseAPI.getAll as jest.Mock).mockResolvedValueOnce({ exercises: Array.from({ length: 50 }, (_, index) => ({ id: `api-${index}`, name: `API Press ${index}`, bodyPart: 'chest' })) }).mockReturnValueOnce(next.promise);
    await mount(); await tick();
    const onEnd = screen.root.findByType(FlashList).props.onEndReached;
    await act(async () => { void onEnd(); void onEnd(); });
    expect(exerciseAPI.getAll).toHaveBeenCalledTimes(2);
    expect(exerciseAPI.getAll).toHaveBeenLastCalledWith(50, 50);
    await search('row');
    await act(async () => next.resolve({ exercises: [{ id: 'late', name: 'Late Page Row', bodyPart: 'back' }] }));
    expect(text()).not.toContain('Late Page Row'); expect(text()).toContain('Dumbbell Row');
    expect(mockCache).toHaveBeenCalledTimes(1);
});
test('the all-muscles control preserves search text while Reset clears both filters', async () => {
    await mount(); await search('row'); await press('Filter back'); await tick();
    await press('Filter all muscles'); expect(screen.root.findByType(TextInput).props.value).toBe('row');
    await press('Clear exercise filters'); expect(screen.root.findByType(TextInput).props.value).toBe('');
});
test('custom movements are offered only when choosing an exercise for a workout', async () => {
    await mount(); await search('Unlisted Movement');
    expect(text()).not.toContain('as custom');
    await act(async () => screen.unmount()); screen = null;
    const onSelect = jest.fn(); await mount({ mode: 'select', onSelect }); await search('Unlisted Movement');
    const custom = screen.root.findAll((node: any) => node.props.title === 'Add “Unlisted Movement” as custom')[0];
    await act(async () => custom.props.onPress());
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Unlisted Movement', custom: true }));
});
test('an empty muscle filter offers all muscles without losing the query or offering a duplicate custom exercise', async () => {
    await mount({ mode: 'select' }); await search('row'); await press('Filter chest'); await tick();
    expect(text()).toContain('No matches in chest'); expect(text()).not.toContain('as custom');
    await press('Search all muscles'); await tick();
    expect(screen.root.findByType(TextInput).props.value).toBe('row');
    expect(text()).toContain('Dumbbell Row');
});
