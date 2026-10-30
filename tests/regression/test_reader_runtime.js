const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createElement: h } = require('react');
const { createRoot } = require('react-dom/client');
const { flushSync } = require('react-dom');

(async () => {
    const dom = new JSDOM('<div id="react"></div><section id="other"><div class="reader-viewport"><div class="paper-container"><article class="book-paper"></article></div></div></section><button id="next">Next</button>',
        { url: 'http://localhost', pretendToBeVisual: true });
    Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
        HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, NodeFilter: dom.window.NodeFilter });
    document.documentElement.lang = 'en';
    const { ReaderRuntime } = await import('../../dist/client/features/reader/readerRuntime.js');
    const { ReaderSurface, useReaderSnapshot } = await import('../../dist/client/features/reader/readerReact.js');
    const runtime = new ReaderRuntime(), other = new ReaderRuntime();
    const controls = { btnNextPage: document.getElementById('next') };
    const root = createRoot(document.getElementById('react'));
    function Workspace({ revision }) {
        const state = useReaderSnapshot(runtime);
        return h('div', null, h('output', null, `${revision}:${state.location.page}`), h(ReaderSurface, { runtime, controls }));
    }
    try {
        flushSync(() => root.render(h(Workspace, { revision: 0 })));
        other.mount(document.getElementById('other'));
        const book = { id: 'runtime-book', title: 'Runtime', pages: ['<p>First <a href="second.xhtml">chapter</a></p>', '<p>Second source</p>', '<p>Third source</p>'],
            hrefToPageMap: { 'second.xhtml': 2 } };
        flushSync(() => { runtime.setBook(book); other.setBook({ ...book, id: 'other-book', language: 'zh-CN' }); });
        assert.equal(runtime.getSnapshot().mounted, true);
        assert.equal(runtime.getSnapshot(), runtime.getSnapshot(), 'snapshot identity stays stable between changes');
        const paper = document.querySelector('#react .book-paper');
        assert.equal(paper.getAttribute('lang'), '', 'Unknown source language must not inherit English UI language');
        assert.equal(document.querySelector('#other .book-paper').lang, 'zh-CN', 'Known book language stays independent of the UI');
        const firstParagraph = paper.firstChild;
        flushSync(() => root.render(h(Workspace, { revision: 1 })));
        assert.equal(paper.firstChild, firstParagraph, 'React workbench rerenders do not replace reader descendants');
        assert.equal(document.querySelector('output').textContent, '1:1');

        flushSync(() => paper.querySelector('a').click());
        assert.equal(runtime.getSnapshot().location.page, 2);
        assert.equal(other.getSnapshot().location.page, 1, 'links stay inside their mounted reader');
        assert.equal(document.querySelector('output').textContent, '1:2');
        runtime.setLayout({ mode: 'scroll', fontSize: 21 });
        assert.equal(runtime.getSnapshot().mode, 'scroll');
        assert.equal(paper.style.fontSize, '21px');

        const range = document.createRange();
        range.selectNodeContents(paper.querySelector('p'));
        range.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 20 });
        window.getSelection().addRange(range);
        flushSync(() => runtime.selection.handleSelection());
        const selected = runtime.getSnapshot().selection;
        assert.equal(selected.text, 'Second source');
        assert.ok(!('range' in selected), 'React receives plain data, never a live Range');
        other.selection.handleSelection();
        assert.equal(other.getSnapshot().selection, null, 'selection is scoped to its reader');
        runtime.selection.clearSelection();
        flushSync(() => runtime.setAnnotations([{ id: 'highlight', bookId: book.id, kind: 'highlight', page: 2,
            quote: 'Second', comment: '', color: 'yellow', location: { sectionId: 'chapter-2', page: 2, start: 0, end: 6, offset: 0 } }]));
        assert.equal(paper.querySelector('.annotation-token').textContent, 'Second');

        const host = paper.closest('.reader-panel');
        runtime.destroy();
        assert.equal(runtime.getSnapshot().mounted, false);
        assert.equal(paper.childNodes.length, 0);
        document.getElementById('next').click();
        assert.equal(runtime.reader.getCurrentPage(), 2, 'destroy removes control listeners');
        flushSync(() => runtime.mount(host, controls));
        assert.equal(runtime.getSnapshot().location.page, 2, 'remount keeps the source location');
        flushSync(() => { runtime.goToPage(1); runtime.mount(host, controls); document.getElementById('next').click(); });
        assert.equal(runtime.getSnapshot().location.page, 2, 'repeated mount does not duplicate button handlers');
        console.log('PASS: React rerender isolation, subscribed state, scoped links/selection, highlights, layout, destroy and remount');
    } finally {
        flushSync(() => root.unmount());
        other.destroy(); dom.window.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
