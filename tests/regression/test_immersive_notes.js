const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<main class="workspace-container immersive-notes"><section id="reader"><div id="reader-viewport"><article id="paper"></article></div></section><section id="panel"><div id="list"><div id="empty"><p></p></div></div></section></main><div id="modal"><h3></h3></div><div id="quote"></div><textarea id="comment"></textarea><button id="confirm"></button>', { url: 'http://localhost/' });
    const keys = ['window', 'document', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        for (const key of keys) globalThis[key] = dom.window[key];
        const { marginGeometry, applyMarginGeometry, positionMarginNotes } = await import('../../dist/client/features/layout/marginNotesLayout.js');
        const { LayoutController } = await import('../../dist/client/features/layout/layoutController.js');
        const { renderNotesList } = await import('../../dist/client/features/annotations/notesUI.js');
        for (const width of [800, 843, 844, 1224, 1366, 1424, 1440, 1611, 1612, 1613, 1920]) {
            const g = marginGeometry(width, 'double');
            if (width >= 1612) {
                assert.equal(g.readingWidth, 1192, `${width}px 窗口不能压缩双页正文`);
                assert.equal(g.readingLeft, (width - 1192) / 2, '双页正文保持居中');
            } else {
                assert.ok(g.readingWidth <= 560, '放不下双侧笔记时使用单页正文');
            }
            assert.equal(g.placement, width >= 1612 ? 'flanks' : 'right', '仅保留双页双侧和单页右侧笔记');
            assert.ok(g.readingLeft >= 16);
            assert.ok(g.rightNoteLeft + g.noteWidth <= width, '右侧笔记完整保留在窗口内');
        }
        assert.equal(marginGeometry(1613, 'double').noteWidth, 176.5);
        assert.equal(marginGeometry(1920, 'double').noteWidth, 260);
        assert.equal(marginGeometry(800, 'single').readingWidth, 516, '最小桌面窗口收窄正文以保留右侧笔记');
        assert.equal(marginGeometry(1613, 'single').readingWidth, 560);
        assert.equal(marginGeometry(1613, 'single').noteWidth, 260);
        assert.equal(marginGeometry(1440, 'single').placement, 'right', '单页仍保留右侧笔记');

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
        assert.equal(layout.isDoublePageEffective(), false, '放不下双页及双侧笔记时暂用单页');
        assert.equal(layout.getLayoutMode(), 'double', '保留双页偏好');
        layout.checkResponsiveLayout(1612);
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
        width = 1440; applyMarginGeometry(elements, 'single'); positionMarginNotes(elements);
        assert.equal(elements.notesList.querySelectorAll('.margin-notes-lane').length, 1);
        assert.equal(byId('card-left'), card, '排版时复用卡片，保留焦点和监听');
        const ordered = [...elements.notesList.querySelectorAll('.note-card')].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top));
        ordered.slice(1).forEach((node, index) => assert.ok(parseFloat(node.style.top) >= parseFloat(ordered[index].style.top) + 180 + 24, '同侧笔记不得互相覆盖'));
        layout.checkResponsiveLayout(width); layout.updateLayoutClasses(); positionMarginNotes(elements);
        assert.equal(layout.getEffectiveReaderMode(), 'single');
        assert.equal(workspace.dataset.notesPlacement, 'right');
        assert.equal(workspace.style.getPropertyValue('--reading-width'), '560px');
        assert.equal(elements.notesList.querySelector('[data-margin-side="right"]').style.height, '768px');
        assert.equal(byId('card-left'), card, '降级为单页时仍复用原卡片');
        width = 1612; applyMarginGeometry(elements, 'double'); positionMarginNotes(elements);
        assert.equal(workspace.dataset.notesPlacement, 'flanks');
        assert.equal(elements.notesList.querySelectorAll('.margin-notes-lane').length, 2);
        assert.equal(card.parentElement.dataset.marginSide, 'left', '窗口扩大后恢复左页笔记位置');
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
