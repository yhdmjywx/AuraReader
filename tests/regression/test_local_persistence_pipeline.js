const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { clientStorage } = require('../helpers/sqlite');

(async () => {
    const storage = await clientStorage([{ id: 'pipeline', pages: ['<p>原文😀</p>'] }]);
    try {
        const books = await import('../../dist/client/infrastructure/bookRepository.js');
        const repo = await import('../../dist/client/infrastructure/annotationRepository.js');
        const record = { id: 'pipeline-note', bookId: 'pipeline', quote: '原文😀', comment: '笔记\n', location: { start: 0, end: 4 }, unknown: { value: 1 } };
        await repo.saveNoteToDB(record);
        assert.deepEqual(storage.read('annotations', record.id), record);
        await storage.restart(); storage.configureClient();
        assert.equal((await books.loadBookFromDB('pipeline')).pages[0], '<p>原文😀</p>');
        assert.equal((await repo.loadNotesForBook('pipeline'))[0].comment, '笔记\n');
        await books.deleteBookFromDB('pipeline');
        assert.equal(storage.read('books', 'pipeline'), undefined);
        assert.equal(storage.read('annotations', record.id), undefined);
        for (const file of ['bookRepository.js', 'annotationRepository.js']) {
            const text = fs.readFileSync(path.join('src/client/infrastructure', file), 'utf8');
            assert.ok(!/indexedDB|\.transaction\(/.test(text), '业务 Repository 不再包含 IndexedDB 访问');
        }
        console.log('✅ SQLite 持久化管道：真实保存、服务重开、完整字段、级联删除及旧业务实现清理通过');
    } finally { await storage.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
