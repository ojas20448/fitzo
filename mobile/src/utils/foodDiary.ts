import type { CalorieEntry } from '../services/api';
import { MEAL_TYPES } from './foodPortion';

export function localDiaryDate(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDiaryDate(date: string, days: number): string {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + days);
    return localDiaryDate(value);
}
export function groupDiaryEntries(entries: CalorieEntry[]) {
    return [...MEAL_TYPES, 'other' as const].map(key => ({
        key, title: key === 'other' ? 'Other' : key[0].toUpperCase() + key.slice(1),
        entries: entries.filter(entry => key === 'other'
            ? !MEAL_TYPES.includes(entry.meal_type as typeof MEAL_TYPES[number]) : entry.meal_type === key),
    })).filter(group => group.entries.length > 0);
}
