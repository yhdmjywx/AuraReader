/** @type {import('electron-builder').Configuration} */
module.exports = {
    appId: 'org.aurareader.desktop',
    productName: 'AuraReader',
    executableName: 'AuraReader',
    directories: { output: 'release', buildResources: 'build' },
    electronVersion: '45.0.0',
    electronDist: 'node_modules/electron/dist',
    asar: true,
    npmRebuild: false, // All production modules are JS; SQLite is built into Electron.
    files: [
        'package.json', 'LICENSE',
        'dist/renderer/**/*',
        'src/desktop/**/*.cjs', 'src/desktop/renderer/**/*',
        'src/server/dataStore.js', 'src/server/fontStore.js',
        'src/server/wikiService.js', 'src/shared/wikiSites.js',
        'src/server/goalLibrary.js', 'src/server/goalValidation.js', 'src/server/migration.js',
        'src/server/storageMaintenance.js'
    ],
    extraFiles: [{ from: '.commandcode/package-resources/THIRD-PARTY-NOTICES.txt', to: 'THIRD-PARTY-NOTICES.txt' },
        { from: 'LICENSE', to: 'LICENSE-AuraReader.txt' }],
    electronFuses: {
        runAsNode: false, enableNodeOptionsEnvironmentVariable: false,
        enableNodeCliInspectArguments: false, onlyLoadAppFromAsar: true,
        enableEmbeddedAsarIntegrityValidation: true
    },
    win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'build/icon.ico' },
    nsis: {
        oneClick: false, perMachine: false, allowElevation: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true, createStartMenuShortcut: true,
        shortcutName: 'AuraReader', runAfterFinish: true,
        deleteAppDataOnUninstall: false, differentialPackage: false,
        artifactName: 'AuraReader-Setup-${version}-${arch}.${ext}'
    },
    publish: null
};
