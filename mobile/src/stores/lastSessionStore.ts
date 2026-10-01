import { create } from 'zustand';
import type { ShareExercise, SharePr } from '../components/share/SharePayload';

export interface LastSession {
    completedAt: number;
    title: string;
    durationMin: number;
    volumeKg: number;
    setCount: number;
    exercises: ShareExercise[];
    prs: SharePr[];
    streak?: number;
}

/**
 * Two hours. Long enough to leave the app and come back to share; short enough
 * that Monday's session cannot appear in the composer on Wednesday. Staleness is
 * belt-and-braces — clearSession() on the log screen is the primary guard — but
 * a crash between screens would otherwise leave the old session resident.
 */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

interface State {
    session: LastSession | null;
    setSession: (s: LastSession) => void;
    clearSession: () => void;
    isStale: () => boolean;
}

export const useLastSessionStore = create<State>((set, get) => ({
    session: null,
    setSession: (session) => set({ session }),
    clearSession: () => set({ session: null }),
    isStale: () => {
        const s = get().session;
        if (!s) return true;
        return Date.now() - s.completedAt > STALE_AFTER_MS;
    },
}));
