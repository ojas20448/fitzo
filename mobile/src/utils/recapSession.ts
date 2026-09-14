import type { LastSession } from '../stores/lastSessionStore';
import { normalizePrs } from './normalizePr';

function parse(value: unknown): any {
    try { return typeof value === 'string' ? JSON.parse(value) : null; }
    catch { return null; }
}

/** Prefer matching saved details; never replace an old recap with another workout. */
export function getRecapSession(recap: unknown, title: unknown, saved: LastSession | null): LastSession | null {
    const data = parse(recap);
    if (!data || ![data.duration, data.sets, data.volume].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) return null;
    if (saved && saved.durationMin === data.duration && saved.setCount === data.sets && saved.volumeKg === data.volume
        && saved.completedAt === data.completedAt) return saved;
    if (!Number.isFinite(data.completedAt) || data.completedAt <= 0) return null;
    const info = parse(title);
    const name = info?.name || info?.day_name;
    return {
        completedAt: data.completedAt,
        title: typeof name === 'string' ? name : 'Workout',
        durationMin: data.duration,
        setCount: data.sets,
        volumeKg: data.volume,
        exercises: [],
        prs: normalizePrs(Array.isArray(data.prs) ? data.prs : []),
    };
}
