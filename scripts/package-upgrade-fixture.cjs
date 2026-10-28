// A successor version used only to exercise NSIS upgrade behavior locally.
// It does not change package.json or publish anything.
const { build, Platform, Arch } = require('electron-builder');
const base = require('../electron-builder.cjs');
build({ targets: Platform.WINDOWS.createTarget('nsis', Arch.x64), publish: 'never',
    config: { ...base, extraMetadata: { version: '1.0.1' },
        directories: { ...base.directories, output: '.commandcode/upgrade-package' } }
}).catch(error => { console.error(error); process.exitCode = 1; });
