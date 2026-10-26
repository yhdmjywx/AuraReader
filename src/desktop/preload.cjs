const { contextBridge, ipcRenderer } = require('electron');

// Sandboxed preload is self-contained. Channels are literals, not renderer input.
if (process.isMainFrame) {
    /** @type {import('../shared/desktop.js').DesktopBridge} */
    const bridge = {
        stage: 4, platform: process.platform,
        versions: { electron: process.versions.electron, node: process.versions.node },
        storage: {
            status: () => ipcRenderer.invoke('aura:storage:status', undefined),
            createLibrary: () => ipcRenderer.invoke('aura:storage:createLibrary', undefined),
            listBooks: () => ipcRenderer.invoke('aura:storage:listBooks', undefined),
            saveBook: command => ipcRenderer.invoke('aura:storage:saveBook', command),
            deleteBook: command => ipcRenderer.invoke('aura:storage:deleteBook', command),
            queryNotes: query => ipcRenderer.invoke('aura:storage:queryNotes', query),
            saveNote: command => ipcRenderer.invoke('aura:storage:saveNote', command),
            deleteNote: command => ipcRenderer.invoke('aura:storage:deleteNote', command),
            queryGoals: query => ipcRenderer.invoke('aura:storage:queryGoals', query),
            saveGoals: command => ipcRenderer.invoke('aura:storage:saveGoals', command),
            queryGoalLibrary: () => ipcRenderer.invoke('aura:storage:queryGoalLibrary', undefined),
            saveGoalLibrary: command => ipcRenderer.invoke('aura:storage:saveGoalLibrary', command),
            restore: command => ipcRenderer.invoke('aura:storage:restore', command),
            backup: () => ipcRenderer.invoke('aura:storage:backup', undefined)
        },
        files: {
            chooseBook: () => ipcRenderer.invoke('aura:files:chooseBook', undefined),
            chooseBackup: () => ipcRenderer.invoke('aura:files:chooseBackup', undefined),
            saveExport: input => ipcRenderer.invoke('aura:files:saveExport', input),
            saveExportFolder: input => ipcRenderer.invoke('aura:files:saveExportFolder', input)
        },
        fonts: {
            list: () => ipcRenderer.invoke('aura:files:listFonts', undefined),
            system: () => ipcRenderer.invoke('aura:files:systemFonts', undefined),
            importFont: () => ipcRenderer.invoke('aura:files:importFont', undefined)
        },
        window: { toggleFullscreen: () => ipcRenderer.invoke('aura:window:fullscreen') },
        lifecycle: {
            requestClose: () => ipcRenderer.invoke('aura:lifecycle:request-close'),
            onPrepareClose: callback => {
                /** @param {import('electron').IpcRendererEvent} _event @param {string} id */
                const listener = (_event, id) => callback(id);
                ipcRenderer.on('aura:lifecycle:prepare-close', listener);
                return () => ipcRenderer.removeListener('aura:lifecycle:prepare-close', listener);
            },
            onCloseCancelled: callback => {
                /** @param {import('electron').IpcRendererEvent} _event @param {string} message */
                const listener = (_event, message) => callback(message);
                ipcRenderer.on('aura:lifecycle:close-cancelled', listener);
                return () => ipcRenderer.removeListener('aura:lifecycle:close-cancelled', listener);
            },
            completeClose: (id, result) => ipcRenderer.invoke('aura:lifecycle:complete-close', id, result)
        }
    };
    contextBridge.exposeInMainWorld('auraDesktop', bridge);
}
