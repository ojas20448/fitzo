jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => 'token-a'), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import api, { caloriesAPI, memberAPI, setAuthToken } from '../../services/api';
import { useOfflineStore } from '../../stores/offlineStore';

it('does not replay a meal after a timeout that could follow a successful commit', async () => {
    const adapter = jest.fn(async (config: any) => { throw { code: 'ECONNABORTED', config }; });
    api.defaults.adapter = adapter;
    await expect(caloriesAPI.log({ calories: 300 })).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(adapter).toHaveBeenCalledTimes(1);
});
it('still retries safe reads for a cold backend', async () => {
    const adapter = jest.fn(async (config: any) => { throw { code: 'ECONNABORTED', config }; });
    api.defaults.adapter = adapter;
    await expect(api.get('/example')).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(adapter).toHaveBeenCalledTimes(2);
});
it('does not return a previous account home cache', async () => {
    const store = useOfflineStore.getState();
    store.cacheHomeData({ user: { id: 'previous' } });
    api.defaults.adapter = async (config: any) => { throw { code: 'ERR_NETWORK', config }; };
    await expect(memberAPI.getHome()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
});

it('rejects a late response from the previous session', async () => {
    let finish!: () => void;
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    api.defaults.adapter = config => new Promise(resolve => {
        finish = () => resolve({ data: { user: { id: 'old' } }, status: 200, statusText: 'OK', headers: {}, config });
        started();
    });
    const pending = memberAPI.getHome();
    await ready;
    await setAuthToken('new-token');
    finish();
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
});

it('isolates pending writes and keeps failed writes recoverable', () => {
    const store = useOfflineStore.getState();
    store.setAccount('a');
    const id = store.queueAction('LOG_CALORIES', { calories: 300 });
    for (let i = 0; i < 5; i++) store.markActionFailed(id, 'server unavailable');
    store.clearFailedActions();
    expect(store.getPendingActions()).toHaveLength(1);
    store.setAccount('b');
    expect(store.getPendingActions()).toHaveLength(0);
    store.setAccount('a');
    expect(store.getPendingActions()).toHaveLength(1);
});
