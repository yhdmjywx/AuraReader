/** @param {NodeJS.ProcessVersions} [versions] */
function assertRuntime(versions = process.versions) {
    const [major, minor] = versions.node.split('.').map(Number);
    if (!versions.electron || major < 24 || (major === 24 && minor < 15)) {
        throw new Error('AuraReader 桌面版需要内置 Node.js >= 24.15.0 的 Electron。');
    }
    if (process.platform !== 'win32' || process.arch !== 'x64') {
        throw new Error('当前桌面版本仅支持 Windows x64。');
    }
    const sqlite = require('node:sqlite');
    if (typeof sqlite.DatabaseSync !== 'function' || typeof sqlite.backup !== 'function') {
        throw new Error('此 Electron 运行时缺少所需的内置 SQLite 能力。');
    }
    return { electron: versions.electron, node: versions.node, sqlite: versions.sqlite,
        platform: process.platform, arch: process.arch };
}

module.exports = { assertRuntime };
