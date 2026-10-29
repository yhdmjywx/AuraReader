const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
require('./build.cjs');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2] || 'all';
if (!['all', 'unit', 'regression', 'syntax', 'migration'].includes(mode)) throw new Error('Unknown test mode');
if (mode === 'all' || mode === 'regression' || mode === 'migration') {
    execFileSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'inherit' });
}
let failed = 0, count = 0;
function run(args) {
    count++;
    try { execFileSync(process.execPath, args, { cwd: root, stdio: mode === 'migration' ? ['ignore', 'pipe', 'inherit'] : 'inherit' }); if (mode === 'migration') console.log('PASS:', args.join(' ')); }
    catch (error) { failed++; console.error('FAILED:', args.join(' ')); if (mode === 'migration') console.error(String(error.stdout || '') + String(error.stderr || '')); if (error.code) console.error(error.code); }
}
if (mode === 'migration') {
    for (const file of ['unit/test_chapter_flow.js', 'unit/test_goals.js', 'unit/test_goal_lifecycle.js', 'unit/test_fonts.js',
        'regression/test_html_and_dom_audit.js', 'regression/test_desktop_assets.js', 'regression/test_reader_runtime.js',
        'regression/test_app_navigation.js', 'regression/test_goal_interaction.js', 'regression/test_goal_home.js',
        'regression/test_goal_cross_book.js', 'regression/test_goal_lifecycle.js', 'regression/test_shelf_popover.js',
        'regression/test_export_panel.js', 'regression/test_chapter_export_menu.js', 'regression/test_mini_tooltip_interaction.js']) run(['tests/' + file]);
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
