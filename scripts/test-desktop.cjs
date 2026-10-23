const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.commandcode/desktop-tests');
fs.mkdirSync(directory, { recursive: true });
const output = fs.mkdtempSync(path.join(directory, 'run-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
async function run(entry) {
    await new Promise((resolve, reject) => {
        const child = spawn(require('electron'), [path.join(root, 'tests/desktop', entry), output], {
            cwd: root, env, stdio: 'inherit', windowsHide: false
        });
        const timer = setTimeout(() => {
            child.kill(); reject(new Error(`Desktop regression exceeded 90 seconds: ${entry}`));
        }, 90000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('exit', (code, signal) => {
            clearTimeout(timer);
            if (code !== 0 || signal) reject(new Error(`Electron regression failed: ${entry}, exit=${code}, signal=${signal}; artifacts: ${output}`));
            else resolve();
        });
    });
}
(async () => {
    await run('main.cjs');
    const report = JSON.parse(fs.readFileSync(path.join(output, 'results.json'), 'utf8'));
    if (report.passed !== true) throw new Error('Desktop report did not pass');
    await run('restart.cjs');
    const restart = JSON.parse(fs.readFileSync(path.join(output, 'restart-results.json'), 'utf8'));
    if (restart.passed !== true) throw new Error('Desktop restart did not pass');
    console.log(JSON.stringify({ ...report, restart }, null, 2));
    console.log('Desktop artifacts:', output);
})().catch(error => { console.error(error); process.exitCode = 1; });
