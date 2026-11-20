const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createDataStore } = require('../../src/server/dataStore');
const { backupDatabase, verifyDatabase } = require('../../src/server/storageMaintenance');

(async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-test-'));
    let store;
    try {
        store = createDataStore(directory);
        const book = { id: 'b', pages: ['<p>原样的章节😀</p>'], extra: [false, { unknown: '保留' }] };
        const note = { id: 'n', bookId: 'b', quote: '章节😀', comment: '初次保存', location: { start: 3, end: 7 } };
        store.restore({ opId: randomUUID(), books: [book], notes: [note] });
        const row = store.books()[0];
        const updatedNote = { ...note, comment: '备份前的修改' };
        store.saveNote({ opId: randomUUID(), expected: 1, generation: row.generation, note: updatedNote });
        const backup = await backupDatabase(directory);
        assert.equal(backup.notes, 1); assert.equal(backup.integrity, 'ok');
        assert.deepEqual(verifyDatabase(backup.filename), { integrity: 'ok', books: 1, notes: 1 });
        store.close(); store = null;
        await fs.rename(path.join(directory, 'aurareader.sqlite'), path.join(directory, 'preserved-original.sqlite'));
        assert.throws(() => createDataStore(directory), /will not be created automatically/);
        await fs.copyFile(backup.filename, path.join(directory, 'aurareader.sqlite'));
        store = createDataStore(directory);
        assert.deepEqual(store.notes(['b'])[0].value, updatedNote);
        assert.deepEqual(store.books()[0].value, book);
        store.check();
        console.log('✅ SQLite 恢复演练：在线一致性备份、完整书籍与笔记恢复、缺库阻断通过');
    } finally {
        store?.close();
        const target = path.resolve(directory);
        if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('aurareader-test-')) throw new Error('Unsafe cleanup');
        await fs.rm(target, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
