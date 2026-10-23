import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { workoutsAPI } from '../services/api';
import { exerciseHistoryFor } from '../utils/exerciseHistory';

let generation = 0;
let cached: { owner: string; groups: unknown[]; at: number } | undefined;
let pending: { owner: string; promise: Promise<unknown[]> } | undefined;

export function invalidateExerciseHistory() { generation++; cached = undefined; pending = undefined; }

function loadHistory(owner: string, token: string): Promise<unknown[]> {
    if (cached?.owner === owner && Date.now() - cached.at < 30000) return Promise.resolve(cached.groups);
    if (pending?.owner === owner) return pending.promise;
    const version = generation;
    // shortcut: bounded to the last 90 logged days; use a paginated exercise endpoint if deeper history is needed.
    const promise = workoutsAPI.getHistory(90, token).then(response => {
        if (!Array.isArray(response?.history)) throw new Error('History unavailable');
        if (generation === version) cached = { owner, groups: response.history, at: Date.now() };
        return response.history;
    }).finally(() => { if (pending?.promise === promise) pending = undefined; });
    pending = { owner, promise };
    return promise;
}

export function useExerciseHistory(name: string, enabled = true) {
    const { user, token } = useAuth();
    const owner = user?.id && token ? `${user.id}:${token}` : '';
    const identity = `${owner}:${name}`;
    const [result, setResult] = useState<{ identity: string; groups: unknown[]; error: boolean }>({ identity: '', groups: [], error: false });
    const [attempt, setAttempt] = useState(0);
    const current = useRef(identity); current.current = identity;
    useEffect(() => {
        let active = true;
        if (!enabled || !owner || !token) return;
        setResult({ identity: '', groups: [], error: false });
        loadHistory(owner, token).then(groups => {
            if (active && current.current === identity) setResult({ identity, groups, error: false });
        }).catch(() => {
            if (active && current.current === identity) setResult({ identity, groups: [], error: true });
        });
        return () => { active = false; };
    }, [identity, owner, token, enabled, attempt]);
    const matches = result.identity === identity;
    return { sessions: matches ? exerciseHistoryFor(result.groups, name) : [],
        loading: !!(enabled && owner && !matches), error: matches && result.error,
        retry: () => { invalidateExerciseHistory(); setAttempt(value => value + 1); } };
}
