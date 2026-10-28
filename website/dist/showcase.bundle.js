(function(){'use strict';
const factories={"website/demo/demo.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountShowcase = mountShowcase;
const reader_js_1 = require("website/demo/reader.js");
const memory_storage_js_1 = require("website/demo/memory-storage.js");
const export_preview_js_1 = require("website/demo/export-preview.js");
const PLAYBACK_RATE = 1.3;
async function mountShowcase(host, { onEvent = () => { } } = {}) {
    host.style.setProperty('--demo-move-duration', `${320 / PLAYBACK_RATE}ms`);
    let state = 'ready';
    let scriptedInput = false;
    const tabStops = new WeakMap();
    const focusable = 'button,a[href],input,textarea,select,[tabindex],[contenteditable]';
    function syncTabStops(root = host) {
        const nodes = [...root.querySelectorAll(focusable)];
        if (root.matches?.(focusable))
            nodes.unshift(root);
        for (const node of nodes) {
            if (state === 'interactive') {
                if (!tabStops.has(node))
                    continue;
                const original = tabStops.get(node);
                if (original === null)
                    node.removeAttribute('tabindex');
                else
                    node.setAttribute('tabindex', original);
                tabStops.delete(node);
            }
            else {
                if (!tabStops.has(node))
                    tabStops.set(node, node.getAttribute('tabindex'));
                node.setAttribute('tabindex', '-1');
            }
        }
    }
    // Install before the original controllers' document handlers. Only the player
    // can send input into a locked reader; outer playback controls remain usable.
    function guardInput(event) {
        if (state === 'interactive' || scriptedInput || !host.contains(event.target))
            return;
        if (event.type === 'keydown' && event.key === 'Tab')
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }
    for (const type of ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'keydown', 'beforeinput', 'input', 'paste', 'cut', 'drop']) {
        document.addEventListener(type, guardInput, true);
    }
    function playerInput(action) {
        scriptedInput = true;
        try {
            return action();
        }
        finally {
            scriptedInput = false;
        }
    }
    const { app } = (0, reader_js_1.createReader)(host);
    const exportPreview = (0, export_preview_js_1.createExportPreview)(host, app);
    new MutationObserver(records => {
        if (state === 'interactive')
            return;
        for (const record of records)
            for (const node of record.addedNodes) {
                if (node.nodeType === 1)
                    syncTabStops(node);
            }
    }).observe(host, { childList: true, subtree: true });
    const send = (type, detail = {}) => onEvent({ type, ...detail });
    const pointer = document.createElement('div');
    pointer.className = 'demo-pointer';
    pointer.setAttribute('aria-hidden', 'true');
    pointer.innerHTML = '<svg viewBox="0 0 24 29"><path d="M2 2v22l6-6 5 10 4-2-5-10h9Z" fill="#1d2737" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    host.append(pointer);
    let paused = false;
    let abort;
    let running = Promise.resolve();
    let commandId = 0;
    let exportShown = false;
    function report(next, label, progress) {
        state = next;
        host.dataset.demoState = next;
        syncTabStops();
        send('state', { state: next, label, progress });
    }
    // Host playback controls can move native focus out of the frame. During the
    // scripted pass only, keep that incidental blur from committing a partial note.
    // Manual reading retains the original editor's blur-to-save behavior.
    document.addEventListener('blur', event => {
        if ((state === 'playing' || state === 'paused') && event.target.matches?.('.note-editor'))
            event.stopImmediatePropagation();
    }, true);
    let pointerTarget;
    let pointerFrame;
    function positionPointer() {
        const target = pointerTarget?.();
        if (!target)
            return;
        const origin = host.getBoundingClientRect();
        pointer.style.transform = `translate(${target.x - origin.left}px, ${target.y - origin.top}px)`;
    }
    function trackPointer() {
        positionPointer();
        pointerFrame = requestAnimationFrame(trackPointer);
    }
    function point(target) {
        pointerTarget = target;
        positionPointer();
        // Commit the first position while hidden, so the arrow appears at the text.
        if (!pointer.classList.contains('visible'))
            pointer.getBoundingClientRect();
        pointer.classList.add('visible');
        if (pointerFrame == null)
            pointerFrame = requestAnimationFrame(trackPointer);
    }
    function parkPointer() {
        cancelAnimationFrame(pointerFrame);
        pointerFrame = null;
        pointerTarget = null;
        pointer.classList.remove('pressed', 'selecting');
    }
    function hidePointer() {
        parkPointer();
        pointer.classList.remove('visible');
    }
    function pointAt(element) {
        point(() => {
            if (!element.isConnected)
                return null;
            const r = element.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0)
                return null;
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
    }
    function pointBesideNote(editor) {
        point(() => {
            if (!editor.isConnected)
                return null;
            const r = editor.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0)
                return null;
            // Keep the entire 24px arrow in the gutter, with 8px clear of the text.
            return { x: r.left - 32, y: r.top + Math.min(14, r.height / 2) };
        });
    }
    async function wait(ms, signal) {
        let remaining = ms / PLAYBACK_RATE;
        while (remaining > 0) {
            if (signal.aborted)
                throw new DOMException('Playback cancelled', 'AbortError');
            const interval = Math.min(80, remaining);
            await new Promise(resolve => setTimeout(resolve, interval));
            if (!paused && !document.hidden)
                remaining -= interval;
        }
        if (signal.aborted)
            throw new DOMException('Playback cancelled', 'AbortError');
    }
    function textPoint(root, index) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (index <= node.length)
                return [node, index];
            index -= node.length;
        }
        throw new Error('找不到演示文字的位置');
    }
    async function selectPhrase(phrase, signal) {
        const root = document.getElementById('book-paper');
        const start = root.textContent.indexOf(phrase);
        if (start < 0)
            throw new Error('找不到 Alice 演示选句');
        const range = document.createRange();
        const [node, offset] = textPoint(root, start);
        range.setStart(node, offset);
        const [firstNode, firstOffset] = textPoint(root, start + 1);
        range.setEnd(firstNode, firstOffset);
        const selection = window.getSelection();
        // Travel from the previous action to the new sentence before starting a drag.
        point(() => {
            const first = [...range.getClientRects()].find(r => r.width > 0 && r.height > 0);
            return first ? { x: first.left, y: first.top + first.height / 2 } : null;
        });
        await wait(420, signal);
        pointer.classList.add('selecting');
        for (let length = 1; length <= phrase.length; length++) {
            const [endNode, endOffset] = textPoint(root, start + length);
            range.setEnd(endNode, endOffset);
            selection.removeAllRanges();
            selection.addRange(range);
            point(() => {
                const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
                const last = rects[rects.length - 1];
                return last ? { x: last.right, y: last.top + last.height / 2 } : null;
            });
            await wait(25, signal);
        }
        pointer.classList.remove('selecting');
        app.selection.handleSelection();
        if (!app.selection.getPendingSelection())
            throw new Error('选区未能建立，请重新播放');
        await wait(500, signal);
    }
    async function click(element, signal, { hideAfterClick = false } = {}) {
        if (!element)
            throw new Error('演示控件尚未就绪');
        pointAt(element);
        await wait(500, signal);
        // The original action hides its toolbar and may replace the selected DOM.
        // Keep this valid position instead of following that removed/hidden target.
        parkPointer();
        pointer.classList.add('pressed');
        playerInput(() => element.click());
        if (hideAfterClick)
            hidePointer();
        await wait(150, signal);
        pointer.classList.remove('pressed');
        await (0, memory_storage_js_1.drainStorage)();
    }
    async function resetReader({ keepPointer = false } = {}) {
        parkPointer();
        exportPreview.reset();
        await app.annotations.finishInlineEdit();
        await (0, memory_storage_js_1.drainStorage)();
        for (const note of [...app.annotations.getNotes()])
            await app.annotations.deleteAnnotation(note.id);
        app.selection.clearSelection();
        app.selection.clearAnnotationContext();
        app.selection.hideSelectionTooltip();
        app.reader.renderPage(1, false, app.annotations.getNotes());
        if (!keepPointer)
            hidePointer();
    }
    async function writeNote(phrase, comment, signal) {
        await selectPhrase(phrase, signal);
        await click(document.getElementById('btn-add-note'), signal, { hideAfterClick: true });
        let editor = document.querySelector('.note-editor');
        if (!editor)
            throw new Error('批注编辑器未能打开');
        const draft = app.annotations.inlineEdit?.note;
        for (let length = 1; length <= comment.length; length++) {
            // A queued viewport update may finish the original editor. Reopen the same
            // draft through its controller rather than typing into a detached textarea.
            if (!editor.isConnected || app.annotations.getEditingNoteId() !== draft.id) {
                app.annotations.beginInlineEdit(draft);
                editor = document.querySelector('.note-editor');
                if (!editor)
                    throw new Error('批注编辑器未能恢复');
            }
            editor.value = comment.slice(0, length);
            playerInput(() => editor.dispatchEvent(new Event('input', { bubbles: true })));
            await wait(45, signal);
        }
        await wait(700, signal);
        parkPointer();
        playerInput(() => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })));
        await app.annotations.finishInlineEdit();
        await app.annotations.assertInlineWritesSaved();
        await (0, memory_storage_js_1.drainStorage)();
        signal.throwIfAborted();
        if (app.annotations.getNotes().find(note => note.id === draft.id)?.comment !== comment)
            throw new Error('演示批注未完整写入');
        const card = [...host.querySelectorAll('.note-card')].find(item => item.dataset.annotationId === draft.id);
        if (card)
            pointBesideNote(card.querySelector('.note-comment-text') || card);
        else
            pointer.classList.add('visible');
    }
    async function showExport(signal) {
        report('playing', '05 / 把原文、高亮和笔记，一起导出为 Markdown。', 84);
        await wait(800, signal);
        await click(host.querySelector('#btn-export-menu'), signal);
        await wait(700, signal);
        await click(host.querySelector('#btn-export-chapters'), signal);
        await wait(700, signal);
        await click(host.querySelector('#btn-export-current-chapter'), signal, { hideAfterClick: true });
        report('playing', '06 / Markdown in Obsidian / VS Code。高亮与笔记，随正文一起保留。', 94);
        await wait(6500, signal);
        exportShown = true;
        exportPreview.reset();
        pointAt(host.querySelector('#btn-export-menu'));
        await wait(500, signal);
    }
    async function play(signal) {
        await resetReader({ keepPointer: true });
        signal.throwIfAborted();
        report('playing', '01 / 选中一句，让值得记住的文字留下来。', 8);
        await wait(800, signal);
        await selectPhrase('what is the use of a book', signal);
        await click(document.querySelector('.tooltip-btn[data-color="yellow"]'), signal);
        report('playing', '02 / 在页边记下想法，与这句原文自然关联。', 28);
        await wait(900, signal);
        await writeNote('without pictures or conversations?', 'A good book starts a conversation with its reader.', signal);
        report('playing', '03 / 再选一句，留下另一个阅读线索。', 52);
        await wait(900, signal);
        await selectPhrase('considering in her own mind', signal);
        await click(document.querySelector('.tooltip-btn[data-color="yellow"]'), signal);
        report('playing', '04 / 再添一条笔记，让新的想法留在原文身边。', 72);
        await wait(900, signal);
        await writeNote('very sleepy and stupid', 'A sleepy afternoon leaves room for adventure.', signal);
        if (!exportShown)
            await showExport(signal);
        parkPointer();
        report('playing', '高亮与笔记，随时带走。点击 Try it yourself，开始你的体验。', 100);
        await wait(3200, signal);
    }
    async function loop(signal) {
        while (!signal.aborted)
            await play(signal);
    }
    async function start(kind) {
        const id = ++commandId;
        abort?.abort();
        paused = false;
        if (kind === 'try')
            report('resetting', '正在清空演示标注，为你准备空白阅读界面…', 0);
        await running.catch(() => { });
        if (id !== commandId)
            return;
        if (kind === 'play')
            exportShown = false;
        abort = new AbortController();
        const signal = abort.signal;
        running = (kind === 'try' ? resetReader().then(() => {
            signal.throwIfAborted();
            report('interactive', '轮到你了。选中文字，添加高亮或批注；点击页边笔记可编辑。', 0);
        }) : loop(signal))
            .catch(error => {
            if (error.name === 'AbortError')
                return;
            hidePointer();
            console.error('AuraReader demo:', error);
            report('error', '演示未能完成，请点击重新播放。', 0);
        });
    }
    function pause() {
        if (state === 'playing' || state === 'paused') {
            paused = !paused;
            report(paused ? 'paused' : 'playing', paused ? '演示已暂停，点击继续观看。' : '正在继续演示…');
        }
    }
    report('ready', '循环演示高亮与批注，随时点击 Try it yourself 接手操作。', 0);
    return { app, exportPreview, play: () => start('play'), try: () => start('try'), pause, get state() { return state; } };
}

},
"website/demo/reader.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReader = createReader;
// A fixed reading surface using the original annotation/selection modules.
const annotationController_js_1 = require("src/client/features/annotations/annotationController.ts");
const selectionController_js_1 = require("src/client/features/annotations/selectionController.ts");
const annotationRenderer_js_1 = require("src/client/features/reader/annotationRenderer.js");
const marginNotesLayout_js_1 = require("src/client/features/layout/marginNotesLayout.js");
const visibleAnnotations_js_1 = require("src/client/features/reader/visibleAnnotations.js");
const alice_js_1 = require("website/demo/alice.js");
const template_js_1 = require("website/demo/template.js");
function createReader(host) {
    host.innerHTML = template_js_1.readerTemplate;
    host.classList.add('aura-showcase-reader');
    const get = id => host.querySelector(`#${id}`);
    get('current-book-title').textContent = alice_js_1.aliceBook.title;
    const elements = {
        workspaceContainer: get('workspace-container'), readerPanel: get('reader-panel'),
        bookPaper: get('book-paper'), bookPaperRight: null, notesPanel: get('notes-panel'),
        notesList: get('notes-list'), emptyNotesState: get('empty-notes-state'),
        selectionTooltip: get('selection-tooltip'), highlightActionTooltip: get('highlight-action-tooltip'),
        btnAddNote: get('btn-add-note'), btnHlRemove: get('btn-hl-remove'), btnNoteRemove: get('btn-note-remove')
    };
    const viewport = get('reader-viewport');
    let selection;
    const annotations = new annotationController_js_1.AnnotationController({ callbacks: {
            getCurrentBookId: () => alice_js_1.ALICE_ID,
            getCurrentPage: () => 1,
            getCurrentChapter: () => 'CHAPTER I. Down the Rabbit-Hole',
            getPendingSelection: () => selection.getPendingSelection(),
            getVisibleAnnotationIds: () => (0, visibleAnnotations_js_1.collectVisibleAnnotationIds)([elements.bookPaper], viewport),
            onNotesChanged: notes => render(notes),
            onFocusAnnotation: note => selection.activateAnnotationId(note.id, { notify: true, showMenu: true }),
            onJump: note => selection.activateAnnotationId(note.id, { notify: true, showMenu: true })
        } });
    selection = new selectionController_js_1.SelectionController({ callbacks: {
            getReadingContext: () => ({ chapterFlow: true, currentPage: 1, sectionId: 'chapter-1' }),
            onCreateHighlight: (color, pending) => annotations.createHighlight({
                quote: pending.text, page: 1, chapter: 'CHAPTER I. Down the Rabbit-Hole', color, location: pending.location
            }),
            onCreateNote: draft => annotations.createNote({ ...draft, chapter: 'CHAPTER I. Down the Rabbit-Hole' }),
            onDeleteHighlight: ids => annotations.deleteHighlights(ids),
            onDeleteNotes: ids => Promise.all(ids.map(id => annotations.deleteNote(id))),
            onAnnotationActivated: context => context.noteIds.length ? annotations.focusNotes(context.noteIds) : annotations.clearFocusedAnnotations(),
            onClearFocus: () => annotations.clearFocusedAnnotations()
        } });
    function render(notes = annotations.getRenderingNotes()) {
        elements.bookPaper.innerHTML = alice_js_1.aliceBook.pages[0];
        (0, annotationRenderer_js_1.renderAnnotationTokens)(elements.bookPaper, notes, 1);
        selection.restoreActiveTokens();
        annotations.refreshVisibleNotes();
        (0, marginNotesLayout_js_1.positionMarginNotes)(elements);
    }
    function layout() {
        (0, marginNotesLayout_js_1.applyMarginGeometry)(elements, 'single');
        annotations.refreshVisibleNotes();
        (0, marginNotesLayout_js_1.positionMarginNotes)(elements);
    }
    annotations.initUI(elements);
    selection.initUI(elements);
    render();
    layout();
    if (typeof ResizeObserver !== 'undefined')
        new ResizeObserver(layout).observe(host);
    window.addEventListener('resize', layout);
    document.fonts?.ready.then(layout);
    return {
        root: host,
        app: { annotations, selection, elements, reader: { renderPage: () => render(), getCurrentPage: () => 1 }, layout }
    };
}

},
"src/client/features/annotations/annotationController.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnotationController = void 0;
const dom_js_1 = require("src/client/app/dom.ts");
const annotationRecovery_js_1 = require("src/client/infrastructure/annotationRecovery.ts");
/* ==========================================================================
   AnnotationController - Notes & Highlights Feature Controller
   Authority owner of: notes, editingNoteId, showHighlightsInSidebar, activeTab.
   Highlights and notes are independent records distinguished by kind.
   ========================================================================== */
const annotationRepository_js_1 = require("src/client/infrastructure/annotationRepository.ts");
const annotationEngine_js_1 = require("src/client/domain/annotationEngine.ts");
const notesUI_js_1 = require("src/client/features/annotations/notesUI.js");
class AnnotationController {
    callbacks;
    notes;
    editingNoteId;
    inlineEdit;
    _inlineWrites;
    inlineWriteErrors = new Map();
    showHighlightsInSidebar;
    notesScope;
    _renderedSidebarIds;
    activeTab;
    focusedNoteIds;
    focusedHighlightIds;
    elements;
    constructor({ callbacks = {} } = {}) {
        this.callbacks = callbacks; // onNotesChanged, onJump, showToast, getCurrentBookId
        this.notes = [];
        this.editingNoteId = null;
        this.inlineEdit = null;
        this._inlineWrites = Promise.resolve();
        this.showHighlightsInSidebar = false;
        this.notesScope = 'page';
        this._renderedSidebarIds = null;
        this.activeTab = 'tab-highlights';
        this.focusedNoteIds = [];
        this.focusedHighlightIds = [];
        this.elements = null;
    }
    getNotes() {
        return this.notes;
    }
    getRenderingNotes() {
        const draft = this.inlineEdit?.note;
        return draft && !this.notes.some(note => note.id === draft.id) ? [draft, ...this.notes] : this.notes;
    }
    // This changes presentation only. getNotes() continues to return the full
    // collection for rendering, persistence, and book-wide exports.
    setNotesScope(scope = 'page') {
        if (scope !== 'page' && scope !== 'book')
            throw new Error('笔记范围只能是 page 或 book');
        this.notesScope = scope;
        this.renderNotesUI();
        return scope;
    }
    getSidebarNotes() {
        const quoted = this.getRenderingNotes().filter(note => String(note.quote || '').trim());
        if (this.notesScope === 'book')
            return quoted;
        const visible = this.callbacks.getVisibleAnnotationIds?.() || new Set();
        return quoted.filter(note => note.id === this.editingNoteId || visible.has(String(note.id)));
    }
    refreshVisibleNotes(finishHiddenEditor = false) {
        if (this.notesScope !== 'page')
            return;
        if (finishHiddenEditor && this.inlineEdit && !this.callbacks.getVisibleAnnotationIds?.().has(String(this.editingNoteId))) {
            this.finishInlineEdit();
        }
        const key = JSON.stringify(this.getSidebarNotes().map(note => note.id));
        if (key !== this._renderedSidebarIds)
            this.renderNotesUI();
    }
    requireQuote(quote) {
        if (String(quote || '').trim())
            return true;
        this.callbacks.showToast?.('请先在正文中选择需要引用的文字');
        return false;
    }
    getEditingNoteId() {
        return this.editingNoteId;
    }
    getShowHighlightsInSidebar() {
        return this.showHighlightsInSidebar;
    }
    async loadNotesForBook(bookId) {
        await this.finishInlineEdit();
        const loaded = bookId ? await (0, annotationRepository_js_1.loadNotesForBook)(bookId) : [];
        this.setNotesForBook(loaded);
        this.renderNotesUI();
        return this.notes;
    }
    // Install prepared data synchronously; the coordinator renders only after
    // the reader and session have also switched to this book.
    setNotesForBook(notes) {
        this.notes = normalizeList(notes);
        this.notesScope = 'page';
        this.focusedNoteIds = [];
        this.focusedHighlightIds = [];
        this._renderedSidebarIds = null;
    }
    getBookId() {
        return this.callbacks.getCurrentBookId ? this.callbacks.getCurrentBookId() : 'crisis-era';
    }
    async addOrUpdateNote(noteObj) {
        const normalized = (0, annotationEngine_js_1.normalizeAnnotation)(noteObj);
        if (!normalized)
            return;
        if ((0, annotationEngine_js_1.isNote)(normalized) && !this.requireQuote(normalized.quote))
            return;
        const idx = this.notes.findIndex(n => n.id === normalized.id);
        if (idx !== -1) {
            this.notes[idx] = normalized;
        }
        else {
            this.notes.unshift(normalized);
        }
        await (0, annotationRepository_js_1.saveNoteToDB)(normalized);
        this.renderNotesUI();
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }
    async createHighlight({ quote, page = 1, chapter = '章节选区', color = 'yellow', location = null }) {
        const highlightPage = Number(page) || 1;
        const cleanQuote = quote || '';
        const existingHighlight = this.notes.find(n => {
            return (0, annotationEngine_js_1.isHighlight)(n) && Number(n.page) === highlightPage && (n.quote || '') === cleanQuote;
        });
        if (existingHighlight) {
            if (this.callbacks.onFocusAnnotation)
                this.callbacks.onFocusAnnotation(existingHighlight);
            else if (this.callbacks.showToast)
                this.callbacks.showToast('已定位到相同高亮');
            return existingHighlight;
        }
        const newNote = (0, annotationEngine_js_1.createAnnotationObject)({
            kind: 'highlight',
            bookId: this.getBookId(),
            quote: cleanQuote,
            comment: '',
            color: color || 'yellow',
            page: highlightPage,
            chapter,
            location
        });
        this.notes.unshift(newNote);
        await (0, annotationRepository_js_1.saveNoteToDB)(newNote);
        if (this.callbacks.showToast)
            this.callbacks.showToast('已成功高亮选中文本');
        this.renderNotesUI();
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
        return newNote;
    }
    createNote({ quote = '', page = 1, chapter = null, location = null } = {}) {
        const pending = this.callbacks.getPendingSelection ? this.callbacks.getPendingSelection() : null;
        const selectedQuote = quote || (pending ? pending.text : '');
        if (!this.requireQuote(selectedQuote))
            return;
        this.finishInlineEdit();
        const note = (0, annotationEngine_js_1.createAnnotationObject)({
            kind: 'note', bookId: this.getBookId(), quote: selectedQuote, comment: '', color: 'green',
            page: Number(page || pending?.page) || 1,
            chapter: chapter || this.callbacks.getCurrentChapter?.() || '章节选区',
            location: location || pending?.location || null
        });
        this.beginInlineEdit(note);
        return note;
    }
    beginInlineEdit(note) {
        if (this.editingNoteId === note.id && this.inlineEdit)
            return;
        this.finishInlineEdit();
        this.editingNoteId = note.id;
        this.inlineEdit = { note, opening: true };
        const editSession = this.inlineEdit;
        this.renderNotesUI();
        // Include unsaved drafts only in the reading surface, never in exports
        // or storage. This also gives the new editor its existing margin anchor.
        if (!this.notes.some(item => item.id === note.id)) {
            this.callbacks.onNotesChanged?.(this.getRenderingNotes());
        }
        if (this.inlineEdit !== editSession)
            return;
        editSession.opening = false;
        // The body and margin lanes are now mounted in their final positions.
        (0, notesUI_js_1.focusInlineEditor)(this.elements, note.id);
        const win = this.elements?.notesList?.ownerDocument.defaultView;
        win?.requestAnimationFrame?.(() => {
            if (this.inlineEdit !== editSession)
                return;
            const editor = this.elements?.notesList?.querySelector('.note-editor');
            if (editor && editor.ownerDocument.activeElement !== editor)
                (0, notesUI_js_1.focusInlineEditor)(this.elements, note.id);
        });
    }
    updateInlineNote(id, comment) {
        const note = this.inlineEdit?.note;
        if (!note || id !== note.id || note.comment === comment)
            return;
        note.comment = comment;
        this.callbacks.onAnnotationContentChanged?.(note);
        note.timestamp = new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16);
        const exists = this.notes.some(item => item.id === id);
        if (!exists && !comment.trim())
            return;
        if (!exists)
            this.notes.unshift(note);
        // Save the raw input, including trailing newlines. No list or body
        // rerender is needed when only a note's own words have changed.
        this.writeInlineNote(note);
    }
    writeInlineNote(note, remove = false) {
        const snapshot = JSON.parse(JSON.stringify(note));
        // Start transactions immediately, in input order. The repository must
        // not mirror an older completed transaction over newer local input.
        const write = remove
            ? (0, annotationRepository_js_1.deleteNoteFromDB)(snapshot.id, snapshot.bookId)
            : (0, annotationRepository_js_1.saveNoteToDB)(snapshot);
        this._inlineWrites = Promise.all([this._inlineWrites, write]).then(() => {
            this.inlineWriteErrors.delete(snapshot.id);
        }).catch(error => {
            this.inlineWriteErrors.set(snapshot.id, { bookId: snapshot.bookId, recoveryAvailable: error.recoveryAvailable === true });
            console.error('笔记持久化失败', error);
            this.callbacks.showToast?.(error.recoveryAvailable === false
                ? '笔记尚未可靠保存，请暂勿关闭页面'
                : error.status === 409 ? '笔记保存存在冲突，输入已保留在本机，请勿关闭页面'
                    : '笔记已保留在本机缓存，数据库暂时无法写入');
        });
    }
    finishInlineEdit() {
        const session = this.inlineEdit;
        if (!session)
            return this._inlineWrites;
        const editor = this.elements?.notesList?.querySelector('.note-editor');
        if (editor)
            this.updateInlineNote(session.note.id, editor.value);
        this.inlineEdit = null;
        this.editingNoteId = null;
        const note = session.note;
        const blank = !note.comment.trim();
        if (blank) {
            const existed = this.notes.some(item => item.id === note.id);
            this.notes = this.notes.filter(item => item.id !== note.id);
            if (existed) {
                this.writeInlineNote(note, true);
            }
        }
        this.renderNotesUI();
        if (blank)
            this.callbacks.onNotesChanged?.(this.notes);
        return this._inlineWrites;
    }
    async assertInlineWritesSaved() {
        await this._inlineWrites;
        // Durable entries are removed by the repository only after acknowledgment.
        // A later recovery must release the close guard; non-durable failures stay.
        for (const [id, failure] of this.inlineWriteErrors) {
            if (failure.recoveryAvailable && !(0, annotationRecovery_js_1.pendingNoteWrites)(failure.bookId).some(entry => entry.id === id))
                this.inlineWriteErrors.delete(id);
        }
        if (this.inlineWriteErrors.size)
            throw new Error('存在保存失败的笔记，窗口已保留；请处理冲突或恢复写入后重试。');
    }
    async saveModalNote({ quote = '', comment = '', page = 1, chapter = '章节选区', location = null } = {}) {
        // Compatibility for programmatic callers; the UI uses inline autosave.
        if (this.inlineEdit) {
            const editor = this.elements?.notesList?.querySelector('.note-editor');
            if (editor)
                editor.value = comment;
            this.updateInlineNote(this.inlineEdit.note.id, comment);
            await this.finishInlineEdit();
            return;
        }
        const cleanComment = (comment || '').trim();
        if (this.editingNoteId) {
            const noteIndex = this.notes.findIndex(n => n.id === this.editingNoteId);
            const current = noteIndex === -1 ? null : this.notes[noteIndex];
            if (!current || !(0, annotationEngine_js_1.isNote)(current)) {
                this.closeNoteModal();
                return;
            }
            if (!cleanComment) {
                const removedId = current.id;
                this.closeNoteModal();
                await this.deleteNote(removedId);
                return;
            }
            if (!this.requireQuote(current.quote))
                return;
            this.notes[noteIndex].comment = cleanComment;
            this.notes[noteIndex].kind = 'note';
            this.notes[noteIndex].color = this.notes[noteIndex].color || 'green';
            this.notes[noteIndex].timestamp = new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16);
            await (0, annotationRepository_js_1.saveNoteToDB)(this.notes[noteIndex]);
            if (this.callbacks.showToast)
                this.callbacks.showToast('笔记已更新');
        }
        else {
            if (!this.requireQuote(quote))
                return;
            if (!cleanComment) {
                if (this.callbacks.showToast)
                    this.callbacks.showToast('请输入笔记内容');
                return;
            }
            const newNote = (0, annotationEngine_js_1.createAnnotationObject)({
                kind: 'note',
                bookId: this.getBookId(),
                quote,
                comment: cleanComment,
                color: 'green',
                page: Number(page) || 1,
                chapter,
                location
            });
            this.notes.unshift(newNote);
            await (0, annotationRepository_js_1.saveNoteToDB)(newNote);
            if (this.callbacks.showToast)
                this.callbacks.showToast('笔记已保存');
        }
        this.closeNoteModal();
        this.renderNotesUI();
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }
    async saveQuickNote() {
        // Keep the old callable entry safe without creating unquoted notes.
        this.requireQuote('');
        return false;
    }
    async deleteHighlight(id) {
        await this.deleteHighlights([id]);
    }
    async deleteHighlights(ids = []) {
        await this.callbacks.beforeDeleteAnnotations?.();
        const idSet = new Set(ids.filter(Boolean));
        const removed = this.notes.filter(n => idSet.has(n.id) && (0, annotationEngine_js_1.isHighlight)(n));
        if (removed.length === 0)
            return;
        const removedIds = new Set(removed.map(n => n.id));
        this.notes = this.notes.filter(n => !removedIds.has(n.id));
        this.focusedHighlightIds = this.focusedHighlightIds.filter(id => !removedIds.has(id));
        for (const id of removedIds) {
            await (0, annotationRepository_js_1.deleteNoteFromDB)(id, this.getBookId());
        }
        this.renderNotesUI();
        if (this.callbacks.showToast)
            this.callbacks.showToast('已移除高亮');
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }
    async deleteNote(id) {
        const target = this.notes.find(n => n.id === id);
        if (!target || !(0, annotationEngine_js_1.isNote)(target))
            return;
        await this.deleteAnnotation(id, '已删除笔记');
    }
    async deleteAnnotation(id, toastMessage = '已删除标注') {
        await this.callbacks.beforeDeleteAnnotations?.();
        if (!id)
            return;
        if (this.editingNoteId === id)
            await this.finishInlineEdit();
        const existed = this.notes.some(n => n.id === id);
        if (!existed)
            return;
        this.notes = this.notes.filter(n => n.id !== id);
        this.focusedNoteIds = this.focusedNoteIds.filter(noteId => noteId !== id);
        this.focusedHighlightIds = this.focusedHighlightIds.filter(noteId => noteId !== id);
        await (0, annotationRepository_js_1.deleteNoteFromDB)(id, this.getBookId());
        this.renderNotesUI();
        if (this.callbacks.showToast)
            this.callbacks.showToast(toastMessage);
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }
    openNoteModal(quote, existingNoteId = null, targetPage = 1) {
        if (!existingNoteId) {
            this.createNote({ quote, page: targetPage });
            return;
        }
        const existingNote = this.notes.find(n => n.id === existingNoteId);
        if (!existingNote || !(0, annotationEngine_js_1.isNote)(existingNote)) {
            this.createNote({
                quote: quote || (existingNote ? existingNote.quote : ''),
                page: targetPage || (existingNote ? existingNote.page : 1),
                chapter: existingNote ? existingNote.chapter : null,
                location: existingNote ? existingNote.location : null
            });
            return;
        }
        this.beginInlineEdit(existingNote);
    }
    closeNoteModal() {
        return this.finishInlineEdit();
    }
    toggleShowHighlightsInSidebar() {
        this.showHighlightsInSidebar = !this.showHighlightsInSidebar;
        this.renderNotesUI();
        if (this.callbacks.showToast) {
            this.callbacks.showToast(this.showHighlightsInSidebar ? '已开启：笔记区同时显示划线' : '已恢复：笔记区仅显示笔记');
        }
    }
    switchTab(tabId) {
        this.activeTab = tabId;
        if (!this.elements)
            return;
        if (this.elements.tabBtns) {
            this.elements.tabBtns.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
            });
        }
        if (this.elements.tabContents) {
            this.elements.tabContents.forEach(content => {
                content.classList.toggle('active', content.id === tabId);
            });
        }
    }
    focusNotes(noteIds = []) {
        const ids = uniqueIds(noteIds);
        if (ids.length === 0)
            return;
        this.switchTab('tab-highlights');
        this.focusedNoteIds = ids;
        this.focusedHighlightIds = [];
        this.renderNotesUI();
        this.scrollCardIntoView(ids[0]);
    }
    focusHighlights(highlightIds = []) {
        const ids = uniqueIds(highlightIds);
        if (ids.length === 0)
            return;
        this.focusedHighlightIds = ids;
        this.focusedNoteIds = [];
        this.switchTab('tab-highlights');
        this.renderNotesUI();
        if (typeof document === 'undefined')
            return;
        const visible = ids.find(id => document.getElementById(`card-${id}`));
        if (visible)
            this.scrollCardIntoView(visible);
    }
    clearFocusedAnnotations() {
        if (this.focusedNoteIds.length === 0 && this.focusedHighlightIds.length === 0)
            return;
        this.focusedNoteIds = [];
        this.focusedHighlightIds = [];
        this.renderNotesUI();
    }
    highlightNoteCard(noteId) {
        (0, notesUI_js_1.highlightNoteCard)(noteId);
    }
    scrollCardIntoView(noteId) {
        if (!noteId || typeof document === 'undefined')
            return;
        const card = document.getElementById(`card-${noteId}`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    renderNotesUI() {
        if (!this.elements)
            return;
        const sidebarNotes = this.getSidebarNotes();
        this._renderedSidebarIds = JSON.stringify(sidebarNotes.map(note => note.id));
        (0, notesUI_js_1.renderNotesList)({
            elements: this.elements,
            notes: sidebarNotes,
            getGoalAction: this.callbacks.getGoalAction,
            onLinkGoal: this.callbacks.onLinkGoal ? id => { Promise.resolve(this.callbacks.onLinkGoal?.(id)).catch(error => this.callbacks.showToast?.(String(error.message || error))); } : null,
            notesScope: this.notesScope,
            showHighlightsInSidebar: this.showHighlightsInSidebar,
            focusedNoteIds: this.focusedNoteIds,
            focusedHighlightIds: this.focusedHighlightIds,
            editingNoteId: this.editingNoteId,
            onInput: (id, comment) => this.updateInlineNote(id, comment),
            onFinish: () => this.finishInlineEdit(),
            onJump: (note) => {
                if (this.callbacks.onJump) {
                    this.callbacks.onJump(note);
                }
            },
            onEdit: (note) => {
                if (!(0, annotationEngine_js_1.isNote)(note))
                    return;
                this.openNoteModal(note.quote, note.id, note.page);
            },
            onDelete: (note) => {
                if ((0, annotationEngine_js_1.isHighlight)(note))
                    this.deleteHighlight(note.id);
                else
                    this.deleteNote(note.id);
            }
        });
    }
    initUI(elements) {
        this.elements = elements;
        if (!elements || typeof document === 'undefined')
            return;
        // Tab Switching
        if (elements.tabBtns) {
            elements.tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchTab(btn.getAttribute('data-tab') || 'tab-highlights');
                });
            });
        }
        // Toggle Highlights in Sidebar
        if (elements.btnToggleShowHighlights) {
            elements.btnToggleShowHighlights.addEventListener('click', () => {
                this.toggleShowHighlightsInSidebar();
            });
        }
        document.addEventListener('pointerdown', event => {
            if (!(0, dom_js_1.eventElement)(event)?.closest('.note-editor'))
                this.finishInlineEdit();
        }, true);
        document.addEventListener('focusin', event => {
            if (this.inlineEdit?.opening)
                return;
            if (!(0, dom_js_1.eventElement)(event)?.closest('.note-editor'))
                this.finishInlineEdit();
        });
        window.addEventListener('pagehide', () => this.finishInlineEdit());
    }
}
exports.AnnotationController = AnnotationController;
function normalizeList(list) {
    return (Array.isArray(list) ? list : []).map(annotationEngine_js_1.normalizeAnnotation).filter((note) => note !== null);
}
function uniqueIds(ids) {
    const seen = new Set();
    const result = [];
    (Array.isArray(ids) ? ids : []).forEach(id => {
        if (!id || seen.has(id))
            return;
        seen.add(id);
        result.push(id);
    });
    return result;
}

},
"src/client/app/dom.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventElement = eventElement;
/** Resolve delegated DOM events, including clicks whose target is a text node. */
function eventElement(event) {
    const target = event.target;
    if (!target)
        return null;
    if ('closest' in target && typeof target.closest === 'function')
        return target;
    return target.parentElement || null;
}

},
"src/client/infrastructure/annotationRecovery.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pendingNoteWrites = pendingNoteWrites;
exports.recordNoteWrite = recordNoteWrite;
exports.attachNoteCommand = attachNoteCommand;
exports.acknowledgeNoteWrite = acknowledgeNoteWrite;
exports.pendingNoteBookIds = pendingNoteBookIds;
exports.clearStoredBookNotes = clearStoredBookNotes;
// A small durable journal distinguishes uncommitted edits from ordinary caches.
// Entries are removed only after SQLite acknowledges the matching operation.
const PREFIX = 'aura_notes_pending_';
function pendingNoteWrites(bookId) {
    try {
        const entries = JSON.parse(localStorage.getItem(PREFIX + bookId) || '[]');
        if (!Array.isArray(entries))
            return [];
        return entries.filter((entry) => {
            if (!entry || typeof entry !== 'object')
                return false;
            const row = entry;
            if (row.bookId !== bookId || typeof row.id !== 'string' || typeof row.version !== 'string')
                return false;
            if (row.operation === 'delete')
                return true;
            if (row.operation !== 'save' || !row.note || typeof row.note !== 'object')
                return false;
            const note = row.note;
            return note.id === row.id && note.bookId === bookId;
        });
    }
    catch (_) {
        return [];
    }
}
function storePending(bookId, entries) {
    if (!bookId)
        return false;
    try {
        const key = PREFIX + bookId;
        if (entries.length)
            localStorage.setItem(key, JSON.stringify(entries));
        else if (typeof localStorage.removeItem === 'function')
            localStorage.removeItem(key);
        else
            localStorage.setItem(key, '[]');
        return true;
    }
    catch (_) {
        return false;
    }
}
function recordNoteWrite(input) {
    const { id, bookId } = input;
    const entry = {
        ...input,
        version: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    };
    if (input.operation === 'save' && entry.operation === 'save')
        entry.note = JSON.parse(JSON.stringify(input.note));
    const current = pendingNoteWrites(bookId);
    const previous = current.find(item => item.id === id);
    entry.prerequisites = [...(previous?.prerequisites || [])];
    if (previous?.command)
        entry.prerequisites.push({ version: previous.version, operation: previous.operation, command: previous.command });
    const entries = current.filter(item => item.id !== id);
    return { ...entry, durable: storePending(bookId, [...entries, entry]) };
}
function attachNoteCommand(entry, command) {
    const entries = pendingNoteWrites(entry.bookId);
    const current = entries.find(item => item.id === entry.id);
    if (!current)
        return { ...entry, command, durable: false };
    if (current.version === entry.version)
        current.command = command;
    else if (!(current.prerequisites || []).some(item => item.version === entry.version)) {
        current.prerequisites = [...(current.prerequisites || []), { version: entry.version, operation: entry.operation, command }];
    }
    return { ...entry, command, durable: storePending(entry.bookId, entries) };
}
function acknowledgeNoteWrite(entry) {
    const entries = pendingNoteWrites(entry.bookId);
    const remaining = entries.filter(item => item.id !== entry.id || item.version !== entry.version);
    remaining.forEach(item => { item.prerequisites = (item.prerequisites || []).filter(prior => prior.version !== entry.version); });
    storePending(entry.bookId, remaining);
}
function pendingNoteBookIds() {
    const ids = [];
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith(PREFIX))
                ids.push(key.slice(PREFIX.length));
        }
    }
    catch (_) { /* SQLite can still work when the recovery buffer is unavailable. */ }
    return ids;
}
function clearStoredBookNotes(bookId) {
    try {
        localStorage.removeItem('aura_notes_' + bookId);
        localStorage.removeItem(PREFIX + bookId);
    }
    catch (_) { /* Database deletion does not depend on cache availability. */ }
}

},
"src/client/infrastructure/annotationRepository.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveNoteToDB = saveNoteToDB;
exports.deleteNoteFromDB = deleteNoteFromDB;
exports.loadNotesFromDB = loadNotesFromDB;
exports.loadNotesForBook = loadNotesForBook;
exports.getNotesForBooks = getNotesForBooks;
const storageError_js_1 = require("src/client/infrastructure/storageError.ts");
const annotationEngine_js_1 = require("src/client/domain/annotationEngine.ts");
const annotationRecovery_js_1 = require("src/client/infrastructure/annotationRecovery.ts");
const storageClient_js_1 = require("website/demo/memory-storage.js");
const normalize = (notes) => notes.map(annotationEngine_js_1.normalizeAnnotation).filter((note) => note !== null);
const commands = new Map();
function saveNoteToDB(note) {
    if (!note?.id)
        return Promise.resolve();
    return submit((0, annotationRecovery_js_1.recordNoteWrite)({ id: note.id, bookId: note.bookId, operation: 'save', note }));
}
function deleteNoteFromDB(id, bookId) {
    if (!id)
        return Promise.resolve();
    return submit((0, annotationRecovery_js_1.recordNoteWrite)({ id, bookId, operation: 'delete' }));
}
function submit(entry, retry = false) {
    return (0, storageClient_js_1.enqueue)(entry.bookId, async () => {
        try {
            await (0, storageClient_js_1.initializeStorage)();
            const latest = (0, annotationRecovery_js_1.pendingNoteWrites)(entry.bookId).find(item => item.id === entry.id);
            if (retry && latest?.version !== entry.version)
                return;
            for (const prior of latest?.prerequisites || entry.prerequisites || []) {
                if (prior.version === entry.version)
                    continue;
                const result = await sendNoteCommand(prior.command);
                (0, storageClient_js_1.acceptNote)(entry.id, entry.bookId, result, prior.operation === 'delete');
                (0, annotationRecovery_js_1.acknowledgeNoteWrite)({ ...entry, version: prior.version });
                commands.delete(prior.version);
            }
            let command = entry.command || commands.get(entry.version);
            if (!command) {
                const book = await (0, storageClient_js_1.bookVersion)(entry.bookId);
                const note = await (0, storageClient_js_1.noteVersion)(entry.id, entry.bookId);
                if (!book.generation)
                    throw new Error('书籍已删除或不存在');
                const version = { opId: entry.version, expected: note.revision, generation: book.generation };
                command = entry.operation === 'save' ? { ...version, note: entry.note }
                    : { ...version, id: entry.id, bookId: entry.bookId };
                commands.set(entry.version, command);
            }
            entry = (0, annotationRecovery_js_1.attachNoteCommand)(entry, command);
            const result = await sendNoteCommand(command);
            (0, storageClient_js_1.acceptNote)(entry.id, entry.bookId, result, entry.operation === 'delete');
            (0, annotationRecovery_js_1.acknowledgeNoteWrite)(entry);
            commands.delete(entry.version);
        }
        catch (cause) {
            const error = new storageError_js_1.StorageClientError((0, storageError_js_1.errorMessage)(cause, '笔记保存失败'), { cause });
            error.status = cause instanceof storageError_js_1.StorageClientError ? cause.status : undefined;
            error.recoveryAvailable = entry.durable !== false;
            error.details = cause instanceof storageError_js_1.StorageClientError ? cause.details : undefined;
            throw error;
        }
    });
}
async function loadNotesFromDB(bookId) {
    if (!bookId)
        return [];
    return normalize((await (0, storageClient_js_1.readNotes)([bookId])).flatMap(row => row.deleted ? [] : [row.value]));
}
async function loadNotesForBook(bookId) {
    if (!bookId)
        return [];
    let notes = await loadNotesFromDB(bookId);
    const pending = (0, annotationRecovery_js_1.pendingNoteWrites)(bookId);
    for (const entry of pending) {
        try {
            await submit(entry, true);
        }
        catch (error) {
            console.warn('笔记补写失败，保留本机恢复内容', error);
        }
    }
    if (pending.length)
        notes = await loadNotesFromDB(bookId);
    return overlay(notes, (0, annotationRecovery_js_1.pendingNoteWrites)(bookId));
}
function overlay(notes, pending) {
    const byId = new Map(notes.map(note => [note.id, note]));
    for (const entry of pending) {
        if (entry.operation === 'delete')
            byId.delete(entry.id);
        else {
            const note = (0, annotationEngine_js_1.normalizeAnnotation)(entry.note);
            if (note)
                byId.set(entry.id, note);
        }
    }
    return [...byId.values()];
}
async function getNotesForBooks(bookIds = []) {
    if (bookIds?.length)
        return (await Promise.all([...new Set(bookIds)].map(loadNotesForBook))).flat();
    const all = (await (0, storageClient_js_1.readNotes)()).filter(row => !row.deleted).map(row => row.value);
    const ids = [...new Set([...all.map(n => n.bookId), ...(0, annotationRecovery_js_1.pendingNoteBookIds)()])];
    return (await Promise.all(ids.map(loadNotesForBook))).flat();
}
function sendNoteCommand(command) {
    return 'note' in command ? (0, storageClient_js_1.storageRequest)('notes/save', command) : (0, storageClient_js_1.storageRequest)('notes/delete', command);
}

},
"src/client/infrastructure/storageError.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageClientError = void 0;
exports.errorMessage = errorMessage;
class StorageClientError extends Error {
    status;
    details;
    recoveryAvailable;
}
exports.StorageClientError = StorageClientError;
function errorMessage(error, fallback) {
    return error instanceof Error ? error.message || fallback : fallback;
}

},
"src/client/domain/annotationEngine.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHighlight = isHighlight;
exports.isNote = isNote;
exports.normalizeAnnotation = normalizeAnnotation;
exports.filterNotes = filterNotes;
exports.findAnnotationsAtQuote = findAnnotationsAtQuote;
exports.findOverlappingNote = findOverlappingNote;
exports.groupAnnotationsByRange = groupAnnotationsByRange;
exports.applyHighlightToHtml = applyHighlightToHtml;
exports.applyAllHighlightsToHtml = applyAllHighlightsToHtml;
exports.createAnnotationObject = createAnnotationObject;
/* ==========================================================================
   AnnotationEngine - Pure Annotation Core Algorithms (Domain Layer)
   Zero DOM dependencies. Owns annotation kind, migration, overlap lookup,
   and the legacy string highlighter kept for existing callers.
   Body rendering uses annotationRangeEngine + annotationRenderer instead.
   ========================================================================== */
function isHighlight(annotation) {
    if (!annotation || typeof annotation !== 'object')
        return false;
    if (annotation.kind === 'highlight')
        return true;
    if (annotation.kind === 'note')
        return false;
    return !annotation.comment || String(annotation.comment).trim() === '';
}
function isNote(annotation) {
    if (!annotation || typeof annotation !== 'object')
        return false;
    if (annotation.kind === 'note')
        return true;
    if (annotation.kind === 'highlight')
        return false;
    return !!(annotation.comment && String(annotation.comment).trim() !== '');
}
function normalizeAnnotation(annotation) {
    if (!annotation || typeof annotation !== 'object')
        return null;
    const comment = annotation.comment == null ? '' : String(annotation.comment);
    const kind = annotation.kind === 'highlight' || annotation.kind === 'note'
        ? annotation.kind : comment.trim() !== '' ? 'note' : 'highlight';
    const page = Number(annotation.page) || 1;
    const color = annotation.color || (kind === 'note' ? 'green' : 'yellow');
    return {
        ...annotation,
        id: annotation.id || '',
        bookId: annotation.bookId || '',
        kind,
        quote: annotation.quote == null ? '' : String(annotation.quote),
        comment,
        color,
        page,
        chapter: annotation.chapter || '章节选区',
        timestamp: annotation.timestamp || '',
        location: normalizeLocation(annotation, page)
    };
}
function normalizeLocation(annotation, page) {
    const existing = annotation.location && typeof annotation.location === 'object'
        ? { ...annotation.location }
        : {};
    const location = {
        ...existing,
        sectionId: existing.sectionId || annotation.sectionId || `chapter-${page}`,
        page: Number(existing.page) || page,
        offset: Number(existing.offset ?? annotation.offset) || 0
    };
    if (existing.start == null)
        delete location.start;
    else
        location.start = Number(existing.start);
    if (existing.end == null)
        delete location.end;
    else
        location.end = Number(existing.end);
    return location;
}
function filterNotes(notes = [], showHighlightsInSidebar = false) {
    const list = (Array.isArray(notes) ? notes : []).map(normalizeAnnotation).filter((item) => item !== null);
    const thoughtNotes = list.filter(isNote);
    const pureHighlights = list.filter(isHighlight);
    const displayedNotes = showHighlightsInSidebar ? list : thoughtNotes;
    return {
        displayedNotes,
        thoughtNotes,
        pureHighlights,
        thoughtCount: thoughtNotes.length,
        pureCount: pureHighlights.length,
        totalCount: list.length
    };
}
function findAnnotationsAtQuote(notes = [], page = 1, quote = '') {
    const cleanQuote = String(quote || '').trim();
    if (!Array.isArray(notes) || !cleanQuote)
        return [];
    const targetPage = Number(page) || 1;
    return notes.map(normalizeAnnotation).filter((item) => item !== null).filter(annotation => {
        if (Number(annotation.page) !== targetPage)
            return false;
        if (!annotation.quote)
            return false;
        const noteQuote = annotation.quote.trim();
        return noteQuote === cleanQuote || noteQuote.includes(cleanQuote) || cleanQuote.includes(noteQuote);
    });
}
function findOverlappingNote(notes = [], page = 1, quote = '') {
    const matches = findAnnotationsAtQuote(notes, page, quote);
    return matches[0] || null;
}
function groupAnnotationsByRange(notes = []) {
    const groups = new Map();
    (Array.isArray(notes) ? notes : []).map(normalizeAnnotation).filter((item) => item !== null).forEach(annotation => {
        const quoteKey = (annotation.quote || '').trim();
        const loc = annotation.location;
        const key = quoteKey
            ? `p${annotation.page}|q|${quoteKey}`
            : `p${annotation.page}|loc|${loc.start ?? ''}|${loc.end ?? ''}|${annotation.id}`;
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(annotation);
    });
    return Array.from(groups.values()).map(items => {
        const highlights = items.filter(isHighlight);
        const noteItems = items.filter(isNote);
        const sample = highlights[0] || noteItems[0] || items[0];
        return {
            page: sample.page,
            chapter: sample.chapter || '',
            quote: sample.quote || '',
            highlights,
            notes: noteItems
        };
    });
}
function applyHighlightToHtml(html, note) {
    if (!html || !note || !note.quote)
        return html;
    const colorClass = `hl-${note.color || 'yellow'}`;
    const noteId = note.id;
    // 1. Precise full-quote match
    if (html.includes(note.quote)) {
        const marked = `<mark class="${colorClass}" data-id="${noteId}">${note.quote}</mark>`;
        return html.replace(note.quote, marked);
    }
    // 2. Cross-paragraph / multi-line split matching
    const rawSegments = note.quote.split(/[\r\n]+/).map(s => s.trim()).filter(s => s.length > 1);
    if (rawSegments.length > 0) {
        let updatedHtml = html;
        let matchFound = false;
        for (const seg of rawSegments) {
            if (updatedHtml.includes(seg)) {
                const marked = `<mark class="${colorClass}" data-id="${noteId}">${seg}</mark>`;
                updatedHtml = updatedHtml.replace(seg, marked);
                matchFound = true;
            }
            else {
                // 3. Sentence-level matching for segments interrupted by tags/newlines
                const subSentences = seg.split(/([。！？；;\n]+)/).map(s => s.trim()).filter(s => s.length > 3);
                for (const sub of subSentences) {
                    if (updatedHtml.includes(sub)) {
                        const markedSub = `<mark class="${colorClass}" data-id="${noteId}">${sub}</mark>`;
                        updatedHtml = updatedHtml.replace(sub, markedSub);
                        matchFound = true;
                    }
                }
            }
        }
        if (matchFound)
            return updatedHtml;
    }
    return html;
}
function applyAllHighlightsToHtml(html, notes = []) {
    if (!html || !Array.isArray(notes) || notes.length === 0)
        return html;
    let resultHtml = html;
    for (const note of notes) {
        resultHtml = applyHighlightToHtml(resultHtml, note);
    }
    return resultHtml;
}
function createAnnotationObject({ id = null, bookId = '', kind = null, quote = '', comment = '', color = null, page = 1, chapter = '章节选区', timestamp = null, sectionId = '', offset = 0, location = null } = {}) {
    const cleanComment = comment || '';
    const finalKind = (kind === 'highlight' || kind === 'note')
        ? kind
        : (cleanComment.trim() !== '' ? 'note' : 'highlight');
    const validPage = Number(page) || 1;
    const sourceLocation = location && typeof location === 'object' ? location : {};
    const loc = {
        sectionId: sourceLocation.sectionId || sectionId || `chapter-${validPage}`,
        page: Number(sourceLocation.page) || validPage,
        offset: Number(sourceLocation.offset ?? offset) || 0
    };
    if (sourceLocation.start != null && sourceLocation.end != null) {
        loc.start = Number(sourceLocation.start);
        loc.end = Number(sourceLocation.end);
        if (!loc.offset)
            loc.offset = loc.start || 0;
    }
    const finalColor = color || (finalKind === 'note' ? 'green' : 'yellow');
    const prefix = finalKind === 'highlight' ? 'highlight-' : 'note-';
    return {
        id: id || (prefix + Date.now() + '-' + Math.floor(Math.random() * 1000)),
        bookId,
        kind: finalKind,
        quote: quote || '',
        comment: cleanComment,
        color: finalColor,
        page: validPage,
        chapter: chapter || '章节选区',
        timestamp: timestamp || new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16),
        location: loc
    };
}

},
"website/demo/memory-storage.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noteVersion = exports.bookVersion = exports.readNotes = exports.readBooks = exports.initializeStorage = exports.operationId = void 0;
exports.enqueue = enqueue;
exports.drainStorage = drainStorage;
exports.acceptBook = acceptBook;
exports.acceptNote = acceptNote;
exports.configureStorage = configureStorage;
exports.unwrapDesktop = unwrapDesktop;
exports.restoreRecords = restoreRecords;
exports.storageRequest = storageRequest;
// Website-only transport. The production repositories and controllers are unchanged.
const alice_js_1 = require("website/demo/alice.js");
const copy = value => structuredClone(value);
const books = new Map([[alice_js_1.aliceBook.id, { id: alice_js_1.aliceBook.id, value: copy(alice_js_1.aliceBook), generation: 'demo-generation', revision: 1, deleted: false }]]);
const notes = new Map();
const queues = new Map();
const operations = new Map();
const operationId = () => crypto.randomUUID();
exports.operationId = operationId;
const initializeStorage = async () => ({ completed: true });
exports.initializeStorage = initializeStorage;
const readBooks = async () => copy([...books.values()]);
exports.readBooks = readBooks;
const readNotes = async (bookIds = []) => copy([...notes.values()].filter(row => !bookIds.length || bookIds.includes(row.bookId)));
exports.readNotes = readNotes;
const bookVersion = async (id) => copy(books.get(id) || { revision: 0 });
exports.bookVersion = bookVersion;
const noteVersion = async (id) => copy(notes.get(id) || { revision: 0 });
exports.noteVersion = noteVersion;
function enqueue(id, task) {
    const next = (queues.get(id) || Promise.resolve()).catch(() => { }).then(task);
    queues.set(id, next);
    next.finally(() => { if (queues.get(id) === next)
        queues.delete(id); }).catch(() => { });
    return next;
}
async function drainStorage() { await Promise.all([...queues.values()]); }
function acceptBook() { }
function acceptNote() { }
function configureStorage() { throw new Error('体验区不连接外部书库'); }
function unwrapDesktop(result) { if (result.ok)
    return result.value; throw new Error(result.error.message); }
async function restoreRecords() { throw new Error('请在桌面版中导入书籍备份'); }
async function storageRequest(route, body) {
    if (route === 'books')
        return { records: await (0, exports.readBooks)() };
    if (route === 'notes/query')
        return { records: await (0, exports.readNotes)(body.bookIds) };
    if (body?.opId && operations.has(body.opId))
        return copy(operations.get(body.opId));
    const isBook = route.startsWith('books/');
    const item = isBook ? body.book : body.note;
    const id = item?.id || body.id;
    const store = isBook ? books : notes;
    const current = store.get(id);
    if ((current?.revision || 0) !== body.expected)
        throw Object.assign(new Error('体验数据版本冲突，请重置体验'), { status: 409 });
    if (!isBook) {
        const book = books.get(item?.bookId || body.bookId);
        if (!book || book.deleted || book.generation !== body.generation)
            throw new Error('示例书籍不存在');
    }
    const revision = (current?.revision || 0) + 1;
    let result;
    switch (route) {
        case 'notes/save':
        case 'notes/delete':
            notes.set(id, { id, bookId: item?.bookId || body.bookId, revision, deleted: route.endsWith('delete'), value: item ? copy(item) : null });
            result = { revision };
            break;
        case 'books/save':
            result = { revision, generation: current?.generation || crypto.randomUUID() };
            books.set(id, { id, ...result, deleted: false, value: copy(item) });
            break;
        case 'books/delete':
            books.set(id, { ...current, revision, deleted: true, value: null });
            for (const [key, note] of notes)
                if (note.bookId === id)
                    notes.delete(key);
            result = { revision };
            break;
        default: throw new Error('此操作请使用桌面版');
    }
    if (body.opId)
        operations.set(body.opId, copy(result));
    return result;
}

},
"website/demo/alice.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aliceBook = exports.ALICE_ID = void 0;
// Lewis Carroll, Alice's Adventures in Wonderland (1865), Chapter I excerpt.
// Public-domain text: https://www.gutenberg.org/ebooks/11
// Only this explicit sample is shipped; no personal library data is copied.
exports.ALICE_ID = 'website-alice';
exports.aliceBook = {
    id: exports.ALICE_ID,
    title: "Alice's Adventures in Wonderland",
    language: 'en',
    format: 'EPUB',
    readerFlow: 'chapter',
    toc: [{ title: 'CHAPTER I. Down the Rabbit-Hole', page: 1 }],
    pages: [String.raw `<h1>CHAPTER I.<br>Down the Rabbit-Hole</h1>
<p>Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”</p>
<p>So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.</p>
<p>There was nothing so <em>very</em> remarkable in that; nor did Alice think it so <em>very</em> much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!”</p>
<p>(when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually <em>took a watch out of its waistcoat-pocket</em>, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.</p>
<p>In another moment down went Alice after it, never once considering how in the world she was to get out again.</p>
<p>The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.</p>
<p>Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs. She took down a jar from one of the shelves as she passed; it was labelled “ORANGE MARMALADE”, but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody underneath, so managed to put it into one of the cupboards as she fell past it.</p>
<p>“Well!” thought Alice to herself, “after such a fall as this, I shall think nothing of tumbling down stairs! How brave they’ll all think me at home! Why, I wouldn’t say anything about it, even if I fell off the top of the house!” (Which was very likely true.)</p>
<p>Down, down, down. Would the fall never come to an end? “I wonder how many miles I’ve fallen by this time?” she said aloud. “I must be getting somewhere near the centre of the earth. Let me see: that would be four thousand miles down, I think—” (for, you see, Alice had learnt several things of this sort in her lessons in the schoolroom, and though this was not a <em>very</em> good opportunity for showing off her knowledge, as there was no one to listen to her, still it was good practice to say it over) “—yes, that’s about the right distance—but then I wonder what Latitude or Longitude I’ve got to?” (Alice had no idea what Latitude was, or Longitude either, but thought they were nice grand words to say.)</p>
<p>Presently she began again. “I wonder if I shall fall right <em>through</em> the earth! How funny it’ll seem to come out among the people that walk with their heads downward! The Antipathies, I think—” (she was rather glad there was no one <em>listening</em>, this time, as it didn’t sound at all the right word) “—but I shall have to ask them what the name of the country is, you know. Please, Ma’am, is this New Zealand or Australia?” (and she tried to curtsey as she spoke—fancy <em>curtseying</em> as you’re falling through the air! Do you think you could manage it?) “And what an ignorant little girl she’ll think me for asking! No, it’ll never do to ask: perhaps I shall see it written up somewhere.”</p>
<p>Down, down, down. There was nothing else to do, so Alice soon began talking again. “Dinah’ll miss me very much to-night, I should think!” (Dinah was the cat.) “I hope they’ll remember her saucer of milk at tea-time. Dinah my dear! I wish you were down here with me! There are no mice in the air, I’m afraid, but you might catch a bat, and that’s very like a mouse, you know. But do cats eat bats, I wonder?” And here Alice began to get rather sleepy, and went on saying to herself, in a dreamy sort of way, “Do cats eat bats? Do cats eat bats?” and sometimes, “Do bats eat cats?” for, you see, as she couldn’t answer either question, it didn’t much matter which way she put it.</p>
<p>She felt that she was dozing off, and had just begun to dream that she was walking hand in hand with Dinah, and saying to her very earnestly, “Now, Dinah, tell me the truth: did you ever eat a bat?” when suddenly, thump! thump! down she came upon a heap of sticks and dry leaves, and the fall was over.</p>
<p>Alice was not a bit hurt, and she jumped up on to her feet in a moment: she looked up, but it was all dark overhead; before her was another long passage, and the White Rabbit was still in sight, hurrying down it. There was not a moment to be lost: away went Alice like the wind, and was just in time to hear it say, as it turned a corner, “Oh my ears and whiskers, how late it’s getting!” She was close behind it when she turned the corner, but the Rabbit was no longer to be seen: she found herself in a long, low hall, which was lit up by a row of lamps hanging from the roof.</p>
<p>There were doors all round the hall, but they were all locked; and when Alice had been all the way down one side and up the other, trying every door, she walked sadly down the middle, wondering how she was ever to get out again.</p>
<p>Suddenly she came upon a little three-legged table, all made of solid glass; there was nothing on it except a tiny golden key, and Alice’s first thought was that it might belong to one of the doors of the hall; but, alas! either the locks were too large, or the key was too small, but at any rate it would not open any of them. However, on the second time round, she came upon a low curtain she had not noticed before, and behind it was a little door about fifteen inches high: she tried the little golden key in the lock, and to her great delight it fitted!</p>
<p>Alice opened the door and found that it led into a small passage, not much larger than a rat-hole: she knelt down and looked along the passage into the loveliest garden you ever saw. How she longed to get out of that dark hall, and wander about among those beds of bright flowers and those cool fountains, but she could not even get her head through the doorway; “and even if my head would go through,” thought poor Alice, “it would be of very little use without my shoulders. Oh, how I wish I could shut up like a telescope! I think I could, if I only knew how to begin.” For, you see, so many out-of-the-way things had happened lately, that Alice had begun to think that very few things indeed were really impossible.</p>`]
};

},
"src/client/features/annotations/notesUI.js":function(module,exports,require,localStorage){
"use strict";
/* ==========================================================================
   NotesUI - Sidebar Notes & Annotations Presentation (Feature Layer)
   Pure UI presentation. Renders note cards, toggles pure-highlight visibility,
   handles inline inputs, and exposes interaction callbacks.
   Zero direct database persistence calls.
   ========================================================================== */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderNotesList = renderNotesList;
exports.highlightNoteCard = highlightNoteCard;
exports.focusInlineEditor = focusInlineEditor;
exports.updateNoteGoalActions = updateNoteGoalActions;
const annotationEngine_js_1 = require("src/client/domain/annotationEngine.ts");
const marginNotesLayout_js_1 = require("src/client/features/layout/marginNotesLayout.js");
const noteCaret_js_1 = require("src/client/features/annotations/noteCaret.js");
/** @param {import('../../app/contracts.js').NotesRenderOptions} options */
function renderNotesList({ elements, notes = [], notesScope = 'page', showHighlightsInSidebar = false, focusedNoteIds = [], focusedHighlightIds = [], onJump = null, onEdit = null, onDelete = null, editingNoteId = null, onInput = null, onFinish = null, getGoalAction = null, onLinkGoal = null }) {
    if (!elements || !elements.notesList)
        return;
    // Never detach the active textarea: autosave and reader refreshes must not
    // reset its caret, scroll position, or an ongoing IME composition.
    const { displayedNotes, pureCount } = (0, annotationEngine_js_1.filterNotes)(notes, showHighlightsInSidebar);
    const focusedIds = new Set([...(focusedNoteIds || []), ...(focusedHighlightIds || [])]);
    const keys = new Map(displayedNotes.map(note => [String(note.id), JSON.stringify([note, focusedIds.has(note.id)])]));
    const retained = new Map();
    elements.notesList.querySelectorAll('.note-card').forEach(card => {
        const id = card.dataset.annotationId;
        const editor = card.querySelector('.note-editor');
        if (keys.has(id) && ((id === String(editingNoteId) && editor)
            || (card._noteRenderKey === keys.get(id) && !editor)))
            retained.set(id, card);
        else
            card.remove();
    });
    if (elements.emptyNotesState && !elements.notesList.contains(elements.emptyNotesState))
        elements.notesList.appendChild(elements.emptyNotesState);
    // Update counts
    if (elements.countPureHighlights) {
        elements.countPureHighlights.textContent = pureCount;
    }
    if (elements.countHighlights) {
        elements.countHighlights.textContent = displayedNotes.length;
    }
    if (elements.notesTotalCount) {
        elements.notesTotalCount.textContent = displayedNotes.length;
    }
    // Update toggle button text & icon
    if (elements.btnToggleShowHighlights) {
        if (showHighlightsInSidebar) {
            elements.btnToggleShowHighlights.innerHTML = `<i class="ri-eye-off-line"></i> 隐藏划线 (${pureCount})`;
            elements.btnToggleShowHighlights.classList.add('active');
        }
        else {
            elements.btnToggleShowHighlights.innerHTML = `<i class="ri-eye-line"></i> 显示划线 (${pureCount})`;
            elements.btnToggleShowHighlights.classList.remove('active');
        }
    }
    if (displayedNotes.length === 0) {
        if (elements.emptyNotesState) {
            elements.emptyNotesState.style.display = 'block';
            const emptyText = elements.emptyNotesState.querySelector('p');
            if (emptyText) {
                const scope = notesScope === 'book' ? '全书' : '当前页';
                emptyText.textContent = showHighlightsInSidebar ? `${scope}暂无划线与笔记` : `${scope}暂无笔记`;
            }
        }
        (0, marginNotesLayout_js_1.positionMarginNotes)(elements);
        return;
    }
    if (elements.emptyNotesState) {
        elements.emptyNotesState.style.display = 'none';
    }
    displayedNotes.forEach(note => {
        const existingCard = retained.get(String(note.id));
        if (existingCard) {
            if (note.id === editingNoteId && !existingCard.querySelector('.note-editor')) {
                startInlineEditor({ card: existingCard, note, elements, onInput, onFinish });
            }
            return;
        }
        const highlight = (0, annotationEngine_js_1.isHighlight)(note);
        const noteKind = (0, annotationEngine_js_1.isNote)(note);
        const card = document.createElement('div');
        card.className = `note-card${noteKind ? ' hl-green-card' : ''}${highlight ? ' pure-highlight-card' : ''}${focusedIds.has(note.id) ? ' is-focused' : ''}`;
        card.id = `card-${note.id}`;
        card.setAttribute('data-annotation-id', note.id);
        card._noteRenderKey = keys.get(String(note.id));
        const chapterLabel = note.chapter ? escapeHtml(note.chapter) : '章节选区';
        const typeBadge = highlight ?
            `<span class="note-loc-tag" style="background: rgba(245,158,11,0.1); color: #d97706; font-weight: 500;"><i class="ri-sparkling-line"></i> 划线</span>` :
            `<span class="note-loc-tag" style="background: rgba(16,185,129,0.1); color: var(--accent-color); font-weight: 500;"><i class="ri-chat-1-line"></i> 笔记</span>`;
        card.innerHTML = `
            <div class="note-card-header">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    ${typeBadge}
                    <span class="note-loc-tag" style="background: rgba(0,0,0,0.04);"><i class="ri-book-open-line"></i> ${chapterLabel}</span>
                    <span class="note-loc-tag"><i class="ri-bookmark-3-line"></i> P.${note.page}</span>
                </div>
                <span style="font-size: 0.76rem; color: var(--text-sub);">${note.timestamp || ''}</span>
            </div>
            ${note.quote ? `<div class="note-quote-text">“${escapeHtml(note.quote)}”</div>` : ''}
            ${noteKind ? `<div class="note-comment-text">${escapeHtml(note.comment || '')}</div>` : ''}
            <div class="note-card-actions">
                <button class="btn btn-ghost-sm btn-delete-note" data-id="${note.id}" title="${highlight ? '删除高亮' : '删除这条笔记'}">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;
        if ((0, marginNotesLayout_js_1.isImmersiveNotes)(elements)) {
            // References remain in the annotation/export; the margin presents
            // only the user's words, in both reading and editing states.
            card.querySelector('.note-card-header')?.remove();
            card.querySelector('.note-quote-text')?.remove();
            const comment = card.querySelector('.note-comment-text');
            if (comment)
                comment.textContent = note.comment;
            else if (highlight) {
                const label = document.createElement('span');
                label.className = 'margin-highlight-label';
                label.textContent = '划线';
                card.prepend(label);
            }
            card.setAttribute('role', 'group');
            card.setAttribute('aria-label', highlight ? '高亮操作' : '关联正文的笔记');
        }
        card.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('.note-editor'))
                return;
            if (noteKind && typeof onEdit === 'function')
                onEdit(note);
            else if (typeof onJump === 'function')
                onJump(note);
        });
        if (noteKind) {
            card.tabIndex = 0;
            card.addEventListener('keydown', event => {
                if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onEdit?.(note);
                }
            });
        }
        const deleteBtn = card.querySelector('.btn-delete-note');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onDelete === 'function')
                    onDelete(note);
            });
        }
        if (onLinkGoal) {
            const linkButton = document.createElement('button');
            linkButton.className = 'btn btn-ghost-sm btn-goal-link';
            linkButton.type = 'button';
            linkButton.dataset.annotationId = note.id;
            linkButton.innerHTML = '<i class="ri-links-line" aria-hidden="true"></i><span>Goal</span>';
            linkButton.addEventListener('click', event => { event.stopPropagation(); onLinkGoal(note.id); });
            card.querySelector('.note-card-actions').appendChild(linkButton);
        }
        elements.notesList.appendChild(card);
        if (note.id === editingNoteId)
            startInlineEditor({ card, note, elements, onInput, onFinish });
    });
    if (!(0, marginNotesLayout_js_1.isImmersiveNotes)(elements)) {
        let before = null;
        for (const note of displayedNotes.slice().reverse()) {
            const card = [...elements.notesList.querySelectorAll('.note-card')].find(node => node.dataset.annotationId === String(note.id));
            (0, marginNotesLayout_js_1.moveNoteCard)(card, elements.notesList, before);
            before = card;
        }
    }
    (0, marginNotesLayout_js_1.positionMarginNotes)(elements);
}
function highlightNoteCard(noteId) {
    const card = document.getElementById(`card-${noteId}`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--primary)';
        setTimeout(() => card.style.outline = '', 2000);
    }
}
function focusInlineEditor(elements, noteId) {
    const card = [...(elements?.notesList?.querySelectorAll('.note-card') || [])]
        .find(node => node.dataset.annotationId === String(noteId));
    const editor = card?.querySelector('.note-editor');
    if (!editor?.isConnected)
        return;
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(editor.value.length, editor.value.length);
    const lane = card.closest('.margin-notes-lane');
    if (lane && card.offsetTop + card.offsetHeight > lane.scrollTop + lane.clientHeight) {
        lane.scrollTop = Math.max(0, card.offsetTop + card.offsetHeight - lane.clientHeight);
    }
}
function startInlineEditor({ card, note, elements, onInput, onFinish }) {
    const text = card.querySelector('.note-comment-text');
    const editor = document.createElement('textarea');
    editor.className = 'note-editor';
    editor.setAttribute('aria-label', '笔记内容');
    editor.setAttribute('aria-keyshortcuts', 'Escape Control+Enter Meta+Enter');
    editor.rows = 1;
    editor.value = note.comment || '';
    const shell = document.createElement('div');
    shell.className = 'note-editor-shell';
    shell.appendChild(editor);
    text.replaceChildren(shell);
    const updateCaret = (0, noteCaret_js_1.attachNoteCaret)(editor, shell);
    card.querySelector('.note-card-actions').hidden = true;
    const resize = () => {
        editor.style.height = '0px';
        editor.style.height = `${Math.max(editor.scrollHeight, 25.2)}px`;
        (0, marginNotesLayout_js_1.positionMarginNotes)(elements);
        updateCaret();
    };
    let composing = false;
    editor.addEventListener('compositionstart', () => { composing = true; });
    editor.addEventListener('compositionend', () => {
        composing = false;
        onInput?.(note.id, editor.value);
        resize();
    });
    editor.addEventListener('input', () => {
        onInput?.(note.id, editor.value);
        resize();
    });
    editor.addEventListener('keydown', event => {
        event.stopPropagation();
        if (composing || event.isComposing || event.keyCode === 229)
            return;
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
            event.preventDefault();
            onFinish?.();
        }
    });
    editor.addEventListener('blur', () => {
        if (!editor.dataset.repositioning)
            onFinish?.();
    });
    resize();
}
function escapeHtml(str) {
    if (!str)
        return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function updateNoteGoalActions(elements, getGoalAction) {
    for (const control of elements?.notesList?.querySelectorAll('.btn-goal-link') || []) {
        const state = getGoalAction?.(control.dataset.annotationId);
        control.hidden = !state?.visible;
        control.disabled = !state || state.disabled;
        control.title = state?.linked ? 'Added to goal' : 'Add to goal';
        control.setAttribute('aria-label', control.title);
        control.classList.toggle('is-linked', !!state?.linked);
        const label = control.querySelector('span');
        if (label)
            label.textContent = state?.linked ? 'Linked' : 'Goal';
        control.querySelector('i').className = state?.linked ? 'ri-check-line' : 'ri-links-line';
    }
}

},
"src/client/features/layout/marginNotesLayout.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOUBLE_PAGE_MIN_WIDTH = void 0;
exports.marginGeometry = marginGeometry;
exports.isImmersiveNotes = isImmersiveNotes;
exports.applyMarginGeometry = applyMarginGeometry;
exports.moveNoteCard = moveNoteCard;
exports.positionMarginNotes = positionMarginNotes;
// Presentation geometry only. Annotation contents, ranges and persistence stay
// with the existing controllers and repositories.
const visibleAnnotations_js_1 = require("src/client/features/reader/visibleAnnotations.js");
// Two 560px columns, a 72px gap, and room for notes on both sides.
exports.DOUBLE_PAGE_MIN_WIDTH = 1612;
function marginGeometry(width, mode = 'single') {
    const w = Math.max(1, Number(width) || 1);
    const double = mode === 'double' && w >= exports.DOUBLE_PAGE_MIN_WIDTH;
    let readingWidth = double ? 1192 : Math.min(560, Math.max(1, w - 32));
    let placement = 'right', noteWidth = 260, gap = 48;
    let readingLeft = (w - readingWidth) / 2;
    if (double) {
        gap = 24;
        placement = 'flanks';
        noteWidth = Math.min(260, (w - 1260) / 2);
    }
    else if (readingLeft + readingWidth + gap + noteWidth > w - 24) {
        gap = 32;
        noteWidth = 220;
        // In narrow windows keep notes beside the text, without a bottom band.
        readingWidth = Math.min(readingWidth, Math.max(1, w - 32 - gap - noteWidth));
        readingLeft = (w - readingWidth - gap - noteWidth) / 2;
    }
    return {
        placement, readingWidth, readingLeft, noteWidth, gap,
        leftNoteLeft: readingLeft - gap - noteWidth,
        rightNoteLeft: readingLeft + readingWidth + gap
    };
}
function isImmersiveNotes(elements) {
    return !!elements?.workspaceContainer?.classList.contains('immersive-notes');
}
function applyMarginGeometry(elements, mode) {
    if (!isImmersiveNotes(elements))
        return;
    const workspace = elements.workspaceContainer;
    const width = workspace.clientWidth || workspace.ownerDocument.defaultView?.innerWidth || 1200;
    const geometry = marginGeometry(width, mode);
    workspace.dataset.notesPlacement = geometry.placement;
    workspace.style.setProperty('--reading-width', `${geometry.readingWidth}px`);
    workspace.style.setProperty('--reading-left', `${geometry.readingLeft}px`);
    workspace.style.setProperty('--reading-right', `${Math.max(0, width - geometry.readingLeft - geometry.readingWidth)}px`);
    workspace._marginGeometry = geometry;
}
function moveNoteCard(card, target, before = null) {
    if (card.parentElement === target && card.nextSibling === before)
        return;
    if (typeof target.moveBefore === 'function' && card.isConnected)
        target.moveBefore(card, before);
    else {
        const editor = card.querySelector('.note-editor');
        const active = editor && card.ownerDocument.activeElement === editor;
        const start = editor?.selectionStart, end = editor?.selectionEnd;
        if (active)
            editor.dataset.repositioning = 'true';
        target.insertBefore(card, before);
        if (active) {
            editor.focus({ preventScroll: true });
            editor.setSelectionRange(start, end);
            delete editor.dataset.repositioning;
        }
    }
}
function positionMarginNotes(elements) {
    if (!isImmersiveNotes(elements) || !elements.notesList)
        return;
    const workspace = elements.workspaceContainer;
    const geometry = workspace._marginGeometry;
    const viewport = workspace.ownerDocument.getElementById('reader-viewport');
    if (!geometry || !viewport)
        return;
    const list = elements.notesList;
    const cards = [...list.querySelectorAll('.note-card')];
    if (!cards.length) {
        list.querySelectorAll('.margin-notes-lane').forEach(lane => lane.remove());
        return;
    }
    const bounds = workspace.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    const win = workspace.ownerDocument.defaultView;
    const paper = elements.bookPaper;
    if (elements.notesPanel && paper && win) {
        const paperStyle = win.getComputedStyle(paper);
        // Use the destination theme token, not an intermediate animated color.
        elements.notesPanel.style.setProperty('--margin-note-color', paperStyle.getPropertyValue('--bg-paper-text').trim() || paperStyle.color);
    }
    const anchors = annotationAnchors(elements, view, bounds.left + geometry.readingLeft + geometry.readingWidth / 2);
    const top = view.top - bounds.top + 32;
    const height = Math.max(1, view.bottom - bounds.top - top - 32);
    const lane = side => {
        let node = list.querySelector(`[data-margin-side="${side}"]`);
        if (!node) {
            node = workspace.ownerDocument.createElement('div');
            node.className = 'margin-notes-lane';
            node.dataset.marginSide = side;
            node.setAttribute('role', 'group');
            node.setAttribute('aria-label', side === 'left' ? '左页笔记' : '当前可见正文的笔记');
            list.appendChild(node);
        }
        node.style.left = `${side === 'left' ? geometry.leftNoteLeft : geometry.rightNoteLeft}px`;
        node.style.top = `${top}px`;
        node.style.width = `${geometry.noteWidth}px`;
        node.style.height = `${height}px`;
        return node;
    };
    const groups = new Map();
    cards.forEach(card => {
        const anchor = anchors.get(card.dataset.annotationId);
        const side = geometry.placement === 'flanks' && anchor?.side === 'left' ? 'left' : 'right';
        const target = lane(side);
        if (card.parentElement !== target)
            moveNoteCard(card, target);
        if (!groups.has(target))
            groups.set(target, []);
        groups.get(target).push({ card, y: anchor ? anchor.top - bounds.top - top : 0 });
    });
    list.querySelectorAll('.margin-notes-lane').forEach(node => {
        if (!groups.has(node))
            node.remove();
    });
    for (const [target, entries] of groups) {
        // Keep an overflowing lane scrollable and stable while its source text
        // scrolls. Never rebuild cards or steal a focused edit/delete button.
        entries.sort((a, b) => a.y - b.y);
        let bottom = 0;
        for (const { card, y } of entries) {
            const pos = Math.max(bottom, Math.min(Math.max(0, y), Math.max(0, height - card.offsetHeight)));
            card.style.top = `${pos}px`;
            bottom = pos + card.offsetHeight + 24;
        }
    }
}
function annotationAnchors(elements, view, middle) {
    const anchors = new Map();
    for (const paper of [elements.bookPaper, elements.bookPaperRight]) {
        if (!paper || paper.hidden || paper.style.display === 'none')
            continue;
        const paperRect = paper.getBoundingClientRect();
        const clip = (0, visibleAnnotations_js_1.intersectVisibleRects)(view, paperRect);
        if (!clip)
            continue;
        for (const token of paper.querySelectorAll('.annotation-token')) {
            for (const rect of token.getClientRects()) {
                const visible = (0, visibleAnnotations_js_1.intersectVisibleRects)(clip, rect);
                if (!visible)
                    continue;
                const side = (visible.left + visible.right) / 2 < middle ? 'left' : 'right';
                const ids = `${token.getAttribute('data-note-ids') || ''} ${token.getAttribute('data-highlight-ids') || ''}`.trim().split(/\s+/);
                ids.filter(Boolean).forEach(id => {
                    const point = { top: visible.top, side };
                    const previous = anchors.get(id);
                    if (!previous || (side === 'left' && previous.side === 'right') || (side === previous.side && point.top < previous.top))
                        anchors.set(id, point);
                });
            }
        }
    }
    return anchors;
}

},
"src/client/features/reader/visibleAnnotations.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectVisibleAnnotationIds = collectVisibleAnnotationIds;
exports.intersectVisibleRects = intersectVisibleRects;
// Read the rendered fragments, not chapter numbers or bounding-box unions:
// one annotation can span multiple lines, columns, or screens.
const RECT_EPSILON = 0.01;
/** @param {(HTMLElement | null | undefined)[]} papers
 * @param {HTMLElement | null} viewport
 * @returns {Set<string>} */
function collectVisibleAnnotationIds(papers = [], viewport = null) {
    const ids = new Set();
    if (!viewport)
        return ids;
    const win = viewport.ownerDocument?.defaultView;
    let view = viewport.getBoundingClientRect();
    if (win && win.innerWidth > 0 && win.innerHeight > 0) {
        view = intersectVisibleRects(view, { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight });
    }
    if (!view)
        return ids;
    for (const paper of papers) {
        if (!paper || paper.hidden || paper.style.display === 'none')
            continue;
        const clip = intersectVisibleRects(view, paper.getBoundingClientRect());
        if (!clip)
            continue;
        for (const token of paper.querySelectorAll('.annotation-token')) {
            if (!token.textContent.trim())
                continue;
            const visible = [...token.getClientRects()].some(rect => intersectVisibleRects(clip, rect));
            if (!visible || win?.getComputedStyle(token).visibility === 'hidden')
                continue;
            for (const attribute of ['data-note-ids', 'data-highlight-ids']) {
                (token.getAttribute(attribute) || '').split(/\s+/).filter(Boolean).forEach(id => ids.add(id));
            }
        }
    }
    return ids;
}
function intersectVisibleRects(a, b) {
    if (!a || !b)
        return null;
    const rect = {
        left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom)
    };
    // Chrome can report a fully clipped previous-column line a few millionths
    // of a CSS pixel beyond the page edge at fractional zoom/DPI. That numeric
    // sliver is not visible text. Keep the tolerance far below a real glyph.
    return rect.right - rect.left > RECT_EPSILON && rect.bottom - rect.top > RECT_EPSILON ? rect : null;
}

},
"src/client/features/annotations/noteCaret.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachNoteCaret = attachNoteCaret;
// A visual caret only; the native textarea still owns input, selection and IME.
function attachNoteCaret(editor, shell) {
    const doc = editor.ownerDocument;
    const win = doc.defaultView;
    const mirror = doc.createElement('div');
    mirror.className = 'note-caret-mirror';
    mirror.setAttribute('aria-hidden', 'true');
    const caret = doc.createElement('span');
    caret.className = 'note-block-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.hidden = true;
    shell.append(mirror, caret);
    let composing = false;
    const update = () => {
        caret.hidden = true;
        editor.classList.remove('has-block-caret');
        if (!win || doc.activeElement !== editor || composing || editor.selectionStart !== editor.selectionEnd)
            return;
        const style = win.getComputedStyle(editor);
        for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'lineHeight',
            'letterSpacing', 'wordSpacing', 'textAlign', 'textIndent', 'textTransform', 'tabSize', 'direction',
            'whiteSpace', 'overflowWrap', 'wordBreak', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
            mirror.style[property] = style[property];
        }
        mirror.style.width = `${editor.clientWidth}px`;
        const offset = editor.selectionStart;
        const marker = doc.createElement('span');
        marker.textContent = editor.value.slice(offset) || '\u200b';
        mirror.replaceChildren(doc.createTextNode(editor.value.slice(0, offset)), marker);
        const rect = marker.getClientRects()[0];
        if (!rect || !rect.height)
            return; // Keep the native caret if measurement is unavailable.
        const host = shell.getBoundingClientRect();
        caret.style.left = `${rect.left - host.left - editor.scrollLeft}px`;
        caret.style.top = `${rect.top - host.top - editor.scrollTop}px`;
        caret.style.height = `${rect.height}px`;
        caret.hidden = false;
        editor.classList.add('has-block-caret');
    };
    for (const event of ['focus', 'blur', 'input', 'select', 'selectionchange', 'keyup', 'click', 'scroll']) {
        editor.addEventListener(event, update);
    }
    editor.addEventListener('compositionstart', () => { composing = true; update(); });
    editor.addEventListener('compositionend', () => { composing = false; update(); });
    return update;
}

},
"src/client/features/annotations/selectionController.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectionController = void 0;
const dom_js_1 = require("src/client/app/dom.ts");
/* ==========================================================================
   SelectionController - Text Selection & Annotation Click Context
   Authority owner of: pendingSelection, activeAnnotationContext.
   A drag keeps the native selection. A click on a token opens one context.
   ========================================================================== */
const selectionTooltipUI_js_1 = require("src/client/features/annotations/selectionTooltipUI.js");
const annotationRenderer_js_1 = require("src/client/features/reader/annotationRenderer.js");
const annotationRangeEngine_js_1 = require("src/client/domain/annotationRangeEngine.ts");
const DRAG_THRESHOLD = 5;
class SelectionController {
    callbacks;
    pendingSelection;
    activeAnnotationContext;
    menuOpen;
    pointerOrigin;
    pointerMoved;
    elements;
    constructor({ callbacks = {} } = {}) {
        this.callbacks = callbacks;
        this.pendingSelection = null;
        this.activeAnnotationContext = null;
        this.menuOpen = false;
        this.pointerOrigin = null;
        this.pointerMoved = false;
        this.elements = null;
    }
    getPendingSelection() {
        return this.pendingSelection;
    }
    getActiveAnnotationContext() {
        return this.activeAnnotationContext;
    }
    get activeHighlightId() {
        const ctx = this.activeAnnotationContext;
        return ctx && ctx.highlightIds && ctx.highlightIds.length ? ctx.highlightIds[0] : null;
    }
    set activeHighlightId(val) {
        if (!val)
            this.clearAnnotationContext();
    }
    clearSelection() {
        this.pendingSelection = null;
        if (window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
    }
    showHighlightAction(targetEl, note) {
        this.hideSelectionTooltip();
        if (!targetEl)
            return;
        if (targetEl.classList && targetEl.classList.contains('annotation-token')) {
            const page = Number(targetEl.dataset.page) || (note && note.page) || 1;
            this.activateToken(targetEl, page, { force: true, notify: false, showMenu: true });
            return;
        }
        if (!note)
            return;
        const highlightIds = note.kind === 'note' ? [] : [note.id];
        const noteIds = note.kind === 'note' ? [note.id] : [];
        this.activeAnnotationContext = {
            key: (0, annotationRangeEngine_js_1.annotationContextKey)(highlightIds, noteIds),
            highlightIds,
            noteIds,
            primaryKind: (0, annotationRangeEngine_js_1.primaryKindFor)(highlightIds, noteIds),
            targetElement: targetEl,
            page: note.page || 1,
            quote: note.quote || '',
            location: note.location || null
        };
        this.showMenuForContext();
    }
    hideHighlightAction() {
        this.clearAnnotationContext();
    }
    hideMenu() {
        this.menuOpen = false;
        if (this.elements)
            (0, selectionTooltipUI_js_1.hideHighlightActionTooltip)(this.elements);
    }
    hideSelectionTooltip() {
        if (this.elements) {
            (0, selectionTooltipUI_js_1.hideSelectionTooltip)(this.elements);
        }
    }
    clearAnnotationContext() {
        const hadContext = !!this.activeAnnotationContext || this.menuOpen;
        this.activeAnnotationContext = null;
        this.menuOpen = false;
        clearActiveTokens();
        if (this.elements)
            (0, selectionTooltipUI_js_1.hideHighlightActionTooltip)(this.elements);
        if (hadContext && this.callbacks.onClearFocus)
            this.callbacks.onClearFocus();
    }
    activateToken(token, page, { force = false, notify = true, showMenu = true } = {}) {
        if (!token)
            return false;
        const highlightIds = splitIds(token.getAttribute('data-highlight-ids'));
        const noteIds = splitIds(token.getAttribute('data-note-ids'));
        const key = (0, annotationRangeEngine_js_1.annotationContextKey)(highlightIds, noteIds);
        if (!force && this.activeAnnotationContext && this.activeAnnotationContext.key === key) {
            return false;
        }
        const root = token.closest('[data-volume-title-page]') || token.closest('.book-paper') || token.parentElement;
        const quoteInfo = collectTokenQuote(root, token);
        const reading = this.callbacks.getReadingContext?.();
        const resolvedPage = Number(page) || Number(token.dataset.page) || 1;
        if (quoteInfo.location) {
            quoteInfo.location.sectionId = token.closest('[data-volume-title-page]')
                ? `chapter-${resolvedPage}` : (reading?.sectionId || quoteInfo.location.sectionId);
            quoteInfo.location.page = resolvedPage;
        }
        this.activeAnnotationContext = {
            key,
            highlightIds,
            noteIds,
            primaryKind: (0, annotationRangeEngine_js_1.primaryKindFor)(highlightIds, noteIds),
            targetElement: token,
            page: resolvedPage,
            quote: quoteInfo.quote,
            location: quoteInfo.location
        };
        this.applyActiveClasses();
        if (showMenu)
            this.showMenuForContext();
        else
            this.hideMenu();
        if (notify && this.callbacks.onAnnotationActivated) {
            this.callbacks.onAnnotationActivated(this.activeAnnotationContext);
        }
        return true;
    }
    activateAnnotationId(annotationId, { notify = false, showMenu = false } = {}) {
        if (!annotationId || typeof document === 'undefined')
            return false;
        const token = findTokenByAnnotationId(annotationId);
        if (!token)
            return false;
        const page = Number(token.dataset.page) || (this.activeAnnotationContext && this.activeAnnotationContext.page) || 1;
        return this.activateToken(token, page, { force: true, notify, showMenu });
    }
    restoreActiveTokens() {
        if (!this.activeAnnotationContext)
            return;
        const tokens = findTokensByKey(this.activeAnnotationContext.key);
        if (tokens.length === 0) {
            this.clearAnnotationContext();
            return;
        }
        this.applyActiveClasses();
        this.activeAnnotationContext.targetElement = tokens[0];
        if (this.menuOpen)
            this.showMenuForContext();
    }
    applyActiveClasses() {
        clearActiveTokens();
        if (!this.activeAnnotationContext)
            return;
        findTokensByKey(this.activeAnnotationContext.key).forEach(token => token.classList.add('is-active'));
    }
    showMenuForContext() {
        if (!this.activeAnnotationContext || !this.elements)
            return;
        if (!this.activeAnnotationContext.highlightIds.length && !this.activeAnnotationContext.noteIds.length) {
            this.hideMenu();
            return;
        }
        const target = this.activeAnnotationContext.targetElement || findTokensByKey(this.activeAnnotationContext.key)[0];
        if (!target)
            return;
        this.activeAnnotationContext.targetElement = target;
        this.refreshGoalAction();
        this.menuOpen = true;
        this.hideSelectionTooltip();
        (0, selectionTooltipUI_js_1.showHighlightActionTooltip)(this.elements, target, this.activeAnnotationContext);
    }
    handleAnnotationClick(event, paper) {
        if (!paper || !event)
            return;
        if (this.pointerMoved || hasTextSelection())
            return;
        const eventTarget = (0, dom_js_1.eventElement)(event);
        const token = eventTarget?.closest('.annotation-token');
        if (!token || !paper.contains(token)) {
            this.clearAnnotationContext();
            return;
        }
        event.stopPropagation();
        const page = Number(token.dataset.page) || Number(paper.dataset.annotationPage) || 1;
        const changed = this.activateToken(token, page);
        if (!changed)
            return;
    }
    handleSelection() {
        if (!this.elements)
            return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            this.hideSelectionTooltip();
            return;
        }
        const selectedText = selection.toString().trim();
        const isInLeft = this.elements.bookPaper && this.elements.bookPaper.contains(selection.anchorNode);
        const isInRight = this.elements.bookPaperRight && this.elements.bookPaperRight.contains(selection.anchorNode);
        if (!selectedText || (!isInLeft && !isInRight)) {
            this.hideSelectionTooltip();
            return;
        }
        this.hideHighlightAction();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0)
            return;
        const ctx = this.callbacks.getReadingContext ? this.callbacks.getReadingContext() : { currentPage: 1 };
        let effectivePage = ctx.chapterFlow
            ? (ctx.currentPage || 1)
            : (isInRight ? (ctx.currentRightPage || (ctx.currentPage + 1)) : (ctx.currentLeftPage || ctx.currentPage));
        let root = isInRight ? this.elements.bookPaperRight : this.elements.bookPaper;
        if (!root)
            return;
        const dividerAt = (node) => (node.nodeType === 1 ? node : node.parentElement)?.closest('[data-volume-title-page]');
        const startDivider = dividerAt(range.startContainer);
        const endDivider = dividerAt(range.endContainer);
        // Cross-spine selections were never a single annotation. Keep the
        // original per-document coordinates instead of inventing a new range.
        if (startDivider !== endDivider || (!startDivider && [...root.querySelectorAll('[data-volume-title-page]')]
            .some(divider => range.intersectsNode(divider)))) {
            this.pendingSelection = null;
            this.hideSelectionTooltip();
            return;
        }
        if (startDivider) {
            root = startDivider;
            effectivePage = Number(startDivider.dataset.volumeTitlePage);
        }
        this.pendingSelection = {
            text: selectedText,
            range,
            page: effectivePage,
            location: (0, annotationRenderer_js_1.selectionLocation)(root, range, effectivePage, startDivider ? `chapter-${effectivePage}` : ctx.sectionId)
        };
        if (this.elements) {
            (0, selectionTooltipUI_js_1.showSelectionTooltip)(this.elements, rect);
        }
    }
    refreshGoalAction() {
        const control = this.elements?.btnAnnotationGoal;
        if (!control)
            return;
        const context = this.activeAnnotationContext;
        const ids = [...new Set([...(context?.highlightIds || []), ...(context?.noteIds || [])])];
        const state = ids.length === 1 ? this.callbacks.getGoalAction?.(ids[0]) : undefined;
        control.hidden = !state?.visible;
        control.disabled = !state || state.disabled;
        control.title = state?.linked ? 'Added to goal' : 'Add to goal';
        control.setAttribute('aria-label', control.title);
        control.classList.toggle('is-linked', !!state?.linked);
        const label = control.querySelector('span');
        if (label)
            label.textContent = state?.linked ? 'Linked' : 'Goal';
        const glyph = control.querySelector('i');
        if (glyph)
            glyph.className = state?.linked ? 'ri-check-line' : 'ri-links-line';
    }
    initUI(elements) {
        this.elements = elements;
        if (!elements || typeof document === 'undefined')
            return;
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString().trim()) {
                this.hideSelectionTooltip();
            }
        });
        const bindPaper = (paper) => {
            if (!paper)
                return;
            paper.addEventListener('pointerdown', (event) => {
                this.pointerOrigin = { x: event.clientX, y: event.clientY };
                this.pointerMoved = false;
            });
            paper.addEventListener('pointermove', (event) => {
                if (!this.pointerOrigin)
                    return;
                const dx = Math.abs(event.clientX - this.pointerOrigin.x);
                const dy = Math.abs(event.clientY - this.pointerOrigin.y);
                if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)
                    this.pointerMoved = true;
            });
            paper.addEventListener('click', (event) => this.handleAnnotationClick(event, paper));
            paper.addEventListener('mouseup', () => setTimeout(() => this.handleSelection(), 30));
            paper.addEventListener('touchend', () => setTimeout(() => this.handleSelection(), 30));
        };
        bindPaper(elements.bookPaper);
        bindPaper(elements.bookPaperRight);
        document.querySelectorAll('.tooltip-btn[data-color]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = btn.getAttribute('data-color') || 'yellow';
                if (this.callbacks.onCreateHighlight && this.pendingSelection) {
                    this.callbacks.onCreateHighlight(color, this.pendingSelection);
                }
                this.hideSelectionTooltip();
                this.clearSelection();
            });
        });
        if (elements.btnAddNote) {
            elements.btnAddNote.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.pendingSelection)
                    return;
                const text = this.pendingSelection.text;
                const page = this.pendingSelection.page;
                const location = this.pendingSelection.location;
                this.hideSelectionTooltip();
                // Clear the body selection before handing focus to the editor.
                // Removing it afterwards can disturb the native input caret.
                this.clearSelection();
                if (this.callbacks.onCreateNote) {
                    this.callbacks.onCreateNote({ quote: text, page, location });
                }
                else if (this.callbacks.onOpenNoteModal) {
                    this.callbacks.onOpenNoteModal(text, null, page);
                }
            });
        }
        elements.btnAnnotationGoal?.addEventListener('click', event => {
            event.stopPropagation();
            const context = this.activeAnnotationContext;
            const ids = [...new Set([...(context?.highlightIds || []), ...(context?.noteIds || [])])];
            if (ids.length !== 1 || elements.btnAnnotationGoal?.disabled)
                return;
            const result = this.callbacks.onLinkGoal?.(ids[0]);
            this.clearAnnotationContext();
            Promise.resolve(result).catch(error => console.error('Goal 归入失败', error));
        });
        if (elements.btnHlRemove) {
            elements.btnHlRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                const ctx = this.activeAnnotationContext;
                if (!ctx || !ctx.highlightIds.length)
                    return;
                const ids = ctx.highlightIds.slice();
                this.clearAnnotationContext();
                if (this.callbacks.onDeleteHighlight)
                    this.callbacks.onDeleteHighlight(ids);
            });
        }
        if (elements.btnNoteRemove) {
            elements.btnNoteRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                const ctx = this.activeAnnotationContext;
                if (!ctx || !ctx.noteIds.length)
                    return;
                const ids = ctx.noteIds.slice();
                this.clearAnnotationContext();
                this.callbacks.onDeleteNotes?.(ids);
            });
        }
        document.addEventListener('click', (e) => {
            const selection = window.getSelection();
            const hasActiveSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;
            if (!(0, dom_js_1.eventElement)(e)?.closest('#selection-tooltip') && !hasActiveSelection) {
                this.hideSelectionTooltip();
            }
            if (this.pointerMoved || hasActiveSelection)
                return;
            if ((0, dom_js_1.eventElement)(e)?.closest('#highlight-action-tooltip') || (0, dom_js_1.eventElement)(e)?.closest('.annotation-token'))
                return;
            if ((0, dom_js_1.eventElement)(e)?.closest('#notes-panel'))
                return;
            this.hideHighlightAction();
        });
    }
}
exports.SelectionController = SelectionController;
function splitIds(value) {
    if (!value)
        return [];
    return String(value).split(/\s+/).filter(Boolean);
}
function hasTextSelection() {
    if (typeof window === 'undefined' || !window.getSelection)
        return false;
    const selection = window.getSelection();
    return !!(selection && selection.rangeCount > 0 && !selection.isCollapsed && selection.toString().trim());
}
function clearActiveTokens() {
    if (typeof document === 'undefined')
        return;
    document.querySelectorAll('.annotation-token.is-active').forEach(token => token.classList.remove('is-active'));
}
function findTokensByKey(key) {
    if (typeof document === 'undefined' || !key)
        return [];
    return Array.from(document.querySelectorAll('.annotation-token')).filter(token => tokenKey(token) === key);
}
function findTokenByAnnotationId(annotationId) {
    if (typeof document === 'undefined' || !annotationId)
        return null;
    if (typeof CSS === 'undefined' || !CSS.escape) {
        return document && annotationId
            ? document.querySelector(`[data-highlight-ids~="${annotationId}"], [data-note-ids~="${annotationId}"]`)
            : null;
    }
    const escaped = CSS.escape(annotationId);
    return document.querySelector(`[data-highlight-ids~="${escaped}"], [data-note-ids~="${escaped}"]`);
}
function tokenKey(token) {
    return (0, annotationRangeEngine_js_1.annotationContextKey)(splitIds(token.getAttribute('data-highlight-ids')), splitIds(token.getAttribute('data-note-ids')));
}
function collectTokenQuote(root, token) {
    const key = tokenKey(token);
    const tokens = root
        ? Array.from(root.querySelectorAll('.annotation-token')).filter(item => tokenKey(item) === key)
        : [token];
    tokens.sort((a, b) => Number(a.dataset.start) - Number(b.dataset.start));
    let contiguous = tokens.length > 0;
    for (let i = 1; i < tokens.length; i++) {
        if (Number(tokens[i].dataset.start) !== Number(tokens[i - 1].dataset.end)) {
            contiguous = false;
            break;
        }
    }
    const used = contiguous ? tokens : [token];
    const start = Number(used[0].dataset.start);
    const end = Number(used[used.length - 1].dataset.end);
    const page = Number(token.dataset.page) || 1;
    const location = Number.isFinite(start) && Number.isFinite(end) && end > start
        ? {
            sectionId: `chapter-${page}`,
            page,
            start,
            end,
            offset: start
        }
        : null;
    return {
        quote: used.map(item => item.textContent).join(''),
        location
    };
}

},
"src/client/features/annotations/selectionTooltipUI.js":function(module,exports,require,localStorage){
"use strict";
/* ==========================================================================
   SelectionTooltipUI - Floating Tooltip & Annotation Context Menu
   Positions the selection bubble and the shared highlight-action tooltip.
   ========================================================================== */
Object.defineProperty(exports, "__esModule", { value: true });
exports.showSelectionTooltip = showSelectionTooltip;
exports.hideSelectionTooltip = hideSelectionTooltip;
exports.showHighlightActionTooltip = showHighlightActionTooltip;
exports.hideHighlightActionTooltip = hideHighlightActionTooltip;
function showSelectionTooltip(elements, rect) {
    if (!elements || !elements.selectionTooltip || !elements.readerPanel || !rect)
        return;
    const readerRect = elements.readerPanel.getBoundingClientRect();
    elements.selectionTooltip.style.left = `${rect.left + rect.width / 2 - readerRect.left}px`;
    elements.selectionTooltip.style.top = `${rect.top - readerRect.top}px`;
    elements.selectionTooltip.style.display = 'flex';
}
function hideSelectionTooltip(elements) {
    if (elements && elements.selectionTooltip) {
        elements.selectionTooltip.style.display = 'none';
    }
}
function showHighlightActionTooltip(elements, targetEl, context) {
    if (!elements || !elements.highlightActionTooltip || !elements.readerPanel || !targetEl)
        return;
    const tooltip = elements.highlightActionTooltip;
    const highlightCount = context?.highlightIds?.length || 0;
    const noteCount = context?.noteIds?.length || 0;
    if (!highlightCount && !noteCount) {
        hideHighlightActionTooltip(elements);
        return;
    }
    const highlightButton = tooltip.querySelector('#btn-hl-remove');
    const noteButton = tooltip.querySelector('#btn-note-remove');
    if (highlightButton)
        highlightButton.hidden = !highlightCount;
    if (noteButton) {
        noteButton.hidden = !noteCount;
        noteButton.querySelector('span').textContent = noteCount > 1 ? `删除笔记（${noteCount}）` : '删除笔记';
    }
    const markRect = targetEl.getBoundingClientRect();
    const readerRect = elements.readerPanel.getBoundingClientRect();
    tooltip.style.left = `${markRect.left + markRect.width / 2 - readerRect.left}px`;
    tooltip.style.top = `${markRect.top - readerRect.top}px`;
    tooltip.style.display = 'flex';
}
function hideHighlightActionTooltip(elements) {
    if (elements && elements.highlightActionTooltip) {
        elements.highlightActionTooltip.style.display = 'none';
    }
}

},
"src/client/features/reader/annotationRenderer.js":function(module,exports,require,localStorage){
"use strict";
/* ==========================================================================
   AnnotationRenderer - Mounts non-nested annotation tokens onto a page.
   One span per merged text fragment. Highlight and note ids stay separate.
   ========================================================================== */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderAnnotationTokens = renderAnnotationTokens;
exports.rangeOffsets = rangeOffsets;
exports.selectionLocation = selectionLocation;
const annotationEngine_js_1 = require("src/client/domain/annotationEngine.ts");
const annotationRangeEngine_js_1 = require("src/client/domain/annotationRangeEngine.ts");
function renderAnnotationTokens(root, annotations = [], page = null) {
    if (!root || typeof document === 'undefined' || !root.ownerDocument)
        return;
    if (page != null)
        root.dataset.annotationPage = String(page);
    // Refresh only our wrappers. Keep the source blocks, typography and link
    // handlers intact; a note edit must never remount or repaginate the chapter.
    root.querySelectorAll('.annotation-token').forEach(token => {
        if (token.closest('[data-volume-title-page]') && !root.closest('[data-volume-title-page]'))
            return;
        token.replaceWith(...token.childNodes);
    });
    if (!Array.isArray(annotations) || annotations.length === 0)
        return;
    const index = buildTextIndex(root);
    if (!index.text)
        return;
    const ranges = [];
    annotations.forEach(raw => {
        const annotation = (0, annotationEngine_js_1.normalizeAnnotation)(raw);
        if (!annotation || !annotation.id)
            return;
        const range = (0, annotationRangeEngine_js_1.resolveAnnotationRange)(index.text, annotation);
        if (!range)
            return;
        ranges.push({
            id: annotation.id,
            kind: annotation.kind,
            start: range.start,
            end: range.end
        });
    });
    const segments = (0, annotationRangeEngine_js_1.buildSegments)(ranges);
    if (segments.length === 0)
        return;
    applySegments(root, segments);
}
function rangeOffsets(root, range) {
    if (!root || !range)
        return null;
    const start = boundaryOffset(root, range.startContainer, range.startOffset);
    const end = boundaryOffset(root, range.endContainer, range.endOffset);
    if (start == null || end == null || end <= start)
        return null;
    return { start, end };
}
function selectionLocation(root, range, page, sectionId) {
    const offsets = rangeOffsets(root, range);
    if (!offsets)
        return null;
    const validPage = Number(page) || 1;
    return {
        sectionId: sectionId || `chapter-${validPage}`,
        page: validPage,
        start: offsets.start,
        end: offsets.end,
        offset: offsets.start
    };
}
function applySegments(root, segments) {
    const initial = buildTextIndex(root);
    const splits = new Map();
    segments.forEach(segment => {
        markSplit(initial, segment.start, splits);
        markSplit(initial, segment.end, splits);
    });
    splits.forEach((offsets, node) => {
        const ordered = Array.from(offsets).sort((a, b) => b - a);
        ordered.forEach(offset => {
            if (offset > 0 && offset < node.textContent.length) {
                node.splitText(offset);
            }
        });
    });
    const refreshed = buildTextIndex(root);
    for (let i = refreshed.nodes.length - 1; i >= 0; i--) {
        const item = refreshed.nodes[i];
        if (!item.node.textContent)
            continue;
        const segment = segments.find(candidate => candidate.start <= item.start && candidate.end >= item.end);
        if (!segment)
            continue;
        wrapTextNode(item.node, segment, item.start, item.end, root.dataset.annotationPage || '');
    }
}
function markSplit(index, offset, splits) {
    const item = index.nodes.find(node => offset > node.start && offset < node.end);
    if (!item)
        return;
    if (!splits.has(item.node))
        splits.set(item.node, new Set());
    splits.get(item.node).add(offset - item.start);
}
function wrapTextNode(textNode, segment, start, end, page) {
    const parent = textNode.parentNode;
    if (!parent)
        return;
    if (parent.classList && parent.classList.contains('annotation-token'))
        return;
    const span = textNode.ownerDocument.createElement('span');
    span.className = 'annotation-token';
    if (segment.highlightIds.length > 0) {
        span.classList.add('has-highlight');
        span.setAttribute('data-highlight-ids', segment.highlightIds.join(' '));
    }
    if (segment.noteIds.length > 0) {
        span.classList.add('has-note');
        span.setAttribute('data-note-ids', segment.noteIds.join(' '));
    }
    span.setAttribute('data-start', String(start));
    span.setAttribute('data-end', String(end));
    if (page)
        span.setAttribute('data-page', String(page));
    parent.insertBefore(span, textNode);
    span.appendChild(textNode);
}
function buildTextIndex(root) {
    const nodes = [];
    const walker = sourceTextWalker(root);
    let offset = 0;
    let current = walker.nextNode();
    while (current) {
        const text = current.textContent || '';
        if (text.length > 0) {
            nodes.push({ node: current, start: offset, end: offset + text.length });
            offset += text.length;
        }
        current = walker.nextNode();
    }
    return {
        nodes,
        text: nodes.map(item => item.node.textContent).join('')
    };
}
function boundaryOffset(root, container, offset) {
    if (!container || !root)
        return null;
    if (container.nodeType === 3)
        return textNodeOffset(root, container, offset);
    if (container.nodeType !== 1)
        return null;
    if (offset <= 0) {
        const first = firstTextNode(container);
        if (first)
            return textNodeOffset(root, first, 0);
        return textBeforeElement(root, container);
    }
    if (offset >= container.childNodes.length) {
        const last = lastTextNode(container);
        if (last)
            return textNodeOffset(root, last, last.textContent.length);
        return textBeforeElement(root, container);
    }
    const child = container.childNodes[offset];
    if (!child)
        return textBeforeElement(root, container);
    if (child.nodeType === 3)
        return textNodeOffset(root, child, 0);
    const first = firstTextNode(child);
    if (first)
        return textNodeOffset(root, first, 0);
    return textBeforeElement(root, child);
}
function textNodeOffset(root, targetNode, nodeOffset) {
    const walker = sourceTextWalker(root);
    let count = 0;
    let current = walker.nextNode();
    while (current) {
        if (current === targetNode) {
            const safeOffset = Math.max(0, Math.min(nodeOffset, current.textContent.length));
            return count + safeOffset;
        }
        count += current.textContent.length;
        current = walker.nextNode();
    }
    return null;
}
function firstTextNode(element) {
    if (!element || element.nodeType !== 1)
        return null;
    const walker = sourceTextWalker(element);
    return walker.nextNode();
}
function lastTextNode(element) {
    if (!element || element.nodeType !== 1)
        return null;
    const walker = sourceTextWalker(element);
    let last = null;
    let current = walker.nextNode();
    while (current) {
        last = current;
        current = walker.nextNode();
    }
    return last;
}
function textBeforeElement(root, element) {
    const walker = sourceTextWalker(root);
    let count = 0;
    let current = walker.nextNode();
    while (current) {
        if (element.contains && element.contains(current))
            return count;
        const position = element.compareDocumentPosition(current);
        if (position & 4)
            return count;
        count += current.textContent.length;
        current = walker.nextNode();
    }
    return count;
}
function sourceTextWalker(root) {
    // The prepended divider has its own original page/offset coordinate space.
    // It must not shift the first chapter's existing or newly selected ranges.
    return root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const divider = node.parentElement?.closest('[data-volume-title-page]');
            return divider && !divider.contains(root) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
    });
}

},
"src/client/domain/annotationRangeEngine.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactWithMap = compactWithMap;
exports.findQuoteRange = findQuoteRange;
exports.resolveAnnotationRange = resolveAnnotationRange;
exports.buildSegments = buildSegments;
exports.annotationContextKey = annotationContextKey;
exports.primaryKindFor = primaryKindFor;
/* ==========================================================================
   AnnotationRangeEngine - Pure text-range merging for annotation tokens.
   No DOM. Callers supply the page's visible text and half-open offsets.
   ========================================================================== */
function compactWithMap(text) {
    const source = String(text || '');
    let compact = '';
    const map = [];
    for (let i = 0; i < source.length; i++) {
        if (/\s/.test(source[i]))
            continue;
        map.push(i);
        compact += source[i];
    }
    return { compact, map };
}
function findQuoteRange(text, quote) {
    const source = String(text || '');
    const target = String(quote || '');
    if (!source || !target.trim())
        return null;
    const direct = source.indexOf(target);
    if (direct !== -1) {
        return { start: direct, end: direct + target.length };
    }
    const compactedSource = compactWithMap(source);
    const compactedQuote = compactWithMap(target).compact;
    if (!compactedQuote)
        return null;
    const at = compactedSource.compact.indexOf(compactedQuote);
    if (at === -1)
        return null;
    const start = compactedSource.map[at];
    const end = compactedSource.map[at + compactedQuote.length - 1] + 1;
    if (start == null || end == null || end <= start)
        return null;
    return { start, end };
}
function resolveAnnotationRange(text, annotation) {
    if (!annotation)
        return null;
    const source = String(text || '');
    const location = annotation.location || {};
    const start = Number(location.start);
    const end = Number(location.end);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && start >= 0 && end <= source.length) {
        if (locationMatchesQuote(source.slice(start, end), annotation.quote)) {
            return { start, end };
        }
    }
    if (!annotation.quote)
        return null;
    return findQuoteRange(source, String(annotation.quote));
}
function locationMatchesQuote(slice, quote) {
    const compactQuote = compactWithMap(quote).compact;
    if (!compactQuote)
        return true;
    const compactSlice = compactWithMap(slice).compact;
    return compactSlice === compactQuote || compactSlice.includes(compactQuote);
}
function buildSegments(ranges = []) {
    const valid = (Array.isArray(ranges) ? ranges : []).filter(range => {
        return Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start && range.id;
    });
    if (valid.length === 0)
        return [];
    const points = new Set();
    valid.forEach(range => {
        points.add(range.start);
        points.add(range.end);
    });
    const sorted = Array.from(points).sort((a, b) => a - b);
    const segments = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        const start = sorted[i];
        const end = sorted[i + 1];
        const covering = valid.filter(range => range.start <= start && range.end >= end);
        if (covering.length === 0)
            continue;
        const highlightIds = uniqueIds(covering.filter(range => range.kind === 'highlight'));
        const noteIds = uniqueIds(covering.filter(range => range.kind === 'note'));
        if (highlightIds.length === 0 && noteIds.length === 0)
            continue;
        const previous = segments[segments.length - 1];
        if (previous && previous.end === start && sameIdList(previous.highlightIds, highlightIds) && sameIdList(previous.noteIds, noteIds)) {
            previous.end = end;
            continue;
        }
        segments.push({ start, end, highlightIds, noteIds });
    }
    return segments;
}
function annotationContextKey(highlightIds = [], noteIds = []) {
    return [...highlightIds, ...noteIds].join('|');
}
function primaryKindFor(highlightIds = [], noteIds = []) {
    if (noteIds.length > 0)
        return 'note';
    if (highlightIds.length > 0)
        return 'highlight';
    return null;
}
function uniqueIds(ranges) {
    const seen = new Set();
    const ids = [];
    ranges.forEach(range => {
        if (!range.id || seen.has(range.id))
            return;
        seen.add(range.id);
        ids.push(range.id);
    });
    return ids;
}
function sameIdList(left, right) {
    if (left.length !== right.length)
        return false;
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i])
            return false;
    }
    return true;
}

},
"website/demo/template.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerTemplate = void 0;
exports.readerTemplate = "<header class=\"app-header\">\n        <div class=\"header-side header-brand\">\n            <div class=\"brand\">\n                <i class=\"ri-book-open-fill brand-icon\"></i>\n                <span class=\"brand-name\">AuraReader</span>\n            </div>\n            <button id=\"btn-goal-sidebar\" class=\"btn btn-icon-sm\" type=\"button\" aria-label=\"Toggle goals sidebar\" hidden=\"\" aria-disabled=\"true\" data-preview-only=\"\" tabindex=\"-1\"><i class=\"ri-side-bar-line\" aria-hidden=\"true\"></i></button>\n        </div>\n\n        <div class=\"header-center\">\n            <button id=\"btn-toc\" class=\"book-nav-btn\" type=\"button\" title=\"打开章节目录\" aria-disabled=\"true\" data-preview-only=\"\" tabindex=\"-1\">\n                <i class=\"ri-list-unordered\"></i>\n                <span id=\"current-book-title\" class=\"book-nav-title\">Alice's Adventures in Wonderland</span>\n                <i class=\"ri-arrow-down-s-line book-nav-caret\"></i>\n            </button>\n        </div>\n\n        <div class=\"header-side header-actions\">\n            <button id=\"btn-shelf\" class=\"btn btn-icon nav-icon\" type=\"button\" title=\"我的书库\" aria-haspopup=\"dialog\" aria-disabled=\"true\" data-preview-only=\"\" tabindex=\"-1\">\n                <i class=\"ri-book-shelf-line\"></i>\n                <span class=\"badge-count\" id=\"shelf-book-count\" hidden=\"\">0</span>\n            </button>\n            <button id=\"btn-appearance\" class=\"btn btn-icon nav-icon\" type=\"button\" title=\"视觉偏好\" aria-disabled=\"true\" data-preview-only=\"\" tabindex=\"-1\">\n                <i class=\"ri-palette-line\"></i>\n            </button>\n            <button id=\"btn-export-menu\" class=\"btn btn-icon nav-icon\" type=\"button\" title=\"导出与备份\" aria-label=\"导出与备份\" aria-expanded=\"false\" aria-controls=\"export-panel\">\n                <i class=\"ri-download-line\" aria-hidden=\"true\"></i>\n            </button>\n            <button id=\"btn-fullscreen\" class=\"btn btn-icon nav-icon\" type=\"button\" title=\"全屏阅读\" aria-disabled=\"true\" data-preview-only=\"\" tabindex=\"-1\">\n                <i class=\"ri-fullscreen-line\"></i>\n            </button>\n        </div>\n    </header><section id=\"export-panel\" class=\"export-panel\" role=\"dialog\" aria-labelledby=\"export-panel-title\" aria-hidden=\"true\">\n        <div class=\"export-panel-heading\">\n            <h2 id=\"export-panel-title\">导出与备份</h2>\n            <p>当前书籍 · <span id=\"export-book-title\">未打开书籍</span></p>\n        </div>\n        <h3 class=\"export-section-title\">导出</h3>\n        <button id=\"btn-export-markdown\" class=\"export-menu-action\" type=\"button\" data-export-action=\"\">\n            <i class=\"ri-file-text-line\" aria-hidden=\"true\"></i>\n            <span class=\"export-action-label\">笔记摘要</span><span class=\"export-extension\">.md</span>\n        </button>\n        <div id=\"chapter-export-entry\" class=\"chapter-export-entry\">\n            <button id=\"btn-export-chapters\" class=\"export-menu-action\" type=\"button\" aria-expanded=\"false\" aria-controls=\"chapter-export-options\">\n                <i class=\"ri-folder-download-line\" aria-hidden=\"true\"></i>\n                <span class=\"export-action-label\">按章节导出</span><span class=\"export-extension\">.md</span>\n            </button>\n            <div id=\"chapter-export-options\" class=\"chapter-export-options\" hidden=\"\">\n                <button id=\"btn-collapse-chapter-export\" class=\"chapter-export-back\" type=\"button\" aria-label=\"返回导出菜单\"><i class=\"ri-arrow-left-s-line\" aria-hidden=\"true\"></i>按章节导出</button>\n                <button id=\"btn-export-current-chapter\" class=\"chapter-export-range\" type=\"button\">当前章节</button>\n                <button id=\"btn-export-all-chapters\" class=\"chapter-export-range\" type=\"button\">全部章节</button>\n                <button id=\"btn-select-chapters\" class=\"chapter-export-range\" type=\"button\" aria-expanded=\"false\" aria-controls=\"chapter-export-custom\">选择章节<i class=\"ri-arrow-right-s-line\" aria-hidden=\"true\"></i></button>\n                <div id=\"chapter-export-custom\" hidden=\"\">\n                    <div id=\"chapter-export-list\" class=\"chapter-export-list\" role=\"group\" aria-label=\"选择需要导出的章节\"></div>\n                    <div class=\"chapter-export-actions\">\n                        <button id=\"btn-cancel-chapter-export\" class=\"btn btn-ghost-sm\" type=\"button\">取消</button>\n                        <button id=\"btn-confirm-chapter-export\" class=\"btn btn-primary\" type=\"button\" disabled=\"\">导出</button>\n                    </div>\n                </div>\n            </div>\n        </div>\n        <hr class=\"export-panel-divider\">\n        <h3 class=\"export-section-title\">书籍备份与恢复</h3>\n        <button id=\"btn-export-full-backup\" class=\"export-menu-action export-backup-action\" type=\"button\" data-export-action=\"\">\n            <i class=\"ri-archive-line\" aria-hidden=\"true\"></i>\n            <span class=\"export-action-label\">导出书籍备份</span><span class=\"export-extension\">.aurabackup</span>\n        </button>\n        <button id=\"btn-import-full-backup\" class=\"export-menu-action export-backup-action\" type=\"button\" data-export-action=\"\">\n            <i class=\"ri-upload-line\" aria-hidden=\"true\"></i>\n            <span class=\"export-action-label\">从备份恢复书籍</span>\n        </button>\n        <p class=\"export-panel-note\">每本书一个备份文件 · 包含高亮与笔记</p>\n        <input type=\"file\" id=\"backup-file-input\" accept=\".aurabackup,.json\" hidden=\"\">\n    </section><main class=\"workspace-container immersive-notes layout-single\" id=\"workspace-container\"><section class=\"reader-panel\" id=\"reader-panel\"><div class=\"reader-viewport\" id=\"reader-viewport\"><div class=\"paper-container\" id=\"paper-container\"><article class=\"book-paper book-paper-left\" id=\"book-paper\"></article></div></div><div class=\"selection-tooltip\" id=\"selection-tooltip\">\n                <button class=\"tooltip-btn hl-yellow\" data-color=\"yellow\" title=\"高亮标记\"><i class=\"ri-mark-pen-line\"></i> 高亮</button>\n                <button class=\"tooltip-btn\" id=\"btn-add-note\" title=\"添加随笔\"><i class=\"ri-sticky-note-line\"></i> 笔记</button>\n            </div><div class=\"selection-tooltip\" id=\"highlight-action-tooltip\">\n                <button class=\"tooltip-btn\" id=\"btn-hl-remove\" type=\"button\" style=\"color: #fca5a5;\" title=\"只移除黄色高亮\"><i class=\"ri-delete-bin-line\"></i> 删除高亮</button>\n                <button class=\"tooltip-btn\" id=\"btn-note-remove\" type=\"button\" style=\"color: #fca5a5;\" title=\"只删除此处关联的笔记\"><i class=\"ri-delete-bin-line\"></i> <span>删除笔记</span></button>\n                <button class=\"tooltip-btn\" id=\"btn-annotation-goal\" type=\"button\" hidden=\"\" aria-label=\"Add to goal\"><i class=\"ri-links-line\" aria-hidden=\"true\"></i><span>Goal</span></button>\n            </div></section><section class=\"notes-panel\" id=\"notes-panel\"><div class=\"notes-list\" id=\"notes-list\"><div class=\"empty-state\" id=\"empty-notes-state\"><p></p></div></div></section></main>";

},
"website/demo/export-preview.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExportPreview = createExportPreview;
// Reuse the desktop export menu and serializer. The website shows the result
// locally; no file picker or download runs during the presentation.
const chapterExportMenu_js_1 = require("src/client/features/backup/chapterExportMenu.js");
const exporters_js_1 = require("src/client/infrastructure/exporters.js");
const alice_js_1 = require("website/demo/alice.js");
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function inline(text) {
    // Only the small, known subset produced by the chapter exporter is styled.
    // All input is escaped first; HTML in user notes cannot become executable.
    return escape(text.replace(/\\([\\`*_{}\[\]<>])/g, '$1'))
        .replace(/&amp;(#\d+;|amp;|lt;|gt;|quot;)/g, '&$1')
        .replace(/&lt;(\/?)mark&gt;/g, '<$1mark>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function renderDocument(markdown) {
    const lines = markdown.split(/\r?\n/), output = [];
    let paragraph = [];
    const flush = () => { if (paragraph.length)
        output.push('<p>' + inline(paragraph.join(' ')) + '</p>'); paragraph = []; };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) {
            flush();
            continue;
        }
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
            flush();
            output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
            continue;
        }
        if (/^---+$/.test(line.trim())) {
            flush();
            output.push('<hr>');
            continue;
        }
        if (/^>/.test(line)) {
            flush();
            const quoted = [];
            do {
                quoted.push(lines[i].replace(/^> ?/, ''));
                i++;
            } while (i < lines.length && /^>/.test(lines[i]));
            i--;
            output.push('<blockquote>' + quoted.join('\n').split(/\n\s*\n/).map(part => '<p>' + inline(part.replace(/\n/g, ' ')) + '</p>').join('') + '</blockquote>');
            continue;
        }
        paragraph.push(line);
    }
    flush();
    return output.join('\n');
}
function createExportPreview(host, app) {
    const get = id => host.querySelector('#' + id);
    const panel = get('export-panel'), menuButton = get('btn-export-menu');
    const workspace = get('workspace-container'), header = host.querySelector('.app-header');
    get('export-book-title').textContent = alice_js_1.aliceBook.title;
    // These entries retain the desktop menu's appearance; this demonstration
    // implements chapter export only, without importing backup/restore services.
    for (const id of ['btn-export-markdown', 'btn-export-full-backup', 'btn-import-full-backup']) {
        get(id).setAttribute('aria-disabled', 'true');
        get(id).dataset.previewOnly = '';
    }
    const view = document.createElement('section');
    view.className = 'showcase-markdown';
    view.hidden = true;
    view.setAttribute('aria-label', 'Markdown in Obsidian / VS Code');
    view.innerHTML = `<header class="markdown-windowbar"><span class="markdown-environment">Markdown in <strong>Obsidian / VS Code</strong></span><button type="button" class="markdown-back"><i class="ri-arrow-left-s-line" aria-hidden="true"></i>返回阅读</button></header><div class="markdown-workspace"><aside class="markdown-sidebar"><div class="markdown-folder-title">AURAREADER EXPORT</div><div class="markdown-folder"><i class="ri-folder-open-line" aria-hidden="true"></i><span>章节导出</span></div><div class="markdown-file-index"><i class="ri-file-text-line" aria-hidden="true"></i>00_目录概览.md</div><div class="markdown-file-active"><i class="ri-markdown-line" aria-hidden="true"></i><span></span></div><div class="markdown-sidebar-foot">原文 · 高亮 · 笔记<br>一起带入下一次思考</div></aside><main class="markdown-main"><div class="markdown-tab"><i class="ri-markdown-line" aria-hidden="true"></i><span></span><span class="markdown-preview-tag">阅读视图</span></div><div class="markdown-scroll"><article class="markdown-document"></article></div></main></div><footer class="markdown-statusbar"><span><i class="ri-check-line" aria-hidden="true"></i>Markdown · UTF-8</span><span>高亮与笔记随正文保留</span></footer>`;
    host.append(view);
    let current = null;
    function closePanel() {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        menuButton.setAttribute('aria-expanded', 'false');
        panel.dispatchEvent(new Event('exportpanelclose'));
    }
    function closePreview() {
        view.hidden = true;
        host.classList.remove('showcase-export-view');
        workspace.inert = header.inert = false;
        workspace.removeAttribute('aria-hidden');
        header.removeAttribute('aria-hidden');
    }
    function showPreview(book, notes, options) {
        const documents = (0, exporters_js_1.buildChapterDocuments)(book, notes, options);
        const chapter = documents.chapterFiles[0];
        current = { ...chapter, filename: `${documents.bookTitle}_${chapter.filename}` };
        view.querySelector('.markdown-document').innerHTML = renderDocument(current.text);
        for (const label of view.querySelectorAll('.markdown-file-active span,.markdown-tab>span:first-of-type'))
            label.textContent = current.filename;
        view.querySelector('.markdown-folder span').textContent = documents.bookTitle;
        view.querySelector('.markdown-file-index').hidden = documents.chapterFiles.length === 1;
        view.querySelector('.markdown-scroll').scrollTop = 0;
        view.hidden = false;
        host.classList.add('showcase-export-view');
        workspace.inert = header.inert = true;
        workspace.setAttribute('aria-hidden', 'true');
        header.setAttribute('aria-hidden', 'true');
        return { status: 'preview' };
    }
    menuButton.addEventListener('click', () => {
        if (panel.classList.contains('open'))
            closePanel();
        else {
            panel.classList.add('open');
            panel.setAttribute('aria-hidden', 'false');
            menuButton.setAttribute('aria-expanded', 'true');
        }
    });
    const elements = {
        exportPanel: panel, btnExportMenu: menuButton,
        chapterExportEntry: get('chapter-export-entry'), btnExportChapters: get('btn-export-chapters'),
        btnCollapseChapterExport: get('btn-collapse-chapter-export'), chapterExportOptions: get('chapter-export-options'),
        chapterExportCustom: get('chapter-export-custom'), btnSelectChapters: get('btn-select-chapters'),
        btnCancelChapterExport: get('btn-cancel-chapter-export'), btnExportCurrentChapter: get('btn-export-current-chapter'),
        btnExportAllChapters: get('btn-export-all-chapters'), btnConfirmChapterExport: get('btn-confirm-chapter-export'),
        chapterExportList: get('chapter-export-list')
    };
    const menu = new chapterExportMenu_js_1.ChapterExportMenu(elements, {
        getCurrentBook: () => alice_js_1.aliceBook, getCurrentPage: () => 1,
        getCurrentNotes: () => app.annotations.getNotes(), onExport: showPreview, closeExportPanel: closePanel
    });
    view.querySelector('.markdown-back').addEventListener('click', () => { closePreview(); app.layout(); });
    host.addEventListener('pointerdown', event => {
        if (!panel.contains(event.target) && !menuButton.contains(event.target))
            closePanel();
    });
    host.addEventListener('keydown', event => {
        if (event.key !== 'Escape')
            return;
        if (!view.hidden)
            closePreview();
        else if (panel.classList.contains('open'))
            closePanel();
    });
    return {
        reset() { closePreview(); closePanel(); },
        get view() { return view; }, get document() { return current; }, get busy() { return menu.busy; }
    };
}

},
"src/client/features/backup/chapterExportMenu.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChapterExportMenu = void 0;
const bookStructure_js_1 = require("src/client/infrastructure/bookStructure.ts");
class ChapterExportMenu {
    constructor(elements, callbacks) {
        this.elements = elements;
        this.callbacks = callbacks;
        this.busy = false;
        this.selectionBook = null;
        this.motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        this.motion?.addEventListener('change', () => {
            if (this.motion.matches)
                elements.chapterExportEntry.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
        });
        elements.btnExportChapters.addEventListener('click', () => {
            const book = callbacks.getCurrentBook?.();
            if (!book?.pages?.length) {
                callbacks.showToast?.('当前图书无可导出内容');
                return;
            }
            this.expand(true);
            elements.btnExportCurrentChapter.focus({ preventScroll: true });
        });
        elements.btnCollapseChapterExport.addEventListener('click', () => { this.expand(false); elements.btnExportChapters.focus({ preventScroll: true }); });
        elements.btnSelectChapters.addEventListener('click', () => this.custom(elements.chapterExportCustom.hidden));
        elements.btnCancelChapterExport.addEventListener('click', () => { this.custom(false); elements.btnSelectChapters.focus({ preventScroll: true }); });
        elements.btnExportCurrentChapter.addEventListener('click', () => this.run('current'));
        elements.btnExportAllChapters.addEventListener('click', () => this.run('all'));
        elements.btnConfirmChapterExport.addEventListener('click', () => this.run('custom'));
        elements.chapterExportList.addEventListener('change', () => this.update());
        elements.exportPanel?.addEventListener('exportpanelclose', () => this.expand(false, false));
        elements.chapterExportEntry.addEventListener('keydown', event => {
            if (event.key !== 'Escape')
                return;
            if (!elements.chapterExportCustom.hidden) {
                this.custom(false);
                elements.btnSelectChapters.focus({ preventScroll: true });
            }
            else if (!elements.chapterExportOptions.hidden) {
                this.expand(false);
                elements.btnExportChapters.focus({ preventScroll: true });
            }
            else
                return;
            event.preventDefault();
            event.stopPropagation();
        });
    }
    transition(change, entering, animate = true) {
        const entry = this.elements.chapterExportEntry;
        const before = entry.getBoundingClientRect().height;
        this.animation?.cancel();
        change();
        const after = entry.getBoundingClientRect().height;
        if (!animate || this.motion?.matches || !entry.animate)
            return;
        this.animation = entry.animate([{ height: `${before}px` }, { height: `${after}px` }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
        entering?.animate?.([{ opacity: 0, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' });
    }
    expand(expanded, animate = true) {
        const e = this.elements;
        this.transition(() => {
            e.btnExportChapters.hidden = expanded;
            e.btnExportChapters.setAttribute('aria-expanded', String(expanded));
            e.chapterExportOptions.hidden = !expanded;
            e.chapterExportCustom.hidden = true;
            e.btnSelectChapters.setAttribute('aria-expanded', 'false');
        }, expanded ? e.chapterExportOptions : e.btnExportChapters, animate);
        if (!expanded)
            this.selectionBook = null;
    }
    custom(expanded) {
        if (this.busy)
            return;
        const e = this.elements;
        if (expanded) {
            const book = this.callbacks.getCurrentBook?.();
            if (book !== this.selectionBook) {
                const structure = (0, bookStructure_js_1.buildBookStructure)(book);
                if (!structure.units.length) {
                    this.callbacks.showToast?.('当前图书无可导出内容');
                    return;
                }
                this.selectionBook = book;
                e.chapterExportList.replaceChildren();
                structure.units.forEach(unit => {
                    const label = document.createElement('label');
                    label.className = 'chapter-export-item';
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.value = unit.id;
                    const text = document.createElement('span');
                    text.textContent = unit.title;
                    label.append(input, text);
                    e.chapterExportList.append(label);
                });
                e.chapterExportList.scrollTop = 0;
            }
        }
        this.transition(() => {
            e.chapterExportCustom.hidden = !expanded;
            e.btnSelectChapters.setAttribute('aria-expanded', String(expanded));
        }, expanded ? e.chapterExportCustom : null);
        this.update();
    }
    selectedIds() { return [...this.elements.chapterExportList.querySelectorAll('input:checked')].map(input => input.value); }
    update() {
        const e = this.elements;
        for (const button of [e.btnExportChapters, e.btnCollapseChapterExport, e.btnExportCurrentChapter, e.btnExportAllChapters, e.btnSelectChapters, e.btnCancelChapterExport])
            button.disabled = this.busy;
        e.btnConfirmChapterExport.disabled = this.busy || !this.selectedIds().length;
        e.btnConfirmChapterExport.textContent = this.busy ? '正在导出…' : '导出';
        e.chapterExportList.querySelectorAll('input').forEach(input => { input.disabled = this.busy; });
        e.chapterExportEntry.setAttribute('aria-busy', String(this.busy));
    }
    async run(scope) {
        if (this.busy)
            return;
        const book = this.callbacks.getCurrentBook?.();
        const structure = (0, bookStructure_js_1.buildBookStructure)(book);
        let selectedUnitIds;
        if (scope === 'current') {
            const unit = structure.pageToUnit.get(this.callbacks.getCurrentPage?.() || 1);
            selectedUnitIds = unit ? [unit.id] : [];
        }
        else if (scope === 'all')
            selectedUnitIds = structure.units.map(unit => unit.id);
        else {
            if (book !== this.selectionBook) {
                this.custom(true);
                this.callbacks.showToast?.('当前书籍已切换，请重新选择章节');
                return;
            }
            selectedUnitIds = this.selectedIds();
        }
        if (!selectedUnitIds.length) {
            this.callbacks.showToast?.('请至少选择一个要导出的章节');
            return;
        }
        this.busy = true;
        this.update();
        let saved = false;
        try {
            const result = await this.callbacks.onExport(book, [...(this.callbacks.getCurrentNotes?.() || [])], { selectedUnitIds });
            saved = !!result && result.status !== 'canceled';
            if (saved) {
                this.callbacks.closeExportPanel?.();
                this.elements.btnExportMenu?.focus({ preventScroll: true });
            }
        }
        finally {
            this.busy = false;
            this.update();
            if (!saved && this.elements.exportPanel?.classList.contains('open')) {
                (scope === 'custom' ? this.elements.btnConfirmChapterExport : scope === 'all' ? this.elements.btnExportAllChapters : this.elements.btnExportCurrentChapter).focus({ preventScroll: true });
            }
        }
    }
}
exports.ChapterExportMenu = ChapterExportMenu;

},
"src/client/infrastructure/bookStructure.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBookStructure = buildBookStructure;
exports.readingUnitForPage = readingUnitForPage;
exports.structureSummary = structureSummary;
const readingLocation_js_1 = require("src/client/domain/readingLocation.ts");
const compact = (text) => String(text || '').replace(/\s+/g, '');
const frontMatter = /^(?:作者原序|原序|自序|代序|序言|序|前言|引言|楔子|译者序|译序|出版说明|版权信息|献辞|致谢)$/;
const appendix = /^(?:附录|后记|跋|译后记|注释|参考文献|索引)/;
// A disposable projection, never a replacement for book.pages or note.page.
// Source documents keep their original text/offset space. Reading and export
// share the same grouping; a TOC node need not be a separate document/unit.
function buildBookStructure(book) {
    const pages = Array.isArray(book?.pages) ? book.pages : [];
    const toc = (0, readingLocation_js_1.ensureTocHierarchy)(book?.toc);
    const roots = [], stack = [];
    const nodes = toc.map((entry, index) => {
        while (stack.length && stack.at(-1).level >= entry.level)
            stack.pop();
        const node = { ...entry, id: `toc-${index}`, page: Number(entry.page) || 0, children: [], parent: stack.at(-1) || null };
        (node.parent ? node.parent.children : roots).push(node);
        stack.push(node);
        return node;
    });
    const documents = pages.map((html, index) => {
        const page = index + 1;
        const root = typeof document === 'undefined' ? null : document.createElement('div');
        if (root)
            root.innerHTML = html;
        const entries = nodes.filter(node => node.page === page);
        const heading = root?.querySelector('h1, h2, h3, h4, h5, h6');
        const legacy = toc[index]?.page == null ? toc[index] : null;
        const title = entries[0]?.title || legacy?.title || heading?.textContent?.trim() || `内容 ${page}`;
        const media = root?.querySelector('img, svg, math, video, audio, table, iframe, object, canvas, hr');
        // Hierarchy and an exact, content-only title are required in addition
        // to the name. Never remove a preface, illustration or ambiguous node.
        const divider = entries.find(node => (0, readingLocation_js_1.isVolumeTitle)(node.title) && node.children.length
            && root && !media && compact(root.textContent) === compact(node.title)
            && root.querySelectorAll('h1, h2, h3, h4, h5, h6').length === 1
            && compact(heading?.textContent) === compact(node.title));
        let kind = 'content';
        if (frontMatter.test(title))
            kind = 'frontmatter';
        else if (appendix.test(title))
            kind = 'appendix';
        else if (entries.some(node => (0, readingLocation_js_1.isVolumeTitle)(node.title) && node.children.length))
            kind = 'volume-content';
        else if (root?.querySelector('nav') || /^(?:目录|目录 Contents|Landmarks|封面|版权)/i.test(title)
            || (root && !root.textContent?.trim()))
            kind = 'resource';
        else if (entries.length === 1 && !entries[0].children.length)
            kind = 'chapter';
        return { page, title, kind, entries, divider, hasText: !!root?.textContent?.trim() };
    });
    const units = [], pageToUnit = new Map();
    for (let index = 0; index < documents.length; index++) {
        const first = documents[index];
        const prefixes = [];
        let body = first, cursor = index;
        while (body.divider) {
            const child = body.divider.children[0];
            const next = documents[cursor + 1];
            if (!next || child.page !== next.page || !next.hasText)
                break;
            // Distinct siblings at the same source position are ambiguous.
            if (body.entries.length !== 1)
                break;
            prefixes.push(body.page);
            body = next;
            cursor++;
        }
        // A chain must end at real content, not another unresolvable divider.
        if (body.divider) {
            prefixes.length = 0;
            body = first;
            cursor = index;
        }
        const sourcePages = [...prefixes, body.page];
        const unit = { id: `source-${first.page}`, page: body.page, title: body.title,
            kind: body.kind, prefixPages: prefixes, sourcePages };
        units.push(unit);
        sourcePages.forEach(page => pageToUnit.set(page, unit));
        index = cursor;
    }
    const counts = { chapters: 0, frontmatter: 0, appendix: 0, volumeContent: 0, resources: 0, content: 0 };
    const keys = { chapter: 'chapters', frontmatter: 'frontmatter', appendix: 'appendix', 'volume-content': 'volumeContent', resource: 'resources', content: 'content' };
    units.forEach(unit => counts[keys[unit.kind]]++);
    return { roots, nodes, documents, units, pageToUnit, counts };
}
function readingUnitForPage(structure, requestedPage) {
    const page = Number(requestedPage);
    return structure?.pageToUnit.get(page) || { page, prefixPages: [], sourcePages: [page] };
}
function structureSummary(structure) {
    const { counts } = structure;
    const parts = [];
    if (counts.chapters)
        parts.push(`${counts.chapters} 章节`);
    if (counts.frontmatter)
        parts.push(`${counts.frontmatter} 前置内容`);
    if (counts.appendix)
        parts.push(`${counts.appendix} 附录`);
    if (counts.volumeContent)
        parts.push(`${counts.volumeContent} 卷前内容`);
    if (counts.resources)
        parts.push(`${counts.resources} 其他内容`);
    if (counts.content)
        parts.push(`${counts.content} 内容单元`);
    return parts.join(' · ') || '0 内容单元';
}

},
"src/client/domain/readingLocation.ts":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReadingLocation = createReadingLocation;
exports.clampPage = clampPage;
exports.calcSpreadPages = calcSpreadPages;
exports.resolveTargetPage = resolveTargetPage;
exports.findChapterForPage = findChapterForPage;
exports.isVolumeTitle = isVolumeTitle;
exports.ensureTocHierarchy = ensureTocHierarchy;
/* ==========================================================================
   ReadingLocation - Pure Reading Position & Navigation Model (Domain Layer)
   Zero DOM dependencies. Handles page boundary clamping, spread pagination,
   chapter matching & internal link resolution.
   ========================================================================== */
function createReadingLocation({ bookId = '', page = 1, totalPages = 1, chapter = '', anchor = '', sectionId = '', offset = 0 } = {}) {
    const validPage = clampPage(page, totalPages);
    return {
        bookId,
        page: validPage,
        totalPages: Math.max(1, totalPages),
        chapter: chapter || '章节选区',
        anchor: anchor || '',
        sectionId: sectionId || `chapter-${validPage}`,
        offset: Number(offset) || 0
    };
}
function clampPage(page, totalPages) {
    const total = Math.max(1, totalPages || 1);
    return Math.max(1, Math.min(Number(page) || 1, total));
}
function calcSpreadPages(currentPage, totalPages) {
    const total = Math.max(1, totalPages || 1);
    const validCurrent = clampPage(currentPage, total);
    const leftPage = (validCurrent % 2 === 1) ? validCurrent : Math.max(1, validCurrent - 1);
    const rightPage = leftPage + 1;
    const hasRight = rightPage <= total;
    return {
        leftPage,
        rightPage: hasRight ? rightPage : null,
        isDouble: true,
        label: hasRight ? `${leftPage}-${rightPage}` : `${leftPage}`
    };
}
function resolveTargetPage(href, hrefToPageMap = {}, currentPage = 1) {
    if (!href)
        return currentPage;
    const [srcPath] = href.split('#');
    const cleanPath = srcPath.replace(/^\/+/, '');
    if (!cleanPath)
        return currentPage;
    if (hrefToPageMap[cleanPath] !== undefined)
        return hrefToPageMap[cleanPath];
    const filename = cleanPath.split('/').pop();
    if (hrefToPageMap[filename || ''] !== undefined)
        return hrefToPageMap[filename || ''];
    return currentPage;
}
function findChapterForPage(toc = [], page = 1) {
    if (!toc || !Array.isArray(toc) || toc.length === 0)
        return '当前章节';
    const sorted = [...toc].sort((a, b) => {
        const pageDiff = (a.page || 1) - (b.page || 1);
        if (pageDiff !== 0)
            return pageDiff;
        return (Number(a.level) || 0) - (Number(b.level) || 0);
    });
    const matched = [...sorted].reverse().find(t => (t.page || 1) <= page);
    return matched ? matched.title : sorted[0].title;
}
const VOLUME_TITLE_RE = /^(?:第\s*[0-9０-９一二三四五六七八九十百千万零两]+\s*[卷部篇集册]|卷\s*之?\s*[0-9０-９一二三四五六七八九十百千万零两]+|(?:volume|part|book)\s+[0-9ivxlcdm]+)/i;
const STANDALONE_TITLE_RE = /^(?:作者原序|原序|自序|代序|序言|序|前言|引言|楔子|后记|跋|附录|译后记|译者序|译序|出版说明|版权信息|目录|简介|内容简介|献辞|致谢)$/;
function isVolumeTitle(title) {
    return VOLUME_TITLE_RE.test(String(title || '').trim());
}
function ensureTocHierarchy(items) {
    const list = Array.isArray(items)
        ? items.map(item => ({ ...item, level: Math.max(0, Number(item.level) || 0) }))
        : [];
    if (!list.length)
        return list;
    const hasExplicitDepth = list.some(item => item.level > 0);
    const hasVolume = list.some(item => isVolumeTitle(item.title));
    if (!hasExplicitDepth && hasVolume) {
        let insideVolume = false;
        for (const item of list) {
            const title = String(item.title || '').trim();
            if (isVolumeTitle(title)) {
                insideVolume = true;
                item.level = 0;
            }
            else if (STANDALONE_TITLE_RE.test(title)) {
                insideVolume = false;
                item.level = 0;
            }
            else if (insideVolume) {
                item.level = 1;
            }
        }
    }
    for (let i = 0; i < list.length; i++) {
        const next = list[i + 1];
        list[i].hasChildren = !!(next && (Number(next.level) || 0) > (Number(list[i].level) || 0));
    }
    return list;
}

},
"src/client/infrastructure/exporters.js":function(module,exports,require,localStorage){
"use strict";
/* ==========================================================================
   Exporters - Document & Annotation Export / Backup Adapter (Infrastructure Layer)
   Provides Markdown, full-book or selected-chapter folder export,
   and per-book .aurabackup export & import deserialization.
   ========================================================================== */
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFile = downloadFile;
exports.exportMarkdown = exportMarkdown;
exports.buildChapterDocuments = buildChapterDocuments;
exports.exportChapters = exportChapters;
exports.exportChapterZip = exportChapterZip;
exports.exportSelectiveBackup = exportSelectiveBackup;
exports.parseBackupFile = parseBackupFile;
const annotationEngine_js_1 = require("src/client/domain/annotationEngine.ts");
const annotationRangeEngine_js_1 = require("src/client/domain/annotationRangeEngine.ts");
const annotationRenderer_js_1 = require("src/client/features/reader/annotationRenderer.js");
const bookStructure_js_1 = require("src/client/infrastructure/bookStructure.ts");
const storageClient_js_1 = require("website/demo/memory-storage.js");
const folderExport_js_1 = require("src/client/infrastructure/folderExport.js");
function downloadFile(filename, data, type) {
    if (typeof window === 'undefined')
        return;
    const blob = (data instanceof Blob) ? data : new Blob([data], { type });
    if (window.auraDesktop) {
        const files = window.auraDesktop.files;
        return blob.arrayBuffer().then(bytes => files.saveExport({ filename, bytes: new Uint8Array(bytes) })).then(storageClient_js_1.unwrapDesktop);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    return { status: 'download-requested' };
}
function exportMarkdown(bookTitle = '图书笔记', notes = []) {
    const groups = (0, annotationEngine_js_1.groupAnnotationsByRange)(notes);
    let md = `# 划线与随笔笔记：《${bookTitle}》\n\n`;
    md += `> 导出时间：${new Date().toLocaleString()}\n\n`;
    md += `## 划线与随笔精选 (${notes.length} 条)\n\n`;
    groups.forEach((group, idx) => {
        md += `### ${idx + 1}. P.${group.page} ${group.chapter || ''}\n`;
        if (group.quote)
            md += `${highlightMarkdown(group.quote)}\n\n`;
        group.notes.forEach(note => {
            if (note.comment)
                md += note.comment.split(/\r?\n/).map(line => `> ${line}`).join('\n') + '\n\n';
        });
        md += `---\n\n`;
    });
    return downloadFile(`${bookTitle}_划线随笔.md`, md, 'text/markdown');
}
function buildChapterDocuments(book, notes = [], { selectedUnitIds } = {}) {
    if (!book || !Array.isArray(book.pages)) {
        throw new Error('当前图书无可导出内容');
    }
    const structure = (0, bookStructure_js_1.buildBookStructure)(book);
    const selection = selectedUnitIds == null ? null : new Set(selectedUnitIds);
    const units = structure.units.filter(unit => !selection || selection.has(unit.id));
    if (!units.length)
        throw new Error('请至少选择一个要导出的章节');
    const selectedPages = new Set(units.flatMap(unit => unit.sourcePages));
    const isPartial = units.length < structure.units.length;
    const bookTitle = safeExportTitle(book.title || '图书');
    const folderName = `${bookTitle}_${isPartial ? '所选章节笔记包' : '分章节笔记包'}`;
    const files = [];
    const chapterFiles = [];
    const annotations = (Array.isArray(notes) ? notes : []).map(annotationEngine_js_1.normalizeAnnotation).filter(Boolean)
        .filter(note => !book.id || !note.bookId || note.bookId === book.id)
        .filter(note => !isPartial || selectedPages.has(note.page))
        .map((note, idx) => ({ ...note, id: note.id || `export-${idx}` }));
    const filesByUnit = new Map(structure.units.map((unit, index) => [unit.id,
        `${String(index + 1).padStart(2, '0')}_${safeExportTitle(unit.title)}.md`]));
    let indexMd = `# 《${book.title}》 导读书册与笔记全览\n\n`;
    indexMd += `- 格式：${book.format || 'EPUB'}\n`;
    indexMd += `- ${isPartial ? '全书内容结构' : '内容结构'}：${(0, bookStructure_js_1.structureSummary)(structure)}\n`;
    indexMd += `- 导出范围：${isPartial ? '所选章节' : '整本书'}\n`;
    indexMd += `- 导出内容文件：${units.length}\n`;
    indexMd += `- 划线数：${annotations.filter(annotationEngine_js_1.isHighlight).length}\n`;
    indexMd += `- 笔记数：${annotations.filter(annotationEngine_js_1.isNote).length}\n`;
    indexMd += `- 导出时间：${new Date().toLocaleString()}\n\n`;
    indexMd += `## 目录结构\n`;
    let unmatchedHighlights = 0;
    // Preserve TOC hierarchy, including multiple nodes/anchors sharing a file.
    // Structural volume nodes link to their first chapter, not an empty file.
    const includedNodes = new Set();
    for (const node of structure.nodes) {
        if (!selectedPages.has(node.page))
            continue;
        for (let ancestor = node; ancestor; ancestor = ancestor.parent)
            includedNodes.add(ancestor.id);
    }
    for (const node of structure.nodes) {
        if (isPartial && !includedNodes.has(node.id))
            continue;
        const unit = structure.pageToUnit.get(node.page);
        const label = escapeMarkdownText(node.title);
        const link = unit && selectedPages.has(node.page) ? `[${label}](./${encodeURIComponent(filesByUnit.get(unit.id))})` : label;
        indexMd += `${'  '.repeat(node.level)}- ${link}\n`;
    }
    const untitledUnits = units.filter(unit => !structure.nodes.some(node => unit.sourcePages.includes(node.page)));
    if (untitledUnits.length) {
        indexMd += '\n## 其他保留内容\n';
        untitledUnits.forEach(unit => { indexMd += `- [${escapeMarkdownText(unit.title)}](./${encodeURIComponent(filesByUnit.get(unit.id))})\n`; });
    }
    // Resolve every annotation within its original source before combining
    // rendered Markdown. Joining HTML first would shift existing note offsets.
    function sourceMarkdown(pageNum) {
        const pageNotes = annotations.filter(n => n.page === pageNum);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = book.pages[pageNum - 1];
        // Offsets are chapter-relative, as in the reader. Saved note ranges
        // recover the exact source quote; legacy notes fall back to quote search.
        const text = tempDiv.textContent;
        const exportNotes = pageNotes.map(note => {
            if (!(0, annotationEngine_js_1.isNote)(note))
                return note;
            const range = resolveNoteRange(text, note);
            if (!range)
                return note;
            const sourceQuote = text.slice(range.start, range.end);
            const savedQuote = (0, annotationRangeEngine_js_1.compactWithMap)(note.quote).compact;
            const resolvedQuote = (0, annotationRangeEngine_js_1.compactWithMap)(sourceQuote).compact;
            return savedQuote === resolvedQuote ? note : { ...note, quote: sourceQuote };
        });
        unmatchedHighlights += exportNotes.filter(annotationEngine_js_1.isHighlight).filter(note => !(0, annotationRangeEngine_js_1.resolveAnnotationRange)(text, note)).length;
        (0, annotationRenderer_js_1.renderAnnotationTokens)(tempDiv, exportNotes, pageNum);
        const chapterBody = chapterBodyMarkdown(tempDiv, exportNotes.filter(annotationEngine_js_1.isNote));
        return chapterBody.markdown + '\n\n' + chapterAnnotationMarkdown(chapterBody.unplacedNotes);
    }
    for (const unit of units) {
        const unitNotes = annotations.filter(note => unit.sourcePages.includes(note.page));
        let markdown = '';
        // A source heading already provides the title for prefixed units:
        // 第一卷 → 大堂. Do not add a second artificial “大堂” before 第一卷.
        if (!unit.prefixPages.length)
            markdown += `# ${escapeMarkdownText(unit.title)}\n\n`;
        markdown += `> 本章划线：${unitNotes.filter(annotationEngine_js_1.isHighlight).length} 条 | 笔记：${unitNotes.filter(annotationEngine_js_1.isNote).length} 条\n\n---\n\n`;
        markdown += unit.sourcePages.map(sourceMarkdown).join('\n');
        const file = { filename: filesByUnit.get(unit.id), text: markdown };
        files.push(file);
        chapterFiles.push(file);
    }
    const invalidPage = note => !Number.isInteger(note.page) || note.page < 1 || note.page > book.pages.length;
    const unassigned = annotations.filter(annotationEngine_js_1.isNote).filter(invalidPage);
    if (unassigned.length) {
        files.push({ filename: '未归属笔记.md', text: '# 未归属笔记\n\n以下笔记的章节位置无效，保留引用与笔记内容以避免遗漏。\n\n' + chapterAnnotationMarkdown(unassigned) });
        indexMd += '\n[未归属笔记](./未归属笔记.md)\n';
    }
    unmatchedHighlights += annotations.filter(annotationEngine_js_1.isHighlight).filter(invalidPage).length;
    if (unmatchedHighlights)
        indexMd += `\n> 有 ${unmatchedHighlights} 条高亮未能定位到正文，未生成正文标记。原始标注仍保留在书库及书籍备份中。\n`;
    files.push({ filename: '00_目录概览.md', text: indexMd });
    return { bookTitle, folderName, chapterFiles, files, unmatchedHighlights };
}
function safeExportTitle(title) {
    let name = String(title).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120).replace(/[\uD800-\uDBFF]$/, '').replace(/[. ]+$/, '') || '图书';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
        name = '_' + name;
    return name;
}
async function exportChapters(book, notes = [], options = {}) {
    const structure = (0, bookStructure_js_1.buildBookStructure)(book);
    const selection = options.selectedUnitIds == null ? null : new Set(options.selectedUnitIds);
    const count = structure.units.filter(unit => !selection || selection.has(unit.id)).length;
    if (!count)
        throw new Error('请至少选择一个要导出的章节');
    // Browser pickers must start during the click, before expensive conversion.
    const destination = count > 1 && !window.auraDesktop ? await folderExport_js_1.saveMarkdownFolder.pick() : null;
    if (count > 1 && !window.auraDesktop && !destination)
        return { status: 'canceled' };
    const documents = buildChapterDocuments(book, notes, options);
    if (documents.chapterFiles.length === 1) {
        const chapter = documents.chapterFiles[0];
        let text = chapter.text;
        const orphan = documents.files.find(file => file.filename === '未归属笔记.md');
        if (orphan)
            text += '\n\n' + orphan.text;
        if (documents.unmatchedHighlights)
            text += `\n\n> 有 ${documents.unmatchedHighlights} 条高亮未能定位到正文，原始标注仍保留在书库及书籍备份中。\n`;
        const filename = safeExportTitle(`${documents.bookTitle}_${chapter.filename.slice(0, -3)}`) + '.md';
        return { ...await downloadFile(filename, text, 'text/markdown;charset=utf-8'), kind: 'file' };
    }
    return (0, folderExport_js_1.saveMarkdownFolder)(`${documents.bookTitle}_章节导出`, documents.files, destination);
}
// Compatibility adapter for legacy consumers; the product UI exports .md/folders.
async function exportChapterZip(book, notes = [], jszipLib, options = {}) {
    if (!jszipLib)
        throw new Error('JSZip 尚未就绪，请检查网络连接');
    const { folderName, files } = buildChapterDocuments(book, notes, options);
    const zip = new jszipLib();
    const folder = zip.folder(folderName);
    files.forEach(file => folder.file(file.filename, file.text));
    const blob = await zip.generateAsync({ type: 'blob' });
    return downloadFile(`${folderName}.zip`, blob, 'application/zip');
}
function resolveNoteRange(text, note) {
    const location = note.location || {};
    const start = Number(location.start);
    const end = Number(location.end);
    const locationPage = Number(location.page);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= text.length
        && (!locationPage || locationPage === Number(note.page))) {
        // A valid saved selection range is the strongest link to the source.
        // Use its text to repair stale or shortened quote strings before the
        // renderer locates the note in the chapter.
        return { start, end };
    }
    return (0, annotationRangeEngine_js_1.resolveAnnotationRange)(text, note);
}
function chapterAnnotationMarkdown(notes) {
    const thoughts = notes.filter(annotationEngine_js_1.isNote);
    if (!thoughts.length)
        return '';
    let md = '## 本章笔记\n\n';
    thoughts.forEach((note, idx) => {
        md += `### ${idx + 1}. 笔记 | P.${note.page}\n\n`;
        md += chapterNoteContent(note);
    });
    return md;
}
function chapterNoteContent(note) {
    let md = '';
    if (note.quote.trim()) {
        md += '> **原文引用**\n';
        md += note.quote.trim().split(/\r?\n/).map(line => `> ${escapeMarkdownText(line)}`).join('\n') + '\n';
        md += '>\n';
    }
    else {
        md += '> 独立随笔（未绑定原文）\n';
        md += '>\n';
    }
    if (note.comment.trim()) {
        md += note.comment.split(/\r?\n/).map(line => `> ${line}`).join('\n') + '\n\n';
    }
    else {
        md += '\n';
    }
    return md;
}
function escapeMarkdownText(text) {
    return String(text).replace(/&/g, '&amp;').replace(/[\\`*_{}\[\]<>]/g, '\\$&');
}
function highlightMarkdown(text) {
    // Source HTML often contains soft-wrapped lines and indentation. Leave
    // whitespace outside marks and never emit a mark for a blank line.
    return String(text).split(/(\r\n|\r|\n)/).map(line => {
        const match = line.match(/^(\s*)([\s\S]*?\S)(\s*)$/);
        if (!match)
            return line;
        // Encode Markdown delimiters as well as HTML characters so the
        // highlighted source stays literal in both HTML and Markdown readers.
        const content = escapeHtml(match[2]).replace(/[\\`*_{}\[\]~=]/g, character => `&#${character.charCodeAt(0)};`);
        return `${match[1]}<mark>${content}</mark>${match[3]}`;
    }).join('');
}
// Serialize annotated text in document order. Adjacent inline tokens share
// one run; paragraph and line boundaries close marks. No quote matching is repeated.
function chapterBodyMarkdown(root, notes = []) {
    const blockSelector = 'p,h1,h2,h3,h4,h5,h6,blockquote,div,section,article,li,ul,ol,table,thead,tbody,tfoot,tr,td,th,pre,figure';
    const noteTokens = new Map();
    root.querySelectorAll('.annotation-token.has-note').forEach(token => {
        (token.getAttribute('data-note-ids') || '').split(/\s+/).filter(Boolean).forEach(id => noteTokens.set(id, token));
    });
    const notesAfterBlock = new Map();
    const unplacedNotes = [];
    notes.forEach(note => {
        const token = noteTokens.get(String(note.id));
        let paragraph = token?.closest('p,h1,h2,h3,h4,h5,h6,blockquote,li,pre,td,th,figure,div,section,article');
        if (paragraph?.tagName !== 'BLOCKQUOTE') {
            paragraph = token?.closest('blockquote') || paragraph;
        }
        if (!paragraph || paragraph === root || !root.contains(paragraph)) {
            unplacedNotes.push(note);
            return;
        }
        if (!notesAfterBlock.has(paragraph))
            notesAfterBlock.set(paragraph, []);
        notesAfterBlock.get(paragraph).push(note);
    });
    function renderNotesAfter(element) {
        return (notesAfterBlock.get(element) || []).map(chapterNoteContent).join('');
    }
    function inline(nodes) {
        const runs = [];
        function write(text, marked) {
            if (!text)
                return;
            const previous = runs[runs.length - 1];
            if (previous && previous.marked === marked)
                previous.text += text;
            else
                runs.push({ text, marked });
        }
        function visit(node, marked = false) {
            if (node.nodeType === 3) {
                write(node.textContent, marked);
                return;
            }
            if (node.nodeType !== 1 || node.matches('script,style'))
                return;
            if (node.tagName === 'BR') {
                write('\n', false);
                return;
            }
            if (node.tagName.toLowerCase() === 'svg') {
                // Keep vector illustrations as images, rather than injecting
                // executable inline SVG into the Markdown document.
                runs.push({ image: `<img src="data:image/svg+xml,${encodeURIComponent(node.outerHTML)}" alt="">` });
                return;
            }
            if (node.tagName === 'IMG' || node.tagName.toLowerCase() === 'image') {
                const src = node.getAttribute('src') || node.getAttribute('href') || node.getAttribute('xlink:href') || '';
                // EPUB images are normally inlined by the parser. Keep them
                // when preserving illustrated dividers and other source pages.
                if (/^(?:data:image\/|https?:\/\/)/i.test(src)) {
                    runs.push({ image: `<img src="${escapeHtml(src)}" alt="${escapeHtml(node.getAttribute('alt') || '')}">` });
                }
                return;
            }
            const isMarked = marked || node.classList.contains('has-highlight');
            node.childNodes.forEach(child => visit(child, isMarked));
        }
        nodes.forEach(node => visit(node));
        return runs.map(run => run.image || (run.marked ? highlightMarkdown(run.text) : escapeMarkdownText(run.text))).join('').trim();
    }
    function children(element) {
        let result = '';
        let buffer = [];
        function flush() {
            const text = inline(buffer);
            if (text)
                result += text + '\n\n';
            buffer = [];
        }
        element.childNodes.forEach(node => {
            if (node.nodeType === 1 && (node.matches(blockSelector) || node.querySelector(blockSelector))) {
                flush();
                result += block(node);
            }
            else
                buffer.push(node);
        });
        flush();
        return result;
    }
    function block(element) {
        if (element.matches('script,style'))
            return '';
        let rendered = '';
        if (/^H[1-6]$/.test(element.tagName))
            rendered = `${'#'.repeat(Math.min(Number(element.tagName[1]) + 1, 6))} ${inline([element])}\n\n`;
        else if (element.tagName === 'BLOCKQUOTE')
            rendered = children(element).trim().split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        else if (element.querySelector(blockSelector))
            rendered = children(element);
        else {
            const text = inline([element]);
            rendered = text ? text + '\n\n' : '';
        }
        return rendered + renderNotesAfter(element);
    }
    return { markdown: children(root).trim(), unplacedNotes };
}
function exportSelectiveBackup({ selectedBooks = [], notes = [], goalStates = [], goalGraphs, includeNotes = true }) {
    const normalizedNotes = (notes || []).map(annotationEngine_js_1.normalizeAnnotation).filter(Boolean);
    const exportedAt = new Date().toISOString();
    const yyyymmdd = exportedAt.slice(0, 10).replace(/-/g, '');
    const files = selectedBooks.map(book => {
        const backupPayload = {
            version: goalGraphs ? "1.3" : "1.1",
            // Keep the existing envelope for compatibility with earlier readers.
            type: "aurareader_full_backup",
            exportedAt,
            books: [book],
            notes: normalizedNotes.filter(note => note.bookId === book.id),
            goalStates: goalStates.filter(state => state.bookId === book.id).map(state => includeNotes
                ? state : { bookId: state.bookId, goals: state.goals })
        };
        if (goalGraphs) {
            const graph = goalGraphs.get(book.id) || { goals: [], links: [], bookLinks: [] };
            delete backupPayload.goalStates;
            backupPayload.goalGraph = includeNotes ? graph : { goals: graph.goals, ...(graph.bookLinks !== undefined ? { bookLinks: graph.bookLinks } : {}) };
        }
        const bookTitle = String(book.title || book.id || '图书')
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
        const fileName = `AuraReader_Backup_${bookTitle}_${yyyymmdd}.aurabackup`;
        return { filename: fileName, data: JSON.stringify(backupPayload, null, 2) };
    });
    if (typeof window !== 'undefined' && window.auraDesktop) {
        return (async () => {
            const results = [];
            let stopped = false;
            for (const file of files) {
                if (stopped) {
                    results.push({ name: file.filename, status: 'not-saved' });
                    continue;
                }
                try {
                    const result = await downloadFile(file.filename, file.data, 'application/json;charset=utf-8');
                    results.push({ name: file.filename, ...result });
                    if (result.status === 'canceled')
                        stopped = true;
                }
                catch (error) {
                    results.push({ name: file.filename, status: 'failed', message: error.message });
                    stopped = true;
                }
            }
            return results;
        })();
    }
    return files.map(file => downloadFile(file.filename, file.data, 'application/json;charset=utf-8'));
}
function parseBackupFile(file) {
    return new Promise((resolve, reject) => {
        if (!file)
            return reject(new Error('未提供备份文件'));
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data || (data.type !== 'aurareader_full_backup' && !Array.isArray(data.notes) && !Array.isArray(data.books))) {
                    return reject(new Error('未识别的备份包格式'));
                }
                resolve(data);
            }
            catch (err) {
                reject(err);
            }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}
function escapeHtml(str) {
    if (!str)
        return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

},
"src/client/infrastructure/folderExport.js":function(module,exports,require,localStorage){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveMarkdownFolder = saveMarkdownFolder;
const storageClient_js_1 = require("website/demo/memory-storage.js");
async function saveMarkdownFolder(folderName, files, destination) {
    if (window.auraDesktop) {
        const encoder = new TextEncoder();
        return (0, storageClient_js_1.unwrapDesktop)(await window.auraDesktop.files.saveExportFolder({ folderName,
            files: files.map(file => ({ filename: file.filename, bytes: encoder.encode(file.text) })) }));
    }
    const parent = await destination;
    if (!parent)
        return { status: 'canceled' };
    // Never reuse an existing directory: keep previous exports intact.
    const names = new Set();
    for await (const name of parent.keys())
        names.add(name.toLowerCase());
    let name = folderName;
    for (let suffix = 2; names.has(name.toLowerCase()); suffix++)
        name = `${folderName} (${suffix})`;
    const folder = await parent.getDirectoryHandle(name, { create: true });
    const created = [];
    try {
        for (const file of files) {
            const handle = await folder.getFileHandle(file.filename, { create: true });
            created.push(file.filename);
            const writable = await handle.createWritable();
            try {
                await writable.write(file.text);
                await writable.close();
            }
            catch (error) {
                await writable.abort().catch(() => { });
                throw error;
            }
        }
        return { status: 'saved', kind: 'folder', name };
    }
    catch (error) {
        for (const filename of created)
            await folder.removeEntry(filename).catch(() => { });
        await parent.removeEntry(name).catch(() => { });
        throw error;
    }
}
saveMarkdownFolder.pick = async () => {
    if (typeof window.showDirectoryPicker !== 'function')
        throw new Error('当前浏览器不支持文件夹导出，请使用桌面版或支持文件夹保存的浏览器');
    try {
        return await window.showDirectoryPicker({ mode: 'readwrite', id: 'aurareader-chapters' });
    }
    catch (error) {
        if (error.name === 'AbortError')
            return null;
        throw error;
    }
};

}};
window.AuraReaderShowcase={mount(host,options){
const cache=new Map(),values=new Map();const memory={get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(String(k))??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear()};
function require(id){if(cache.has(id))return cache.get(id).exports;const module={exports:{}};cache.set(id,module);factories[id](module,module.exports,require,memory);return module.exports;}
return require("website/demo/demo.js").mountShowcase(host,options);
}};
})();
