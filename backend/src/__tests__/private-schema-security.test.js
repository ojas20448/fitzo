const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('private tables and helpers reject API roles while the backend owner keeps access', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/private-schema-security.spec.cjs')], { timeout: 30000 });
}, 35000);
