const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
require('./build.cjs');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2] || 'all';
if (!['all', 'unit', 'regression', 'syntax'].includes(mode)) throw new Error('Unknown test mode');
let failed = 0, count = 0;
function run(args) {
    count++;
    try { execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' }); }
    catch (error) { failed++; console.error('FAILED:', args.join(' ')); if (error.code) console.error(error.code); }
}
if (mode === 'all' || mode === 'syntax') {
    for (const file of fs.readdirSync(path.join(root, 'src/server')).filter(file => file.endsWith('.js'))) run(['--check', 'src/server/' + file]);
}
for (const group of ['unit', 'regression']) {
    if (mode !== 'all' && mode !== group) continue;
    const files = fs.readdirSync(path.join(root, 'tests', group)).filter(file => file.endsWith('.js') && file !== 'run_all.js').sort();
    for (const file of files) { console.log(group + '/' + file); run(['tests/' + group + '/' + file]); }
}
console.log(`Checks: ${count}, failed: ${failed}`);
if (failed) process.exitCode = 1;
