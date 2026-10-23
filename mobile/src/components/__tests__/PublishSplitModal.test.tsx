import React from 'react';
import { Text, TextInput } from 'react-native';
import PublishSplitModal from '../PublishSplitModal';
import { workoutsAPI } from '../../services/api';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member', name: 'Alex' }, token: 'token' }) }));
jest.mock('../../services/api', () => ({ workoutsAPI: { getMySplits: jest.fn(), publishSplit: jest.fn() } }));
let screen: any;
const success = jest.fn(), close = jest.fn();
const control = (label: string) => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
const press = async (label: string) => { await act(async () => { await control(label).props.onPress(); }); };
const input = async (label: string, value: string) => { await act(async () => screen.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === label).props.onChangeText(value)); };
const texts = () => screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
beforeEach(() => { jest.clearAllMocks(); (workoutsAPI.getMySplits as jest.Mock).mockResolvedValue({ splits: [{ id: 'saved-id', name: 'My upper', days: ['Upper', 'Rest'], training_plan: {} }] }); });
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; });
async function select() { await act(async () => { screen = create(<PublishSplitModal visible onSuccess={success} onClose={close} />); }); await press('Publish My upper'); }

test('publishes the selected saved plan and keeps form details available after failure', async () => {
    (workoutsAPI.publishSplit as jest.Mock).mockRejectedValueOnce(new Error('Couldn’t publish')).mockResolvedValueOnce({});
    await select(); expect(texts()).toContain('Workout logs and lifted weights stay private.');
    await input('Published plan name', '  My upper  '); await input('Plan description', '  Two days of strength  '); await input('Plan tags', 'Strength, strength');
    await press('Publish to community'); expect(texts()).toContain('Couldn’t publish'); expect(success).not.toHaveBeenCalled();
    await press('Publish to community');
    expect(workoutsAPI.publishSplit).toHaveBeenLastCalledWith({ source_split_id: 'saved-id', name: 'My upper', description: 'Two days of strength', difficulty_level: 'intermediate', tags: ['strength'] }, 'token');
    expect(success).toHaveBeenCalledTimes(1);
});
test('blocks blank details, invalid tags and duplicate pending submissions', async () => {
    let resolve!: (value: any) => void; (workoutsAPI.publishSplit as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
    await select(); await press('Publish to community'); expect(workoutsAPI.publishSplit).not.toHaveBeenCalled();
    await input('Plan description', 'My routine'); await input('Plan tags', 'a,b,c,d,e,f'); await press('Publish to community'); expect(workoutsAPI.publishSplit).not.toHaveBeenCalled();
    await input('Plan tags', 'strength');
    await act(async () => { control('Publish to community').props.onPress(); control('Publish to community').props.onPress(); });
    expect(workoutsAPI.publishSplit).toHaveBeenCalledTimes(1); await press('Close publishing'); expect(close).not.toHaveBeenCalled();
    await act(async () => resolve({})); expect(success).toHaveBeenCalledTimes(1);
});
