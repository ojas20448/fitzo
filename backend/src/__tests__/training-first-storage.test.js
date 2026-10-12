const { execFileSync } = require('node:child_process');
const path = require('node:path');
test('real SQL supports training-only completion, safe routine replacement and preference removal', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/training-first-storage.spec.cjs')], { timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
}, 35000);
