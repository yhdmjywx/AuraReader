const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { clientStorage } = require('../helpers/sqlite');

(async () => {
    const dom = new JSDOM('', { url: 'http://localhost/' });
    const keys = ['window', 'document', 'NodeFilter', 'localStorage'];
    const originals = new Map(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
    let storage;
    try {
        keys.forEach(k => { globalThis[k] = dom.window[k]; });
        const book = { id: 'unicode', pages: ['<p>前文😀重复句。</p><p>后文重复句。尾声</p>'] };
        storage = await clientStorage([book]);
        const { saveNoteToDB, loadNotesForBook, deleteNoteFromDB } = await import('../../src/client/infrastructure/annotationRepository.js');
        const { loadBookFromDB } = await import('../../src/client/infrastructure/bookRepository.js');
        const { renderAnnotationTokens } = await import('../../src/client/features/reader/annotationRenderer.js');
        const root = document.createElement('div'); root.innerHTML = book.pages[0];
        const text = root.textContent;
        const range = (id, kind, start, end) => ({ id, kind, bookId: book.id, page: 1, quote: text.slice(start, end), comment: kind === 'note' ? '重叠笔记\n😀' : '', location: { sectionId: 'chapter-1', page: 1, start, end, offset: start }, extension: { keep: true } });
        const records = [range('cross', 'highlight', 2, text.length - 2), range('repeat', 'highlight', text.lastIndexOf('重复句'), text.lastIndexOf('重复句') + 4), range('overlap', 'note', 2, 8)];
        for (const record of records) await saveNoteToDB(record);
        await storage.restart(); storage.configureClient();
        const restored = await loadNotesForBook(book.id);
        root.innerHTML = (await loadBookFromDB(book.id)).pages[0];
        renderAnnotationTokens(root, restored, 1);
        assert.equal(root.textContent, text);
        for (const record of records) {
            const attribute = record.kind === 'note' ? 'data-note-ids' : 'data-highlight-ids';
            const actual = [...root.querySelectorAll(`[${attribute}~="${record.id}"]`)].map(n => n.textContent).join('');
            assert.equal(actual, record.quote, 'UTF-16 偏移、跨段、重复引用与重叠范围往返后不变');
            assert.deepEqual(storage.read('annotations', record.id), record);
        }
        await deleteNoteFromDB('overlap', book.id);
        assert.deepEqual((await loadNotesForBook(book.id)).map(n => n.id).sort(), ['cross', 'repeat']);
        console.log('✅ SQLite 标注往返：完整字段、跨段、重叠、重复引用、emoji UTF-16 范围及独立删除通过');
    } finally {
        await storage?.close(); dom.window.close();
        for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
