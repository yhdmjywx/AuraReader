// External acceptance of the installed, hardened executable. The production app
// contains no test module/IPC. CDP is enabled only by this test's launch switch.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { verifyPackage } = require('../../scripts/verify-package.cjs');
const { createFontStore, inspectFont } = require('../../src/server/fontStore.js');
const { DatabaseSync } = require('node:sqlite');
const APP_URL = 'aurareader://app/index.html';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function connect(port) {
    let page;
    for (let attempt = 0; attempt < 150; attempt++) {
        try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.url === APP_URL); } catch { /* Endpoint starts with Chromium. */ }
        if (page) break; await delay(100);
    }
    assert.ok(page, 'Installed reader exposes its exact test target');
    const socket = new WebSocket(page.webSocketDebuggerUrl); await once(socket, 'open');
    let id = 0; const pending = new Map();
    socket.addEventListener('message', event => {
        const result = JSON.parse(event.data); const request = pending.get(result.id);
        if (!request) return; pending.delete(result.id); clearTimeout(request.timer);
        if (result.error) request.reject(new Error(JSON.stringify(result.error))); else request.resolve(result.result);
    });
    socket.addEventListener('close', () => {
        for (const request of pending.values()) {
            clearTimeout(request.timer);
            // Chromium can close its debug socket before replying to Browser.close.
            // The caller still requires process exit=0 and durable SQLite content.
            if (request.method === 'Browser.close') request.resolve({});
            else request.reject(new Error('Debug target closed during ' + request.method));
        }
        pending.clear();
    });
    return {
        async call(method, params = {}) {
            return new Promise((resolve, reject) => {
                const serial = ++id;
                const timer = setTimeout(() => { pending.delete(serial); reject(new Error('CDP timeout: ' + method)); }, 25000);
                pending.set(serial, { resolve, reject, timer, method }); socket.send(JSON.stringify({ id: serial, method, params }));
            });
        },
        async run(expression) {
            const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
            if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
            return result.result.value;
        },
        close() { socket.close(); }
    };
}
async function verifyInstalled(install, output, phase, expectedVersion) {
    const contents = await verifyPackage(install); assert.equal(contents.version, expectedVersion);
    const profile = path.join(output, 'profile');
    const env = { ...process.env, PATH: [process.env.SystemRoot + '/System32', process.env.SystemRoot,
        process.env.SystemRoot + '/System32/WindowsPowerShell/v1.0'].join(';'), NODE_OPTIONS: '--invalid-option-that-must-be-ignored' };
    delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_PATH;
    const child = spawn(path.join(install, 'AuraReader.exe'), [`--user-data-dir=${profile}`, '--remote-debugging-port=0'],
        { cwd: output, env, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = once(child, 'exit'); let log = ''; let port;
    child.stdout.on('data', bytes => { log += bytes; });
    child.stderr.on('data', bytes => { log += bytes; const match = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (match) port = Number(match[1]); });
    const watchdog = setTimeout(() => { child.kill(); }, 80000);
    let client;
    try {
        for (let attempt = 0; attempt < 150 && !port && child.exitCode === null; attempt++) await delay(100);
        assert.ok(port, 'Packaged Chromium starts without Node on PATH: ' + log);
        client = await connect(port);
        await client.call('Network.enable');
        await client.call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
        await client.run(`(async () => { const end = Date.now()+15000; while (!['library','setup','error'].includes(document.documentElement.dataset.desktopReady)) {
            if (Date.now()>end) throw new Error('Installed boot timeout'); await new Promise(r=>setTimeout(r,20)); }
            if (document.documentElement.dataset.desktopReady==='error') throw new Error(document.getElementById('desktop-status').textContent);
            if (document.documentElement.dataset.desktopReady==='setup') document.getElementById('desktop-create-library').click();
            while(document.documentElement.dataset.desktopReady!=='library') { if(Date.now()>end) throw new Error('Installed library timeout'); await new Promise(r=>setTimeout(r,20)); } })()`);
        const state = await client.run(`({ node: auraDesktop.versions.node, electron: auraDesktop.versions.electron,
            require: typeof require, process: typeof process, zip: typeof JSZip,
            resources: performance.getEntriesByType('resource').map(r=>r.name) })`);
        assert.equal(state.electron, '45.0.0'); assert.match(state.node, /^24\./);
        assert.equal(state.require, 'undefined'); assert.equal(state.process, 'undefined'); assert.equal(state.zip, 'function');
        assert.ok(state.resources.every(url => url.startsWith('aurareader://app/')));
        const resources = await client.run(`(async()=>{const files=['/styles.css','/vendor/jszip.min.js','/vendor/remixicon.woff2','/assets/fonts/literata.woff2','/assets/fonts/sarasa-regular.woff2'];
            const result=[]; for(const file of files){const r=await fetch(file); result.push({file,status:r.status,size:(await r.arrayBuffer()).byteLength});}return result;})()`);
        resources.forEach(resource => { assert.equal(resource.status, 200, resource.file); assert.ok(resource.size > 0, resource.file); });
        state.packagedResources = resources;
        if (phase === 'fresh') {
            const value = await client.run(`(async () => {
                const s=auraDesktop.storage; const book={id:'installer-current',title:'安装持久化测试',pages:['<p>安装后正文😀</p>'],unknown:{preserve:[null,1]}};
                const command={opId:crypto.randomUUID(),expected:0,book}; const saved=await s.saveBook(command);
                if (!saved.ok) throw new Error(JSON.stringify(saved));
                const replay=await s.saveBook(command); if(JSON.stringify(saved)!==JSON.stringify(replay)) throw new Error('Idempotency');
                const note={id:'installer-note',bookId:book.id,kind:'note',quote:'安装后正文😀',comment:'初始笔记',page:1,
                    location:{page:1,start:0,end:7},unknown:[false,'完整字段']};
                const n=await s.saveNote({opId:crypto.randomUUID(),expected:0,generation:saved.value.generation,note});
                if(!n.ok)throw new Error(JSON.stringify(n));
                localStorage.setItem('aura_install_preference','保留偏好😀');
                const a=await import('./main.js'); await a.coordinator.openBook(book.id); a.annotations.setNotesScope('book');
                a.annotations.openNoteModal(note.quote,note.id,1);
                const editor=document.querySelector('.note-editor'); if(!editor)throw new Error('Installed editor missing');
                editor.value='安装关闭前最后输入\\n😀\\n';
                return await s.backup(); })()`);
            assert.equal(value.ok, true); assert.equal(value.value.integrity, 'ok');
            const font = inspectFont(await fs.readFile(path.resolve('src/client/assets/fonts/literata.woff2')), 'literata.woff2');
            await client.run(`localStorage.setItem('aura_font_preference', ${JSON.stringify(JSON.stringify({kind:'imported',id:font.id,name:font.name}))}); true`);
        } else {
            const persisted = await client.run(`(async () => {const s=auraDesktop.storage;const a=await import('./main.js'); await a.reader.fonts.ready;
                await a.coordinator.openBook('installer-current'); const notes=await s.queryNotes({bookIds:['installer-current']});
                const fonts=await auraDesktop.fonts.list(); return {notes,book:a.reader.getCurrentBook(),fonts,
                    preference:localStorage.getItem('aura_install_preference'),fontChoice:a.reader.fonts.choice,failed:a.reader.fonts.failed};})()`);
            assert.equal(persisted.notes.value.records[0].value.comment, '安装关闭前最后输入\n😀\n');
            assert.deepEqual(persisted.notes.value.records[0].value.unknown, [false, '完整字段']);
            assert.deepEqual(persisted.book.unknown, { preserve: [null, 1] });
            assert.equal(persisted.preference, '保留偏好😀'); assert.equal(persisted.fonts.value.fonts.length, 1);
            assert.equal(persisted.fontChoice.kind, 'imported'); assert.equal(persisted.failed, false);
        }
        const systemFonts = await client.run('auraDesktop.fonts.system()'); assert.equal(systemFonts.ok, true); assert.ok(systemFonts.value.fonts.length > 0);
        const screenshot = await client.call('Page.captureScreenshot', { format: 'png' });
        await fs.writeFile(path.join(output, phase + '.png'), Buffer.from(screenshot.data, 'base64'));
        // Browser.close exercises application shutdown. The separately tested
        // page-close API now requests the same native flush handshake via IPC.
        await client.call('Browser.close');
        const [code] = await exited; assert.equal(code, 0);
        if (phase === 'fresh') {
            const font = await createFontStore(path.join(profile, 'data/fonts')).import(await fs.readFile(path.resolve('src/client/assets/fonts/literata.woff2')), 'literata.woff2');
            // Set preference using the next real renderer launch; font bytes are
            // a controlled fixture in the already-created current SQLite profile.
            await fs.writeFile(path.join(output, 'font.json'), JSON.stringify(font));
        }
        const db = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'), { readOnly: true });
        try {
            assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
            assert.equal(JSON.parse(db.prepare('SELECT payload FROM annotations WHERE id=?').get('installer-note').payload).comment, '安装关闭前最后输入\n😀\n');
        } finally { db.close(); }
        const result = { passed: true, phase, profile, noNodeOnPath: true, offline: true, state, contents };
        await fs.writeFile(path.join(output, phase + '.json'), JSON.stringify(result, null, 2));
        return result;
    } finally {
        clearTimeout(watchdog); client?.close();
        await fs.writeFile(path.join(output, phase + '.log'), log);
        if (child.exitCode === null) child.kill();
    }
}
module.exports = { verifyInstalled, connect };
