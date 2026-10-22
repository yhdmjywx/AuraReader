const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const { createAnnotationObject, normalizeAnnotation, filterNotes } = await import('../../dist/client/domain/annotationEngine.js');
    const { getSeedNotes } = await import('../../dist/client/infrastructure/demoData.js');
    const highlight = createAnnotationObject({ id: 'h', bookId: 'b', quote: '原文', comment: '' });
    const note = createAnnotationObject({ id: 'n', bookId: 'b', quote: '原文', comment: '笔记' });
    assert.equal(highlight.kind, 'highlight'); assert.equal(highlight.color, 'yellow');
    assert.equal(note.kind, 'note'); assert.equal(note.color, 'green');
    assert.equal(normalizeAnnotation({ comment: '旧笔记' }).kind, 'note');
    assert.equal(normalizeAnnotation({ comment: '' }).kind, 'highlight');
    assert.deepEqual(filterNotes([highlight, note]).displayedNotes.map(n => n.id), ['n']);
    assert.equal(filterNotes([highlight, note], true).displayedNotes.length, 2);
    for (const seed of getSeedNotes()) assert.equal(seed.color, seed.comment.trim() ? 'green' : 'yellow');
    const dom = new JSDOM('<article>原文</article>');
    const oldDocument = globalThis.document, oldFilter = globalThis.NodeFilter;
    try {
        globalThis.document = dom.window.document; globalThis.NodeFilter = dom.window.NodeFilter;
        const { renderAnnotationTokens } = await import('../../dist/client/features/reader/annotationRenderer.js');
        const paper = document.querySelector('article');
        renderAnnotationTokens(paper, [highlight, note], 1);
        const token = paper.querySelector('.annotation-token');
        assert.equal(token.classList.contains('has-highlight'), true, '黄色背景标记');
        assert.equal(token.classList.contains('has-note'), true, '独立红色下划线标记');
        assert.equal(token.dataset.highlightIds, 'h'); assert.equal(token.dataset.noteIds, 'n');
        assert.equal(paper.textContent, '原文');
        console.log('✅ 实际领域模型、历史类型推断、种子颜色、显示过滤和重叠标记通过');
    } finally {
        dom.window.close();
        if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
        if (oldFilter === undefined) delete globalThis.NodeFilter; else globalThis.NodeFilter = oldFilter;
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
