// Run the current hardened executable against an isolated profile, without
// installing it. Exercise both workers and publication resources inside ASAR.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
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
    // Keep the executable outside the checkout as well as removing Node from
    // PATH, so package resolution cannot fall back to workspace/node_modules.
    const standalone = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-packaged-'));
    const executableDirectory = path.join(standalone, 'app');
    await fs.cp(directory, executableDirectory, { recursive: true });
    assert.equal((await verifyPackage(executableDirectory)).archiveSha256, contents.archiveSha256);
    const profile = path.join(output, 'profile');
    let child, exited, timer;
    let log = '', port, client, phase = 'boot';
    const launch = async () => {
        port = undefined; let currentLog = '';
        child = spawn(path.join(executableDirectory, 'AuraReader.exe'), ['--user-data-dir=' + profile, '--remote-debugging-port=0'],
            { cwd: standalone, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        exited = once(child, 'exit');
        child.stdout.on('data', bytes => { log += bytes; });
        child.stderr.on('data', bytes => {
            log += bytes; currentLog += bytes;
            const match = currentLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
            if (match) port = Number(match[1]);
        });
        timer = setTimeout(() => child.kill(), 90000);
        for (let attempt = 0; attempt < 150 && !port && child.exitCode === null; attempt++) await delay(100);
        assert.ok(port, 'packaged application starts: ' + currentLog);
        client = await connect(port);
        await client.call('Network.enable');
        await client.call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    };
    try {
        await launch();
        const waitFor = async expression => {
            const deadline = Date.now() + 20000;
            while (true) {
                try { if (await client.run('Boolean(' + expression + ')')) return; }
                catch (error) { if (!String(error).includes('Execution context was destroyed')) throw error; }
                assert.ok(Date.now() < deadline, 'Packaged EPUB timeout: ' + expression);
                await delay(50);
            }
        };
        await waitFor(`document.documentElement.dataset.desktopReady === 'setup'`);
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
        const beforeClose = await client.run(`(async () => {
            const a=await import(${JSON.stringify(mainUrl)});
            await a.reader.fonts.choose({kind:'original'});
            await a.annotations.saveModalNote({quote:'Stable quotation',comment:'Initial saved note',page:1});
            const note=a.annotations.getNotes().find(item=>item.comment==='Initial saved note');
            a.annotations.setNotesScope('book');
            a.annotations.openNoteModal(note.quote,note.id,1);
            return {noteId:note.id,book:await auraDesktop.storage.getBook({id:'book_Packaged%20compatibility.epub'}),
                goals:await auraDesktop.storage.queryGoalLibrary(),font:localStorage.getItem('aura_font_preference')};
        })()`);
        await waitFor(`document.querySelector('.note-editor')`);
        const finalText = 'Last input at packaged close\n中文😀\n';
        await client.run(`document.querySelector('.note-editor').value=${JSON.stringify(finalText)}; true`);
        console.log('Reloaded publication; requesting application close');
        phase = 'close';
        await client.run(`window.close(); true`);
        const [code] = await exited; assert.equal(code, 0, 'normal packaged shutdown');
        clearTimeout(timer); client.close();
        const db = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'), { readOnly: true });
        try {
            assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
            assert.equal(JSON.parse(db.prepare('SELECT payload FROM annotations WHERE id=?').get(beforeClose.noteId).payload).comment, finalText);
        } finally { db.close(); }
        phase = 'restart';
        await launch();
        await waitFor(`document.documentElement.dataset.reactWorkbench === 'true'`);
        const restarted = await client.run(`(async () => {
            const a=await import(${JSON.stringify(mainUrl)}); await a.coordinator.openBook('book_Packaged%20compatibility.epub');
            return {book:await auraDesktop.storage.getBook({id:'book_Packaged%20compatibility.epub'}),
                notes:await auraDesktop.storage.queryNotes({bookIds:['book_Packaged%20compatibility.epub']}),
                goals:await auraDesktop.storage.queryGoalLibrary(),font:localStorage.getItem('aura_font_preference')};
        })()`);
        assert.deepEqual(restarted.book, beforeClose.book, 'book/EPUB payload and revisions survive close/restart unchanged');
        assert.deepEqual(restarted.goals, beforeClose.goals, 'Goal relationships survive close/restart unchanged');
        assert.equal(restarted.font, beforeClose.font, 'original font preference survives restart');
        assert.equal(restarted.notes.value.records.find(row => row.id === beforeClose.noteId).value.comment, finalText);
        await waitFor(`document.querySelector('iframe.reader-document')?.contentDocument.getElementById('picture')?.naturalWidth > 0`);
        await client.run(`window.close(); true`);
        const [restartCode] = await exited; assert.equal(restartCode, 0, 'restarted application closes normally');
        assert.doesNotMatch(log, /Desktop cleanup failed:|Uncaught Exception/i, 'shutdown must complete without cleanup errors');
        const report = { passed: true, contents, state, resources, offline: true, noNodeOnPath: true,
            isolatedApplicationDirectory: true, reloaded: true, restarted: true, exitCode: code, restartCode,
            closeFlushPersisted: true, bookUnchanged: true, goalsUnchanged: true, fontPreferencePreserved: true, installed: false };
        await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
        console.log('PASS: standalone packaged EPUB workers/resources, close-time note flush, exact book/Goal/font preservation, reload, restart and both normal exits');
    } catch (error) {
        if (client && child?.exitCode === null && child.signalCode === null) {
            try {
                const diagnostic = await client.run(`(async () => {
                    const a=await import(${JSON.stringify(mainUrl)});
                    return {surface:document.documentElement.dataset.appSurface,page:a.reader.getCurrentPage(),
                        editing:a.annotations.getEditingNoteId(),scope:a.annotations.notesScope,
                        notes:a.annotations.getNotes(),sidebar:document.getElementById('react-notes')?.innerHTML};
                })()`);
                await fs.writeFile(path.join(output, 'failure-state.json'), JSON.stringify(diagnostic, null, 2));
            } catch { /* Keep the original failing assertion if the target is already gone. */ }
        }
        await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: false, phase,
            archiveSha256: contents.archiveSha256, error: String(error), exitCode: child?.exitCode, signal: child?.signalCode }, null, 2));
        throw error;
    } finally {
        clearTimeout(timer); client?.close();
        if (child?.exitCode === null && child.signalCode === null) { child.kill(); await exited; }
        await fs.writeFile(path.join(output, 'application.log'), log);
        const resolved = path.resolve(standalone);
        if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('aurareader-packaged-')) throw new Error('Unsafe test cleanup path');
        await fs.rm(resolved, { recursive: true, force: true, maxRetries: 1 });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
