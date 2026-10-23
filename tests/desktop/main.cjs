// Runs inside real Electron main, with a visible native BrowserWindow.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');
const { app, BrowserWindow, net } = require('electron');
const { startDesktop } = require('../../src/desktop/main.cjs');
const { APP_URL } = require('../../src/desktop/assets.cjs');
const { verifyRuntime } = require('./runtime.cjs');

const output = path.resolve(process.argv[2]);
const checks = [];
const errors = [];
const requested = [];
app.on('web-contents-created', (_event, contents) => {
    contents.on('console-message', details => { if (['warning', 'error'].includes(details.level)) errors.push(details.message); });
    contents.on('did-fail-load', (_event, code, message, url) => errors.push(`${code}: ${message} ${url}`));
    contents.on('did-start-navigation', (_event, url) => requested.push(url));
});
const watchdog = setTimeout(() => { console.error('Electron checks timed out'); app.exit(1); }, 75000);

(async () => {
    const profile = path.join(output, 'profile');
    const window = await startDesktop({ profileDirectory: profile });
    assert.ok(window);
    const runtime = await verifyRuntime(path.join(output, 'runtime-storage'));
    checks.push('real Electron SQLite: WAL, timeout, complete JSON, rollback, idempotency, backup, readOnly, reopen');
    assert.equal(window.isVisible(), true);
    assert.equal(window.webContents.getURL(), APP_URL);
    assert.equal(app.getPath('userData'), profile);
    assert.equal(app.getPath('sessionData'), profile);
    const wc = window.webContents;
    const run = source => wc.executeJavaScript(source, true);
    const state = await run(`(async () => {
        await document.fonts.load('16px remixicon');
        await document.fonts.load('16px Literata');
        await document.fonts.load('16px "Sarasa Gothic SC"');
        return { ready: document.documentElement.dataset.desktopReady,
            bridge: window.auraDesktop, bridgeFrozen: Object.isFrozen(window.auraDesktop),
            require: typeof require, process: typeof process, Buffer: typeof Buffer,
            controls: [...document.querySelectorAll('button, input, select, textarea')]
                .filter(e => e.id !== 'btn-theme-toggle').every(e => e.disabled),
            icons: document.fonts.check('16px remixicon'),
            literals: document.fonts.check('16px Literata'),
            chinese: document.fonts.check('16px "Sarasa Gothic SC"'),
            resources: performance.getEntriesByType('resource').map(r => r.name),
            status: document.getElementById('desktop-status').textContent };
    })()`);
    assert.equal(state.ready, 'true');
    assert.equal(state.require, 'undefined'); assert.equal(state.process, 'undefined'); assert.equal(state.Buffer, 'undefined');
    assert.equal(state.bridgeFrozen, true);
    assert.deepEqual(Object.keys(state.bridge).sort(), ['platform', 'stage', 'storageAvailable', 'versions']);
    assert.equal(state.bridge.storageAvailable, false); assert.equal(state.bridge.stage, 2);
    assert.equal(state.bridge.versions.electron, runtime.electron);
    assert.ok(state.controls && state.icons && state.literals && state.chinese);
    assert.match(state.status, /本地书库暂未接入/);
    assert.ok(state.resources.every(url => url.startsWith('aurareader://app/')));
    assert.ok(!state.resources.some(url => url.includes('/api/')));
    assert.deepEqual(errors, [], 'No initial load or renderer errors');
    const preferences = wc.getLastWebPreferences();
    for (const key of ['sandbox', 'contextIsolation', 'webSecurity']) assert.equal(preferences[key], true, key);
    for (const key of ['nodeIntegration', 'nodeIntegrationInWorker', 'nodeIntegrationInSubFrames', 'webviewTag']) assert.equal(preferences[key], false, key);
    checks.push('visible native window, isolated profile, DOM ready, Node absent, metadata-only bridge, disabled unavailable actions');
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
    await run(`document.getElementById('btn-theme-toggle').click()`);
    assert.equal(await run(`document.body.classList.contains('theme-dark')`), true);
    await capture('shell-dark.png');
    assert.equal(await run(`getComputedStyle(document.getElementById('book-paper')).backgroundColor`), 'rgb(24, 34, 52)');
    checks.push('theme interaction and native renderer screenshots');

    for (const [url, status] of [['/main.js?v=15', 200], ['/assets/fonts/inventory.json', 200],
        ['/package.json', 404], ['/data/aurareader.sqlite', 404], ['/api/storage/session', 404]]) {
        const response = await net.fetch(new URL(url, APP_URL).href);
        assert.equal(response.status, status, url);
        assert.ok(response.headers.get('Content-Security-Policy'));
    }
    checks.push('actual protocol resources and denial of package/data/API routes');
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
    assert.equal(await run(`document.documentElement.dataset.desktopReady`), 'true');
    assert.deepEqual(errors.slice(offlineErrors), []);
    checks.push('offline shell reload without HTTP service');
    const report = { passed: true, runtime, checks, profile,
        actualGui: true, screenshots: ['shell-light.png', 'shell-dark.png'],
        limitations: ['Stage 2 shell only; no library IPC, native file operations or installer acceptance'] };
    // Keep app alive until the report is durable, then test the normal close path.
    const closed = once(window, 'closed');
    const holdQuit = event => event.preventDefault();
    app.on('before-quit', holdQuit);
    const quitting = new Promise(resolve => app.once('before-quit', () => resolve(true)));
    window.close(); await closed; await quitting;
    checks.push('normal last-window close triggers application quit');
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    clearTimeout(watchdog);
    app.removeListener('before-quit', holdQuit);
    app.quit();
})().catch(async error => {
    console.error(error);
    await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), stack: error.stack, checks, errors, requested }, null, 2));
    clearTimeout(watchdog); app.exit(1);
});
