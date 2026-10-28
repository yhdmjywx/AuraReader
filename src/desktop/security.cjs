/** @param {import('electron').Session} session */
function secureSession(session) {
    session.setPermissionCheckHandler(() => false);
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.setDevicePermissionHandler(() => false);
    session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
    session.on('will-download', event => event.preventDefault());
    session.webRequest.onBeforeRequest((details, callback) => {
        let allowed = false;
        try {
            const url = new URL(details.url);
            allowed = url.protocol === 'aurareader:' && url.host === 'app' && !url.username && !url.password;
            if (details.resourceType === 'image' && ['data:', 'blob:'].includes(url.protocol)) allowed = true;
        } catch { /* Malformed and external requests are denied. */ }
        callback({ cancel: !allowed });
    });
}

/** @param {import('electron').BrowserWindow} window */
function secureWindow(window) {
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-frame-navigate', event => event.preventDefault());
    window.webContents.on('will-redirect', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
}

module.exports = { secureSession, secureWindow };
