const { ipcMain, shell } = require('electron');
const { randomUUID } = require('node:crypto');
const { StorageError } = require('../server/dataStore.js');
const { APP_URL } = require('./assets.cjs');
const { createWikiService, validateWikiRequest } = require('../server/wikiService.js');
const { wikiExternalUrl } = require('../shared/wikiSites.js');

/** @param {import('electron').BrowserWindow} window */
function registerWikiIpc(window) {
    const wiki = createWikiService();
    /** @type {Map<string, AbortController>} */
    const requests = new Map();
    const actions = ['read', 'cancel', 'openExternal'];
    for (const action of actions) ipcMain.handle('aura:wiki:' + action, async (event, ...args) => {
        try {
            assertSender(event, window);
            if (args.length !== 1) throw new Error('Invalid Wikipedia argument count.');
            if (action === 'openExternal') {
                await shell.openExternal(wikiExternalUrl(args[0]));
                return { ok: true, value: undefined };
            }
            if (action === 'cancel') {
                if (typeof args[0] !== 'string') throw new Error('Invalid Wikipedia request identifier.');
                requests.get(args[0])?.abort();
                return { ok: true, value: undefined };
            }
            const input = validateWikiRequest(args[0]);
            if (requests.has(input.id)) throw new Error('Duplicate Wikipedia request.');
            const controller = new AbortController();
            requests.set(input.id, controller);
            try {
                const value = await wiki.read(input, controller.signal);
                assertSender(event, window);
                return { ok: true, value };
            } finally { requests.delete(input.id); }
        } catch (error) {
            return { ok: false, error: { status: 502, message: error instanceof Error ? error.message : 'Wikipedia is unavailable.' } };
        }
    });
    const cancelAll = () => { requests.forEach(controller => controller.abort()); requests.clear(); };
    window.webContents.on('did-start-navigation', cancelAll);
    window.webContents.on('render-process-gone', cancelAll);
    return () => {
        cancelAll();
        actions.forEach(action => ipcMain.removeHandler('aura:wiki:' + action));
        window.webContents.removeListener('did-start-navigation', cancelAll);
        window.webContents.removeListener('render-process-gone', cancelAll);
    };
}

/** @param {import('electron').IpcMainInvokeEvent} event @param {import('electron').BrowserWindow} window */
function assertSender(event, window) {
    if (window.isDestroyed() || event.sender !== window.webContents || !event.senderFrame
        || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== APP_URL) {
        throw new StorageError("Only registered reader windows may access local services.", 403);
    }
}

/** @param {unknown} error */
function failure(error, fallback = "Local library operation failed. Existing data has been preserved.") {
    if (error instanceof StorageError) return { ok: false, error: { message: error.message, status: error.status, details: error.details } };
    console.error('Desktop service failed:', error);
    return { ok: false, error: { message: fallback, status: 500 } };
}

/** @param {import('electron').BrowserWindow} window @param {ReturnType<typeof import('./files.cjs').createFileService>} files */
function registerFileIpc(window, files) {
    const actions = ['chooseBook', 'chooseBackup', 'saveExport', 'saveExportFolder', 'listFonts', 'systemFonts', 'importFont'];
    for (const action of actions) {
        ipcMain.handle('aura:files:' + action, async (event, ...args) => {
            try {
                assertSender(event, window);
                if (args.length !== 1) throw new StorageError("Invalid argument count.");
                const value = await files.call(action, args[0], () => assertSender(event, window));
                assertSender(event, window);
                return { ok: true, value };
            } catch (error) { return failure(error, "File or font operation failed. Check file and folder permissions."); }
        });
    }
    ipcMain.handle('aura:window:fullscreen', event => {
        try {
            assertSender(event, window);
            window.setFullScreen(!window.isFullScreen());
            return { ok: true, value: { fullscreen: window.isFullScreen() } };
        } catch (error) { return failure(error, "Could not toggle window fullscreen."); }
    });
    return () => {
        actions.forEach(action => ipcMain.removeHandler('aura:files:' + action));
        ipcMain.removeHandler('aura:window:fullscreen');
    };
}

/** @param {import('electron').BrowserWindow} window @param {ReturnType<typeof import('./storage.cjs').createDesktopStorage>} storage */
function registerStorageIpc(window, storage) {
    const actions = ['status', 'createLibrary', 'listBooks', 'saveBook', 'deleteBook', 'queryGoals', 'saveGoals', 'queryGoalLibrary', 'saveGoalLibrary', 'queryNotes', 'saveNote', 'deleteNote', 'restore', 'backup'];
    for (const action of actions) {
        ipcMain.handle('aura:storage:' + action, async (event, ...args) => {
            try {
                assertSender(event, window);
                if (args.length !== 1) throw new StorageError("Invalid argument count.");
                return { ok: true, value: await storage.call(action, args[0]) };
            } catch (error) { return failure(error); }
        });
    }
    return () => actions.forEach(action => ipcMain.removeHandler('aura:storage:' + action));
}

/** @param {import('electron').BrowserWindow} window @param {ReturnType<typeof import('./storage.cjs').createDesktopStorage>} storage */
function coordinateClose(window, storage) {
    let allowed = false;
    /** @type {{id: string, frame: import('electron').WebFrameMain, timer: NodeJS.Timeout} | null} */
    let pending = null;
    /** @param {string} message */
    const cancel = message => {
        if (pending) clearTimeout(pending.timer);
        pending = null;
        if (!window.isDestroyed()) window.webContents.send('aura:lifecycle:close-cancelled', message);
    };
    window.on('close', event => {
        if (allowed) return;
        event.preventDefault();
        if (pending) return;
        // A crashed renderer cannot acknowledge a flush. Its confirmed writes
        // are already in SQLite; keep its recovery journal and let the user exit.
        if (window.webContents.isCrashed()) {
            storage.settle().then(() => { allowed = true; window.close(); })
                .catch(error => console.error("Could not close the library after the crash.", error));
            return;
        }
        if (window.webContents.mainFrame.url !== APP_URL) { cancel("The page is not ready. Closing was canceled. Keep this window open and try again."); return; }
        const id = randomUUID();
        pending = { id, frame: window.webContents.mainFrame,
            timer: setTimeout(() => cancel("Save confirmation timed out. This window remains open. Check unsaved content and try again."), 30000) };
        window.webContents.send('aura:lifecycle:prepare-close', id);
    });
    ipcMain.handle('aura:lifecycle:request-close', (event, ...args) => {
        try {
            assertSender(event, window);
            if (args.length) throw new StorageError("Close requests do not accept arguments.");
            setImmediate(() => { if (!window.isDestroyed()) window.close(); });
            return { ok: true, value: { requested: true } };
        } catch (error) { return failure(error); }
    });
    window.on('query-session-end', event => {
        if (allowed) return;
        event.preventDefault(); window.close();
    });
    ipcMain.handle('aura:lifecycle:complete-close', async (event, id, result) => {
        try {
            assertSender(event, window);
            if (!pending || pending.id !== id || event.senderFrame !== pending.frame) throw new StorageError("Invalid or expired close request.", 409);
            if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean'
                || Object.keys(result).some(key => !['ok', 'message'].includes(key))
                || (result.message !== undefined && (typeof result.message !== 'string' || result.message.length > 1000))) throw new StorageError("Invalid close result.");
            if (!result.ok) { cancel(result.message || "Some content is not confirmed saved. This window remains open."); return { ok: true, value: { accepted: false } }; }
            const request = pending;
            await storage.settle();
            if (pending !== request) throw new StorageError("Close request canceled.", 409);
            clearTimeout(request.timer); pending = null; allowed = true;
            // Let invoke deliver its response before destroying the sender.
            setImmediate(() => window.close());
            return { ok: true, value: { accepted: true } };
        } catch (error) { return failure(error); }
    });
    return () => {
        if (pending) clearTimeout(pending.timer);
        ipcMain.removeHandler('aura:lifecycle:complete-close');
        ipcMain.removeHandler('aura:lifecycle:request-close');
    };
}

module.exports = { assertSender, registerStorageIpc, registerFileIpc, registerWikiIpc, coordinateClose };
