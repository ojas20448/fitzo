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
    {
        // A design-token migration once replaced ~50 hex literals with the
        // *string* 'colors.accent.violet' instead of the expression. TypeScript
        // could not see it (every color prop is typed `string`), so charts and
        // the health report shipped rendering black. This rule is the gate that
        // TS cannot be: a quoted token path is always a bug.
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "Literal[value=/^(colors|theme|typography|spacing|borderRadius)\./]",
                    message:
                        'Stringified design token. Write the expression ({colors.accent.gold}), not a quoted path.',
                },
                {
                    selector:
                        "TemplateElement[value.raw=/^(colors|theme)\.[a-zA-Z.]+$/]",
                    message:
                        'Stringified design token in a template literal. Interpolate the expression instead.',
                },
            ],
        },
    },
]);
