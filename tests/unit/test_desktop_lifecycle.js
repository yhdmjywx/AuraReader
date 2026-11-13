const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
    const handlers = new Map(), messages = [];
    const contents = new EventEmitter();
    Object.assign(contents, { mainFrame: { url: 'aurareader://app/index.html' },
        isDestroyed: () => window.destroyed, isCrashed: () => false,
        send: (...args) => messages.push(args) });
    const window = new EventEmitter();
    window.destroyed = false;
    window.isDestroyed = () => window.destroyed;
    Object.defineProperty(window, 'webContents', { get() {
        if (window.destroyed) throw new Error('Object has been destroyed');
        return contents;
    } });
    window.closeCalls = 0;
    window.close = () => {
        assert.equal(window.destroyed, false, 'cannot close a destroyed window');
        window.closeCalls++;
        const event = { prevented: false, preventDefault() { this.prevented = true; } };
        window.emit('close', event);
        if (!event.prevented) { window.destroyed = true; window.emit('closed'); }
    };
    let wikiSignal;
    const filename = path.resolve('src/desktop/ipc.cjs');
    const loaded = new Module(filename, module);
    loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = name => {
        if (name === 'electron') return { ipcMain: {
            handle: (name, handler) => { assert.equal(handlers.has(name), false); handlers.set(name, handler); },
            removeHandler: name => handlers.delete(name)
        }, shell: { openExternal: async () => {} } };
        if (name === '../server/wikiService.js') return { ...originalRequire(name), createWikiService: () => ({
            read: (_input, signal) => new Promise((_resolve, reject) => {
                wikiSignal = signal;
                signal.addEventListener('abort', () => reject(new Error('canceled')), { once: true });
            })
        }) };
        return originalRequire(name);
    };
    loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
    const sender = { sender: contents, senderFrame: contents.mainFrame };
    return { ...loaded.exports, window, contents, handlers, messages, sender, wikiSignal: () => wikiSignal };
}

(async () => {
    const wiki = fixture();
    const removeWiki = wiki.registerWikiIpc(wiki.window);
    const reading = wiki.handlers.get('aura:wiki:read')(wiki.sender, { id: 'pending', kind: 'article', site: 'en', title: 'Reader' });
    wiki.window.destroyed = true;
    removeWiki(); removeWiki();
    assert.equal(wiki.wikiSignal().aborted, true);
    assert.equal((await reading).ok, false);
    assert.equal(wiki.handlers.size, 0);
    assert.equal(wiki.contents.listenerCount('did-start-navigation'), 0);
    assert.equal(wiki.contents.listenerCount('render-process-gone'), 0);

    const normal = fixture();
    const dispose = normal.coordinateClose(normal.window, { settle: async () => {} });
    normal.window.once('closed', dispose);
    normal.window.close(); normal.window.close();
    assert.equal(normal.messages.length, 1, 'repeated close shares one save confirmation');
    const id = normal.messages[0][1];
    const complete = normal.handlers.get('aura:lifecycle:complete-close');
    assert.equal((await complete(normal.sender, 'forged', { ok: true })).ok, false);
    assert.equal((await complete(normal.sender, id, { ok: false, message: 'Unsaved' })).value.accepted, false);
    assert.equal(normal.window.destroyed, false, 'failed save must keep the window open');
    normal.window.close();
    const next = normal.messages.findLast(message => message[0] === 'aura:lifecycle:prepare-close')[1];
    assert.equal((await complete(normal.sender, next, { ok: true })).value.accepted, true);
    await tick();
    assert.equal(normal.window.destroyed, true);
    assert.equal(normal.handlers.size, 0);

    const scheduled = fixture();
    const removeScheduled = scheduled.coordinateClose(scheduled.window, { settle: async () => {} });
    scheduled.window.close();
    assert.equal((await scheduled.handlers.get('aura:lifecycle:complete-close')(
        scheduled.sender, scheduled.messages[0][1], { ok: true })).value.accepted, true);
    scheduled.window.destroyed = true; removeScheduled(); await tick();
    assert.equal(scheduled.window.closeCalls, 1, 'a queued close rechecks window lifetime');

    for (const crash of [false, true]) {
        const late = fixture();
        late.contents.isCrashed = () => crash;
        let release;
        const settle = new Promise(resolve => { release = resolve; });
        const remove = late.coordinateClose(late.window, { settle: () => settle });
        late.window.close();
        const completion = !crash && late.handlers.get('aura:lifecycle:complete-close')(
            late.sender, late.messages[0][1], { ok: true });
        late.window.destroyed = true; remove(); remove(); release();
        if (completion) assert.equal((await completion).ok, false, 'expired close cannot be accepted');
        await tick(); await tick();
        assert.equal(late.window.closeCalls, 1, 'late callbacks cannot touch the destroyed window');
    }
    console.log('PASS: destroyed-window cleanup, Wiki cancellation, repeated/failed/forged close and late save/crash callbacks');
})().catch(error => { console.error(error); process.exitCode = 1; });
