const { rmSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const output = resolve(root, 'dist');
if (output !== join(root, 'dist')) throw new Error('Unexpected build output path');
rmSync(output, { recursive: true, force: true });
const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', join(root, 'tsconfig.json')], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
