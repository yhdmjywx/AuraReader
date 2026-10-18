const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM(`<body><main class="immersive-notes"><div id="reader-viewport"><article id="paper"></article></div><section id="notes-panel"><div id="list"><div id="empty"><p></p></div></div></section></main><button id="outside">继续阅读</button></body>`, { url: 'http://localhost/' });
    const globals = ['window', 'document', 'localStorage'];
    const originals = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let setDB;
    try {
        globals.forEach(key => { globalThis[key] = dom.window[key]; });
        ({ setDB } = await import('../../src/client/infrastructure/bookRepository.js'));
        const { AnnotationController } = await import('../../src/client/features/annotations/annotationController.js');
        const { SelectionController } = await import('../../src/client/features/annotations/selectionController.js');
        const { applyMarginGeometry, positionMarginNotes } = await import('../../src/client/features/layout/marginNotesLayout.js');
        const { ReaderController } = await import('../../src/client/features/reader/readerController.js');
        const { AppCoordinator } = await import('../../src/client/app/appCoordinator.js');
        const { Session } = await import('../../src/client/app/session.js');
        const { saveBookToDB } = await import('../../src/client/infrastructure/bookRepository.js');
        setDB(null);
        const byId = id => document.getElementById(id);
        const elements = { notesList: byId('list'), emptyNotesState: byId('empty'), workspaceContainer: document.querySelector('main'), bookPaper: byId('paper'), notesPanel: byId('notes-panel') };
        const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
        let width = 1613;
        Object.defineProperty(elements.workspaceContainer, 'clientWidth', { get: () => width });
        elements.workspaceContainer.getBoundingClientRect = () => box(0, 0, width, 800);
        byId('reader-viewport').getBoundingClientRect = () => box(0, 0, width, 760);
        elements.bookPaper.getBoundingClientRect = () => box(210, 0, 1192, 760);
        applyMarginGeometry(elements, 'double');
        const session = new Session('inline-a');
        const focusFrames = [];
        window.requestAnimationFrame = callback => { focusFrames.push(callback); return focusFrames.length; };
        let paints = 0;
        const controller = new AnnotationController({ callbacks: {
            getCurrentBookId: () => session.getCurrentBookId(),
            getCurrentChapter: () => '第一章',
            getVisibleAnnotationIds: () => new Set(controller.getRenderingNotes().map(note => note.id)),
            onNotesChanged: notes => {
                paints++;
                elements.bookPaper.replaceChildren();
                notes.forEach(note => {
                    const token = document.createElement('span');
                    token.className = 'annotation-token'; token.dataset.noteIds = note.id;
                    token.getClientRects = () => [box(230, 130, 150, 25)];
                    elements.bookPaper.appendChild(token);
                });
                controller.refreshVisibleNotes();
                positionMarginNotes(elements);
                if (controller.inlineEdit?.opening) {
                    assert.notEqual(document.activeElement, elements.notesList.querySelector('.note-editor'), '正文和页边完成重绘前不提前交接焦点');
                }
            }
        } });
        controller.initUI(elements);
        const editor = () => elements.notesList.querySelector('.note-editor');
        const input = text => {
            const node = editor(); node.value = text;
            node.dispatchEvent(new window.Event('input', { bubbles: true }));
            return node;
        };
        const key = (name, options = {}) => {
            const event = new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...options });
            editor().dispatchEvent(event); return event;
        };
        const stored = book => JSON.parse(localStorage.getItem(`aura_notes_${book}`) || '[]');
        const location = { page: 1, sectionId: 'chapter-1', start: 2, end: 9 };

        // Exercise the actual selection-button path: no second click or dialog.
        const button = document.createElement('button'); document.body.appendChild(button);
        const selection = new SelectionController({ callbacks: { onCreateNote: data => {
            assert.equal(window.getSelection().rangeCount, 0, '正文选区必须在创建并聚焦编辑框之前清除');
            assert.equal(selection.pendingSelection, null);
            controller.createNote(data);
        } } });
        selection.initUI({ btnAddNote: button });
        elements.bookPaper.textContent = '关联的原文';
        const range = document.createRange(); range.selectNodeContents(elements.bookPaper);
        window.getSelection().addRange(range);
        selection.pendingSelection = { text: '关联的原文', page: 1, location };
        button.focus();
        button.click();
        const draftId = controller.editingNoteId;
        assert.equal(document.activeElement, editor(), '点击记笔记后直接获得焦点');
        assert.equal(editor().value, '');
        assert.equal(controller.getNotes().length, 0, '空草稿不进入保存或导出集合');
        assert.equal(stored('inline-a').length, 0);
        assert.equal(document.querySelector('#note-modal'), null);
        assert.equal(elements.notesList.querySelectorAll('.note-editor').length, 1);
        const current = input('第一行\n第二行\n');
        assert.equal(stored('inline-a')[0].comment, current.value, '退出前已持久化，末尾换行不被裁剪');
        const count = paints;
        current.setSelectionRange(2, 2);
        for (let i = 0; i < 25; i++) {
            controller.renderNotesUI();
            controller.refreshVisibleNotes();
        }
        assert.equal(editor(), current, '多次刷新不重建正在输入的 textarea');
        assert.equal(document.activeElement, current);
        assert.equal(current.selectionStart, 2);
        assert.equal(paints, count, '输入期间无需反复重绘正文标记');
        assert.equal(key('Enter').defaultPrevented, false);
        assert.equal(key('Enter', { shiftKey: true }).defaultPrevented, false);
        current.dispatchEvent(new window.CompositionEvent('compositionstart', { bubbles: true }));
        key('Escape'); assert.equal(editor(), current, '中文组词期间 Esc 不结束笔记');
        current.dispatchEvent(new window.CompositionEvent('compositionend', { bubbles: true }));
        for (const nextWidth of [1440, 1366, 1920]) {
            width = nextWidth;
            applyMarginGeometry(elements, 'double'); positionMarginNotes(elements);
            assert.equal(editor(), current);
            assert.equal(document.activeElement, current, '笔记侧边／底部重排保留焦点');
            assert.equal(current.selectionStart, 2);
        }
        key('Escape');
        await controller.finishInlineEdit();
        byId('outside').focus();
        focusFrames.splice(0).forEach(callback => callback());
        assert.equal(document.activeElement, byId('outside'), '下一帧的聚焦检查不能抢回已退出笔记的焦点');
        assert.equal(editor(), null);
        assert.equal(controller.getNotes()[0].id, draftId);
        assert.deepEqual(controller.getNotes()[0].location.start, location.start);
        assert.equal(controller.getNotes()[0].quote, '关联的原文');
        assert.equal(elements.notesList.querySelector('.note-comment-text').textContent, '第一行\n第二行\n');
        byId(`card-${draftId}`).click();
        assert.equal(document.activeElement, editor(), '点击已有笔记直接继续编辑');
        input('修改后的内容'); key('Enter', { ctrlKey: true });
        await controller.finishInlineEdit();
        assert.equal(stored('inline-a')[0].comment, '修改后的内容');

        // Blank creation and independent highlights/notes sharing one range.
        controller.createNote({ quote: '关联的原文', location });
        input(' \n '); key('Escape'); await controller.finishInlineEdit();
        assert.equal(controller.getNotes().length, 1);
        const highlight = await controller.createHighlight({ quote: '关联的原文', location });
        controller.createNote({ quote: '关联的原文', location });
        input('同一原文的第二条笔记');
        const secondId = controller.editingNoteId;
        controller.openNoteModal('', draftId);
        assert.equal(controller.editingNoteId, draftId, '已有编辑会话不能挡住切换至另一条笔记');
        assert.equal(editor().value, '修改后的内容');
        controller.openNoteModal('', secondId);
        assert.equal(editor().value, '同一原文的第二条笔记');
        byId('outside').dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
        assert.equal(editor(), null, '点击外部即可退出，不阻止后续阅读');
        byId(`card-${secondId}`).click(); input(''); key('Escape'); await controller.finishInlineEdit();
        assert.ok(!controller.getNotes().some(note => note.id === secondId));
        assert.ok(controller.getNotes().some(note => note.id === draftId));
        assert.ok(controller.getNotes().some(note => note.id === highlight.id && note.kind === 'highlight'));

        // Out-of-date async DB completion cannot overwrite the latest local input.
        const transactions = [];
        setDB({ transaction: () => {
            const tx = { objectStore: () => ({ put: note => { tx.snapshot = note; }, delete: id => { tx.removed = id; } }) };
            transactions.push(tx); return tx;
        } });
        byId(`card-${draftId}`).click();
        input('旧版本'); input('新版本');
        transactions[0].oncomplete(); await Promise.resolve();
        assert.equal(stored('inline-a').find(note => note.id === draftId).comment, '新版本');
        transactions[1].oncomplete();
        await controller.finishInlineEdit();
        assert.equal(transactions[0].snapshot.comment, '旧版本');
        assert.equal(transactions[1].snapshot.comment, '新版本');
        setDB(null);

        // Book switches await outstanding writes while the source book is active.
        await saveBookToDB({ id: 'inline-b', title: '第二本书', pages: ['正文'] });
        byId(`card-${draftId}`).click(); input('换书前最后一句');
        const coordinator = new AppCoordinator({ session, annotationController: controller, readerController: { setBook() {}, renderPage() {} } });
        await coordinator.openBook('inline-b');
        assert.equal(editor(), null);
        assert.equal(session.getCurrentBookId(), 'inline-b');
        assert.equal(controller.getNotes().length, 0);
        assert.equal(stored('inline-a').find(note => note.id === draftId).comment, '换书前最后一句');
        assert.equal(stored('inline-b').length, 0);
        session.setCurrentBookId('inline-a'); await controller.loadNotesForBook('inline-a');
        assert.equal(controller.getNotes().find(note => note.id === draftId).comment, '换书前最后一句');
        controller.openNoteModal('', draftId);
        input('翻页前输入');
        const reader = new ReaderController({ callbacks: { beforeNavigate: () => { controller.finishInlineEdit(); return controller.getNotes(); } } });
        reader.setBook('navigation', { pages: ['第一页', '第二页'] });
        reader.renderPage(2);
        assert.equal(editor(), null, '直接调用翻页也结束原位编辑');
        assert.equal(stored('inline-a').find(note => note.id === draftId).comment, '翻页前输入');
        const html = fs.readFileSync('src/client/index.html', 'utf8');
        assert.ok(!html.includes('id="note-modal"') && !html.includes('id="btn-confirm-modal"'));
        assert.match(fs.readFileSync('src/client/styles.css', 'utf8'), /caret-color:\s*#d95353/);
        console.log('✅ 原位笔记：自动聚焦、即时持久化、换行、IME、退出、空笔记、焦点与光标稳定、布局重排、异步写入隔离及换书翻页通过');
    } finally {
        setDB?.(null);
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exit(1); });
