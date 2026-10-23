const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createDesktopStorage, command } = require('../../src/desktop/storage.cjs');

(async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-desktop-test-'));
    const directory = path.join(temporary, 'data');
    let service = createDesktopStorage(directory);
    try {
        assert.deepEqual(await service.call('status'), { initialized: false });
        await assert.rejects(fs.access(directory));
        await assert.rejects(service.call('listBooks'), { status: 423 });
        await Promise.all([service.call('createLibrary'), service.call('createLibrary')]);
        assert.deepEqual(await service.call('status'), { initialized: true });
        const count = (await service.call('listBooks')).records.length;
        await service.call('createLibrary');
        assert.equal((await service.call('listBooks')).records.length, count);
        const book = { id: 'ipc-test', pages: ['<p>完整😀正文</p>'], extra: { fields: [false, null, ''] } };
        const c = { opId: randomUUID(), expected: 0, book };
        const version = await service.call('saveBook', c);
        assert.deepEqual(await service.call('saveBook', c), version);
        await assert.rejects(service.call('saveBook', { ...c, book: { ...book, extra: 'different' } }), { status: 409 });
        for (const body of [{ ...c, opId: randomUUID(), path: 'secret' }, { opId: 'x', book },
            { ...c, expected: -1 }, { ...c, book: { ...book, extra: undefined } },
            { ...c, book: { ...book, extra: new Date() } }]) {
            await assert.rejects(service.call('saveBook', body), { status: 400 });
        }
        assert.throws(() => command({ text: 'x'.repeat(100) }, ['text'], 32), { status: 413 });
        const cyclic = {}; cyclic.self = cyclic;
        assert.throws(() => command({ value: cyclic }, ['value']), { status: 400 });
        assert.throws(() => command({ value: Array(2) }, ['value']), { status: 400 });
        const note = { id: 'ipc-note', bookId: book.id, quote: '完整😀', comment: '原文\n笔记😀\n', location: { page: 1, start: 0, end: 4 }, extra: { intact: true } };
        const save = { opId: randomUUID(), expected: 0, generation: version.generation, note };
        await service.call('saveNote', save);
        assert.deepEqual((await service.call('queryNotes', { bookIds: [book.id] })).records[0].value, note);
        await assert.rejects(service.call('queryNotes', { bookIds: [''] }), { status: 400 });
        await assert.rejects(service.call('restore', { opId: randomUUID(), books: [{ id: 'rollback', pages: [] }], notes: [{ ...note, id: 'orphan', bookId: 'missing' }] }), { status: 409 });
        assert.ok(!(await service.call('listBooks')).records.some(row => row.id === 'rollback'));
        const backup = await service.call('backup');
        assert.equal(backup.integrity, 'ok'); assert.ok(!backup.name.includes(path.sep));
        await fs.access(path.join(directory, 'backups', backup.name));
        await service.call('deleteNote', { opId: randomUUID(), expected: 1, generation: version.generation, bookId: book.id, id: note.id });
        await assert.rejects(service.call('saveNote', { ...save, opId: randomUUID() }), { status: 409 });
        await service.call('deleteBook', { opId: randomUUID(), expected: 1, id: book.id });
        const recreated = await service.call('saveBook', { opId: randomUUID(), expected: 2, book });
        assert.notEqual(recreated.generation, version.generation);
        await assert.rejects(service.call('saveNote', { ...save, opId: randomUUID(), note: { ...note, id: 'late' } }), { status: 409 });
        service.close(); service = createDesktopStorage(directory);
        assert.deepEqual(await service.call('status'), { initialized: true });
        assert.deepEqual((await service.call('listBooks')).records.find(row => row.id === book.id).value, book);
        service.close(); service = createDesktopStorage(directory);
        await fs.rename(path.join(directory, 'aurareader.sqlite'), path.join(directory, 'preserved.sqlite'));
        await assert.rejects(service.call('status'), { status: 500 });
        await assert.rejects(fs.access(path.join(directory, 'aurareader.sqlite')));
        await fs.mkdir(path.join(temporary, 'unknown'));
        await fs.writeFile(path.join(temporary, 'unknown', 'original.json'), 'keep');
        const unknown = createDesktopStorage(path.join(temporary, 'unknown'));
        try { await assert.rejects(unknown.call('createLibrary'), { status: 409 }); }
        finally { unknown.close(); }
        assert.equal(await fs.readFile(path.join(temporary, 'unknown', 'original.json'), 'utf8'), 'keep');
        console.log('PASS: desktop explicit initialization, validation, CAS/idempotency/tombstones/generation, complete JSON, backup, rollback, reopen and missing/unknown data guards');
    } finally {
        service.close();
        const target = path.resolve(temporary);
        if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('aurareader-desktop-test-')) throw new Error('Unsafe cleanup');
        await fs.rm(target, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
