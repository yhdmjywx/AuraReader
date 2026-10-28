const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app } = require('electron');
const { startDesktop } = require('../../src/desktop/main.cjs');

const output = path.resolve(process.argv[2]);
const timer = setTimeout(() => app.exit(1), 30000);
(async () => {
    const previous = JSON.parse(await fs.readFile(path.join(output, 'results.json'), 'utf8'));
    const window = await startDesktop({ profileDirectory: previous.profile });
    const result = await window.webContents.executeJavaScript(`(async () => {
        while (document.documentElement.dataset.desktopReady !== 'library') await new Promise(resolve => setTimeout(resolve, 20));
        return await auraDesktop.storage.queryNotes({ bookIds: ['desktop-ipc'] });
    })()`);
    assert.equal(result.ok, true);
    assert.equal(result.value.records.find(row => row.id === previous.closeNoteId).value.comment, '关闭前最后输入\n😀\n');
    const files = JSON.parse(await fs.readFile(path.join(output, 'file-results.json'), 'utf8'));
    const persisted = await window.webContents.executeJavaScript(`(async () => {
        const a = await import('./main.js'); await a.reader.fonts.ready;
        const books = await auraDesktop.storage.listBooks();
        return { books: books.value.records.map(r => r.id), fontId: a.reader.fonts.choice.id,
            failed: a.reader.fonts.failed, imported: a.reader.fonts.imported.map(f => f.id) };
    })()`);
    assert.ok(persisted.books.includes(files.imported.id));
    assert.equal(persisted.fontId, files.fontId); assert.equal(persisted.failed, false);
    assert.ok(persisted.imported.includes(files.fontId));
    await fs.writeFile(path.join(output, 'restart-results.json'), JSON.stringify({ passed: true, closeFlushPersisted: true,
        importedBookAndFontPersisted: true }));
    clearTimeout(timer);
    window.close();
})().catch(error => { console.error(error); clearTimeout(timer); app.exit(1); });
