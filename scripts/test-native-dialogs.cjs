// Interactive Windows acceptance: uses real system dialogs and an isolated profile.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const parent = path.join(root, '.commandcode/desktop-native');
fs.mkdirSync(parent, { recursive: true });
const output = fs.mkdtempSync(path.join(parent, 'run-'));
console.log('Native dialog artifacts:', output);
console.log('Select book:', path.join(root, 'tests/fixtures/test.epub'));
console.log('Select font:', path.join(root, 'src/client/assets/fonts/literata.woff2'));
console.log('Save Markdown:', path.join(output, 'native.md'));
console.log('Then cancel the ZIP save dialog. Do not select personal files.');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.join(root, 'tests/desktop/native-dialogs.cjs'), output],
    { cwd: root, env, stdio: 'inherit', windowsHide: false });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code || 0; });
