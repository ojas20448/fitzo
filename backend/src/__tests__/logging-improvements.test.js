const { execFileSync } = require('node:child_process');
const path = require('node:path');
test('real PostgreSQL queries preserve repeat portions and measure conversion and return logging', () => {
    execFileSync(process.execPath, ['--test', path.join(__dirname, '../../tests/logging-improvements.spec.cjs')], { timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
}, 35000);
