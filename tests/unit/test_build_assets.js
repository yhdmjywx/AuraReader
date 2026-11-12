const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Worker: NodeWorker } = require('node:worker_threads');
const { publicationFixture } = require('../helpers/epub.cjs');

(async () => {
    const { readiumStyles } = await import('../../dist/client/features/reader/readiumStyles.js');
    for (const [variant, directory] of Object.entries({ ltr: '', rtl: 'rtl/', cjk: 'cjk-horizontal/', vertical: 'cjk-vertical/' })) {
        for (const [role, name] of Object.entries({ before: 'before', defaults: 'default', after: 'after' })) {
            const filename = require.resolve(`@readium/css/css/dist/${directory}ReadiumCSS-${name}.css`);
            assert.equal(readiumStyles[variant][role], fs.readFileSync(filename, 'utf8'), `${variant}/${role}: complete upstream CSS`);
        }
    }
    // Execute the emitted worker with a browser-message bridge, rather than
    // taking the no-Worker fallback. This catches stale .ts URLs in dist/client.
    const prior = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
    globalThis.Worker = class {
        constructor(url) {
            assert.equal(url.pathname.endsWith('/epubImport.worker.js'), true);
            this.worker = new NodeWorker(`
                const { parentPort } = require('node:worker_threads');
                globalThis.self = { postMessage: message => parentPort.postMessage(message) };
                const ready = import(${JSON.stringify(url.href)});
                parentPort.on('message', async data => { await ready; self.onmessage({ data }); });
            `, { eval: true });
            this.worker.on('message', data => this.onmessage({ data }));
            this.worker.on('error', error => this.onerror(error));
        }
        postMessage(bytes, transfer) { this.worker.postMessage(bytes, transfer); }
        terminate() { void this.worker.terminate(); }
    };
    try {
        const { importEpubBytes } = await import('../../dist/client/infrastructure/epubImport.js');
        const fixture = await publicationFixture();
        const bytes = Uint8Array.from(fixture).buffer;
        const result = await importEpubBytes(bytes);
        assert.equal(bytes.byteLength, 0, 'input transfers to worker');
        assert.equal(result.title, 'P0 publication');
        assert.equal(result.chapters.length, 2);
        assert.deepEqual(Buffer.from(result.epub.archive, 'base64'), fixture);
    } finally {
        if (prior) Object.defineProperty(globalThis, 'Worker', prior); else delete globalThis.Worker;
    }
    console.log('PASS: all 12 raw styles retain exact bytes; emitted worker imports ZIP/XML/shared ESM and returns the real publication');
})().catch(error => { console.error(error); process.exitCode = 1; });
