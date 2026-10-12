const { execFileSync } = require('node:child_process');
const path = require('node:path');
test('real SQL persists starter plans, rolls back failures and scopes previous sessions', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/starter-workout-storage.spec.cjs')], { timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
}, 35000);
