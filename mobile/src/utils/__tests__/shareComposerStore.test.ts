import { useShareComposerStore } from '../../stores/shareComposerStore';
import { STALE_AFTER_MS } from '../../stores/lastSessionStore';
import type { LastSession } from '../../stores/lastSessionStore';
import type { SharePayload } from '../../components/share/SharePayload';

const session = (): LastSession => ({
    completedAt: Date.now(),
    title: 'Push', durationMin: 58, volumeKg: 12400, setCount: 24,
    exercises: [{ id: '1', name: 'Bench Press', volumeKg: 3200, setCount: 4 }],
    prs: [],
});

const staticPayload = (): SharePayload => ({
    headline: '4 WORKOUTS',
    subtitle: 'WEEKLY RECAP',
    rows: [{ label: 'Streak', value: '3 days' }],
    prs: [],
    exercises: [],
    date: new Date(),
});

describe('shareComposerStore', () => {
    beforeEach(() => useShareComposerStore.getState().clearSource());

    it('holds a session source', () => {
        useShareComposerStore.getState().setSource({ kind: 'session', session: session() });
        const source = useShareComposerStore.getState().source;
        expect(source?.kind).toBe('session');
        expect(source?.kind === 'session' && source.session.title).toBe('Push');
    });

    it('holds a static source', () => {
        useShareComposerStore.getState().setSource({ kind: 'static', payload: staticPayload() });
        const source = useShareComposerStore.getState().source;
        expect(source?.kind).toBe('static');
        expect(source?.kind === 'static' && source.payload.headline).toBe('4 WORKOUTS');
    });

    it('clearSource empties it', () => {
        useShareComposerStore.getState().setSource({ kind: 'session', session: session() });
        useShareComposerStore.getState().clearSource();
        expect(useShareComposerStore.getState().source).toBeNull();
    });

    it('is stale once the window has passed', () => {
        useShareComposerStore.getState().setSource({ kind: 'session', session: session() });
        useShareComposerStore.setState({ setAt: Date.now() - STALE_AFTER_MS - 1000 });
        expect(useShareComposerStore.getState().isStale()).toBe(true);
    });

    it('a freshly set source is not stale', () => {
        useShareComposerStore.getState().setSource({ kind: 'static', payload: staticPayload() });
        expect(useShareComposerStore.getState().isStale()).toBe(false);
    });

    it('an absent source counts as stale', () => {
        expect(useShareComposerStore.getState().isStale()).toBe(true);
    });
});
