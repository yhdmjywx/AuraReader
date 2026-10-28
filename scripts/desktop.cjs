const { spawn } = require('node:child_process');
const path = require('node:path');

// Codex and some terminals inherit this switch. The desktop must run Electron,
// never its Node-only mode. Do not alter the user's persistent environment.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.resolve(__dirname, '..')], {
    cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit', windowsHide: false
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => {
    if (signal) console.error(`Electron exited on ${signal}`);
    process.exitCode = code ?? 1;
});
