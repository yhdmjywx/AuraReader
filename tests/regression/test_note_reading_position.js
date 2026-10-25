const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<div id="reader-viewport"><article id="paper"></article><article id="right"></article></div><section id="notes-panel"><div id="list"></div></section>', { url: 'http://localhost/' });
    const keys = ['window', 'document', 'NodeFilter', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let storage;
    try {
        keys.forEach(key => { globalThis[key] = dom.window[key]; });
        storage = await require('../helpers/sqlite').clientStorage([{ id: 'position', pages: ['正文'] }]);
        const { ReaderController } = await import('../../dist/client/features/reader/readerController.js');
        const { AnnotationController } = await import('../../dist/client/features/annotations/annotationController.js');
        const elements = { bookPaper: document.getElementById('paper'), bookPaperRight: document.getElementById('right'), notesList: document.getElementById('list') };
        const viewport = document.getElementById('reader-viewport');
        const reader = new ReaderController();
        reader.elements = elements;
        let refreshes = 0;
        const controller = new AnnotationController({ callbacks: {
            getCurrentBookId: () => 'position',
            getVisibleAnnotationIds: () => new Set(controller.getRenderingNotes().map(note => note.id)),
            onNotesChanged: notes => { refreshes++; reader.refreshAnnotations(notes); }
        } });
        controller.initUI(elements);
        for (const mode of ['scroll', 'single', 'double', 'spread']) {
            reader.setBook('position', { format: 'EPUB', readerFlow: mode === 'spread' ? undefined : 'chapter', pages: ['<p id="source">前文引用😀后文</p>', '<p>右页引用</p>'] });
            reader.currentLeftPage = 1;
            reader.currentRightPage = mode === 'spread' ? 2 : null;
            reader.paintChapter(1, []);
            elements.bookPaperRight.innerHTML = '<p>右页引用</p>';
            const source = document.getElementById('source');
            const prefix = document.createElement('div');
            prefix.dataset.volumeTitlePage = '3'; prefix.innerHTML = '<h1>第一卷</h1>';
            elements.bookPaper.prepend(prefix);
            elements.bookPaper.scrollLeft = mode === 'scroll' ? 0 : 1264;
            viewport.scrollTop = mode === 'scroll' ? 830 : 0;
            reader.flowAnchorText = ''; // Reproduce editing before the delayed anchor is recorded.
            const position = [elements.bookPaper.scrollLeft, viewport.scrollTop];
            const note = controller.createNote({ quote: '引用😀', location: { page: 1, start: 2, end: 6 } });
            assert.equal(document.getElementById('source'), source, `${mode}: 新建笔记不能重建正文`);
            assert.deepEqual([elements.bookPaper.scrollLeft, viewport.scrollTop], position);
            assert.equal(elements.bookPaper.querySelector('.has-note').textContent, '引用😀');
            const editor = elements.notesList.querySelector('.note-editor');
            editor.value = '笔记内容'; editor.dispatchEvent(new window.Event('input'));
            await controller.finishInlineEdit();
            const before = refreshes;
            document.getElementById(`card-${note.id}`).click();
            assert.equal(document.activeElement, elements.notesList.querySelector('.note-editor'));
            assert.equal(refreshes, before, '点击已有笔记只需聚焦编辑器');
            assert.deepEqual([elements.bookPaper.scrollLeft, viewport.scrollTop], position);
            await controller.finishInlineEdit();
            reader.refreshAnnotations([...controller.getNotes(), { id: 'volume', kind: 'note', page: 3, quote: '第一卷', comment: '卷笔记' }, { id: 'right-note', kind: 'note', page: 2, quote: '右页引用', comment: '右页' }]);
            assert.equal(prefix.querySelectorAll('.has-note').length, 1);
            reader.refreshAnnotations([]);
            assert.equal(elements.bookPaper.querySelector('.annotation-token'), null, '刷新可移除正文和卷页标注');
            assert.equal(document.getElementById('source'), source);
            assert.equal(source.textContent, '前文引用😀后文');
            assert.deepEqual([elements.bookPaper.scrollLeft, viewport.scrollTop], position);
            if (mode === 'spread') assert.equal(elements.bookPaperRight.querySelector('.annotation-token'), null);
            controller.setNotesForBook([]);
        }
        console.log('✅ 笔记创建及点击编辑保留原正文节点和横纵阅读位置，卷页及双页标注可重复刷新和清除');
    } finally {
        await storage?.close(); dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
