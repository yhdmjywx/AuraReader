/** @param {NodeJS.ProcessVersions} [versions] */
function assertRuntime(versions = process.versions) {
    const [major, minor] = versions.node.split('.').map(Number);
    if (!versions.electron || major < 24 || (major === 24 && minor < 15)) {
        throw new Error("AuraReader Desktop requires Electron with Node.js >= 24.15.0.");
    }
    if (process.platform !== 'win32' || process.arch !== 'x64') {
        throw new Error("This desktop version supports Windows x64 only.");
    }
    const sqlite = require('node:sqlite');
    if (typeof sqlite.DatabaseSync !== 'function' || typeof sqlite.backup !== 'function') {
        throw new Error("This Electron runtime lacks the required built-in SQLite support.");
    }
    return { electron: versions.electron, node: versions.node, sqlite: versions.sqlite,
        platform: process.platform, arch: process.arch };
}

module.exports = { assertRuntime };
