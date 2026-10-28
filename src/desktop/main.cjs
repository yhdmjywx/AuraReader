const { app, BrowserWindow, Menu, dialog, protocol, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { assertRuntime } = require('./runtime.cjs');
const { APP_URL, createAssetHandler } = require('./assets.cjs');
const { secureSession, secureWindow } = require('./security.cjs');
const { createDesktopStorage } = require('./storage.cjs');
const { registerStorageIpc, registerFileIpc, coordinateClose } = require('./ipc.cjs');
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
    const profile = profileDirectory || app.commandLine.getSwitchValue('user-data-dir') || path.join(app.getPath('appData'), 'AuraReader');
    if (!path.isAbsolute(profile)) throw new Error('用户数据目录必须使用绝对路径。');
    if (app.isPackaged) {
        const relative = path.relative(path.dirname(process.execPath), path.resolve(profile));
        const outside = relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
        if (!outside) throw new Error('用户数据目录必须位于安装目录之外。');
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
        backgroundColor: '#f8fafc', show: false,
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
    desktopSession.protocol.handle('aurareader', await createAssetHandler(path.resolve(__dirname, '../..'), files.fontResource));
    const storage = createDesktopStorage(dataDirectory);
    const removeStorageHandlers = registerStorageIpc(window, storage);
    const removeFileHandlers = registerFileIpc(window, files);
    const removeCloseHandlers = coordinateClose(window, { ...storage, async settle() { await storage.settle(); await files.settle(); } });
    window.once('closed', () => {
        removeStorageHandlers(); removeFileHandlers(); removeCloseHandlers(); storage.close();
    });
    app.on('window-all-closed', () => app.quit());
    window.webContents.on('preload-error', (_event, _file, error) => {
        console.error('Desktop preload failed:', error);
        dialog.showErrorBox('AuraReader 启动失败', '安全隔离入口加载失败，请保留现有数据并重新安装应用。');
        app.exit(1);
    });
    await window.loadURL(APP_URL);
    window.show();
    return window;
}

if (require.main === module) {
    startDesktop().catch(error => {
        console.error('Desktop startup failed:', error);
        dialog.showErrorBox('AuraReader 启动失败', error instanceof Error ? error.message : String(error));
        app.exit(1);
    });
}

module.exports = { startDesktop };
