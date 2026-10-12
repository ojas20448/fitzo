const { execFileSync } = require('node:child_process');
const path = require('node:path');
test('readiness upsert and date queries work against isolated PostgreSQL storage', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/readiness-storage.spec.cjs')], { timeout: 30000 });
}, 35000);
