const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { sqliteServer } = require('../helpers/sqlite');
const { createDataStore, digest } = require('../../src/server/dataStore');
const { createMigration } = require('../../src/server/migration');

(async () => {
    const notes = [
        { id: 'recovered-note', bookId: 'crisis-era', quote: '引用一', comment: '原笔记😀\n', extra: { keep: true } },
        { id: 'recovered-highlight', bookId: 'crisis-era', quote: '引用二', comment: '', page: 1 }
    ];
    const resident = { id: 'resident', bookId: 'deep-work', quote: '正文', comment: '正常笔记' };
    const snapshot = {
        origin: 'http://localhost:8095',
        indexedDB: { books: [], notes: [resident, { id: 'other', bookId: 'crisis-era', comment: '其他笔记' }] },
        caches: { 'deep-work': JSON.stringify([resident, ...notes]) }, pending: {},
        builtins: { books: [{ id: 'deep-work', pages: ['正文'] }, { id: 'crisis-era', pages: ['引用一引用二'] }], notes: [] }
    };
    const cacheRecoveries = notes.map(note => ({ id: note.id, cacheBookId: 'deep-work', targetBookId: note.bookId, recordHash: digest(note) }));
    const server = await sqliteServer({ bootstrap: false });
    let store;
    try {
        const saved = await server.request('migration/snapshot', snapshot);
        const unapproved = await server.request('migration/commit', { snapshotId: saved.snapshotId, cacheRecoveries });
        assert.equal(unapproved.status, 409, 'HTTP 请求不能自行批准缓存恢复');
        assert.deepEqual(server.read('annotations'), []);
        store = createDataStore(server.directory);
        const migration = createMigration(store);
        assert.throws(() => migration.commit('test-source', saved.snapshotId, { cacheRecoveries: [{ ...cacheRecoveries[0], recordHash: 'changed' }] }), /迁移发现冲突/);
        const result = migration.commit('test-source', saved.snapshotId, { cacheRecoveries });
        assert.equal(result.completed, true);
        assert.equal(result.manifest.notes, 4);
        notes.forEach(note => assert.deepEqual(server.read('annotations', note.id), note));
        assert.deepEqual(server.read('annotations', resident.id), resident);
        assert.deepEqual(migration.commit('test-source', saved.snapshotId), result, '重载无需重复批准');
        const dir = path.join(server.directory, 'migration-snapshots', digest('test-source'), saved.snapshotId);
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'caches.json'), 'utf8')), snapshot.caches, '原始缓存快照保持完整');
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'resolution.json'), 'utf8')).cacheRecoveries, cacheRecoveries);
        assert.equal(result.manifest.cleanup.caches['deep-work'], digest(snapshot.caches['deep-work']), '清理使用原缓存的精确散列');
        store.close(); store = null;
        await server.restart();
        assert.equal((await server.request('migration/status')).completed, true);
        notes.forEach(note => assert.deepEqual(server.read('annotations', note.id), note));
        for (const [source, changed] of [
            ['pending-delete', { ...snapshot, pending: { 'crisis-era': JSON.stringify([{ id: notes[0].id, bookId: 'crisis-era', operation: 'delete', version: 'delete' }]) } }],
            ['duplicate', { ...snapshot, caches: { ...snapshot.caches, 'crisis-era': JSON.stringify([notes[0]]) } }]
        ]) {
            const archived = await server.request('migration/snapshot', changed, { 'X-Aura-Source': source });
            store = createDataStore(server.directory);
            assert.throws(() => createMigration(store).commit(source, archived.snapshotId, { cacheRecoveries }), /迁移发现冲突/, '涉及删除或其他副本时不能套用原恢复决定');
            assert.equal(createMigration(store).status(source).completed, false);
            store.close(); store = null;
        }
        console.log('✅ 缓存冲突恢复：精确批准、完整字段、独立记录、原始快照、重试重启及删除/重复保护通过');
    } finally { store?.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
