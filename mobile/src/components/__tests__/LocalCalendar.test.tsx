import React from 'react';
import { Text } from 'react-native';
import { Rect } from 'react-native-svg';
import BusyTimesStrip from '../BusyTimesStrip';
import WeeklyCharts from '../WeeklyCharts';
import { colors } from '../../styles/theme';
const { create, act } = jest.requireActual('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../services/api', () => ({
    caloriesAPI: { getHistory: async () => ({ history: [{ logged_date: '2026-10-24T00:00:00Z', total_protein: 20 }] }) },
    nutritionAPI: { getProfile: async () => ({ profile: { target_calories: 2000 } }) },
}));

afterEach(() => jest.useRealTimers());

it('uses the gym weekday for the busy-hours row', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-24T22:30:00Z'));
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    grid[6][18] = 10;
    grid[0][8] = 10;
    let screen: any;
    await act(async () => { screen = create(<BusyTimesStrip grid={grid} quietest={null} confidence="good" timezone="Europe/London" />); });
    try {
        const copy = screen.root.findAllByType(Text).map((node: any) => node.props.children).flat().join('');
        expect(copy).toContain('Quietest around 6pm');
    } finally { await act(async () => screen.unmount()); }
});

it('keeps a calendar-date meal on today’s bar west of UTC', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 24, 8));
    let screen: any;
    await act(async () => { screen = create(<WeeklyCharts />); });
    try {
        const rectangles = screen.root.findAllByType(Rect);
        const protein = rectangles.find((node: any) => node.props.fill === colors.macro.protein);
        expect(protein).toBeDefined();
        expect(protein.props.x).toBe(Math.max(...rectangles.map((node: any) => Number(node.props.x))));
    } finally { await act(async () => screen.unmount()); }
});
