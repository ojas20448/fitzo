import React from 'react';
import { Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../Avatar';
import AvatarPicker from '../AvatarPicker';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('../../utils/haptics', () => ({ selectionAsync: jest.fn() }));
let screen: any;
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; });

test.each([undefined, 'Ojas', '   '])('uses a neutral profile silhouette without a photo (name: %s)', async name => {
    await act(async () => { screen = create(<Avatar name={name} uri={null} size="xl" />); });
    expect(screen.root.findByType(Ionicons).props.name).toBe('person');
    expect(screen.root.findAllByType(Image)).toHaveLength(0);
    expect(screen.root.findAllByType(Text).some((node: any) => node.props.children === '?' || node.props.children === 'OJ')).toBe(false);
});

test.each(['avatar_lion', 'https://example.test/profile.jpg'])('keeps a selected profile image: %s', async uri => {
    await act(async () => { screen = create(<Avatar uri={uri} name="Ojas" />); });
    const photo = screen.root.findByType(Image);
    expect(photo.props.contentFit).toBe('cover');
    if (uri.startsWith('https:')) expect(photo.props.source).toEqual({ uri });
    else expect(photo.props.source).toBe(require('../../../assets/avatar_lion.png'));
});

test('labels an unselected profile picture correctly in the picker', async () => {
    await act(async () => { screen = create(<AvatarPicker value={null} onChange={jest.fn()} name="Ojas" />); });
    const labels = screen.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(labels).toContain('Default profile picture');
    expect(labels).not.toContain('Your initials');
});

test('the picker can restore the default picture and locks selection during saving', async () => {
    const onChange = jest.fn();
    await act(async () => { screen = create(<AvatarPicker value="avatar_lion" onChange={onChange} />); });
    const button = () => screen.root.findAllByProps({ accessibilityLabel: 'Use default profile picture' }).find((node: any) => typeof node.props.onPress === 'function');
    await act(async () => button().props.onPress());
    expect(onChange).toHaveBeenCalledWith(null);
    onChange.mockClear();
    await act(async () => screen.update(<AvatarPicker value="avatar_lion" onChange={onChange} disabled />));
    await act(async () => button().props.onPress());
    expect(onChange).not.toHaveBeenCalled();
});
