const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { clientStorage } = require('../helpers/sqlite');

(async () => {
    const dom = new JSDOM('', { url: 'http://localhost/' });
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const warn = console.warn; const logError = console.error;
    globalThis.localStorage = dom.window.localStorage;
    let server;
    try {
        console.warn = console.error = () => {};
        server = await clientStorage([{ id: 'book-a', pages: ['关联的原文'] }, { id: 'book-b', pages: ['其他书'] }]);
        const repo = await import('../../dist/client/infrastructure/annotationRepository.js');
        const { AnnotationController } = await import('../../dist/client/features/annotations/annotationController.js');
        const notices = [];
        const controller = () => new AnnotationController({ callbacks: { getCurrentBookId: () => 'book-a', showToast: text => notices.push(text) } });
        const original = { id: 'existing', bookId: 'book-a', kind: 'note', quote: '原文', comment: '旧内容', page: 1 };
        await repo.saveNoteToDB(original);
        const current = controller(); await current.loadNotesForBook('book-a');
        current.beginInlineEdit(current.getNotes()[0]);
        server.configureClient((url, opts) => {
            if (/notes\/(save|delete)$/.test(url)) throw new Error('offline');
            return fetch(url, opts);
        });
        current.updateInlineNote('existing', '最新内容\n保留换行\n'); await current.finishInlineEdit();
        assert.equal(server.read('annotations', 'existing').comment, '旧内容');
        assert.match(notices.at(-1), /已保留在本机缓存/);
        const reopened = controller();
        assert.equal((await reopened.loadNotesForBook('book-a'))[0].comment, '最新内容\n保留换行\n');
        assert.equal((await repo.getNotesForBooks(['book-a']))[0].comment, '最新内容\n保留换行\n');
        server.configureClient();
        await reopened.loadNotesForBook('book-a');
        assert.equal(server.read('annotations', 'existing').comment, '最新内容\n保留换行\n');
        assert.equal(localStorage.getItem('aura_notes_pending_book-a'), null);
        localStorage.setItem('aura_notes_book-a', JSON.stringify([{ ...original, comment: '旧缓存不能覆盖 SQLite' }]));
        assert.equal((await repo.loadNotesForBook('book-a'))[0].comment, '最新内容\n保留换行\n');

        // Lose both responses for the first committed input, then type again.
        // Reopen with the exact predecessor command and newest draft intact.
        let lose = true;
        server.configureClient(async (url, opts) => {
            const response = await fetch(url, opts);
            if (lose && url.endsWith('/notes/save')) throw new Error('response lost');
            return response;
        });
        reopened.beginInlineEdit(reopened.getNotes()[0]);
        reopened.updateInlineNote('existing', '已提交但未确认');
        await reopened.finishInlineEdit();
        reopened.beginInlineEdit(reopened.getNotes()[0]);
        reopened.updateInlineNote('existing', '后续输入不能被旧响应覆盖');
        await reopened.finishInlineEdit();
        assert.ok(localStorage.getItem('aura_notes_pending_book-a'));
        lose = false; server.configureClient();
        const recovered = await controller().loadNotesForBook('book-a');
        assert.equal(recovered[0].comment, '后续输入不能被旧响应覆盖');
        assert.equal(server.read('annotations', 'existing').comment, recovered[0].comment);

        server.configureClient((url, opts) => url.endsWith('/notes/delete') ? Promise.reject(new Error('offline')) : fetch(url, opts));
        await assert.rejects(repo.deleteNoteFromDB('existing', 'book-a'));
        assert.deepEqual(await repo.loadNotesForBook('book-a'), [], '失败删除在重开与备份中不能复活');
        assert.deepEqual(await repo.getNotesForBooks(['book-a']), []);
        server.configureClient(); await repo.loadNotesForBook('book-a');
        assert.equal(server.read('annotations', 'existing'), undefined);
        assert.equal(localStorage.getItem('aura_notes_pending_book-a'), null);

        const created = current.createNote({ quote: '新引用' });
        server.configureClient((url, opts) => url.endsWith('/notes/save') ? Promise.reject(new Error('offline')) : fetch(url, opts));
        current.updateInlineNote(created.id, '失败的新笔记'); await current.finishInlineEdit();
        assert.ok((await repo.loadNotesForBook('book-a')).some(n => n.id === created.id));
        server.configureClient(); await repo.loadNotesForBook('book-a');
        assert.equal(server.read('annotations', created.id).comment, '失败的新笔记');

        globalThis.localStorage = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
        await repo.saveNoteToDB({ ...original, id: 'db-only' });
        assert.equal(server.read('annotations', 'db-only').comment, '旧内容');
        server.configureClient((url, opts) => url.endsWith('/notes/save') ? Promise.reject(new Error('offline')) : fetch(url, opts));
        const denied = controller(); const draft = denied.createNote({ quote: '原文' });
        denied.updateInlineNote(draft.id, '两处存储都失败'); await denied.finishInlineEdit();
        assert.match(notices.at(-1), /尚未可靠保存/);
        console.log('✅ SQLite 自动保存恢复：真实文件、失败更新／新增／删除、备份、丢失响应后的连续输入、旧缓存隔离与存储拒绝通过');
    } finally {
        console.warn = warn; console.error = logError;
        await server?.close(); dom.window.close();
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage;
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
