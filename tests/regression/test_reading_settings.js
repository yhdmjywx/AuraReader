const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM(`<main class="workspace-container immersive-notes"><section id="reader"><div class="reader-viewport"><div class="paper-container"><article class="book-paper"></article></div></div></section></main>
        <button id="line-down"></button><span id="line-label"></span><button id="line-up"></button>
        <button id="width-down"></button><span id="width-label"></span><button id="width-up"></button>`,
        { url: 'http://localhost/', pretendToBeVisual: true });
    const keys = ['window', 'document', 'localStorage', 'Node', 'NodeFilter'];
    const prior = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let runtime;
    try {
        for (const key of keys) globalThis[key] = dom.window[key];
        const { ReaderRuntime } = await import('../../dist/client/features/reader/readerRuntime.js');
        const { marginGeometry } = await import('../../dist/client/features/layout/marginNotesLayout.js');
        const { applyLineSpacing } = await import('../../dist/client/features/reader/readingTypography.js');
        const { readingAxis } = await import('../../dist/client/features/reader/readingAxis.js');
        const byId = id => document.getElementById(id);
        let available = 1600;
        const workspace = document.querySelector('main'), container = document.querySelector('.paper-container');
        Object.defineProperty(workspace, 'clientWidth', { get: () => available });
        Object.defineProperty(container, 'clientWidth', { get: () => parseFloat(workspace.style.getPropertyValue('--reading-width')) || 560 });
        Object.defineProperty(container, 'clientHeight', { get: () => 600 });
        const controls = { workspaceContainer: workspace, lineSpacingLabel: byId('line-label'),
            btnLineSpacingDec: byId('line-down'), btnLineSpacingInc: byId('line-up'),
            readingWidthLabel: byId('width-label'), btnReadingWidthDec: byId('width-down'), btnReadingWidthInc: byId('width-up') };
        const paragraph = '<p id="body" style="line-height:2.10!important">Stable quotation for highlights and margin notes. <code style="line-height:24px">a + b</code><ruby style="line-height:1.25">字<rt>zi</rt></ruby></p>';
        const pages = [`<h1 style="line-height:1.1">Heading</h1>${paragraph}<table><tbody><tr><td><p style="line-height:1.3">Cell</p></td></tr></tbody></table>`,
            '<p>Fixed page</p>', '<p id="rtl">نص عربي محفوظ في المصدر ولا تتغير علاقة الملاحظات به.</p>', '<p>縦書きの本文と元の方向を維持して行間を調整します。</p>'];
        const book = { id: 'reading-settings', title: 'Reading settings', readerFlow: 'chapter', pages,
            epub: { documents: pages.map((_, i) => ({ page: i + 1, sectionId: `chapter-${i + 1}`, path: `${i}.xhtml`,
                layout: i === 1 ? 'pre-paginated' : 'reflowable', viewport: { width: 600, height: 800 }, language: i === 2 ? 'ar' : 'en', direction: i === 2 ? 'rtl' : 'ltr',
                attributes: { html: {}, body: { style: 'font-size:20px;line-height:1.6' + (i === 3 ? ';writing-mode:vertical-rl' : '') } }, styles: [] })), manifest: [], spine: [] } };
        const start = ('Heading' + 'Stable quotation for highlights and margin notes. a + b字zi' + 'Cell').indexOf('Stable quotation');
        const note = { id: 'layout-note', bookId: book.id, kind: 'note', page: 1, quote: 'Stable quotation', comment: 'Preserved note',
            location: { sectionId: 'chapter-1', page: 1, start, end: start + 16, offset: start } };
        const source = JSON.stringify(book), annotation = JSON.stringify(note);
        runtime = new ReaderRuntime(); runtime.mount(byId('reader'), controls); runtime.setBook(book, [note]);
        const reader = runtime.reader, paper = reader.elements.bookPaper;
        const body = paper.querySelector('#body'), token = paper.querySelector('.annotation-token');
        assert.equal(byId('line-label').textContent, '2.10×', 'display current author line height before overriding');
        assert.equal(body.style.getPropertyValue('line-height'), '2.1', 'initial rendering keeps author style');
        assert.equal(reader.lineSpacingOverride, false);
        const frame = () => new Promise(resolve => window.requestAnimationFrame(() => resolve()));
        await frame(); // Allow the existing initial font-ready callback to finish first.
        let layouts = 0;
        const layout = reader.layoutAndPlace.bind(reader);
        reader.layoutAndPlace = (...args) => { layouts++; return layout(...args); };
        byId('line-up').click(); byId('line-up').click(); byId('width-down').click();
        await frame();
        assert.equal(layouts, 1, 'rapid setting changes share one pagination pass');
        assert.equal(body.style.lineHeight, '2.2');
        assert.equal(container.clientWidth, 520);
        assert.equal(paper.querySelector('h1').style.lineHeight, '1.1');
        assert.equal(paper.querySelector('code').style.lineHeight, '24px');
        assert.equal(paper.querySelector('ruby').style.lineHeight, '1.25');
        assert.equal(paper.querySelector('td p').style.lineHeight, '1.3');
        assert.equal(paper.querySelector('.annotation-token'), token, 'layout does not replace annotation nodes');
        assert.equal(paper.querySelector('#body'), body, 'layout does not replace source blocks');
        assert.equal(JSON.stringify(book), source, 'book package and source markup are unchanged');
        assert.equal(JSON.stringify(note), annotation, 'source coordinates and note data are unchanged');
        const split = body.cloneNode(true); split.removeAttribute('id'); paper.appendChild(split);
        applyLineSpacing(paper, null);
        assert.equal(body.style.getPropertyValue('line-height'), '2.1');
        assert.equal(body.style.getPropertyPriority('line-height'), 'important', 'original inline priority is restored');
        assert.equal(split.style.lineHeight, '2.1', 'pagination clones recover the original author line height');
        assert.equal(split.querySelector('ruby').style.lineHeight, '1.25');
        split.remove();
        reader.applyTypography();

        for (let i = 0; i < 50; i++) byId('line-up').click();
        await frame();
        assert.equal(reader.lineSpacing, 2.4); assert.equal(byId('line-up').disabled, true);
        for (let i = 0; i < 50; i++) byId('line-down').click();
        await frame();
        assert.equal(reader.lineSpacing, 1.2); assert.equal(byId('line-down').disabled, true);
        reader.layoutController.readingWidth = 560;
        available = 732; runtime.relayout();
        assert.equal(byId('width-label').textContent, '448px');
        assert.match(byId('width-label').title, /Preferred 560px/);
        assert.equal(byId('width-up').disabled, true);
        byId('width-down').click(); await frame();
        assert.equal(container.clientWidth, 408, 'decrease starts at actual constrained width');
        available = 1600; runtime.relayout();
        assert.equal(container.clientWidth, 408, 'resize keeps the session preference');
        runtime.goToPage(2);
        assert.equal(byId('line-up').disabled, true); assert.equal(byId('width-up').disabled, true);
        assert.match(byId('line-label').title, /Fixed-layout/);
        assert.equal(container.clientWidth, 560, 'fixed layout uses original container geometry');
        assert.equal(paper.querySelector('p').style.lineHeight, '', 'fixed content receives no line-height override');
        runtime.goToPage(3);
        assert.equal(paper.dir, 'rtl');
        assert.equal(paper.querySelector('#rtl').style.lineHeight, '1.2');
        assert.equal(container.clientWidth, 408);
        runtime.goToPage(4);
        Object.defineProperty(paper.ownerDocument.documentElement, 'clientWidth', { value: 560, configurable: true });
        assert.equal(paper.style.writingMode, 'vertical-rl');
        const columnSpacing = parseFloat(paper.ownerDocument.defaultView.getComputedStyle(paper.querySelector('p')).fontSize) * reader.lineSpacing;
        assert.equal(parseFloat(paper.style.getPropertyValue('--aura-reading-line-height')), columnSpacing);
        const step = readingAxis(paper).step;
        assert.ok(Math.abs(step / columnSpacing - Math.round(step / columnSpacing)) < 0.00001, 'vertical steps follow the new body line spacing');
        reader.clearBook(); assert.equal(byId('line-up').disabled, true); assert.equal(byId('width-down').disabled, true);
        for (const width of [600, 732, 800, 1200, 1600, 1920]) for (const preferred of [320, 560, 800]) {
            const g = marginGeometry(width, preferred);
            assert.ok(g.readingWidth <= preferred); assert.ok(g.readingLeft >= 16);
            assert.ok(g.rightNoteLeft >= g.readingLeft + g.readingWidth + 32);
            assert.ok(g.rightNoteLeft + g.noteWidth <= width, 'custom reading width retains the notes lane');
        }
        console.log('PASS: session controls, coalesced reflow, reversible scoped typography, preserved special content/annotations/source, constrained width, fixed/RTL transitions and notes geometry');
    } finally {
        runtime?.destroy(); dom.window.close();
        for (const [key, value] of prior) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
