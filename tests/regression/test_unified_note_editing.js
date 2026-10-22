const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<div id="list"></div>', { url: 'http://localhost/' });
    const keys = ['window', 'document', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let storage;
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        storage = await require('../helpers/sqlite').clientStorage([{ id: 'editing', pages: ['同一段原文'] }]);
        const { AnnotationController } = await import('../../dist/client/features/annotations/annotationController.js');
        const elements = { notesList: document.getElementById('list') };
        const makeController = () => {
            const controller = new AnnotationController({ callbacks: {
                getCurrentBookId: () => 'editing',
                getVisibleAnnotationIds: () => new Set(controller.getNotes().map(note => note.id))
            } });
            controller.initUI(elements);
            return controller;
        };
        const controller = makeController();
        const location = { page: 1, start: 0, end: 6 };
        const highlight = await controller.createHighlight({ quote: '同一段原文', location });
        controller.createNote({ quote: '同一段原文', location });
        const id = controller.editingNoteId;
        const editor = () => elements.notesList.querySelector('.note-editor');
        const input = value => {
            editor().value = value;
            editor().dispatchEvent(new window.Event('input', { bubbles: true }));
        };
        assert.equal(document.activeElement, editor());
        input('第一行\n第二行😀\n');
        await storage.drain();
        assert.equal(storage.read('annotations', id).comment, '第一行\n第二行😀\n', '退出前已经写入真实 SQLite');
        await controller.finishInlineEdit();
        await storage.restart();
        storage.configureClient();
        const reopened = makeController();
        await reopened.loadNotesForBook('editing');
        assert.equal(reopened.getNotes().length, 2);
        assert.equal(reopened.getNotes().find(note => note.id === id).comment, '第一行\n第二行😀\n');
        assert.deepEqual(storage.read('annotations', highlight.id), highlight, '同一原文的笔记不改写高亮');
        document.getElementById('card-' + id).click();
        assert.equal(document.activeElement, editor());
        input('修改后的笔记');
        await reopened.finishInlineEdit();
        await reopened.loadNotesForBook('editing');
        assert.equal(reopened.getNotes().find(note => note.id === id).comment, '修改后的笔记');
        await reopened.deleteNote(id);
        assert.equal(storage.read('annotations', id), undefined);
        assert.deepEqual(storage.read('annotations', highlight.id), highlight);
        await reopened.deleteHighlight(highlight.id);
        await reopened.loadNotesForBook('editing');
        assert.deepEqual(reopened.getNotes(), []);
        console.log('✅ 真实原位笔记：创建、输入中保存、重启重开、点击编辑、独立删除笔记和高亮通过');
    } finally {
        await storage?.close(); dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
