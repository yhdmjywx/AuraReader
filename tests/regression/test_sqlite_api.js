const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { sqliteServer } = require('../helpers/sqlite');

(async () => {
    const server = await sqliteServer();
    try {
        const book = { id: 'a', title: '完整书籍', pages: ['<p>原文😀</p>'], unknown: { preserved: [1, null, ''] } };
        const command = { opId: randomUUID(), book, expected: 0 };
        const saved = await server.request('books/save', command);
        assert.equal(saved.status, 200);
        assert.deepEqual(await server.request('books/save', command), saved, '响应丢失后同一操作安全重试');
        assert.equal((await server.request('books/save', { ...command, book: { ...book, title: '不同命令' } })).status, 409);
        const note = { id: 'n', bookId: 'a', kind: 'note', quote: '原文😀', comment: '一\n二\n', location: { start: 0, end: 4 }, extra: { a: true } };
        const first = await server.request('notes/save', { opId: randomUUID(), note, expected: 0, generation: saved.generation });
        assert.equal(first.revision, 1);
        const second = await server.request('notes/save', { opId: randomUUID(), note: { ...note, comment: '最新' }, expected: 1, generation: saved.generation });
        assert.equal(second.revision, 2);
        assert.equal((await server.request('notes/save', { opId: randomUUID(), note, expected: 1, generation: saved.generation })).status, 409, '迟到版本不能覆盖最新内容');
        const remove = { opId: randomUUID(), id: 'n', bookId: 'a', expected: 2, generation: saved.generation };
        assert.equal((await server.request('notes/delete', remove)).revision, 3);
        assert.equal((await server.request('notes/delete', remove)).revision, 3);
        assert.equal((await server.request('notes/save', { opId: randomUUID(), note, expected: 2, generation: saved.generation })).status, 409, '删除后迟到保存不能复活标注');
        const highlight = { ...note, id: 'h', kind: 'highlight', comment: '' };
        assert.equal((await server.request('notes/save', { opId: randomUUID(), note: highlight, expected: 0, generation: saved.generation })).status, 200);
        assert.equal((await server.request('notes/query', { bookIds: ['other'] })).records.length, 0);
        await server.restart();
        assert.deepEqual((await server.request('books')).records[0].value, book);
        assert.deepEqual((await server.request('notes/query', { bookIds: ['a'] })).records.find(r => r.id === 'h').value, highlight);

        const badRestore = await server.request('restore', { opId: randomUUID(), books: [{ id: 'rollback', pages: ['正文'] }], notes: [{ ...note, id: 'orphan', bookId: 'missing' }] });
        assert.equal(badRestore.status, 409);
        assert.ok(!(await server.request('books')).records.some(r => r.id === 'rollback'), '批量恢复失败必须全部回滚');
        assert.equal((await server.request('books', undefined, { Origin: 'https://evil.example' })).status, 403);
        const badHost = await new Promise((resolve, reject) => {
            require('node:http').get(server.base + '/api/storage/session', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
        });
        assert.equal(badHost, 403);
        assert.equal((await server.request('books', undefined, { 'X-Aura-Token': 'bad' })).status, 403);
        assert.equal((await server.request('books/save', { opId: randomUUID(), expected: 0, book: { id: 'bad' } })).status, 400);
        assert.equal((await server.request('books/delete', { opId: randomUUID(), id: 'a', expected: 1 })).status, 200);
        assert.ok((await server.request('notes/query', { bookIds: ['a'] })).records.every(r => r.deleted));
        const recreated = await server.request('books/save', { opId: randomUUID(), book, expected: 2 });
        assert.notEqual(recreated.generation, saved.generation);
        assert.equal((await server.request('notes/save', { opId: randomUUID(), note: { ...note, id: 'late' }, expected: 0, generation: saved.generation })).status, 409);
        const db = new DatabaseSync(path.join(server.directory, 'aurareader.sqlite'), { readOnly: true });
        assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0); db.close();
        console.log('✅ SQLite API：真实文件、重开、完整 JSON、CAS、重试去重、删除屏障、事务回滚及访问限制通过');
    } finally { await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
