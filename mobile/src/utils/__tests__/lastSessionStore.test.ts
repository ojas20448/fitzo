import { useLastSessionStore, STALE_AFTER_MS } from '../../stores/lastSessionStore';

const session = () => ({
    completedAt: Date.now(),
    title: 'Push', durationMin: 58, volumeKg: 12400, setCount: 24,
    exercises: [{ id: '1', name: 'Bench Press', volumeKg: 3200, setCount: 4 }],
    prs: [],
});

describe('lastSessionStore', () => {
    beforeEach(() => useLastSessionStore.getState().clearSession());

    it('holds a session', () => {
        useLastSessionStore.getState().setSession(session());
        expect(useLastSessionStore.getState().session?.title).toBe('Push');
    });

    it('clearSession empties it', () => {
        useLastSessionStore.getState().setSession(session());
        useLastSessionStore.getState().clearSession();
        expect(useLastSessionStore.getState().session).toBeNull();
    });

    it('is stale once the window has passed', () => {
        useLastSessionStore.getState().setSession({
            ...session(), completedAt: Date.now() - STALE_AFTER_MS - 1000,
        });
        expect(useLastSessionStore.getState().isStale()).toBe(true);
    });

    it('a fresh session is not stale', () => {
        useLastSessionStore.getState().setSession(session());
        expect(useLastSessionStore.getState().isStale()).toBe(false);
    });

    it('an absent session counts as stale', () => {
        expect(useLastSessionStore.getState().isStale()).toBe(true);
    });
});
