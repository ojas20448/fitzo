const { execFileSync } = require('node:child_process');
const path = require('node:path');

// PGlite loads WASM outside Jest's VM, matching coach-profile-source.test.js.
test('registration and exercise browsing survive production acceptance edge cases', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/migration-acceptance.spec.cjs')], { timeout: 30000 });
}, 35000);
