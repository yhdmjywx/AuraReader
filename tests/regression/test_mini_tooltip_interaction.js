const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM(fs.readFileSync('src/client/index.html', 'utf8'), { url: 'http://localhost/' });
    const globals = ['window', 'document', 'localStorage', 'NodeFilter'];
    const originals = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let setDB;
    try {
        globals.forEach(key => { globalThis[key] = dom.window[key]; });
        ({ setDB } = await import('../../src/client/infrastructure/bookRepository.js'));
        setDB(null);
        const { AnnotationController } = await import('../../src/client/features/annotations/annotationController.js');
        const { SelectionController } = await import('../../src/client/features/annotations/selectionController.js');
        const { applyHighlightsToPaper } = await import('../../src/client/features/reader/paperRenderer.js');
        const { showHighlightActionTooltip } = await import('../../src/client/features/annotations/selectionTooltipUI.js');
        const byId = id => document.getElementById(id);
        const elements = {
            readerPanel: byId('reader-panel'), bookPaper: byId('book-paper'), bookPaperRight: byId('book-paper-right'),
            selectionTooltip: byId('selection-tooltip'), highlightActionTooltip: byId('highlight-action-tooltip'),
            btnAddNote: byId('btn-add-note'), btnHlRemove: byId('btn-hl-remove'), btnNoteRemove: byId('btn-note-remove'),
            notesList: byId('notes-list'), emptyNotesState: byId('empty-notes-state'), workspaceContainer: byId('workspace-container')
        };
        const tooltip = elements.highlightActionTooltip;
        assert.equal(tooltip.querySelectorAll('button').length, 2, '已存在标注的菜单只保留删除高亮和删除笔记');
        assert.equal(tooltip.querySelector('.tooltip-divider'), null);
        for (const id of ['btn-hl-view-notes', 'btn-hl-operate', 'btn-hl-add-thought']) assert.equal(byId(id), null);
        const annotations = new AnnotationController({ callbacks: {
            getCurrentBookId: () => 'menu-test',
            getVisibleAnnotationIds: () => new Set(annotations.getNotes().map(note => note.id)),
            onNotesChanged: notes => {
                elements.bookPaper.innerHTML = '<p>同一段正文，后续内容。</p>';
                applyHighlightsToPaper(elements.bookPaper, 1, notes);
                annotations.refreshVisibleNotes();
            }
        } });
        annotations.initUI(elements);
        const location = { page: 1, start: 0, end: 5 };
        const highlight = await annotations.createHighlight({ quote: '同一段正文', location });
        const onlyHighlight = elements.bookPaper.querySelector('.annotation-token');
        let deletion;
        const creations = [];
        const selection = new SelectionController({ callbacks: {
            onDeleteHighlight: ids => { deletion = annotations.deleteHighlights(ids); },
            onDeleteNotes: ids => { deletion = Promise.all(ids.map(id => annotations.deleteNote(id))); },
            onCreateNote: data => creations.push({ type: 'note', ...data }),
            onCreateHighlight: (color, pending) => creations.push({ type: 'highlight', color, ...pending })
        } });
        selection.initUI(elements);
        selection.activateToken(onlyHighlight, 1);
        assert.equal(tooltip.style.display, 'flex', '纯高亮可以直接删除');
        assert.equal(selection.menuOpen, true);
        assert.equal(elements.btnHlRemove.hidden, false);
        assert.equal(elements.btnNoteRemove.hidden, true);

        await annotations.saveModalNote({ quote: '同一段正文', comment: '与高亮独立保存的笔记', location });
        const note = annotations.getNotes().find(item => item.kind === 'note');
        selection.activateToken(elements.bookPaper.querySelector('.annotation-token'), 1, { force: true });
        assert.deepEqual(selection.getActiveAnnotationContext().highlightIds, [highlight.id]);
        assert.deepEqual(selection.getActiveAnnotationContext().noteIds, [note.id]);
        assert.equal(tooltip.style.display, 'flex');
        assert.equal(elements.btnNoteRemove.hidden, false);
        assert.equal(elements.btnHlRemove.hidden, false);
        elements.btnHlRemove.click(); await deletion;
        assert.equal(tooltip.style.display, 'none');
        assert.equal(selection.getActiveAnnotationContext(), null);
        assert.deepEqual(annotations.getNotes().map(item => item.id), [note.id], '删除重叠高亮不会连带删除笔记');
        assert.deepEqual(JSON.parse(localStorage.getItem('aura_notes_menu-test')).map(item => item.id), [note.id]);

        const noteOnly = elements.bookPaper.querySelector('.annotation-token');
        selection.activateToken(noteOnly, 1, { force: true });
        assert.equal(selection.menuOpen, true, '只有笔记时直接显示删除笔记');
        assert.equal(tooltip.style.display, 'flex');
        assert.equal(elements.btnHlRemove.hidden, true);
        assert.equal(elements.btnNoteRemove.hidden, false);
        assert.deepEqual(selection.getActiveAnnotationContext().noteIds, [note.id]);
        showHighlightActionTooltip(elements, noteOnly, { noteIds: [note.id], highlightIds: [] });
        assert.equal(tooltip.style.display, 'flex', '兼容入口也可以显示删除笔记');
        elements.btnNoteRemove.click(); await deletion;
        assert.equal(annotations.getNotes().length, 0);
        assert.equal(elements.bookPaper.querySelector('.annotation-token'), null, '删除笔记同步移除红色下划线');
        assert.deepEqual(JSON.parse(localStorage.getItem('aura_notes_menu-test')), []);

        const remainingHighlight = await annotations.createHighlight({ quote: '同一段正文', location });
        await annotations.saveModalNote({ quote: '同一段正文', comment: '此处第一条笔记', location });
        await annotations.saveModalNote({ quote: '同一段正文', comment: '此处第二条笔记', location });
        selection.activateToken(elements.bookPaper.querySelector('.annotation-token'), 1, { force: true });
        assert.equal(elements.btnNoteRemove.querySelector('span').textContent, '删除笔记（2）', '多条关联笔记显示明确数量');
        elements.btnNoteRemove.click(); await deletion;
        assert.deepEqual(annotations.getNotes().map(item => item.id), [remainingHighlight.id], '删除重叠笔记不会连带删除高亮');
        assert.ok(elements.bookPaper.querySelector('.annotation-token').getAttribute('data-highlight-ids'));
        assert.equal(elements.bookPaper.querySelector('.annotation-token').getAttribute('data-note-ids'), null);
        assert.deepEqual(JSON.parse(localStorage.getItem('aura_notes_menu-test')).map(item => item.id), [remainingHighlight.id]);

        await annotations.saveModalNote({ quote: '同一段正文', comment: '从页边删除的笔记', location });
        const marginNote = annotations.getNotes().find(item => item.kind === 'note');
        const deleteNote = byId('card-' + marginNote.id).querySelector('.btn-delete-note');
        assert.ok(deleteNote, '页边笔记保留原来的删除按钮');
        deleteNote.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.deepEqual(annotations.getNotes().map(item => item.id), [remainingHighlight.id]);

        selection.pendingSelection = { text: '新的选区', page: 1, location };
        elements.btnAddNote.click();
        selection.pendingSelection = { text: '新的选区', page: 1, location };
        document.querySelector('#selection-tooltip [data-color="yellow"]').click();
        assert.deepEqual(creations.map(item => item.type), ['note', 'highlight'], '划选正文后仍可新建笔记和高亮');
        console.log('✅ 标注删除菜单：纯高亮、纯笔记、重叠标注独立删除、多条笔记计数及页边删除与创建入口正常');
    } finally {
        setDB?.(null);
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exit(1); });
