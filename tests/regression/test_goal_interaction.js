const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { JSDOM } = require('jsdom');
const { createDataStore } = require('../../src/server/dataStore');

(async () => {
    const root = path.resolve('.commandcode/goal-interaction'); fs.mkdirSync(root, { recursive: true });
    const store = createDataStore(fs.mkdtempSync(path.join(root, 'run-')));
    const dom = new JSDOM(fs.readFileSync('src/client/index.html', 'utf8'), { url: 'http://localhost' });
    global.window = dom.window; global.document = dom.window.document; global.localStorage = dom.window.localStorage;
    global.HTMLElement = dom.window.HTMLElement;
    const { configureStorage } = await import('../../dist/client/infrastructure/storageClient.js');
    let gate = null;
    const response = body => ({ ok: true, status: 200, json: async () => body });
    configureStorage({ sourceId: 'goal-test', fetch: async (url, options = {}) => {
        const route = url.split('/').at(-1), command = options.body ? JSON.parse(options.body) : null;
        if (route === 'session') return response({ token: 'test' });
        if (url.endsWith('migration/status')) return response({ completed: true });
        if (url.endsWith('goals/library/save') && gate) { const current = gate; gate = null; current.enter(); await current.wait; }
        try {
            if (url.endsWith('goals/library')) return response(store.goalLibrary());
            if (url.endsWith('goals/library/save')) return response(store.saveGoalLibrary(command));
            if (url.endsWith('goals/query')) return response({ records: store.goals(command.bookIds) });
            if (url.endsWith('goals/save')) return response(store.saveGoals(command));
            if (url.endsWith('notes/save')) return response(store.saveNote(command));
            if (url.endsWith('notes/delete')) return response(store.deleteNote(command));
            if (url.endsWith('notes/query')) return response({ records: store.notes(command.bookIds) });
            if (route === 'books') return response({ records: store.books() });
            throw new Error('Unexpected ' + url);
        } catch (error) { return { ok: false, status: error.status || 500, json: async () => ({ error: error.message }) }; }
    } });
    const book = { id: 'a', title: 'A', pages: ['<p>Source</p>', '<p>Second</p>'] };
    const version = store.saveBook({ opId: randomUUID(), expected: 0, book });
    const notes = [
        { id: 'n', bookId: 'a', kind: 'note', quote: 'Source', comment: 'My own words', page: 1 },
        { id: 'h', bookId: 'a', kind: 'highlight', quote: 'Source', comment: '', page: 1 }
    ];
    notes.forEach(note => store.saveNote({ opId: randomUUID(), expected: 0, generation: version.generation, note }));
    const { GoalController } = await import('../../dist/client/features/goals/goalController.js');
    const { AnnotationController } = await import('../../dist/client/features/annotations/annotationController.js');
    const { pendingLibrary, libraryDrafts } = await import('../../dist/client/infrastructure/goalLibraryRepository.js');
    const elements = { goalPanel: document.getElementById('goal-panel'), workspaceContainer: document.getElementById('workspace-container'),
        goalSidebar: document.getElementById('goal-sidebar'), goalResizer: document.getElementById('goal-resizer'),
        btnGoals: document.getElementById('btn-goals'), readingWorkspace: document.getElementById('reading-workspace'),
        bookPaper: document.getElementById('book-paper'), notesList: document.getElementById('notes-list') };
    Object.defineProperty(elements.workspaceContainer, 'clientWidth', { value: 1613, configurable: true });
    let page = 1, mode = 'single'; const failures = [];
    const annotations = new AnnotationController({ callbacks: { getCurrentBookId: () => 'a', getVisibleAnnotationIds: () => new Set(['n', 'h']) } });
    annotations.setNotesForBook(notes); annotations.initUI(elements); annotations.renderNotesUI();
    const goals = new GoalController({ getAnnotations: () => annotations.getNotes(), getLocation: () => ({ bookId: 'a', page, sectionId: 'chapter-' + page, chapter: 'Chapter', totalPages: 2, offset: 0, anchor: '' }),
        getMode: () => mode, showToast: text => failures.push(text), jump: id => { assert.ok(['h', 'n'].includes(id)); },
        finishAnnotations: () => annotations.finishInlineEdit(), annotationsSaved: () => annotations.assertInlineWritesSaved() });
    annotations.callbacks.onAnnotationContentChanged = () => goals.refreshAnnotations();
    goals.initUI(elements); await goals.initialize();
    const click = selector => { const control = document.querySelector(selector); assert.ok(control, selector); control.click(); };
    const input = text => { goals.ui.editor.value = text; goals.ui.editor.dispatchEvent(new window.Event('input', { bubbles: true })); };
    click('[aria-label="New goal"]'); input('What do I want to understand?\n我的问题');
    assert.equal(libraryDrafts().length, 1); assert.equal(store.goalLibrary().value.goals.length, 0, 'new drafts are not committed nodes');
    goals.edit = null; goals.render();
    goals.ready = null; await goals.initialize();
    assert.equal(goals.ui.editor.value, 'What do I want to understand?\n我的问题', 'uncommitted draft restores into the existing editor');
    await goals.finishInlineEdit(); assert.equal(store.goalLibrary().value.goals.length, 1); assert.equal(libraryDrafts().length, 0);
    assert.equal(goals.selected,null,'creating at Home stays at the root');
    const parent = goals.state.goals[0].id; click('.goal-child'); assert.equal(goals.selected,parent);
    click('[aria-label="New goal"]'); input('A child question'); const child=goals.edit.draft.id; await goals.finishInlineEdit();
    assert.equal(goals.selected,parent,'creating inside a Goal stays in that folder');
    assert.equal(goals.state.goals.find(g=>g.id===child).parentId,parent);
    click('.goal-child'); assert.equal(goals.selected,child);
    click('#goal-new');input('First new folder');const siblingA=goals.edit.draft.id;
    click('#goal-new');assert.equal(goals.edit.draft.parentId,child,'New while typing creates a sibling at the same level');
    input('Second new folder');await goals.finishInlineEdit();
    assert.equal(goals.selected,child);assert.equal(goals.state.goals.filter(g=>g.parentId===child).length,2);
    assert.equal(goals.state.goals.filter(g=>g.parentId===siblingA).length,0,'New never unexpectedly descends into the draft it just saved');
    click('#goal-up');assert.equal(goals.selected,parent);
    click('#goal-home-nav');assert.equal(goals.selected,null);assert.equal(goals.canLink('n'),false,'root never links to a hidden prior selection');
    assert.equal(document.querySelectorAll('.goal-child').length,1,'root lists immediate Goals only');
    click('.goal-child');click('.goal-child');
    await goals.linkAnnotation('n'); assert.equal(document.querySelectorAll('.goal-item').length, 1);
    assert.equal(document.querySelector('.goal-items-toggle').getAttribute('aria-expanded'), 'true');
    click('.goal-items-toggle'); assert.equal(document.querySelectorAll('.goal-item').length, 0);
    await goals.linkAnnotation('h'); assert.equal(document.querySelectorAll('.goal-item').length, 2);
    await goals.linkAnnotation('h'); assert.equal(store.goalLibrary().value.links.length, 2);
    goals.selectGoal(parent); assert.equal(document.querySelector('.goal-items-toggle'), null);
    goals.selectGoal(child); assert.equal(document.querySelectorAll('.goal-item').length, 2);
    click('.goal-title'); const editor = goals.ui.editor; input('A changed child'); editor.setSelectionRange(3, 3);
    goals.refreshAnnotations(); assert.equal(document.activeElement, editor); assert.equal(editor.selectionStart, 3);
    await goals.finishInlineEdit();
    annotations.openNoteModal('Source', 'n', 1);
    const noteEditor = elements.notesList.querySelector('.note-editor');
    noteEditor.value = 'Revised note'; noteEditor.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(elements.notesList.querySelector('.note-editor'), noteEditor);
    assert.ok(document.querySelector('.goal-items').textContent.includes('Revised note'));
    await annotations.finishInlineEdit(); await annotations.assertInlineWritesSaved();
    page = 2; goals.selectGoal(parent); goals.updateReadingContext(); assert.equal(document.querySelectorAll('.goal-child').length, 1,'folder contents do not disappear on chapter changes');
    page = 1; goals.updateReadingContext(); assert.equal(document.querySelectorAll('.goal-child').length, 1);
    mode = 'double'; goals.updateReadingContext(); assert.equal(elements.goalPanel.hidden, true);
    mode = 'single'; goals.updateReadingContext(); assert.equal(elements.goalPanel.hidden, false);
    goals.selectGoal(child); click('[aria-label="Unlink"]'); await goals.flush(); assert.equal(store.notes(['a']).filter(row => !row.deleted).length, 2);
    // The target belongs to the user's click, even if selection changes while
    // the existing annotation save is still awaiting acknowledgment.
    let releaseAnnotation;
    goals.callbacks.annotationsSaved = () => new Promise(resolve => { releaseAnnotation = resolve; });
    const linking = goals.linkAnnotation('n');
    while (!releaseAnnotation) await Promise.resolve();
    goals.selectGoal(parent);
    let navigationReady = false;
    const finishing = goals.finishInlineEdit().then(() => { navigationReady = true; });
    await Promise.resolve(); assert.equal(navigationReady, false, 'book navigation waits for the captured link');
    releaseAnnotation(); await linking; await finishing;
    assert.equal(goals.selected, parent);
    assert.ok(goals.state.links.some(link => link.goalId === child && link.annotationId === 'n'));
    assert.equal(goals.state.links.some(link => link.goalId === parent && link.annotationId === 'n'), false);
    goals.callbacks.annotationsSaved = () => annotations.assertInlineWritesSaved();
    goals.selectGoal(child);
    // Slow acknowledgment must neither reset the editor nor clear newer input.
    let enter, release;
    const entered = new Promise(resolve => { enter = resolve; });
    gate = { enter, wait: new Promise(resolve => { release = resolve; }) };
    click('.goal-title'); input('First pending'); const saving = goals.flush(); await entered;
    input('Newest pending\n'); release(); await saving; await goals.finishInlineEdit();
    assert.equal(store.goalLibrary().value.goals.find(goal => goal.id === child).text, 'Newest pending\n');
    assert.equal(pendingLibrary().length, 0);
    const confirmed = store.goalLibrary();
    store.saveGoalLibrary({ opId: randomUUID(), expected: confirmed.revision, state: confirmed.value });
    click('.goal-title'); input('Conflict retained');
    await assert.rejects(goals.flush()); assert.equal(pendingLibrary().at(-1).state.goals.find(goal => goal.id === child).text, 'Conflict retained');
    await assert.rejects(goals.assertWritesSaved()); assert.ok(failures.length);
    if (goals.timer) clearTimeout(goals.timer);
    dom.window.close(); store.close();
    console.log('Goal interaction: real SQLite save/recovery, retained editors, automatic expansion, navigation, IME-safe structure, chapters, unlink and stale-write protection passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
