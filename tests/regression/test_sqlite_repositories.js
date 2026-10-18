const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { clientStorage } = require('../helpers/sqlite');

(async () => {
    const dom = new JSDOM('', { url: 'http://localhost/' });
    const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    globalThis.localStorage = dom.window.localStorage;
    const server = await clientStorage([{ id: 'repo', pages: ['<p>原文😀</p>'] }]);
    try {
        const repo = await import('../../src/client/infrastructure/annotationRepository.js');
        const books = await import('../../src/client/infrastructure/bookRepository.js');
        const { AnnotationController } = await import('../../src/client/features/annotations/annotationController.js');
        const make = () => new AnnotationController({ callbacks: { getCurrentBookId: () => 'repo' } });
        const controller = make();
        await controller.loadNotesForBook('repo');
        const note = controller.createNote({ quote: '原文😀', location: { page: 1, start: 0, end: 4 } });
        for (let i = 0; i < 30; i++) controller.updateInlineNote(note.id, `快速输入 ${i}\n第二行\n`);
        await controller.finishInlineEdit();
        assert.equal(server.read('annotations', note.id).comment, '快速输入 29\n第二行\n');
        assert.equal(localStorage.getItem('aura_notes_repo'), null, '不再维持整书 localStorage 主副本');
        assert.equal(localStorage.getItem('aura_notes_pending_repo'), null);

        // Let the server commit, then lose the response. The repository must
        // retry precisely the same operation, without a second update.
        let lost = false;
        server.configureClient(async (url, opts) => {
            const response = await fetch(url, opts);
            if (!lost && url.endsWith('/notes/save')) { lost = true; throw new Error('lost response'); }
            return response;
        });
        await repo.saveNoteToDB({ ...note, comment: '提交成功但响应丢失' });
        assert.ok(lost);
        assert.equal(server.read('annotations', note.id).comment, '提交成功但响应丢失');
        await server.restart(); server.configureClient();
        assert.equal((await books.loadBookFromDB('repo')).pages[0], '<p>原文😀</p>');
        assert.equal((await make().loadNotesForBook('repo'))[0].comment, '提交成功但响应丢失');
        await repo.deleteNoteFromDB(note.id, 'repo');
        assert.deepEqual(await repo.loadNotesForBook('repo'), []);
        console.log('✅ SQLite Repository：真实 API、快速输入顺序、恢复缓冲清理、响应丢失重试及服务重开通过');
    } finally {
        await server.close(); dom.window.close();
        if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage;
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
