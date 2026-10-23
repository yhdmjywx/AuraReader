const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');
const { BrowserWindow } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const { APP_URL } = require('../../src/desktop/assets.cjs');

async function verifyStorage(window, profile, checks) {
    const wc = window.webContents;
    const run = source => wc.executeJavaScript(source, true);
    const result = await run(`(async () => {
        const s = auraDesktop.storage;
        const book = { id: 'desktop-ipc', title: '桌面 IPC 阅读回归', pages: ['<p>原文😀 第一段完整文本。</p><p>第二段。</p>'],
            unknown: { preserved: [false, null, '完整字段'] } };
        const command = { opId: crypto.randomUUID(), expected: 0, book };
        const saved = await s.saveBook(command);
        const replay = await s.saveBook(command);
        const changedOp = await s.saveBook({ ...command, book: { ...book, title: 'wrong' } });
        const invalid = await s.saveBook({ ...command, path: 'C:/arbitrary' });
        const note = { id: 'desktop-ipc-note', bookId: book.id, quote: '原文😀', comment: '完整\\n笔记😀\\n',
            kind: 'note', location: { page: 1, start: 0, end: 4 }, unknown: [1, null] };
        const noteCommand = { opId: crypto.randomUUID(), expected: 0, generation: saved.value.generation, note };
        const noteSaved = await s.saveNote(noteCommand);
        const stale = await s.saveNote({ ...noteCommand, opId: crypto.randomUUID() });
        const queried = await s.queryNotes({ bookIds: [book.id] });
        const backup = await s.backup();
        const badRestore = await s.restore({ opId: crypto.randomUUID(), books: [{ id: 'must-rollback', pages: [] }],
            notes: [{ ...note, id: 'orphan', bookId: 'missing' }] });
        const restoredBook = { ...book, id: 'desktop-restored' };
        const restoredNote = { ...note, id: 'desktop-restored-note', bookId: restoredBook.id };
        const restored = await (await import('./infrastructure/storageClient.js')).restoreRecords([restoredBook], [restoredNote]);
        const restoredNotes = await s.queryNotes({ bookIds: [restoredBook.id] });
        const books = await s.listBooks();
        const forgedClose = await auraDesktop.lifecycle.completeClose('forged', { ok: true });
        return { book, note, saved, replay, changedOp, invalid, noteSaved, stale, queried, backup, badRestore, books, forgedClose,
            restoredBook, restoredNote, restored, restoredNotes };
    })()`);
    assert.equal(result.saved.ok, true); assert.deepEqual(result.saved, result.replay);
    assert.equal(result.changedOp.error.status, 409); assert.equal(result.invalid.error.status, 400);
    assert.equal(result.noteSaved.ok, true); assert.equal(result.stale.error.status, 409);
    assert.deepEqual(result.queried.value.records[0].value, result.note);
    assert.deepEqual(result.books.value.records.find(row => row.id === result.book.id).value, result.book);
    assert.equal(result.backup.value.integrity, 'ok'); assert.equal(result.badRestore.error.status, 409);
    assert.ok(!result.books.value.records.some(row => row.id === 'must-rollback'));
    assert.deepEqual(result.restored, { books: 1, notes: 1 });
    assert.deepEqual(result.books.value.records.find(row => row.id === result.restoredBook.id).value, result.restoredBook);
    assert.deepEqual(result.restoredNotes.value.records[0].value, result.restoredNote);
    assert.equal(result.forgedClose.error.status, 409);
    checks.push('actual IPC: complete payloads, CAS, same-op replay, invalid fields, backup, repository restore success/rollback and forged close denial');

    // Same preload and same URL in a second window still cannot access storage.
    const outsider = new BrowserWindow({ show: false, webPreferences: {
        preload: path.resolve(__dirname, '../../src/desktop/preload.cjs'),
        sandbox: true, contextIsolation: true, nodeIntegration: false, session: wc.session
    } });
    await outsider.loadURL(APP_URL);
    const denied = await outsider.webContents.executeJavaScript('auraDesktop.storage.status()');
    assert.equal(denied.error.status, 403);
    for (const capability of ['auraDesktop.files.chooseBook()', 'auraDesktop.fonts.list()', 'auraDesktop.window.toggleFullscreen()', 'auraDesktop.lifecycle.requestClose()']) {
        assert.equal((await outsider.webContents.executeJavaScript(capability)).error.status, 403);
    }
    outsider.destroy();
    await wc.loadURL(APP_URL + '?untrusted');
    assert.equal((await run('auraDesktop.storage.status()')).error.status, 403);
    assert.equal((await run('auraDesktop.files.chooseBook()')).error.status, 403);
    assert.equal((await run('auraDesktop.lifecycle.requestClose()')).error.status, 403);
    await wc.loadURL(APP_URL);
    await run(`(async () => { while (document.documentElement.dataset.desktopReady !== 'library')
        await new Promise(resolve => setTimeout(resolve, 20)); })()`);
    checks.push('actual IPC sender checks: second window and non-exact top-level URL rejected');

    await run(`(async () => {
        const app = await import('./main.js'); await app.coordinator.openBook('desktop-ipc');
        app.annotations.setNotesScope('book');
        app.annotations.openNoteModal('原文😀', 'desktop-ipc-note', 1);
        const editor = document.querySelector('.note-editor');
        if (!editor) throw new Error('Actual editor missing');
        editor.value = '实际 DOM 输入\\n第二行😀\\n'; editor.dispatchEvent(new Event('input', { bubbles: true }));
        await app.annotations.finishInlineEdit(); await app.annotations.assertInlineWritesSaved();
        await (await import('./infrastructure/storageClient.js')).drainStorage();
    })()`);
    const db = new DatabaseSync(path.join(profile, 'data/aurareader.sqlite'), { readOnly: true });
    try {
        const note = JSON.parse(db.prepare('SELECT payload FROM annotations WHERE id=?').get('desktop-ipc-note').payload);
        assert.equal(note.comment, '实际 DOM 输入\n第二行😀\n');
        assert.deepEqual(note.unknown, [1, null]);
    } finally { db.close(); }
    checks.push('existing coordinator, real inline editor input and repositories persist through IPC to actual SQLite');

    // A pending journal entry survives reload and blocks close until the existing
    // repository has acknowledged its exact command. Never clear it to pass.
    await run(`(async () => {
        const row = (await auraDesktop.storage.queryNotes({ bookIds: ['desktop-ipc'] })).value.records[0];
        const book = (await auraDesktop.storage.listBooks()).value.records.find(row => row.id === 'desktop-ipc');
        const note = { ...row.value, comment: '待写恢复\\n😀' };
        const version = crypto.randomUUID();
        const command = { opId: version, expected: row.revision, generation: book.generation, note };
        localStorage.setItem('aura_notes_pending_desktop-ipc', JSON.stringify([{ id: note.id, bookId: note.bookId,
            operation: 'save', note, version, durable: true, command }]));
    })()`);
    await wc.loadURL(APP_URL);
    await run(`(async () => { while (document.documentElement.dataset.desktopReady !== 'library')
        await new Promise(resolve => setTimeout(resolve, 20));
        window.__cancelledClose = null;
        auraDesktop.lifecycle.onCloseCancelled(message => { window.__cancelledClose = message; });
    })()`);
    window.close();
    await run(`(async () => { while (!window.__cancelledClose) await new Promise(resolve => setTimeout(resolve, 20)); })()`);
    assert.equal(window.isDestroyed(), false);
    assert.equal(await run(`document.body.inert`), false);
    assert.ok(await run(`localStorage.getItem('aura_notes_pending_desktop-ipc')`));
    const recovered = await run(`(async () => {
        const notes = await (await import('./infrastructure/annotationRepository.js')).loadNotesForBook('desktop-ipc');
        return { comment: notes.find(note => note.id === 'desktop-ipc-note').comment,
            pending: localStorage.getItem('aura_notes_pending_desktop-ipc') };
    })()`);
    assert.equal(recovered.comment, '待写恢复\n😀'); assert.equal(recovered.pending, null);
    checks.push('pending journal survives reload, prevents window close, then replays through existing repository without data reset');
}

module.exports = { verifyStorage };
