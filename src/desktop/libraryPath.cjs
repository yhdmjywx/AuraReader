const path = require('node:path');

/** @param {string} appData @param {string} [override] */
function desktopProfile(appData, override) {
    const directory = override || path.join(appData, 'AuraReader');
    if (!path.isAbsolute(directory)) throw new Error("The user data directory must use an absolute path.");
    return path.resolve(directory);
}

module.exports = { desktopProfile };
