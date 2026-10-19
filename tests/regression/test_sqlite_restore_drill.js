const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createDataStore } = require('../../src/server/dataStore');
const { createMigration } = require('../../src/server/migration');
const { backupDatabase, verifyDatabase } = require('../../src/server/storageMaintenance');

(async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-test-'));
    let store; let restored;
    try {
        store = createDataStore(directory);
        const book = { id: 'b', pages: ['<p>原样的章节😀</p>'], extra: [false, { unknown: '保留' }] };
        const note = { id: 'n', bookId: 'b', quote: '章节😀', comment: '迁移前', location: { start: 3, end: 7 } };
        const migration = createMigration(store);
        const raw = { origin: '', indexedDB: { books: [book], notes: [note] }, caches: {}, pending: {}, builtins: { books: [], notes: [] } };
        const archived = migration.snapshot('drill', raw);
        migration.commit('drill', archived.snapshotId);
        const row = store.books()[0];
        store.saveNote({ opId: randomUUID(), expected: 1, generation: row.generation, note: { ...note, comment: '迁移后新增修改' } });
        const backup = await backupDatabase(directory);
        assert.equal(backup.notes, 1); assert.equal(backup.integrity, 'ok');
        store.close(); store = null;
        await fs.rename(path.join(directory, 'aurareader.sqlite'), path.join(directory, 'preserved-original.sqlite'));
        assert.throws(() => createDataStore(directory), /禁止自动新建空书库/);
        await fs.copyFile(backup.filename, path.join(directory, 'aurareader.sqlite'));
        store = createDataStore(directory);
        assert.equal(store.notes(['b'])[0].value.comment, '迁移后新增修改', '一致性备份恢复包含切换后的修改');
        assert.deepEqual(store.books()[0].value, book);
        store.check(); store.close(); store = null;

        // Recover the pre-cutover baseline from the independently stored raw
        // snapshots into a separate SQLite file; never clear the source IDB.
        const recovery = path.join(directory, 'snapshot-recovery');
        await fs.mkdir(recovery);
        await fs.cp(path.join(directory, 'migration-snapshots'), path.join(recovery, 'migration-snapshots'), { recursive: true });
        restored = createDataStore(recovery);
        const result = createMigration(restored).commit('drill', archived.snapshotId);
        assert.equal(result.completed, true);
        assert.deepEqual(restored.books()[0].value, book);
        assert.deepEqual(restored.notes(['b'])[0].value, note);
        assert.equal(verifyDatabase(path.join(recovery, 'aurareader.sqlite')).notes, 1);
        console.log('✅ SQLite 恢复演练：在线一致性备份、切换后修改恢复、缺库阻断及独立原始快照重建通过');
    } finally {
        store?.close(); restored?.close();
        const target = path.resolve(directory);
        if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('aurareader-test-')) throw new Error('Unsafe cleanup');
        await fs.rm(target, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
