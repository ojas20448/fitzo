import type { LastSession } from '../stores/lastSessionStore';
import type { SharePayload, ShareExercise } from '../components/share/SharePayload';
import { formatDate, formatVolumeKg, normalizeShareMuscle } from '../components/share/format';
import { weightEquivalence } from '../components/ReceiptShareCard';
import { TOTAL_ID, EX_PREFIX, PR_PREFIX } from './shareMoment';

/** Keep selected-lift measures distinct from whole-session context. */
export function buildSharePayload(session: LastSession, selection: string[]): SharePayload {
    const exIds = selection.filter(id => id.startsWith(EX_PREFIX)).map(id => id.slice(EX_PREFIX.length));
    const prNames = selection.filter(id => id.startsWith(PR_PREFIX)).map(id => id.slice(PR_PREFIX.length));
    const hasTotal = selection.includes(TOTAL_ID);
    const exercises = hasTotal ? session.exercises : session.exercises.filter(ex => exIds.includes(ex.id));
    const prs = session.prs.filter(pr => prNames.includes(pr.exercise));
    const selectedVolume = exercises.reduce((sum, ex) => sum + ex.volumeKg, 0);
    const selectedSets = exercises.reduce((sum, ex) => sum + ex.setCount, 0);
    const subset = !hasTotal && exercises.length > 0;
    const prOnly = exercises.length === 0 && prs.length > 0;
    const volume = exercises.length ? selectedVolume : session.volumeKg;
    const sets = exercises.length ? selectedSets : session.setCount;
    const headline = prOnly
        ? (prs.length === 1 ? prs[0].current : `${prs.length} PERSONAL RECORDS`)
        : volume > 0 ? `${formatVolumeKg(volume)} KG` : `${sets} ${sets === 1 ? 'SET' : 'SETS'}`;
    const headlineLabel = prOnly ? 'Personal record'
        : volume > 0 ? (subset ? 'Selected load volume' : 'Workout load volume') : 'Completed sets';
    const date = new Date(session.completedAt);
    return {
        headline,
        headlineLabel: prs.length > 1 && prOnly ? 'New personal bests' : headlineLabel,
        contextLabel: subset && exercises.length === 1 ? exercises[0].name : undefined,
        caption: selectedVolume > 0 ? weightEquivalence(selectedVolume) : undefined,
        subtitle: `${session.title} · ${formatDate(date)}`,
        rows: [
            { label: subset || prOnly ? 'Session duration' : 'Duration', value: `${session.durationMin} min` },
            { label: subset ? 'Selected sets' : prOnly ? 'Session sets' : 'Sets', value: `${subset ? selectedSets : session.setCount}` },
            ...(session.streak ? [{ label: 'Streak', value: `${session.streak} days` }] : []),
        ],
        prs,
        exercises,
        date,
    };
}

/** Session set counts use canonical anatomical keys, including catalog aliases. */
export function deriveMuscleVolume(exercises: ShareExercise[]): Record<string, number> {
    return exercises.reduce((acc, ex) => {
        const target = normalizeShareMuscle(ex.target);
        if (target && ex.setCount > 0) acc[target] = (acc[target] || 0) + ex.setCount;
        return acc;
    }, {} as Record<string, number>);
}
