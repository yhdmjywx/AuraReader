const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<main id="reader"><div id="reader-viewport"><div id="container"><article class="book-paper" id="paper"></article></div></div></main><div id="selection-tooltip"></div><button id="prev"></button><button id="next"></button><span id="current"></span><span id="total"></span>');
    const keys = ['window', 'document', 'Node', 'NodeFilter'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let reader;
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        const { buildBookStructure, readingUnitForPage } = await import('../../src/client/infrastructure/bookStructure.js');
        const resolveVolumeTitleFlow = (book, page) => {
            const unit = readingUnitForPage(buildBookStructure(book), page);
            return { page: unit.page, titlePage: unit.prefixPages[0] || null };
        };
        const { ReaderController } = await import('../../src/client/features/reader/readerController.js');
        const { SelectionController } = await import('../../src/client/features/annotations/selectionController.js');
        const { selectionLocation } = await import('../../src/client/features/reader/annotationRenderer.js');
        const byId = id => document.getElementById(id);
        const book = {
            id: 'volume-book', format: 'EPUB', readerFlow: 'chapter',
            pages: ['<h1>前言</h1><p>前言正文。</p>', '\n<h1 id="same">第一卷</h1>\n',
                '\n<h2 id="same">大堂</h2><p>重复句。引用😀原文。重复句。</p>', '<h2>第二章</h2><p>后续正文。</p>'],
            toc: [{ title: '前言', page: 1 }, { title: '第一卷', page: 2 }, { title: '大堂', page: 3 }, { title: '第二章', page: 4 }],
            hrefToPageMap: { 'volume.xhtml': 2, 'chapter.xhtml': 3 }
        };
        const original = JSON.stringify(book);
        assert.deepEqual(resolveVolumeTitleFlow(book, 2), { page: 3, titlePage: 2 });
        assert.deepEqual(resolveVolumeTitleFlow(book, 3), { page: 3, titlePage: 2 });
        assert.deepEqual(resolveVolumeTitleFlow(book, 4), { page: 4, titlePage: null });
        for (const html of ['<h1>第一卷</h1><p>卷前说明不能丢。</p>', '<h1>第一卷</h1><img src="cover.jpg">', '<h1>第一卷</h1><svg></svg>']) {
            const other = { ...book, pages: [...book.pages] }; other.pages[1] = html;
            assert.equal(resolveVolumeTitleFlow(other, 2).titlePage, null, '含额外正文或插图的卷页独立保留');
        }
        const leaf = { ...book, toc: [{ title: '第一卷', page: 2, level: 0 }, { title: '第二卷', page: 3, level: 0 }] };
        assert.equal(resolveVolumeTitleFlow(leaf, 2).titlePage, null, '不能将两个卷页强行合并');
        let mode = 'double';
        const elements = {
            readerPanel: byId('reader'), bookPaper: byId('paper'), paperContainer: byId('container'),
            btnPrevPage: byId('prev'), btnNextPage: byId('next'), currentPageSpan: byId('current'), totalPagesSpan: byId('total'), selectionTooltip: byId('selection-tooltip')
        };
        for (const node of [elements.bookPaper, elements.paperContainer, byId('reader-viewport')]) {
            Object.defineProperty(node, 'clientHeight', { value: 700 });
            Object.defineProperty(node, 'clientWidth', { get: () => mode === 'double' ? 1192 : 560 });
        }
        Object.defineProperty(elements.bookPaper, 'scrollWidth', { get: () => mode === 'double' ? 1192 : 560 });
        const measure = () => ({ left: 20, top: 30, width: 50, height: 25, right: 70, bottom: 55 });
        dom.window.Range.prototype.getBoundingClientRect = measure;
        reader = new ReaderController({ layoutController: { getEffectiveReaderMode: () => mode } });
        reader.setBook(book.id, book);
        await reader.fonts.prepareForBook();
        reader.elements = elements;
        const holder = document.createElement('div'); holder.innerHTML = book.pages[2];
        const start = holder.textContent.indexOf('引用');
        const notes = [
            { id: 'body-note', bookId: book.id, kind: 'note', page: 3, quote: '引用😀原文', comment: '已有笔记', location: { page: 3, sectionId: 'chapter-3', offset: start, start, end: start + '引用😀原文'.length } },
            { id: 'title-highlight', bookId: book.id, kind: 'highlight', page: 2, quote: '第一卷' }
        ];
        const selection = new SelectionController({ callbacks: { getReadingContext: () => ({ chapterFlow: true, currentPage: reader.currentPage, sectionId: reader.getLocation().sectionId }) } });
        selection.elements = elements;
        for (mode of ['double', 'single', 'scroll']) {
            reader.renderPage(2, false, notes);
            assert.equal(reader.currentPage, 3);
            assert.ok(elements.bookPaper.textContent.includes('第一卷'));
            assert.ok(elements.bookPaper.textContent.includes('引用😀原文'));
            const token = elements.bookPaper.querySelector('[data-note-ids="body-note"]');
            assert.equal(token.dataset.page, '3'); assert.equal(Number(token.dataset.start), start);
            const range = document.createRange(); range.selectNodeContents(token);
            const native = window.getSelection(); native.removeAllRanges(); native.addRange(range);
            selection.handleSelection();
            assert.equal(selection.pendingSelection.page, 3);
            assert.deepEqual(selection.pendingSelection.location, notes[0].location, '展示卷标题后正文原偏移不变');
            const divider = elements.bookPaper.querySelector('[data-volume-title-page]');
            const titleToken = divider.querySelector('.annotation-token');
            range.selectNodeContents(titleToken); native.removeAllRanges(); native.addRange(range);
            selection.handleSelection();
            assert.equal(selection.pendingSelection.page, 2, '卷标题标注仍归原文件');
            assert.equal(selection.pendingSelection.location.sectionId, 'chapter-2');
            native.removeAllRanges();
            selection.handleAnnotationClick({ target: titleToken, stopPropagation() {} }, elements.bookPaper);
            assert.equal(selection.activeAnnotationContext.page, 2);
            range.selectNodeContents(elements.bookPaper); native.addRange(range);
            selection.handleSelection(); assert.equal(selection.pendingSelection, null, '不生成跨原文件的错误偏移');
            native.removeAllRanges();
            const bodyRange = document.createRange(); bodyRange.selectNodeContents(token);
            assert.equal(selectionLocation(elements.bookPaper, bodyRange, 3).start, start);
            // Duplicate anchor ids in different spine documents resolve within their source.
            reader.renderChapterPage(3, false, notes, { anchorId: 'same' });
            assert.ok(elements.bookPaper.querySelector('h2').classList.contains('flow-start') || mode === 'scroll');
            reader.renderPage(2, false, notes);
            reader.nextPage(notes); assert.equal(reader.currentPage, 4);
            reader.prevPage(notes); assert.equal(reader.currentPage, 3);
            reader.prevPage(notes); assert.equal(reader.currentPage, 1, '返回越过已衔接的卷页，不在标题与正文间循环');
            reader.nextPage(notes); assert.equal(reader.currentPage, 3);
        }
        assert.equal(JSON.stringify(book), original, '原书、目录、编号和链接映射未改写');
        assert.equal(notes[0].location.start, start);
        console.log('✅ 纯卷标题衔接、保留说明/插图、单/双页/滚动、前后翻页、同 ID 锚点、原标注和新选区偏移通过');
    } finally {
        clearTimeout(reader?._anchorTimer); dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
