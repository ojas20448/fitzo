const { execFileSync } = require('child_process');
const path = require('path');

test('community workouts persist, filter, rank, heart and adopt against PostgreSQL', () => {
    const output = execFileSync(process.execPath, ['--test', '--test-reporter=tap', path.join(__dirname, '../../tests/published-workouts-storage.spec.cjs')], { encoding: 'utf8', timeout: 90000, env: { ...process.env, NODE_ENV: 'test' } });
    expect(output).toContain('# fail 0');
}, 95000);
