const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM(`<!doctype html><body>
        <div id="reader-viewport"><div id="paper"></div><div id="right"></div></div>
        <div id="notes"><div id="empty"><p></p></div></div>
        <span id="count"></span><span id="total"></span><span id="pure"></span><button id="toggle"></button>
    </body>`, { url: 'http://localhost:8095/' });
    const keys = ['window', 'document', 'localStorage', 'NodeFilter'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        for (const key of keys) globalThis[key] = dom.window[key];
        const { collectVisibleAnnotationIds } = await import('../../src/client/features/reader/visibleAnnotations.js');
        const { AnnotationController } = await import('../../src/client/features/annotations/annotationController.js');
        const { ReaderController } = await import('../../src/client/features/reader/readerController.js');
        const { setDB } = await import('../../src/client/infrastructure/bookRepository.js');
        setDB(null);
        const byId = id => document.getElementById(id);
        const viewport = byId('reader-viewport');
        const paper = byId('paper');
        const right = byId('right');
        const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
        let viewportRect = rect(0, 0, 560, 500);
        viewport.getBoundingClientRect = () => viewportRect;
        paper.getBoundingClientRect = () => rect(0, 0, viewportRect.width, 500);
        right.getBoundingClientRect = () => rect(600, 0, 400, 500);
        right.style.display = 'none';

        const fragments = new Map();
        function token(id, boxes, options = {}) {
            const span = document.createElement('span');
            span.className = 'annotation-token';
            span.setAttribute(options.highlight ? 'data-highlight-ids' : 'data-note-ids', id);
            span.textContent = options.text ?? `原文-${id}`;
            span.getClientRects = () => fragments.get(id);
            fragments.set(id, boxes);
            (options.right ? right : paper).appendChild(span);
            return span;
        }
        token('left', [rect(20, 30, 200, 20)]);
        token('right-page', [rect(650, 60, 200, 20)]);
        token('next-screen', [rect(1100, 60, 200, 20)]);
        token('cross', [rect(-120, 100, 80, 20), rect(30, 120, 200, 20), rect(1200, 120, 80, 20)]);
        token('union-only', [rect(-120, 180, 80, 20), rect(1200, 180, 80, 20)]);
        token('below', [rect(30, 600, 80, 20)]);
        token('boundary', [rect(560, 200, 80, 20)]);
        // Reproduces Chrome at a fractional zoom/DPI: a previous-column line
        // ends 0.000008px inside the next page even though it is fully clipped.
        token('rounding-left', [rect(-560, 330, 560.000008, 20)]);
        token('rounding-right', [rect(559.999992, 360, 80, 20)]);
        token('rounding-top', [rect(40, -20, 80, 20.000008)]);
        token('rounding-bottom', [rect(40, 499.999992, 80, 20)]);
        token('partial-visible', [rect(-79.75, 420, 80, 20)]);
        token('blank', [rect(40, 240, 80, 20)], { text: ' \n ' });
        token('highlight', [rect(30, 280, 100, 20)], { highlight: true });
        token('hidden-right', [rect(650, 80, 150, 20)], { right: true });
        const getVisible = () => collectVisibleAnnotationIds([paper, right], viewport);
        assert.deepEqual([...getVisible()].sort(), ['cross', 'highlight', 'left', 'partial-visible'], '只接受真实文字片段交集，排除页边浮点误差，并保留真实的部分可见引用');

        viewportRect = rect(0, 0, 1000, 500);
        assert.ok(getVisible().has('right-page'), '双页范围包含右页');
        assert.ok(!getVisible().has('hidden-right'), '隐藏的旧右页不能进入范围');
        right.style.display = 'block';
        assert.ok(getVisible().has('hidden-right'), '非章节双页模式也读取可见的右页纸张');
        right.style.display = 'none';

        const elements = {
            notesList: byId('notes'), emptyNotesState: byId('empty'),
            countHighlights: byId('count'), notesTotalCount: byId('total'),
            countPureHighlights: byId('pure'), btnToggleShowHighlights: byId('toggle')
        };
        const messages = [];
        const annotations = new AnnotationController({ callbacks: {
            getCurrentBookId: () => 'visibility-test',
            getVisibleAnnotationIds: getVisible,
            showToast: message => messages.push(message)
        } });
        const all = ['left', 'right-page', 'next-screen', 'cross', 'below'].map(id => ({
            id, bookId: 'visibility-test', kind: 'note', page: 1, quote: `原文-${id}`, comment: `笔记-${id}`
        }));
        all.push({ id: 'highlight', kind: 'highlight', page: 1, quote: '划线原文' });
        all.push({ id: 'legacy', kind: 'note', page: 1, quote: '', comment: '旧独立随笔' });
        annotations.notes = all;
        annotations.initUI(elements);
        annotations.renderNotesUI();
        const cards = () => [...elements.notesList.querySelectorAll('.note-card')].map(card => card.dataset.annotationId);
        assert.deepEqual(cards(), ['left', 'right-page', 'cross']);
        assert.equal(elements.notesTotalCount.textContent, '3');
        assert.equal(elements.countPureHighlights.textContent, '1');
        assert.equal(annotations.getNotes().length, 7, '侧栏过滤不改变全书数据和导出来源');

        viewportRect = rect(0, 0, 560, 500);
        annotations.refreshVisibleNotes();
        assert.deepEqual(cards(), ['left', 'cross'], '侧栏展开收窄正文后更新当前屏幕笔记');
        const originalCard = elements.notesList.querySelector('.note-card');
        annotations.refreshVisibleNotes();
        assert.equal(elements.notesList.querySelector('.note-card'), originalCard, '可见条目未变时不重建卡片，保留侧栏滚动和焦点');
        annotations.toggleShowHighlightsInSidebar();
        assert.deepEqual(cards(), ['left', 'cross', 'highlight']);

        fragments.set('left', [rect(-600, 30, 200, 20)]);
        fragments.set('right-page', [rect(20, 60, 200, 20)]);
        fragments.set('cross', [rect(-120, 100, 80, 20), rect(-20, 120, 40, 20)]);
        annotations.refreshVisibleNotes();
        assert.deepEqual(cards(), ['right-page', 'cross', 'highlight'], '翻页后重新判断范围，跨屏引用有一部分可见就保留');
        fragments.set('right-page', [rect(20, -60, 200, 20)]);
        fragments.set('below', [rect(20, 480, 80, 40)]);
        annotations.refreshVisibleNotes();
        assert.deepEqual(cards(), ['cross', 'below', 'highlight'], '连续滚动中上下边界的部分可见引用也进入列表');

        annotations.setNotesScope('book');
        assert.deepEqual(cards(), ['left', 'right-page', 'next-screen', 'cross', 'below', 'highlight'], '全书接口可查询所有有原文的标注，不展示旧独立随笔');
        assert.equal(annotations.getNotes().length, 7, '旧独立随笔仍保留，备份不丢数据');
        for (const id of fragments.keys()) fragments.set(id, [rect(2000, 2000, 20, 20)]);
        annotations.setNotesScope('page');
        assert.deepEqual(cards(), []);
        assert.ok(elements.notesList.contains(elements.emptyNotesState), '空状态节点不能在重绘时被移出侧栏');
        assert.equal(elements.emptyNotesState.style.display, 'block');
        assert.equal(elements.emptyNotesState.querySelector('p').textContent, '当前页暂无划线与笔记');

        const before = annotations.getNotes().length;
        await annotations.saveQuickNote('不再创建独立随笔');
        annotations.createNote({ quote: '  ' });
        await annotations.saveModalNote({ quote: '', comment: '无原文笔记' });
        await annotations.addOrUpdateNote({ id: 'no-quote', kind: 'note', comment: '无原文笔记' });
        assert.equal(annotations.getNotes().length, before, '所有用户创建入口均拒绝无引用笔记');
        assert.ok(messages.includes('请先在正文中选择需要引用的文字'));
        await annotations.saveModalNote({ quote: '选中的原文', comment: '合法笔记', page: 1 });
        assert.equal(annotations.getNotes().length, before + 1, '引用笔记仍可保存');
        const saved = annotations.getNotes()[0];
        annotations.openNoteModal(saved.quote, saved.id, 1);
        await annotations.saveModalNote({ comment: '编辑后的笔记' });
        assert.equal(annotations.getNotes()[0].comment, '编辑后的笔记');
        await annotations.deleteNote(saved.id);
        assert.equal(annotations.getNotes().length, before);

        const reader = new ReaderController();
        reader.elements = { bookPaper: paper, bookPaperRight: right };
        assert.deepEqual([...reader.getVisibleAnnotationIds()], []);
        let changed = 0;
        reader.callbacks.onViewportChange = () => changed++;
        reader.initUI(reader.elements);
        paper.dispatchEvent(new window.Event('scroll'));
        paper.dispatchEvent(new window.Event('scroll'));
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(changed, 1, '捕获不冒泡的正文横向滚动，并合并同一帧的通知');
        reader.refitAfterTypography();
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(changed, 2, '非章节模式调整字体后也重新判断可见范围');

        const html = fs.readFileSync(path.join(__dirname, '../../src/client/index.html'), 'utf8');
        assert.ok(!html.includes('id="quick-note-input"') && !html.includes('id="btn-save-quick-note"'), '页面不再提供独立随笔输入框');
        console.log('✅ 当前屏幕笔记：单双页、跨屏/跨行片段、滚动、范围切换、全书数据保留及引用约束全部通过');
    } finally {
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
        dom.window.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
