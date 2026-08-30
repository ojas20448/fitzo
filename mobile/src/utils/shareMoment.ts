import type { LastSession } from '../stores/lastSessionStore';

export type ThemeId = 'receipt' | 'spec' | 'scoreboard' | 'anatomy' | 'chalk';

/** Extracted from the dead WorkoutShareCard before deletion. */
const WORKOUT_MILESTONES = [500, 365, 200, 100, 50, 25, 10];
export function getWorkoutMilestone(count: number): string | null {
    return WORKOUT_MILESTONES.includes(count) ? `${count}TH WORKOUT` : null;
}

/**
 * Labels are hardcoded, not derived via toLocaleString(): that formats by the
 * host locale, so "100,000" becomes "100.000" under a European locale and the
 * assertion flakes. These strings are also what the old card shipped.
 */
const VOLUME_MILESTONES: { threshold: number; label: string }[] = [
    { threshold: 1_000_000, label: '1M KG LIFETIME' },
    { threshold: 500_000, label: '500K KG LIFETIME' },
    { threshold: 250_000, label: '250K KG LIFETIME' },
    { threshold: 100_000, label: '100K KG LIFETIME' },
];
export function getVolumeMilestone(totalKg: number): string | null {
    // Only within 2% above the threshold. Announcing "100K KG" to someone at
    // 180,000 is not a milestone, it is noise.
    for (const m of VOLUME_MILESTONES) {
        if (totalKg >= m.threshold && totalKg < m.threshold * 1.02) return m.label;
    }
    return null;
}

/**
 * What the composer opens with.
 *
 * Selection ids are namespaced so a chip list can mix kinds:
 *   'total' | 'ex:<exerciseId>' | 'pr:<exerciseName>' | 'muscles'
 *
 * Exactly one item is pre-selected. SCOREBOARD renders a single figure at full
 * frame, so handing it two PRs would have nothing sensible to draw.
 */
export function pickMoment(session: LastSession): { selection: string[]; theme: ThemeId } {
    if (session.prs.length > 0) {
        return { selection: [`pr:${session.prs[0].exercise}`], theme: 'scoreboard' };
    }
    if (session.exercises.length > 0) {
        const heaviest = session.exercises.reduce((a, b) => (b.volumeKg > a.volumeKg ? b : a));
        return { selection: [`ex:${heaviest.id}`], theme: 'receipt' };
    }
    return { selection: ['total'], theme: 'receipt' };
}
