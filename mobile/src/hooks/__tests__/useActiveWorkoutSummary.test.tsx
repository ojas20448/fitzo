import React from 'react';
import { Text } from 'react-native';
import { useActiveWorkoutSummary } from '../useActiveWorkoutSummary';
import { loadActiveWorkoutDraft } from '../../utils/activeWorkoutDraft';
const { create, act } = jest.requireActual('react-test-renderer');
let mockListener: (owner: string, draft: any) => void;
jest.mock('../../utils/activeWorkoutDraft', () => ({
    loadActiveWorkoutDraft: jest.fn(), subscribeActiveWorkoutDraft: (listener: any) => { mockListener = listener; return jest.fn(); },
}));
function Read({ user }: { user: string }) { const summary = useActiveWorkoutSummary(user, '/food'); return <Text>{summary.hasActiveWorkout ? summary.label : 'none'}</Text>; }
let screen: any;
afterEach(async () => { await act(async () => screen?.unmount()); });
it('ignores late reads from a previous account', async () => {
    let resolve!: (draft: any) => void;
    (loadActiveWorkoutDraft as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce(null);
    await act(async () => { screen = create(<Read user="a" />); });
    await act(async () => screen.update(<Read user="b" />));
    await act(async () => resolve({ intent: { session_label: 'Private A workout' }, exercises: [{}] }));
    expect(screen.root.findByType(Text).props.children).toBe('none');
});
it('reacts to saved and finished workouts without polling', async () => {
    (loadActiveWorkoutDraft as jest.Mock).mockResolvedValue(null);
    await act(async () => { screen = create(<Read user="a" />); });
    await act(async () => mockListener('a', { intent: { session_label: 'Push' }, exercises: [{}] }));
    expect(screen.root.findByType(Text).props.children).toBe('Push');
    await act(async () => mockListener('b', null));
    expect(screen.root.findByType(Text).props.children).toBe('Push');
    await act(async () => mockListener('a', null));
    expect(screen.root.findByType(Text).props.children).toBe('none');
});
