const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pipeline } = require('node:stream/promises');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src/connector');
const output = path.join(root, 'dist/connector');
const server = path.join(output, 'server');
const tsc = spawnSync(process.execPath, [
    require.resolve('typescript/bin/tsc'), '--project', path.join(root, 'tsconfig.connector.json')
], { stdio: 'inherit' });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

fs.mkdirSync(server, { recursive: true });
fs.copyFileSync(path.join(root, 'src/client/package.json'), path.join(output, 'modules/client/package.json'));
for (const name of fs.readdirSync(source).filter(name => name.endsWith('.cjs'))) {
    fs.copyFileSync(path.join(source, name), path.join(server, name));
}
for (const name of ['plugin.json', 'mcp.json', 'package.json', 'package-lock.json']) {
    fs.copyFileSync(path.join(source, name), path.join(output, name));
}
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
for (const name of ['src/desktop/storage.cjs', 'src/desktop/libraryPath.cjs', 'src/server/dataStore.js',
    'src/server/goalLibrary.js', 'src/server/goalValidation.js', 'src/server/storageMaintenance.js',
    'src/server/publicationResources.js', 'src/server/publicationWorkerClient.js',
    'src/server/publicationWorker.cjs', 'src/shared/epubPaths.mjs']) {
    const target = path.join(output, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, name), target);
}
if (process.argv.includes('--package')) {
    // Invoke npm's script with Node to keep the working directory and argument
    // boundaries intact on Windows, including paths with spaces.
    const npm = process.env.npm_execpath;
    if (!npm) throw new Error('Run npm run pack:connector to install the bundled runtime dependencies.');
    const install = spawnSync(process.execPath, [npm, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
        { cwd: output, stdio: 'inherit' });
    if (install.status !== 0) process.exit(install.status ?? 1);
}
console.log(output);

if (process.argv.includes('--package')) zipPackage().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

async function zipPackage() {
    const JSZip = require('jszip');
    const zip = new JSZip();
    function add(directory) {
        for (const entry of fs.readdirSync(path.join(output, directory), { withFileTypes: true })) {
            if (entry.name === '.bin') continue;
            const relative = path.join(directory, entry.name);
            if (entry.isDirectory()) add(relative);
            else if (entry.isFile()) zip.file(relative.split(path.sep).join('/'), fs.createReadStream(path.join(output, relative)));
        }
    }
    add('');
    const filename = path.join(root, 'dist/aurareader-connector.zip');
    const temporary = filename + '.tmp';
    try {
        await pipeline(zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE' }), fs.createWriteStream(temporary));
        fs.renameSync(temporary, filename);
        console.log(filename);
    } finally { fs.rmSync(temporary, { force: true }); }
}
