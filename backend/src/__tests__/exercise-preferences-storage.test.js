const { execFileSync } = require('node:child_process');
const path = require('node:path');
test('exercise preferences survive storage, migrations and account isolation', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/exercise-preferences.spec.cjs')], { timeout: 45000 });
}, 50000);
