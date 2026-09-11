jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { isHealthImportEnabled, enableHealthImport } from '../healthImportPreference';
it('never imports one account device readings into a newly signed-in account without opting in', async () => {
    expect(await isHealthImportEnabled()).toBe(false);
    expect(await isHealthImportEnabled('a')).toBe(false);
    await enableHealthImport('a');
    expect(await isHealthImportEnabled('a')).toBe(true);
    expect(await isHealthImportEnabled('b')).toBe(false);
});
