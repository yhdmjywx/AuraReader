const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const asar = require('@electron/asar');
const { getCurrentFuseWire, FuseV1Options } = require('@electron/fuses');
async function verifyPackage(directory) {
    const archive = path.join(directory, 'resources/app.asar');
    const entries = asar.listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\//, ''));
    const required = ['src/desktop/main.cjs', 'src/desktop/preload.cjs', 'dist/client/desktop.js', 'dist/client/main.js',
        'src/client/index.html', 'src/client/styles.css', 'src/client/assets/fonts/literata.woff2',
        'src/client/assets/fonts/sarasa-regular.woff2', 'src/client/assets/fonts/licenses/Literata-OFL.txt',
        'src/server/dataStore.js', 'src/server/migration.js', 'src/server/storageMaintenance.js', 'src/server/fontStore.js',
        'node_modules/jszip/dist/jszip.min.js', 'node_modules/remixicon/fonts/remixicon.woff2', 'node_modules/fontkit/dist/main.cjs'];
    required.forEach(file => assert.ok(entries.includes(file), 'Missing package resource: ' + file));
    for (const entry of entries) {
        assert.ok(!/^(data|tests|docs|\.git|\.commandcode)\//.test(entry), 'Private/development file: ' + entry);
        assert.ok(!/^node_modules\/(electron|electron-builder|typescript|jsdom)\//.test(entry), 'Development dependency: ' + entry);
        assert.ok(!/^src\/server\/(server|storageApi)\.js$/.test(entry), 'HTTP server in desktop package');
        assert.ok(!entry.endsWith('.sqlite') && !entry.endsWith('.epub'), 'User data/test fixture in package');
    }
    const pkg = JSON.parse(asar.extractFile(archive, 'package.json'));
    assert.equal(pkg.main, 'src/desktop/main.cjs');
    const fuses = await getCurrentFuseWire(path.join(directory, 'AuraReader.exe'));
    for (const name of ['RunAsNode', 'EnableNodeOptionsEnvironmentVariable', 'EnableNodeCliInspectArguments']) assert.equal(fuses[FuseV1Options[name]], 48, name);
    for (const name of ['OnlyLoadAppFromAsar', 'EnableEmbeddedAsarIntegrityValidation']) assert.equal(fuses[FuseV1Options[name]], 49, name);
    for (const file of ['LICENSE.electron.txt', 'LICENSES.chromium.html', 'LICENSE-AuraReader.txt', 'THIRD-PARTY-NOTICES.txt']) assert.ok(fs.statSync(path.join(directory, file)).size > 0, file);
    return { passed: true, version: pkg.version, entries: entries.length, requiredResources: required.length, fuses,
        archiveSha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex') };
}
if (require.main === module) verifyPackage(path.resolve(process.argv[2] || 'release/win-unpacked'))
    .then(result => {
        console.log(JSON.stringify(result, null, 2));
        const parent = path.resolve(process.argv[2] || 'release/win-unpacked', '..');
        const name = `AuraReader-Setup-${result.version}-x64.exe`;
        const installer = path.join(parent, name);
        if (fs.existsSync(installer)) {
            const sha256 = createHash('sha256').update(fs.readFileSync(installer)).digest('hex');
            fs.writeFileSync(installer + '.sha256', sha256 + '  ' + name + '\n');
            fs.writeFileSync(path.join(parent, 'package-verification.json'), JSON.stringify({ ...result, installer: { name, sha256, bytes: fs.statSync(installer).size } }, null, 2));
        }
    }).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { verifyPackage };
