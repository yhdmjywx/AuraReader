const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createDataStore } = require('../../src/server/dataStore');
const { backupDatabase, verifyDatabase } = require('../../src/server/storageMaintenance');
const { assertRuntime } = require('../../src/desktop/runtime.cjs');

async function verifyRuntime(directory) {
    const versions = assertRuntime();
    const book = { id: 'desktop-runtime', title: 'Electron SQLite 探测', pages: ['<p>原文😀</p>'], unknown: { intact: true } };
    let store = createDataStore(directory);
    try {
        assert.equal(store.one('PRAGMA journal_mode').journal_mode, 'wal');
        assert.equal(store.one('PRAGMA foreign_keys').foreign_keys, 1);
        assert.equal(Object.values(store.one('PRAGMA busy_timeout'))[0], 5000);
        const command = { opId: randomUUID(), expected: 0, book };
        const revision = store.saveBook(command);
        assert.deepEqual(store.saveBook(command), revision);
        assert.throws(() => store.saveBook({ ...command, book: { ...book, title: 'conflict' } }), /操作 ID/);
        assert.throws(() => store.transaction(() => {
            store.run('UPDATE books SET payload=? WHERE id=?', '{}', book.id);
            throw new Error('rollback probe');
        }), /rollback probe/);
        assert.deepEqual(store.books()[0].value, book);
        const note = { id: 'n', bookId: book.id, quote: '原文😀', comment: '备份\n内容😀', unknown: [null, 1] };
        store.saveNote({ opId: randomUUID(), expected: 0, generation: revision.generation, note });
        const backup = await backupDatabase(directory);
        assert.deepEqual(verifyDatabase(backup.filename), { integrity: 'ok', books: 1, notes: 1 });
        const readonly = new DatabaseSync(backup.filename, { readOnly: true });
        try {
            assert.deepEqual(JSON.parse(readonly.prepare('SELECT payload FROM books').get().payload), book);
            assert.deepEqual(JSON.parse(readonly.prepare('SELECT payload FROM annotations').get().payload), note);
            assert.throws(() => readonly.exec('DELETE FROM books'), /readonly/i);
        } finally { readonly.close(); }
        store.close();
        store = createDataStore(directory);
        assert.deepEqual(store.books()[0].value, book);
        assert.deepEqual(store.notes([book.id])[0].value, note);
        assert.deepEqual(store.check(), { integrity: 'ok', foreignKeys: 0 });
        return { ...versions, wal: true, timeout: 5000, rollback: true, idempotent: true,
            backup: true, readOnly: true, reopen: true, directory: path.resolve(directory) };
    } finally { store.close(); }
}

module.exports = { verifyRuntime };
