const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('activity days work against isolated PostgreSQL storage', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/activity-timezone.spec.cjs')], { timeout: 45000 });
}, 50000);
