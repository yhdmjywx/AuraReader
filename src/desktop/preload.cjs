const { contextBridge } = require('electron');

// Stage 2 deliberately provides metadata only. No IPC, Node objects or paths
// cross the bridge; stage 3 will add individual validated business capabilities.
if (process.isMainFrame) {
    contextBridge.exposeInMainWorld('auraDesktop', Object.freeze({
        stage: 2, storageAvailable: false, platform: process.platform,
        versions: Object.freeze({ electron: process.versions.electron, node: process.versions.node })
    }));
}
