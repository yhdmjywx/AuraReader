const { app, BrowserWindow, Menu, dialog, protocol, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { assertRuntime } = require('./runtime.cjs');
const { APP_URL, createAssetHandler } = require('./assets.cjs');
const { secureSession, secureWindow } = require('./security.cjs');
const { createDesktopStorage } = require('./storage.cjs');
const { desktopProfile } = require('./libraryPath.cjs');
const { registerStorageIpc, registerFileIpc, registerWikiIpc, coordinateClose, windowSurfaceColors, workbenchOverlayHeight } = require('./ipc.cjs');
const { createFileService } = require('./files.cjs');

protocol.registerSchemesAsPrivileged([{
    scheme: 'aurareader', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

/** @param {{profileDirectory?: string, dialogs?: import('./dialogs.js').DialogPort}} [options] */
async function startDesktop({ profileDirectory, dialogs } = {}) {
    assertRuntime();
    app.setName('AuraReader');
    // Honor Electron's explicit profile switch for isolated acceptance and user-
    // selected data locations. Renderer cannot change this main-process setting.
    const profile = desktopProfile(app.getPath('appData'), profileDirectory || app.commandLine.getSwitchValue('user-data-dir'));
    if (app.isPackaged) {
        const relative = path.relative(path.dirname(process.execPath), path.resolve(profile));
        const outside = relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
        if (!outside) throw new Error("The user data directory must be outside the installation directory.");
    }
    fs.mkdirSync(profile, { recursive: true });
    app.setPath('userData', profile);
    app.setPath('sessionData', profile);
    app.setAppUserModelId('org.aurareader.desktop');
    if (!app.requestSingleInstanceLock()) { app.quit(); return null; }
    /** @type {import('electron').BrowserWindow | null} */
    let window = null;
    app.on('second-instance', () => {
        if (window && !window.isDestroyed()) {
            if (window.isMinimized()) window.restore();
            window.show(); window.focus();
        }
    });
    await app.whenReady();
    Menu.setApplicationMenu(null);
    const desktopSession = session.defaultSession;
    secureSession(desktopSession);
    window = new BrowserWindow({
        title: 'AuraReader', width: 1440, height: 960, minWidth: 800, minHeight: 600,
        backgroundColor: windowSurfaceColors.light, show: false,
        ...(process.platform === 'win32' ? {
            accentColor: windowSurfaceColors.light,
            titleBarStyle: 'hidden',
            // Match the midpoint of the gutter and the 52px workbench slot.
            titleBarOverlay: { height: workbenchOverlayHeight, color: '#00000000', symbolColor: '#767680' }
        } : {}),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'), session: desktopSession,
            nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
            contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false,
            allowRunningInsecureContent: false, devTools: false
        }
    });
    secureWindow(window);
    const owner = window;
    const dataDirectory = path.join(app.getPath('userData'), 'data');
    const files = createFileService({ dataDirectory,
        protectedDirectories: [dataDirectory, ...(app.isPackaged ? [path.dirname(process.execPath)] :
            [path.resolve(__dirname, '..'), path.resolve(__dirname, '../../dist')])],
        dialogs: dialogs || { open: options => dialog.showOpenDialog(owner, options), save: options => dialog.showSaveDialog(owner, options) }
    });
    const storage = createDesktopStorage(dataDirectory);
    desktopSession.protocol.handle('aurareader', await createAssetHandler(path.resolve(__dirname, '../..'), files.fontResource, storage.publicationResource));
    const removeStorageHandlers = registerStorageIpc(window, storage);
    const removeFileHandlers = registerFileIpc(window, files);
    const removeWikiHandlers = registerWikiIpc(window);
    const removeCloseHandlers = coordinateClose(window, { ...storage, async settle() { await storage.settle(); await files.settle(); } });
    window.once('closed', () => {
        // A cleanup error must not leave the database or worker alive. Keep the
        // error visible while completing the remaining independent disposals.
        for (const dispose of [removeStorageHandlers, removeFileHandlers, removeWikiHandlers, removeCloseHandlers, () => storage.close()]) {
            try { dispose(); } catch (error) { console.error('Desktop cleanup failed:', error); }
        }
    });
    app.on('window-all-closed', () => app.quit());
    window.webContents.on('preload-error', (_event, _file, error) => {
        console.error('Desktop preload failed:', error);
        dialog.showErrorBox("AuraReader startup failed", "The secure preload could not be loaded. Preserve existing data and reinstall the application.");
        app.exit(1);
    });
    await window.loadURL(APP_URL);
    window.show();
    return window;
}

module.exports = { startDesktop };
