const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const asar = require('@electron/asar');
const { verifyLocalDependencies } = require('../../scripts/verify-package.cjs');

(async () => {
    const parent = path.resolve('.commandcode/package-dependency-tests');
    await fs.mkdir(parent, { recursive: true });
    const directory = await fs.mkdtemp(path.join(parent, 'run-'));
    const source = path.join(directory, 'source');
    await fs.mkdir(source);
    for (const [file, contents] of Object.entries({
        'main.cjs': "const path = require('node:path'); const { Worker } = require('node:worker_threads'); new Worker(path.join(__dirname, 'worker.cjs'));",
        'worker.cjs': "import('./paths.mjs');",
        'paths.mjs': "export { value } from './value.mjs';",
        'value.mjs': 'export const value = 1;'
    })) await fs.writeFile(path.join(source, file), contents);
    const archive = path.join(directory, 'fixture.asar');
    await asar.createPackage(source, archive);
    const entries = ['main.cjs', 'worker.cjs', 'paths.mjs', 'value.mjs'];
    assert.deepEqual(verifyLocalDependencies(archive, entries, ['main.cjs']), entries.slice().sort());
    for (const missing of entries.slice(1)) {
        assert.throws(() => verifyLocalDependencies(archive, entries.filter(entry => entry !== missing), ['main.cjs']),
            /Missing package dependency/, missing + ' must not disappear from the package');
    }
    console.log('PASS: package graph follows Worker, dynamic ESM and re-exports; each missing dependency fails verification');
})().catch(error => { console.error(error); process.exitCode = 1; });
