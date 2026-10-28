const { ipcMain } = require('electron');
const { randomUUID } = require('node:crypto');
const { StorageError } = require('../server/dataStore.js');
const { APP_URL } = require('./assets.cjs');

/** @param {import('electron').IpcMainInvokeEvent} event @param {import('electron').BrowserWindow} window */
function assertSender(event, window) {
    if (window.isDestroyed() || event.sender !== window.webContents || !event.senderFrame
        || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== APP_URL) {
        throw new StorageError('只允许已登记的阅读器主窗口访问本地服务', 403);
    }
}

/** @param {unknown} error */
function failure(error, fallback = '本地书库操作失败，原数据未清除') {
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
                if (args.length !== 1) throw new StorageError('无效参数数量');
                const value = await files.call(action, args[0], () => assertSender(event, window));
                assertSender(event, window);
                return { ok: true, value };
            } catch (error) { return failure(error, '文件或字体操作失败，请检查文件和目录权限'); }
        });
    }
    ipcMain.handle('aura:window:fullscreen', event => {
        try {
            assertSender(event, window);
            window.setFullScreen(!window.isFullScreen());
            return { ok: true, value: { fullscreen: window.isFullScreen() } };
        } catch (error) { return failure(error, '窗口全屏切换失败'); }
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
                if (args.length !== 1) throw new StorageError('无效参数数量');
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
                .catch(error => console.error('崩溃后的书库关闭未完成', error));
            return;
        }
        if (window.webContents.mainFrame.url !== APP_URL) { cancel('页面尚未就绪，关闭已取消；请保留窗口并重试。'); return; }
        const id = randomUUID();
        pending = { id, frame: window.webContents.mainFrame,
            timer: setTimeout(() => cancel('保存确认超时，窗口已保留；请检查未保存内容后重试。'), 30000) };
        window.webContents.send('aura:lifecycle:prepare-close', id);
    });
    ipcMain.handle('aura:lifecycle:request-close', (event, ...args) => {
        try {
            assertSender(event, window);
            if (args.length) throw new StorageError('关闭请求不接受参数');
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
            if (!pending || pending.id !== id || event.senderFrame !== pending.frame) throw new StorageError('无效或已过期的关闭请求', 409);
            if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean'
                || Object.keys(result).some(key => !['ok', 'message'].includes(key))
                || (result.message !== undefined && (typeof result.message !== 'string' || result.message.length > 1000))) throw new StorageError('无效关闭结果');
            if (!result.ok) { cancel(result.message || '存在未确认保存的内容，窗口已保留。'); return { ok: true, value: { accepted: false } }; }
            const request = pending;
            await storage.settle();
            if (pending !== request) throw new StorageError('关闭请求已取消', 409);
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

module.exports = { assertSender, registerStorageIpc, registerFileIpc, coordinateClose };
