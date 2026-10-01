/** Explicit device calendar day prevents a UTC server shifting imported data. */
export function localDateString(at = new Date()): string {
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

export function healthDayWindow(date: string, now = new Date()): { start: Date; end: Date } {
    const start = new Date(`${date}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start.getTime()) ||
        localDateString(start) !== date || date > localDateString(now)) {
        throw new RangeError('Choose a valid date up to today');
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end: new Date(Math.min(end.getTime(), now.getTime())) };
}

export function recentHealthDates(count: number, now = new Date()): string[] {
    if (!Number.isInteger(count) || count < 1 || count > 30) throw new RangeError('Import between 1 and 30 days');
    return Array.from({ length: count }, (_, index) => {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        day.setDate(day.getDate() - index);
        return localDateString(day);
    });
}
