const { app, dialog } = require('electron');
const { startDesktop } = require('./main.cjs');

// Electron can load the package entry through import(), without require.main.
startDesktop().catch(error => {
    console.error('Desktop startup failed:', error);
    dialog.showErrorBox('AuraReader startup failed', error instanceof Error ? error.message : String(error));
    app.exit(1);
});
