const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.commandcode/desktop-tests');
fs.mkdirSync(directory, { recursive: true });
const output = fs.mkdtempSync(path.join(directory, 'run-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
async function run(entry, args = []) {
    await new Promise((resolve, reject) => {
        const child = spawn(require('electron'), [path.join(root, 'tests/desktop', entry), output, ...args], {
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
    const selected = process.argv[2];
    if (selected) {
        if (!['main.cjs','restart.cjs','note-interaction.cjs','goal-interaction.cjs','goal-home.cjs','goal-lifecycle.cjs'].includes(selected)) throw new Error('Unknown desktop test: ' + selected);
        await run(selected, process.argv.slice(3));
        console.log('Desktop artifacts:', output);
        return;
    }
    await run('main.cjs');
    const report = JSON.parse(fs.readFileSync(path.join(output, 'results.json'), 'utf8'));
    if (report.passed !== true) throw new Error('Desktop report did not pass');
    await run('restart.cjs');
    const restart = JSON.parse(fs.readFileSync(path.join(output, 'restart-results.json'), 'utf8'));
    if (restart.passed !== true) throw new Error('Desktop restart did not pass');
    await run('note-interaction.cjs');
    const notes = JSON.parse(fs.readFileSync(path.join(output, 'note-interaction-results.json'), 'utf8'));
    if (notes.passed !== true) throw new Error('Desktop note interaction did not pass');
    await run('goal-interaction.cjs');
    const goals = JSON.parse(fs.readFileSync(path.join(output, 'goal-results.json'), 'utf8'));
    if (goals.passed !== true) throw new Error('Goal desktop report did not pass');
    await run('goal-home.cjs');
    const home = JSON.parse(fs.readFileSync(path.join(output, 'home-results.json'), 'utf8'));
    if (home.passed !== true) throw new Error('Goal home desktop report did not pass');
    await run('goal-home.cjs', ['import-first']);
    const homeImport = JSON.parse(fs.readFileSync(path.join(output, 'home-import-results.json'), 'utf8'));
    if (homeImport.passed !== true) throw new Error('Goal home import-first report did not pass');
    await run('goal-lifecycle.cjs');
    const lifecycle = JSON.parse(fs.readFileSync(path.join(output, 'lifecycle-results.json'), 'utf8'));
    if (lifecycle.passed !== true) throw new Error('Goal lifecycle desktop report did not pass');
    console.log(JSON.stringify({ ...report, restart, notes, goals, home, homeImport, lifecycle }, null, 2));
    console.log('Desktop artifacts:', output);
})().catch(error => { console.error(error); process.exitCode = 1; });
