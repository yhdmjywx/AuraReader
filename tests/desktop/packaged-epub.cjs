// Run the current hardened executable against an isolated profile, without
// installing it. Exercise both workers and publication resources inside ASAR.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const asar = require('@electron/asar');
const JSZip = require('jszip');
const { connect } = require('./packaged.cjs');
const { publicationFixture } = require('../helpers/epub.cjs');
const { verifyPackage } = require('../../scripts/verify-package.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const directory = path.resolve(process.argv[2] || 'release/win-unpacked');
    const parent = path.resolve('.commandcode/packaged-epub');
    await fs.mkdir(parent, { recursive: true });
    const output = await fs.mkdtemp(path.join(parent, 'run-'));
    console.log('Packaged EPUB artifacts:', output);
    const contents = await verifyPackage(directory);
    const archive = path.join(directory, 'resources/app.asar');
    const main = asar.listPackage(archive).map(file => file.replaceAll('\\', '/')).find(file => /^\/dist\/renderer\/assets\/main-[^/]+\.js$/.test(file));
    assert.ok(main, 'current renderer application chunk');
    const mainUrl = 'aurareader://app/' + main.slice('/dist/renderer/'.length);
    const zip = await JSZip.loadAsync(await publicationFixture());
    zip.file('OPS/Styles/book.css', '@import "nested.css"; @font-face {font-family: PackageFont; src: url("../Fonts/book.woff2")} body {font-family: PackageFont}');
    zip.file('OPS/Styles/nested.css', 'p {color: rgb(12, 88, 166)}');
    zip.file('OPS/Fonts/book.woff2', await fs.readFile(path.resolve('src/client/assets/fonts/literata.woff2')));
    zip.file('OPS/package.opf', (await zip.file('OPS/package.opf').async('string')).replace('</manifest>',
        '<item id="nested-css" href="Styles/nested.css" media-type="text/css"/><item id="font" href="Fonts/book.woff2" media-type="font/woff2"/></manifest>'));
    const fixture = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
    const env = { ...process.env, PATH: [process.env.SystemRoot + '/System32', process.env.SystemRoot].join(';') };
    delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_PATH;
    const child = spawn(path.join(directory, 'AuraReader.exe'), ['--user-data-dir=' + path.join(output, 'profile'), '--remote-debugging-port=0'],
        { cwd: output, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const exited = once(child, 'exit');
    let log = '', port, client, phase = 'boot';
    child.stdout.on('data', bytes => { log += bytes; });
    child.stderr.on('data', bytes => { log += bytes; const match = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (match) port = Number(match[1]); });
    const timer = setTimeout(() => child.kill(), 90000);
    try {
        for (let attempt = 0; attempt < 150 && !port && child.exitCode === null; attempt++) await delay(100);
        assert.ok(port, 'packaged application starts: ' + log);
        client = await connect(port);
        const waitFor = async expression => {
            const deadline = Date.now() + 20000;
            while (true) {
                try { if (await client.run(expression)) return; }
                catch (error) { if (!String(error).includes('Execution context was destroyed')) throw error; }
                assert.ok(Date.now() < deadline, 'Packaged EPUB timeout: ' + expression);
                await delay(50);
            }
        };
        await waitFor(`document.documentElement.dataset.desktopReady === 'setup'`);
        await client.call('Network.enable');
        await client.call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
        await client.run(`document.getElementById('desktop-create-library').click(); true`);
        await waitFor(`document.documentElement.dataset.reactWorkbench === 'true'`);
        phase = 'import';
        const state = await client.run(`(async () => {
            const a = await import(${JSON.stringify(mainUrl)});
            const bytes = Uint8Array.from(atob(${JSON.stringify(fixture)}), c => c.charCodeAt(0));
            await a.coordinator.importBook(new File([bytes], 'Packaged compatibility.epub'));
            await a.coordinator.openBook('book_Packaged%20compatibility.epub');
            return { require: typeof require, process: typeof process, worker: typeof Worker, electron: auraDesktop.versions.electron };
        })()`);
        console.log('Imported publication through packaged Web Worker and IPC');
        phase = 'resources';
        assert.deepEqual(state, { require: 'undefined', process: 'undefined', worker: 'function', electron: '45.0.0' });
        await waitFor(`(() => {
            const d = document.querySelector('iframe.reader-document')?.contentDocument;
            return d?.getElementById('picture')?.complete && d.getElementById('picture').naturalWidth > 0
                && d.defaultView.getComputedStyle(d.getElementById('quote')).color === 'rgb(12, 88, 166)';
        })()`);
        const resources = await client.run(`(async () => {
            const d = document.querySelector('iframe.reader-document').contentDocument;
            const font = await d.fonts.load('16px PackageFont', 'Reading');
            const image = d.getElementById('picture');
            const response = await fetch(image.src);
            const a = await import(${JSON.stringify(mainUrl)});
            const book = a.reader.getCurrentBook();
            const snapshot = await auraDesktop.storage.getBook({ id: book.id });
            return { font: font.length, image: await response.text(), status: response.status,
                readiumBytes: d.querySelector('[data-publication="before"]').textContent.length,
                persisted: snapshot.ok && snapshot.value.record.value.epub.archive.length,
                workers: performance.getEntriesByType('resource').filter(r => /epubImport.worker-/.test(r.name)).map(r => r.name) };
        })()`);
        assert.equal(resources.font, 1, 'publication font loads from the packaged ZIP worker');
        assert.equal(resources.status, 200); assert.match(resources.image, /#208542/);
        assert.ok(resources.readiumBytes > 1000, 'real Readium CSS reaches reader document');
        assert.ok(resources.persisted > 1000, 'archive persisted over real desktop IPC');
        // importEpubBytes only takes its synchronous fallback when Worker is
        // absent. With the native Worker present, a persisted archive proves
        // that the Vite-built worker loaded and returned the parsed publication.
        await fs.writeFile(path.join(output, 'resources.json'), JSON.stringify({ state, resources }, null, 2));
        console.log('Verified packaged Readium, nested CSS, font and image');
        phase = 'reload';
        await client.call('Page.reload');
        await waitFor(`document.documentElement.dataset.reactWorkbench === 'true'`);
        await client.run(`(async () => { const a = await import(${JSON.stringify(mainUrl)}); await a.coordinator.openBook('book_Packaged%20compatibility.epub'); })()`);
        await waitFor(`document.querySelector('iframe.reader-document')?.contentDocument.getElementById('picture')?.naturalWidth > 0`);
        console.log('Reloaded publication; requesting application close');
        phase = 'close';
        await client.run(`window.close(); true`);
        const [code] = await exited; assert.equal(code, 0, 'normal packaged shutdown');
        const report = { passed: true, contents, state, resources, offline: true, noNodeOnPath: true,
            reloaded: true, exitCode: code, installed: false };
        await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
        console.log('PASS: packaged EPUB import worker, Readium CSS, nested publication CSS/font/image, IPC persistence, reload and normal exit');
    } catch (error) {
        await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: false, phase,
            archiveSha256: contents.archiveSha256, error: String(error), exitCode: child.exitCode, signal: child.signalCode }, null, 2));
        throw error;
    } finally {
        clearTimeout(timer); client?.close();
        if (child.exitCode === null) child.kill();
        await fs.writeFile(path.join(output, 'application.log'), log);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
