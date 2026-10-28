const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createDataStore } = require('../../src/server/dataStore.js');
const { backupDatabase, verifyDatabase } = require('../../src/server/storageMaintenance.js');
(async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-faults-'));
    let store;
    try {
        store = createDataStore(directory);
        const book = { id: 'confirmed', pages: ['<p>已确认原文😀</p>'], unknown: [false, null] };
        const revision = store.saveBook({ opId: 'book', expected: 0, book });
        const note = { id: 'confirmed-note', bookId: book.id, comment: '已确认笔记\n😀', unknown: { intact: true } };
        store.saveNote({ opId: 'note', expected: 0, generation: revision.generation, note });
        const baseline = store.notes([book.id])[0];
        const count = store.one('SELECT count(*) AS n FROM operations').n;
        const command = { opId: 'full-retry', expected: baseline.revision, generation: revision.generation,
            note: { ...note, comment: '容量恢复后保存😀' + 'x'.repeat(1024 * 1024) } };
        const max = store.one('PRAGMA max_page_count').max_page_count;
        store.db.exec('PRAGMA max_page_count=' + store.one('PRAGMA page_count').page_count);
        for (let attempt = 0; attempt < 2; attempt++) {
            assert.throws(() => store.saveNote(command), error => error.errcode === 13 && /full/i.test(error.message), 'SQLITE_FULL must survive automatic rollback');
            assert.equal(store.db.isTransaction, false);
            assert.deepEqual(store.notes([book.id])[0], baseline);
            assert.equal(store.one('SELECT count(*) AS n FROM operations').n, count);
            assert.deepEqual(store.check(), { integrity: 'ok', foreignKeys: 0 });
        }
        store.db.exec('PRAGMA max_page_count=' + max);
        const saved = store.saveNote(command);
        assert.deepEqual(store.saveNote(command), saved);
        assert.equal(saved.revision, baseline.revision + 1);
        const readonly = { ...command, opId: 'readonly-retry', expected: saved.revision, note: { ...note, comment: '只读解除后重试' } };
        store.db.exec('PRAGMA query_only=ON');
        assert.throws(() => store.saveNote(readonly), error => error.errcode === 8 && /readonly/i.test(error.message));
        assert.equal(store.notes([book.id])[0].value.comment, command.note.comment);
        store.db.exec('PRAGMA query_only=OFF');
        const locker = new DatabaseSync(store.filename);
        try {
            locker.exec('BEGIN IMMEDIATE');
            assert.throws(() => store.saveNote(readonly), error => error.errcode === 5 && /locked/i.test(error.message));
            assert.equal(store.db.isTransaction, false);
        } finally { locker.exec('ROLLBACK'); locker.close(); }
        assert.equal(store.saveNote(readonly).revision, saved.revision + 1);
        const backup = await backupDatabase(directory);
        assert.equal(verifyDatabase(backup.filename).integrity, 'ok');
        store.close(); store = createDataStore(directory);
        assert.deepEqual(store.notes([book.id])[0].value, readonly.note);
        assert.deepEqual(store.books()[0].value, book);
        assert.deepEqual(store.check(), { integrity: 'ok', foreignKeys: 0 });
        console.log('PASS: actual SQLITE_FULL automatic rollback, read-only and competing writer failures preserve confirmed data/op IDs; same-command retry, backup and reopen succeed');
    } finally {
        store?.close();
        const target = path.resolve(directory);
        if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('aurareader-faults-')) throw new Error('Unsafe cleanup');
        await fs.rm(target, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
