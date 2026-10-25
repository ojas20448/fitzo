import React from 'react';
import DiaryDatePicker from '../DiaryDatePicker';
const { create, act } = jest.requireActual('react-test-renderer');
let screen: any;
const select = jest.fn(), close = jest.fn();
const press = async (label: string) => act(async () => screen.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function').props.onPress());
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2028, 2, 5, 12)); jest.clearAllMocks(); });
afterEach(async () => { await act(async () => screen?.unmount()); jest.useRealTimers(); });
it('navigates month and year boundaries and selects a real leap day', async () => {
    await act(async () => { screen = create(<DiaryDatePicker visible date="2028-03-05" onSelect={select} onClose={close} />); });
    await press('Previous month'); await press('Choose 2028-02-29');
    expect(select).toHaveBeenCalledWith('2028-02-29'); expect(close).toHaveBeenCalled();
    await act(async () => screen.update(<DiaryDatePicker visible date="2028-01-10" onSelect={select} onClose={close} />));
    await press('Previous month'); await press('Choose 2027-12-31');
    expect(select).toHaveBeenLastCalledWith('2027-12-31');
});
it('disables future dates and lets cancellation leave the selected date untouched', async () => {
    await act(async () => { screen = create(<DiaryDatePicker visible date="2028-03-04" onSelect={select} onClose={close} />); });
    expect(screen.root.findAllByProps({ accessibilityLabel: 'Choose 2028-03-06' }).some((node: any) => node.props.disabled)).toBe(true);
    await press('Cancel date selection'); expect(select).not.toHaveBeenCalled();
    await press('Choose today'); expect(select).toHaveBeenCalledWith('2028-03-05');
});
