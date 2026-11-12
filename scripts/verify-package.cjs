const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const asar = require('@electron/asar');
const ts = require('typescript');
const { getCurrentFuseWire, FuseV1Options } = require('@electron/fuses');
// Check the actual local dependency graph, so a newly imported helper cannot
// silently disappear from the desktop package's explicit resource list.
function verifyLocalDependencies(archive, entries, roots) {
    const files = new Set(entries);
    const visited = new Set();
    function visit(file) {
        if (visited.has(file)) return;
        visited.add(file);
        const source = ts.createSourceFile(file, asar.extractFile(archive, file.split('/').join(path.sep)).toString('utf8'), ts.ScriptTarget.Latest, true);
        function dependency(specifier) {
            if (!specifier.startsWith('.')) return;
            const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
            const resolved = [base, base + '.js', base + '.cjs', base + '.mjs', base + '.json', base + '/index.js']
                .find(candidate => files.has(candidate) && /\.(?:[cm]?js|json)$/.test(candidate));
            assert.ok(resolved, `Missing package dependency: ${file} -> ${specifier}`);
            if (!resolved.endsWith('.json')) visit(resolved);
        }
        function walk(node) {
            if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
                || ts.isIdentifier(node.expression) && node.expression.text === 'require')
                && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
                dependency(node.arguments[0].text);
            }
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
                && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependency(node.moduleSpecifier.text);
            if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Worker') {
                const entry = node.arguments?.[0];
                // The Node worker uses path.join(__dirname, 'publicationWorker.cjs').
                assert.ok(entry && ts.isCallExpression(entry) && entry.expression.getText(source) === 'path.join'
                    && entry.arguments.length === 2 && entry.arguments[0].getText(source) === '__dirname'
                    && ts.isStringLiteral(entry.arguments[1]), `Unverified worker path: ${file}`);
                dependency('./' + entry.arguments[1].text);
            }
            ts.forEachChild(node, walk);
        }
        walk(source);
    }
    roots.forEach(visit);
    return [...visited].sort();
}
async function verifyPackage(directory) {
    const archive = path.join(directory, 'resources/app.asar');
    const entries = asar.listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\//, ''));
    const required = ['src/desktop/main.cjs', 'src/desktop/preload.cjs',
        'dist/renderer/index.html', 'dist/renderer/fonts/literata.woff2',
        'dist/renderer/fonts/sarasa-regular.woff2', 'dist/renderer/fonts/licenses/Literata-OFL.txt',
        'src/server/dataStore.js', 'src/server/goalValidation.js', 'src/server/migration.js', 'src/server/storageMaintenance.js', 'src/server/fontStore.js',
        'node_modules/fontkit/dist/main.cjs', 'node_modules/@zip.js/zip.js/index-native.cjs',
        'src/server/publicationWorker.cjs', 'src/shared/epubPaths.mjs'];
    required.forEach(file => assert.ok(entries.includes(file), 'Missing package resource: ' + file));
    const localModules = verifyLocalDependencies(archive, entries, ['src/desktop/main.cjs', 'src/desktop/preload.cjs']);
    const html = asar.extractFile(archive, path.join('dist', 'renderer', 'index.html')).toString('utf8');
    const resources = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)].map(match => 'dist/renderer/' + match[1]);
    assert.ok(resources.some(file => file.endsWith('.js')), 'Missing renderer entry');
    resources.forEach(file => assert.ok(entries.includes(file), 'Missing built resource: ' + file));
    // Include lazy chunks, Web Workers, fonts and other runtime resources, not
    // just the entry tags in index.html. Compare against this build, byte-for-byte.
    const rendererRoot = path.resolve(__dirname, '../dist/renderer');
    const rendererResources = fs.readdirSync(rendererRoot, { recursive: true })
        .filter(file => fs.statSync(path.join(rendererRoot, file)).isFile());
    for (const file of rendererResources) {
        const entry = 'dist/renderer/' + file.split(path.sep).join('/');
        assert.ok(entries.includes(entry), 'Missing built resource: ' + entry);
        assert.ok(asar.extractFile(archive, entry.split('/').join(path.sep)).equals(fs.readFileSync(path.join(rendererRoot, file))),
            'Stale built resource: ' + entry);
    }
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
    return { passed: true, version: pkg.version, entries: entries.length, requiredResources: required.length,
        rendererResources: rendererResources.length, localModules, fuses,
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
module.exports = { verifyPackage, verifyLocalDependencies };
