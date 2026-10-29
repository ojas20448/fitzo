const { execFileSync } = require('node:child_process');
const path = require('node:path');
test('AI accounting survives module reloads and shares one allowance across paid calls', () => {
    execFileSync(process.execPath, [path.join(__dirname, '../../tests/ai-quota-storage.spec.cjs')], { timeout: 30000 });
}, 35000);
