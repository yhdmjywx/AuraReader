const assert = require('node:assert/strict');
const { clientStorage } = require('../helpers/sqlite');

(async () => {
    const storage = await clientStorage();
    try {
        const { restoreRecords } = await import('../../dist/client/infrastructure/storageClient.js');
        const { loadNotesForBook, getNotesForBooks } = await import('../../dist/client/infrastructure/annotationRepository.js');
        const { deleteBookFromDB } = await import('../../dist/client/infrastructure/bookRepository.js');
        const books = [{ id: 'A', pages: ['<p>A 的原文</p>'] }, { id: 'B', pages: ['<p>B 的原文</p>'] }];
        const notes = [
            { id: 'A1', bookId: 'A', quote: 'A 的原文', comment: '笔记 A', unknown: ['完整保留'] },
            { id: 'A2', bookId: 'A', quote: 'A 的原文', comment: '', kind: 'highlight' },
            { id: 'B1', bookId: 'B', quote: 'B 的原文', comment: '笔记 B' }
        ];
        await restoreRecords(books, notes);
        assert.deepEqual((await loadNotesForBook('A')).map(n => n.id), ['A1', 'A2']);
        assert.deepEqual((await loadNotesForBook('B')).map(n => n.id), ['B1']);
        assert.deepEqual((await getNotesForBooks(['A', 'B'])).map(n => n.id), ['A1', 'A2', 'B1']);
        for (const note of notes) assert.deepEqual(storage.read('annotations', note.id), note);
        await assert.rejects(restoreRecords([{ id: 'partial', pages: ['不能部分入库'] }], [{ id: 'bad', bookId: 'missing' }]), { status: 409 });
        assert.equal(storage.read('books', 'partial'), undefined);
        await deleteBookFromDB('A');
        assert.deepEqual(await loadNotesForBook('A'), []);
        assert.deepEqual(storage.read('annotations', 'B1'), notes[2]);
        console.log('✅ 真实 SQLite 全链路：多书恢复、书籍隔离、未知字段、失败事务回滚及关联删除通过');
    } finally { await storage.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
