const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { sqliteServer } = require('../helpers/sqlite');

(async () => {
    const server = await sqliteServer({ bootstrap: false });
    try {
        const book = { id: 'legacy', title: '旧书', readerFlow: 'chapter', pages: ['<h1>章</h1><p>原文😀</p><p>另一段</p>'], toc: [{ title: '章', page: 1 }], extra: { nested: [null, true, 3] } };
        const note = { id: 'note', bookId: book.id, quote: '原文😀\n另一段', comment: '旧内容', page: 1, location: { start: 1, end: 9 }, unknown: { original: '保留' } };
        const removed = { ...note, id: 'deleted' };
        const essay = { ...note, id: 'essay', quote: '', comment: '历史独立随笔' };
        const latest = { ...note, comment: '未写入的新内容\n' };
        const snapshot = {
            origin: 'http://localhost:8095', indexedDB: { books: [book], notes: [note, removed, essay] },
            caches: { legacy: JSON.stringify([{ ...note, comment: '更旧的缓存' }]) },
            pending: { legacy: JSON.stringify([
                { id: 'note', bookId: 'legacy', operation: 'save', version: 'v1', note: latest },
                { id: 'deleted', bookId: 'legacy', operation: 'delete', version: 'v2' }
            ]) }, builtins: { books: [{ id: 'crisis-era', pages: ['示例正文'] }], notes: [{ id: 'seed', bookId: 'crisis-era', quote: '示例', comment: '示例关联' }] }
        };
        assert.equal((await server.request('books')).status, 423, '未迁移来源不得读取空 SQLite');
        const archived = await server.request('migration/snapshot', snapshot);
        assert.equal(archived.status, 200);
        const files = await fs.readdir(path.join(server.directory, 'migration-snapshots'));
        const dir = path.join(server.directory, 'migration-snapshots', files[0], archived.snapshotId);
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'indexedDB.json'), 'utf8')), snapshot.indexedDB);
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'pending.json'), 'utf8')), snapshot.pending);
        await server.restart();
        assert.equal((await server.request('migration/status')).completed, false, '上传后中断不能错误切换');
        assert.equal((await server.request('books')).status, 423);
        assert.equal((await server.request('migration/snapshot', snapshot)).snapshotId, archived.snapshotId);
        const migrated = await server.request('migration/commit', { snapshotId: archived.snapshotId });
        assert.equal(migrated.status, 200, JSON.stringify(migrated));
        assert.equal(migrated.manifest.books, 2);
        assert.equal(migrated.manifest.notes, 3);
        assert.equal(migrated.manifest.deleted, 1);
        assert.deepEqual((await server.request('books')).records.find(r => r.id === book.id).value, book);
        const records = (await server.request('notes/query', { bookIds: ['legacy'] })).records;
        assert.deepEqual(records.find(n => n.id === 'note').value, latest);
        assert.deepEqual(records.find(n => n.id === 'essay').value, essay);
        assert.equal(records.find(n => n.id === 'deleted').deleted, true);
        assert.deepEqual(await server.request('migration/commit', { snapshotId: archived.snapshotId }), migrated);
        await server.restart();
        assert.equal((await server.request('migration/status')).completed, true);
        assert.equal((await server.request('notes/query', { bookIds: ['crisis-era'] })).records[0].value.id, 'seed');

        async function conflict(snapshotValue, source) {
            const headers = { 'X-Aura-Source': source };
            const saved = await server.request('migration/snapshot', snapshotValue, headers);
            assert.equal(saved.status, 200);
            const result = await server.request('migration/commit', { snapshotId: saved.snapshotId }, headers);
            assert.equal(result.status, 409, JSON.stringify(result));
            assert.ok(result.details.length);
            assert.equal((await server.request('migration/status', undefined, headers)).completed, false);
            assert.equal((await server.request('books', undefined, headers)).status, 423);
        }
        await conflict({ ...snapshot, indexedDB: { books: [{ ...book, pages: ['不同正文'] }], notes: [] }, caches: {}, pending: {} }, 'different-book');
        await conflict({ ...snapshot, indexedDB: { books: [], notes: [{ ...note, bookId: 'missing' }] }, caches: {}, pending: {} }, 'orphan');
        await conflict({ ...snapshot, caches: { legacy: JSON.stringify([{ ...note, id: 'cache-only' }]) } }, 'uncertain-cache');
        await conflict({ ...snapshot, pending: { legacy: '{broken' } }, 'damaged-buffer');
        assert.deepEqual((await server.request('books')).records.find(r => r.id === book.id).value, book, '冲突不能改变已迁移书库');
        console.log('✅ SQLite 迁移：独立原始快照、完整对象／章节、待写覆盖／删除、旧随笔、示例关联、中断重试与冲突阻断通过');
    } finally { await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
