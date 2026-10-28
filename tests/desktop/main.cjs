// Runs inside real Electron main, with a visible native BrowserWindow.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');
const { app, BrowserWindow, net } = require('electron');
const { startDesktop } = require('../../src/desktop/main.cjs');
const { APP_URL } = require('../../src/desktop/assets.cjs');
const { verifyRuntime } = require('./runtime.cjs');
const { verifyStorage } = require('./storage.cjs');
const { verifyFiles } = require('./files.cjs');

const output = path.resolve(process.argv[2]);
const checks = [];
const errors = [];
const requested = [];
app.on('web-contents-created', (_event, contents) => {
    contents.on('console-message', details => { if (['warning', 'error'].includes(details.level)) errors.push(details.message); });
    contents.on('did-fail-load', (_event, code, message, url) => errors.push(`${code}: ${message} ${url}`));
    contents.on('did-start-navigation', (_event, url) => requested.push(url));
});
const watchdog = setTimeout(() => { console.error('Electron checks timed out'); app.exit(1); }, 85000);

(async () => {
    const profile = path.join(output, 'profile');
    const queues = { open: [], save: [] };
    const dialogs = Object.fromEntries(['open', 'save'].map(kind => [kind, async () => {
        assert.ok(queues[kind].length, `Unexpected ${kind} dialog`);
        return queues[kind].shift();
    }]));
    const window = await startDesktop({ profileDirectory: profile, dialogs });
    assert.ok(window);
    const runtime = await verifyRuntime(path.join(output, 'runtime-storage'));
    checks.push('real Electron SQLite: WAL, timeout, complete JSON, rollback, idempotency, backup, readOnly, reopen');
    assert.equal(window.isVisible(), true);
    assert.equal(window.webContents.getURL(), APP_URL);
    assert.equal(app.getPath('userData'), profile);
    assert.equal(app.getPath('sessionData'), profile);
    const wc = window.webContents;
    const run = source => wc.executeJavaScript(source, true);
    const waitFor = async expression => {
        await run(`(async () => { const end = Date.now() + 10000;
            while (!(${expression})) { if (Date.now() > end) throw new Error('Desktop state timeout');
                await new Promise(resolve => setTimeout(resolve, 20)); }
        })()`);
    };
    await waitFor(`document.documentElement.dataset.desktopReady === 'setup'`);
    assert.match(await run(`document.getElementById('desktop-status').textContent`), /创建此设备上的阅读书库/);
    await assert.rejects(fs.access(path.join(profile, 'data/aurareader.sqlite')));
    assert.equal((await run(`auraDesktop.storage.listBooks()`)).error.status, 423);
    await run(`document.getElementById('desktop-create-library').click()`);
    await waitFor(`document.documentElement.dataset.desktopReady === 'library'`);
    checks.push('no database before explicit create; current SQLite library created and existing app booted through IPC');
    const state = await run(`(async () => {
        await document.fonts.load('16px remixicon');
        await document.fonts.load('16px Literata');
        await document.fonts.load('16px "Sarasa Gothic SC"');
        return { ready: document.documentElement.dataset.desktopReady,
            bridge: { keys: Object.keys(window.auraDesktop), stage: window.auraDesktop.stage,
                versions: window.auraDesktop.versions }, bridgeFrozen: Object.isFrozen(window.auraDesktop),
            require: typeof require, process: typeof process, Buffer: typeof Buffer,
            controls: ['btn-import-book', 'btn-export-menu', 'btn-read-system-fonts', 'btn-import-font']
                .every(id => !document.getElementById(id).disabled),
            zip: typeof window.JSZip,
            icons: document.fonts.check('16px remixicon'),
            literals: document.fonts.check('16px Literata'),
            chinese: document.fonts.check('16px "Sarasa Gothic SC"'),
            resources: performance.getEntriesByType('resource').map(r => r.name),
            title: document.getElementById('current-book-title').textContent };
    })()`);
    assert.equal(state.ready, 'library');
    assert.equal(state.require, 'undefined'); assert.equal(state.process, 'undefined'); assert.equal(state.Buffer, 'undefined');
    assert.equal(state.bridgeFrozen, true);
    assert.deepEqual(state.bridge.keys.sort(), ['files', 'fonts', 'lifecycle', 'platform', 'stage', 'storage', 'versions', 'window']);
    assert.equal(state.bridge.stage, 4);
    assert.equal(state.zip, 'function');
    assert.equal(await run(`document.querySelector('button[title="原书字体恢复将在后续支持"]').disabled`), true);
    assert.equal(state.bridge.versions.electron, runtime.electron);
    assert.ok(state.controls && state.icons && state.literals && state.chinese);
    assert.match(state.title, /未打开书籍/);
    assert.equal(await run("document.getElementById('goal-home').hidden"), false);
    // Existing reader checks use the same explicit demo fixture after onboarding.
    await run("(async()=>{const a=await import('./main.js');await a.coordinator.openBook('crisis-era')})()");
    assert.ok(state.resources.every(url => url.startsWith('aurareader://app/')));
    assert.ok(!state.resources.some(url => url.includes('/api/')));
    assert.deepEqual(errors, [], 'No initial load or renderer errors');
    const preferences = wc.getLastWebPreferences();
    for (const key of ['sandbox', 'contextIsolation', 'webSecurity']) assert.equal(preferences[key], true, key);
    for (const key of ['nodeIntegration', 'nodeIntegrationInWorker', 'nodeIntegrationInSubFrames', 'webviewTag']) assert.equal(preferences[key], false, key);
    checks.push('visible native window, isolated profile, DOM ready, Node absent, scoped bridge, file/font/export controls enabled and local JSZip ready');
    checks.push('local CSS, Remix Icon and both reader fonts loaded; no remote resources or storage HTTP requests');
    const capture = async name => {
        await run(`(async () => {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await Promise.all(document.getAnimations().map(animation => animation.finished));
            await new Promise(resolve => requestAnimationFrame(resolve));
        })()`);
        const image = await wc.capturePage(undefined, { stayAwake: true });
        assert.equal(image.isEmpty(), false);
        await fs.writeFile(path.join(output, name), image.toPNG());
    };
    await capture('shell-light.png');
    await run(`document.getElementById('btn-export-menu').click()`);
    await capture('export-menu.png');
    await run(`document.getElementById('btn-export-chapters').click(); document.getElementById('btn-select-chapters').click()`);
    assert.equal(await run(`document.getElementById('chapter-export-custom').hidden`), false);
    await capture('chapter-export-light.png');
    await run(`document.getElementById('btn-cancel-chapter-export').click()`);
    assert.equal(await run(`document.activeElement.id`), 'btn-select-chapters');
    await run(`document.getElementById('btn-export-menu').click()`);
    await run(`document.getElementById('btn-theme-toggle').click()`);
    assert.equal(await run(`document.body.classList.contains('theme-dark')`), true);
    await capture('shell-dark.png');
    await run(`document.getElementById('btn-export-menu').click(); document.getElementById('btn-export-chapters').click(); document.getElementById('btn-select-chapters').click()`);
    await capture('chapter-export-dark.png');
    await run(`document.getElementById('btn-cancel-chapter-export').click()`);
    await run(`document.getElementById('btn-export-menu').click()`);
    assert.equal(await run(`getComputedStyle(document.querySelector('.app-header')).backgroundColor`), 'rgb(30, 41, 59)');
    assert.equal(await run(`document.getElementById('notes-panel').style.getPropertyValue('--margin-note-color').trim()`), '#e2e8f0');
    checks.push('theme interaction and native renderer screenshots');
    checks.push('inline chapter options and custom list, light/dark screenshots, no reader overlay, cancel restores focus');

    for (const [url, status] of [['/main.js?v=15', 200], ['/assets/fonts/inventory.json', 200],
        ['/package.json', 404], ['/data/aurareader.sqlite', 404], ['/api/storage/session', 404]]) {
        const response = await net.fetch(new URL(url, APP_URL).href);
        assert.equal(response.status, status, url);
        assert.ok(response.headers.get('Content-Security-Policy'));
    }
    checks.push('actual protocol resources and denial of package/data/API routes');
    await verifyStorage(window, profile, checks);
    await verifyFiles(window, output, queues, checks);
    assert.deepEqual(queues, { open: [], save: [] });
    // Permission and CSP probes run after the clean-load assertion. Their console
    // violations are expected here and do not hide errors during normal startup.
    const denied = await run(`(async () => {
        const blocked = async url => { try { await fetch(url); return false; } catch { return true; } };
        const csp = [];
        document.addEventListener('securitypolicyviolation', event => csp.push(event.violatedDirective));
        window.__inlineProbe = false;
        const inline = document.createElement('script'); inline.textContent = 'window.__inlineProbe = true'; document.body.append(inline);
        const frame = document.createElement('iframe'); frame.src = location.href; document.body.append(frame);
        const network = await blocked('http://127.0.0.1:8095/api/health');
        const file = await blocked('file:///C:/Windows/win.ini');
        const permission = await new Promise(resolve => navigator.geolocation.getCurrentPosition(() => resolve('granted'), error => resolve(error.code)));
        await new Promise(resolve => setTimeout(resolve, 100));
        frame.remove(); inline.remove();
        return { inline: window.__inlineProbe, network, file, permission, csp,
            popup: window.open('https://example.com/') === null };
    })()`);
    assert.equal(denied.inline, false); assert.ok(denied.network && denied.file && denied.popup);
    assert.equal(denied.permission, 1);
    assert.ok(denied.csp.some(value => value.startsWith('script-src')));
    assert.ok(denied.csp.some(value => value.startsWith('frame-src')));
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    checks.push('real renderer CSP: inline scripts/frames/localhost/file blocked; geolocation and popups denied');
    await run(`location.href = 'https://example.com/'`);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(wc.getURL(), APP_URL);
    checks.push('renderer external navigation denied');
    const offlineErrors = errors.length;
    await wc.session.enableNetworkEmulation({ offline: true });
    const loaded = once(wc, 'did-finish-load');
    wc.reload(); await loaded;
    await waitFor(`document.documentElement.dataset.desktopReady === 'library'`);
    assert.deepEqual(errors.slice(offlineErrors), []);
    checks.push('offline reader reload through IPC without HTTP service');
    const closeNoteId = await run(`(async () => {
        const app = await import('./main.js'); await app.coordinator.openBook('desktop-ipc');
        app.annotations.setNotesScope('book');
        const note = app.annotations.createNote({ quote: '原文😀', page: 1, location: { page: 1, start: 0, end: 4 } });
        const editor = document.querySelector('.note-editor');
        if (!editor) throw new Error('Close-time editor missing');
        editor.value = '关闭前最后输入\\n😀\\n';
        return note.id;
    })()`);
    const report = { passed: true, runtime, checks, profile,
        actualGui: true, screenshots: ['shell-light.png', 'shell-dark.png', 'export-menu.png', 'chapter-export-light.png', 'chapter-export-dark.png'],
        closeNoteId, limitations: ['Automated file tests inject main-process dialog results; native dialog operation is a separate check', 'Installer lifecycle acceptance is a separate test:install check; old database support is out of scope'] };
    // Keep app alive until the report is durable, then test the normal close path.
    const closed = once(window, 'closed');
    const holdQuit = event => event.preventDefault();
    app.on('before-quit', holdQuit);
    const quitting = new Promise(resolve => app.once('before-quit', () => resolve(true)));
    window.close(); await closed; await quitting;
    checks.push('close handshake flushes active editor and SQLite, then normal last-window close quits');
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    clearTimeout(watchdog);
    app.removeListener('before-quit', holdQuit);
    app.quit();
})().catch(async error => {
    console.error(error);
    await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), stack: error.stack, checks, errors, requested }, null, 2));
    clearTimeout(watchdog); app.exit(1);
});
