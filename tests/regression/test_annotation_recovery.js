const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Transaction failures are injected at the database boundary; the production
// repository and inline controller still perform all saving and recovery.
function database(initial = []) {
    const rows = new Map(initial.map(note => [note.id, structuredClone(note)]));
    const db = { rows, failWrites: false, failReads: false, manual: false, writes: [] };
    db.transaction = (_stores, mode) => {
        const tx = {};
        const read = filter => {
            const request = {};
            queueMicrotask(() => {
                if (db.failReads) {
                    request.onerror?.(new Error('read failure'));
                } else {
                    request.result = [...rows.values()].filter(filter).map(note => structuredClone(note));
                    request.onsuccess?.();
                }
            });
            return request;
        };
        const write = operation => {
            tx.complete = (success = true) => {
                if (success) { operation(); tx.oncomplete?.(); }
                else { tx.error = new Error('write failure'); tx.onabort?.(); }
            };
            db.writes.push(tx);
            if (!db.manual) queueMicrotask(() => tx.complete(!db.failWrites));
        };
        tx.objectStore = () => ({
            put: value => { const snapshot = structuredClone(value); write(() => rows.set(value.id, snapshot)); },
            delete: id => write(() => rows.delete(id)),
            getAll: () => read(() => true),
            index: () => ({ getAll: bookId => read(note => note.bookId === bookId) })
        });
        assert.ok(['readonly', 'readwrite'].includes(mode));
        return tx;
    };
    return db;
}

(async () => {
    const dom = new JSDOM('', { url: 'http://localhost/' });
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const originalWarn = console.warn;
    const originalError = console.error;
    let setDB;
    try {
        globalThis.localStorage = dom.window.localStorage;
        console.warn = () => {};
        console.error = () => {};
        ({ setDB } = await import('../../src/client/infrastructure/bookRepository.js'));
        const { deleteBookFromDB } = await import('../../src/client/infrastructure/bookRepository.js');
        const repo = await import('../../src/client/infrastructure/annotationRepository.js');
        const { pendingNoteWrites } = await import('../../src/client/infrastructure/annotationRecovery.js');
        const { AnnotationController } = await import('../../src/client/features/annotations/annotationController.js');
        const note = (id, comment, bookId = 'book-a') => ({
            id, bookId, kind: 'note', quote: '关联的原文', comment, page: 1,
            location: { sectionId: 'chapter-1', start: 0, end: 6 }
        });
        const notices = [];
        const controller = () => new AnnotationController({ callbacks: {
            getCurrentBookId: () => 'book-a', showToast: text => notices.push(text)
        } });
        const db = database([note('existing', '数据库旧内容'), note('other', '另一本书', 'book-b')]);
        setDB(db);
        const current = controller();
        await current.loadNotesForBook('book-a');
        current.beginInlineEdit(current.getNotes()[0]);
        db.failWrites = true;
        current.updateInlineNote('existing', '输入中最新内容\n保留换行\n');
        await current.finishInlineEdit();
        assert.equal(db.rows.get('existing').comment, '数据库旧内容');
        assert.equal(pendingNoteWrites('book-a').length, 1);
        assert.match(notices.at(-1), /已保留在本机缓存/);

        // A new controller represents reopening: no state from the editor is
        // reused, and a failed retry must not hide the latest stored input.
        const reopened = controller();
        await reopened.loadNotesForBook('book-a');
        assert.equal(reopened.getNotes()[0].comment, '输入中最新内容\n保留换行\n');
        assert.equal(pendingNoteWrites('book-a').length, 1);
        const backup = await repo.getNotesForBooks(['book-a']);
        assert.equal(backup.length, 1, '备份严格限制在所选书籍');
        assert.equal(backup[0].comment, '输入中最新内容\n保留换行\n');

        db.failWrites = false;
        await reopened.loadNotesForBook('book-a');
        assert.equal(db.rows.get('existing').comment, '输入中最新内容\n保留换行\n');
        assert.equal(pendingNoteWrites('book-a').length, 0, '成功补写后清理待写记录');
        db.rows.set('existing', note('existing', '数据库已经更新'));
        assert.equal((await repo.loadNotesForBook('book-a'))[0].comment, '数据库已经更新', '普通旧缓存不能覆盖数据库');

        db.failWrites = true;
        const created = reopened.createNote({ quote: '另一处原文' });
        reopened.updateInlineNote(created.id, '新笔记也需要恢复');
        await reopened.finishInlineEdit();
        assert.equal(db.rows.has(created.id), false);
        assert.ok((await repo.loadNotesForBook('book-a')).some(item => item.id === created.id));
        await assert.rejects(repo.deleteNoteFromDB('existing', 'book-a'));
        assert.ok(!(await repo.loadNotesForBook('book-a')).some(item => item.id === 'existing'), '失败的删除不能在重开后复活');
        assert.ok(!(await repo.getNotesForBooks(['book-a'])).some(item => item.id === 'existing'));
        db.failWrites = false;
        await repo.loadNotesForBook('book-a');
        assert.equal(db.rows.has('existing'), false);
        assert.equal(db.rows.get(created.id).comment, '新笔记也需要恢复');
        assert.equal(pendingNoteWrites('book-a').length, 0);

        // Clear an existing inline note: deletion remains durable even while
        // the final empty-string save and delete both fail.
        await reopened.loadNotesForBook('book-a');
        reopened.beginInlineEdit(reopened.getNotes()[0]);
        db.failWrites = true;
        reopened.updateInlineNote(created.id, '');
        await reopened.finishInlineEdit();
        assert.deepEqual(await repo.loadNotesForBook('book-a'), []);
        db.failWrites = false;
        assert.deepEqual(await repo.loadNotesForBook('book-a'), []);
        assert.equal(db.rows.has(created.id), false);

        db.manual = true;
        const first = repo.saveNoteToDB(note('ordered', '旧输入'));
        const second = repo.saveNoteToDB(note('ordered', '新输入'));
        const secondFailed = assert.rejects(second);
        db.writes.at(-2).complete(true);
        await first;
        assert.equal(pendingNoteWrites('book-a')[0].note.comment, '新输入', '旧事务完成不能清除较新的待写内容');
        db.writes.at(-1).complete(false);
        await secondFailed;
        db.manual = false;
        assert.equal((await repo.loadNotesForBook('book-a'))[0].comment, '新输入');
        assert.equal(db.rows.get('ordered').comment, '新输入');

        db.failReads = true;
        assert.equal((await repo.loadNotesForBook('book-a'))[0].comment, '新输入', '读库失败仍可使用缓存');
        db.failReads = false;
        db.failWrites = true;
        await assert.rejects(repo.saveNoteToDB({ ...note('pending-highlight', '', 'book-c'), kind: 'highlight' }));
        // The journal also protects highlight records (no note text required).
        const allBackup = await repo.getNotesForBooks();
        assert.ok(allBackup.some(item => item.id === 'pending-highlight' && item.kind === 'highlight'));
        setDB(null);
        await deleteBookFromDB('book-c');
        assert.deepEqual(await repo.loadNotesForBook('book-c'), [], '删除书籍后不从缓存或待写记录恢复其标注');

        // A denied/full localStorage must not stop healthy database writes.
        globalThis.localStorage = {
            getItem() { throw new Error('storage denied'); },
            setItem() { throw new Error('storage full'); }
        };
        setDB(db);
        db.failWrites = false;
        await repo.saveNoteToDB(note('db-only', '仅数据库可用'));
        assert.equal(db.rows.get('db-only').comment, '仅数据库可用');
        db.failWrites = true;
        const unavailable = controller();
        const draft = unavailable.createNote({ quote: '关联的原文' });
        unavailable.updateInlineNote(draft.id, '无法保存的输入');
        await unavailable.finishInlineEdit();
        assert.match(notices.at(-1), /尚未可靠保存/);
        setDB(null);
        await assert.rejects(repo.saveNoteToDB(note('neither', '两处均不可用')), { recoveryAvailable: false });

        console.log('✅ 自动保存恢复：失败更新／新增／删除、重开与备份、自动补写、版本隔离、读库失败和存储不可用通过');
    } finally {
        setDB?.(null);
        console.warn = originalWarn;
        console.error = originalError;
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else delete globalThis.localStorage;
        dom.window.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
