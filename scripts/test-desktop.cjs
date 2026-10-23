const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.commandcode/desktop-tests');
fs.mkdirSync(directory, { recursive: true });
const output = fs.mkdtempSync(path.join(directory, 'run-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.join(root, 'tests/desktop/main.cjs'), output], {
    cwd: root, env, stdio: 'inherit', windowsHide: false
});
// A dead renderer or hung shutdown must fail, never leave a passing test behind.
const timer = setTimeout(() => {
    console.error('Desktop regression exceeded 90 seconds.');
    child.kill(); process.exitCode = 1;
}, 90000);
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => {
    clearTimeout(timer);
    if (code !== 0 || signal) {
        console.error(`Electron regression failed: exit=${code}, signal=${signal}; artifacts: ${output}`);
        process.exitCode = 1; return;
    }
    try {
        const report = JSON.parse(fs.readFileSync(path.join(output, 'results.json'), 'utf8'));
        if (report.passed !== true) throw new Error('Desktop report did not pass');
        console.log(JSON.stringify(report, null, 2));
        console.log('Desktop artifacts:', output);
    } catch (error) { console.error(error); process.exitCode = 1; }
});
