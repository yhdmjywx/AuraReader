const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<main class="workspace-container immersive-notes"><section id="reader"><div id="reader-viewport"><article id="paper"></article></div></section><section id="panel"><div id="list"><div id="empty"><p></p></div></div></section></main><div id="modal"><h3></h3></div><div id="quote"></div><textarea id="comment"></textarea><button id="confirm"></button>', { url: 'http://localhost/' });
    const keys = ['window', 'document', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        for (const key of keys) globalThis[key] = dom.window[key];
        const { marginGeometry, applyMarginGeometry, positionMarginNotes } = await import('../../src/client/features/layout/marginNotesLayout.js');
        const { LayoutController } = await import('../../src/client/features/layout/layoutController.js');
        const { renderNotesList } = await import('../../src/client/features/annotations/notesUI.js');
        for (const width of [1224, 1366, 1424, 1440, 1612, 1613, 1920]) {
            const g = marginGeometry(width, 'double');
            assert.equal(g.readingWidth, 1192, `${width}px 窗口不能压缩双页正文`);
            assert.ok(g.readingLeft >= 16 || g.placement === 'flanks');
            if (g.placement !== 'bottom') assert.ok(g.rightNoteLeft + g.noteWidth <= width);
        }
        assert.equal(marginGeometry(1613, 'double').noteWidth, 176.5);
        assert.equal(marginGeometry(1920, 'double').noteWidth, 260);
        assert.equal(marginGeometry(1440, 'double').placement, 'right');
        assert.equal(marginGeometry(1440, 'double').noteWidth, 192);
        assert.equal(marginGeometry(1366, 'double').bandHeight, 168);
        assert.equal(marginGeometry(1613, 'single').readingWidth, 560);
        assert.equal(marginGeometry(1613, 'single').noteWidth, 260);

        const byId = id => document.getElementById(id);
        const workspace = document.querySelector('main');
        let width = 1613;
        Object.defineProperty(workspace, 'clientWidth', { get: () => width });
        Object.defineProperty(workspace, 'clientHeight', { get: () => 876 });
        const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
        workspace.getBoundingClientRect = () => box(0, 52, width, 876);
        byId('reader-viewport').getBoundingClientRect = () => box(0, 52, width, 832);
        byId('paper').getBoundingClientRect = () => box(210.5, 84, 1192, 768);
        const elements = { workspaceContainer: workspace, readerPanel: byId('reader'), bookPaper: byId('paper'), notesPanel: byId('panel'), notesList: byId('list'), emptyNotesState: byId('empty'), noteModal: byId('modal'), modalQuotePreview: byId('quote'), modalNoteTextarea: byId('comment'), btnConfirmModal: byId('confirm') };
        localStorage.setItem('aura_sidebar_collapsed', 'true');
        const layout = new LayoutController();
        layout.initUI(elements);
        assert.notEqual(elements.notesPanel.style.display, 'none', '旧收起偏好不能隐藏沉浸式笔记');
        assert.equal(localStorage.getItem('aura_sidebar_collapsed'), 'true', '无需改写旧设置数据');
        assert.equal(workspace.classList.contains('sidebar-collapsed'), false);
        localStorage.setItem('aura_reader_width', '25');
        layout.updateLayoutClasses();
        assert.equal(workspace.style.getPropertyValue('--reading-width'), '560px', '旧拖动比例不参与当前几何计算');
        assert.equal(localStorage.getItem('aura_reader_width'), '25', '历史配置保留原值');
        layout.setPageMode('double', 1366);
        assert.equal(layout.isDoublePageEffective(), true);
        layout.checkResponsiveLayout(1223);
        assert.equal(layout.isDoublePageEffective(), false, '放不下完整双页时用原有降级流程');
        layout.checkResponsiveLayout(1613);
        assert.equal(layout.isDoublePageEffective(), true);
        layout.updateLayoutClasses();

        function token(id, rects) {
            const node = document.createElement('span');
            node.className = 'annotation-token'; node.dataset.noteIds = id; node.textContent = '原文';
            node.getClientRects = () => rects;
            elements.bookPaper.appendChild(node);
        }
        token('left', [box(250, 200, 150, 24)]);
        token('right', [box(-349.5, 100, 560.000008, 24), box(900, 240, 200, 24)]);
        token('cross', [box(240, 650, 120, 24), box(900, 100, 180, 24)]);
        const notes = ['left', 'right', 'cross'].map(id => ({ id, kind: 'note', quote: `引用-${id}`, comment: `正文笔记-${id}\n保留第二行`, page: 1, location: { page: 1, start: 10, end: 20 } }));
        const original = JSON.stringify(notes);
        let edited, jumped, deleted;
        renderNotesList({ elements, notes, onEdit: note => edited = note, onJump: note => jumped = note, onDelete: note => deleted = note });
        assert.equal(elements.notesList.querySelectorAll('.note-quote-text, .note-card-header').length, 0, '页边不渲染引用、章节和日期');
        assert.equal(elements.notesList.querySelector('.note-comment-text').textContent, notes[0].comment);
        const leftLane = elements.notesList.querySelector('[data-margin-side="left"]');
        assert.deepEqual([...leftLane.children].map(card => card.dataset.annotationId), ['left', 'cross'], '跨栏引用仍归于可见的左侧起点');
        const card = byId('card-left');
        card.click(); assert.equal(edited.quote, notes[0].quote);
        assert.equal(jumped, undefined, '点击笔记进入原位编辑，不再跳动正文');
        card.querySelector('.btn-delete-note').click(); assert.equal(deleted.id, notes[0].id);
        assert.equal(card.querySelector('.btn-edit-note'), null, '点击文字即可编辑，不增加编辑按钮');

        for (const node of elements.notesList.querySelectorAll('.note-card')) Object.defineProperty(node, 'offsetHeight', { value: 180 });
        width = 1440; applyMarginGeometry(elements, 'double'); positionMarginNotes(elements);
        assert.equal(elements.notesList.querySelectorAll('.margin-notes-lane').length, 1);
        assert.equal(byId('card-left'), card, '排版时复用卡片，保留焦点和监听');
        const ordered = [...elements.notesList.querySelectorAll('.note-card')].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top));
        ordered.slice(1).forEach((node, index) => assert.ok(parseFloat(node.style.top) >= parseFloat(ordered[index].style.top) + 180 + 24, '同侧笔记不得互相覆盖'));
        width = 1366; applyMarginGeometry(elements, 'double'); positionMarginNotes(elements);
        assert.equal(workspace.dataset.notesPlacement, 'bottom');
        assert.equal(workspace.style.getPropertyValue('--note-band-height'), '168px');
        assert.equal(elements.notesList.querySelector('[data-margin-side="right"]').style.height, '144px');
        elements.bookPaper.style.setProperty('--bg-paper-text', '#d1d5db');
        elements.bookPaper.style.color = 'rgb(29, 33, 41)';
        positionMarginNotes(elements);
        assert.equal(elements.notesPanel.style.getPropertyValue('--margin-note-color'), '#d1d5db', '使用纸张主题目标颜色，不截取过渡动画的旧颜色');
        assert.equal(JSON.stringify(notes), original, 'UI 排版和简化展示不能改变原文引用、位置或笔记内容');
        renderNotesList({ elements, notes: [] });
        assert.equal(elements.notesList.querySelectorAll('.margin-notes-lane').length, 0);
        console.log('✅ 沉浸式笔记：固定行宽、响应排列、跨栏锚点、长笔记避让、旧折叠状态、原有操作和数据完整性通过');
    } finally {
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
        dom.window.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
