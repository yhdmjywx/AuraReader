const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { app } = require('electron');
const { startDesktop } = require('../../src/desktop/main.cjs');
const output = path.resolve(process.argv[2]);
const checks = [];
const timer = setTimeout(() => { console.error('Native dialog acceptance timed out'); app.exit(1); }, 10 * 60 * 1000);
(async () => {
    // No injected DialogPort: every prompt below is an actual Windows dialog.
    const profile = path.join(output, 'profile');
    const window = await startDesktop({ profileDirectory: profile });
    const run = code => window.webContents.executeJavaScript(code, true);
    await run(`(async () => { while (document.documentElement.dataset.desktopReady !== 'setup') await new Promise(r => setTimeout(r, 20));
        document.getElementById('desktop-create-library').click();
        while (document.documentElement.dataset.desktopReady !== 'library') await new Promise(r => setTimeout(r, 20)); })()`);
    await window.webContents.session.enableNetworkEmulation({ offline: true });
    console.log('NATIVE STEP 1: select tests/fixtures/test.epub');
    const book = await run(`(async () => { const a = await import('./main.js'); const f = await import('./infrastructure/desktopFiles.js');
        const file = await f.chooseDesktopFile('book'); if (!file) throw new Error('Book selection canceled');
        await a.coordinator.importBook(file); return a.reader.getCurrentBook(); })()`);
    assert.equal(book.title, 'test'); assert.ok(book.pages.length >= 12);
    checks.push('actual native open dialog selects EPUB; existing parser persists it to current SQLite while offline');
    console.log('NATIVE STEP 2: select src/client/assets/fonts/literata.woff2');
    const font = await run(`(async () => { const a = await import('./main.js'); await a.reader.fonts.importFile();
        return { failed: a.reader.fonts.failed, choice: a.reader.fonts.choice, count: a.reader.fonts.imported.length }; })()`);
    assert.equal(font.choice.kind, 'imported'); assert.equal(font.failed, false); assert.equal(font.count, 1);
    checks.push('actual native font dialog; imported FontFace loads offline');
    console.log('NATIVE STEP 3: save Markdown to ' + path.join(output, 'native.md'));
    const toast = await run(`(async () => { const a = await import('./main.js');
        await a.backup.exportMarkdown(a.reader.getCurrentBook().title, []); return document.getElementById('toast-msg').textContent; })()`);
    assert.match(toast, /已保存/);
    assert.match(await fs.readFile(path.join(output, 'native.md'), 'utf8'), /《test》/);
    checks.push('actual native save dialog creates Markdown; disk bytes and success feedback verified');
    console.log('NATIVE STEP 4: cancel chapter directory dialog');
    const cancel = await run(`(async () => { const a = await import('./main.js');
        await a.backup.exportChapters(a.reader.getCurrentBook(), []); return document.getElementById('toast-msg').textContent; })()`);
    assert.equal(cancel, '已取消保存');
    checks.push('actual native cancel returns to reader without false success');
    const database = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'), { readOnly: true });
    try {
        assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        assert.equal(JSON.parse(database.prepare('SELECT payload FROM books WHERE id=?').get(book.id).payload).pages.length, book.pages.length);
    } finally { database.close(); }
    const image = await window.webContents.capturePage(undefined, { stayAwake: true });
    await fs.writeFile(path.join(output, 'native-reader.png'), image.toPNG());
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: true, nativeDialogs: true, injectedDialogs: false,
        checks, profile, bookId: book.id, fontId: font.choice.id, sqliteIntegrity: 'ok' }, null, 2));
    console.log('NATIVE PASSED:', output); clearTimeout(timer); window.close();
})().catch(async error => {
    console.error(error);
    await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ passed: false, error: String(error), checks }, null, 2));
    clearTimeout(timer); app.exit(1);
});
