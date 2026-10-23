import { coachEntryPrompt } from '../coachEntry';
import { groupDiaryEntries, localDiaryDate, shiftDiaryDate } from '../foodDiary';
import type { CalorieEntry } from '../../services/api';

it('accepts bounded editable coach prompts from known destinations only', () => {
    expect(coachEntryPrompt('food', ' Review my meals ')).toBe('Review my meals');
    expect(coachEntryPrompt('workout', 'a'.repeat(501))).toBe('');
    expect(coachEntryPrompt('unknown', 'send this')).toBe('');
    expect(coachEntryPrompt('food', ['send this'])).toBe('');
});
it('uses local calendar days across month boundaries', () => {
    expect(localDiaryDate(new Date(2026, 9, 22, 0, 5))).toBe('2026-10-22');
    expect(shiftDiaryDate('2026-10-01', -1)).toBe('2026-09-30');
});
it('keeps legacy unassigned meals visible alongside grouped entries', () => {
    const entries = [{ id: 'a', meal_type: 'lunch' }, { id: 'b', meal_type: null }] as CalorieEntry[];
    expect(groupDiaryEntries(entries).map(group => [group.title, group.entries.map(entry => entry.id)])).toEqual([['Lunch', ['a']], ['Other', ['b']]]);
});
