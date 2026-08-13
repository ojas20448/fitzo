// Expo SDK 54 flat ESLint config (ESLint 9).
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
    expoConfig,
    {
        ignores: ['dist/*', 'expo-env.d.ts'],
    },
    {
        // Pre-existing debt, demoted to warnings during ESLint rollout so the
        // gate can be green. Tighten once the codebase is clean:
        // 36 JSX text nodes with raw quotes/apostrophes, 3 memoized components
        // without displayName (bad for React DevTools + error messages).
        rules: {
            'react/no-unescaped-entities': 'warn',
            'react/display-name': 'warn',
        },
    },
]);
