jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { isHealthImportEnabled, enableHealthImport, disableHealthImport, isBackgroundHealthEnabled, setBackgroundHealthEnabled } from '../healthImportPreference';
it('never imports one account device readings into a newly signed-in account without opting in', async () => {
    expect(await isHealthImportEnabled()).toBe(false);
    expect(await isHealthImportEnabled('a')).toBe(false);
    await enableHealthImport('a');
    expect(await isHealthImportEnabled('a')).toBe(true);
    expect(await isHealthImportEnabled('b')).toBe(false);
});

it('requires separate background opt-in and clears it when importing is disabled', async () => {
    await enableHealthImport('background-user');
    expect(await isBackgroundHealthEnabled('background-user')).toBe(false);
    await setBackgroundHealthEnabled('background-user', true);
    expect(await isBackgroundHealthEnabled('background-user')).toBe(true);
    await disableHealthImport('background-user');
    expect(await isHealthImportEnabled('background-user')).toBe(false);
    expect(await isBackgroundHealthEnabled('background-user')).toBe(false);
    await enableHealthImport('background-user');
    expect(await isBackgroundHealthEnabled('background-user')).toBe(false);
});
