const { execFileSync } = require('node:child_process');
const path = require('node:path');

// PGlite loads WASM with dynamic import; a plain Node process avoids Jest's VM
// module restriction while keeping this real-SQL regression in the usual suite.
test('coach profile SQL uses canonical nutrition targets and supports legacy accounts', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/coach-profile-source.spec.cjs')], { timeout: 30000 });
}, 35000);
