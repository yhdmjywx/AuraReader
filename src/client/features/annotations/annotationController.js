/* ==========================================================================
   AnnotationController - Notes & Highlights Feature Controller
   Authority owner of: notes, editingNoteId, showHighlightsInSidebar, activeTab.
   Highlights and notes are independent records distinguished by kind.
   ========================================================================== */

import {
    saveNoteToDB as repoSaveNote,
    deleteNoteFromDB as repoDeleteNote,
    loadNotesForBook as repoLoadNotesForBook,
    loadNotesFromDB as repoLoadNotesFromDB,
    persistNotesToLocalStorage
} from '../../infrastructure/annotationRepository.js';

import {
    createAnnotationObject,
    isHighlight,
    isNote,
    normalizeAnnotation
} from '../../domain/annotationEngine.js';

import {
    renderNotesList,
    highlightNoteCard as domHighlightNoteCard,
    openNoteModal as domOpenNoteModal,
    closeNoteModal as domCloseNoteModal
} from './notesUI.js';

export class AnnotationController {
    constructor({
        callbacks = {}
    } = {}) {
        this.callbacks = callbacks; // onNotesChanged, onJump, showToast, getCurrentBookId, ensureSidebarExpanded
        this.notes = [];
        this.editingNoteId = null;
        this.showHighlightsInSidebar = false;
        this.notesScope = 'page';
        this._renderedSidebarIds = null;
        this.activeTab = 'tab-highlights';
        this.focusedNoteIds = [];
        this.focusedHighlightIds = [];
        this.modalQuote = null;
        this.modalPage = null;
        this.modalChapter = null;
        this.modalLocation = null;
        this.elements = null;
    }

    getNotes() {
        return this.notes;
    }

    // This changes presentation only. getNotes() continues to return the full
    // collection for rendering, persistence, and book-wide exports.
    setNotesScope(scope = 'page') {
        if (scope !== 'page' && scope !== 'book') throw new Error('笔记范围只能是 page 或 book');
        this.notesScope = scope;
        this.renderNotesUI();
        return scope;
    }

    getSidebarNotes() {
        const quoted = this.notes.filter(note => String(note.quote || '').trim());
        if (this.notesScope === 'book') return quoted;
        const visible = this.callbacks.getVisibleAnnotationIds?.() || new Set();
        return quoted.filter(note => visible.has(String(note.id)));
    }

    refreshVisibleNotes() {
        if (this.notesScope !== 'page') return;
        const key = JSON.stringify(this.getSidebarNotes().map(note => note.id));
        if (key !== this._renderedSidebarIds) this.renderNotesUI();
    }

    requireQuote(quote) {
        if (String(quote || '').trim()) return true;
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
        this.notesScope = 'page';
        if (!bookId) {
            this.notes = [];
            this.renderNotesUI();
            return [];
        }

        let loaded = await repoLoadNotesFromDB(bookId);
        if (!loaded || loaded.length === 0) {
            loaded = await repoLoadNotesForBook(bookId);
        }

        this.notes = normalizeList(loaded);
        this.renderNotesUI();
        return this.notes;
    }

    persistNotes(bookId = this.getBookId()) {
        if (!bookId) return;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aura_notes_' + bookId, JSON.stringify(this.notes));
        }
        persistNotesToLocalStorage(bookId, this.notes);
    }

    getBookId() {
        return this.callbacks.getCurrentBookId ? this.callbacks.getCurrentBookId() : 'crisis-era';
    }

    async addOrUpdateNote(noteObj) {
        const normalized = normalizeAnnotation(noteObj);
        if (!normalized) return;
        if (isNote(normalized) && !this.requireQuote(normalized.quote)) return;
        const idx = this.notes.findIndex(n => n.id === normalized.id);
        if (idx !== -1) {
            this.notes[idx] = normalized;
        } else {
            this.notes.unshift(normalized);
        }

        await repoSaveNote(normalized);
        this.persistNotes();
        this.renderNotesUI();

        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    async createHighlight({ quote, page = 1, chapter = '章节选区', color = 'yellow', location = null }) {
        const highlightPage = Number(page) || 1;
        const cleanQuote = quote || '';
        const existingHighlight = this.notes.find(n => {
            return isHighlight(n) && Number(n.page) === highlightPage && (n.quote || '') === cleanQuote;
        });

        if (existingHighlight) {
            if (this.callbacks.onFocusAnnotation) this.callbacks.onFocusAnnotation(existingHighlight);
            else if (this.callbacks.showToast) this.callbacks.showToast('已定位到相同高亮');
            return existingHighlight;
        }

        const newNote = createAnnotationObject({
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
        await repoSaveNote(newNote);
        this.persistNotes();
        if (this.callbacks.showToast) this.callbacks.showToast('已成功高亮选中文本');

        this.renderNotesUI();
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
        return newNote;
    }

    createNote({ quote = '', page = 1, chapter = null, location = null } = {}) {
        const pending = this.callbacks.getPendingSelection ? this.callbacks.getPendingSelection() : null;
        const selectedQuote = quote || (pending ? pending.text : '');
        if (!this.requireQuote(selectedQuote)) return;
        this.editingNoteId = null;
        this.modalQuote = selectedQuote;
        this.modalPage = Number(page || (pending ? pending.page : 1)) || 1;
        this.modalChapter = chapter || null;
        this.modalLocation = location || (pending ? pending.location : null);

        if (this.elements) {
            domOpenNoteModal({
                elements: this.elements,
                quote: this.modalQuote,
                existingNote: null
            });
        }
    }

    async saveModalNote({ quote = '', comment = '', page = 1, chapter = '章节选区', location = null } = {}) {
        const cleanComment = (comment || '').trim();

        if (this.editingNoteId) {
            const noteIndex = this.notes.findIndex(n => n.id === this.editingNoteId);
            const current = noteIndex === -1 ? null : this.notes[noteIndex];
            if (!current || !isNote(current)) {
                this.closeNoteModal();
                return;
            }

            if (!cleanComment) {
                const removedId = current.id;
                this.closeNoteModal();
                await this.deleteNote(removedId);
                return;
            }

            if (!this.requireQuote(current.quote)) return;

            this.notes[noteIndex].comment = cleanComment;
            this.notes[noteIndex].kind = 'note';
            this.notes[noteIndex].color = this.notes[noteIndex].color || 'green';
            this.notes[noteIndex].timestamp = new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16);
            await repoSaveNote(this.notes[noteIndex]);
            this.persistNotes();
            if (this.callbacks.showToast) this.callbacks.showToast('笔记已更新');
        } else {
            if (!this.requireQuote(quote)) return;
            if (!cleanComment) {
                if (this.callbacks.showToast) this.callbacks.showToast('请输入笔记内容');
                return;
            }

            const newNote = createAnnotationObject({
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
            await repoSaveNote(newNote);
            this.persistNotes();
            if (this.callbacks.showToast) this.callbacks.showToast('笔记已保存');
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
        const idSet = new Set(ids.filter(Boolean));
        const removed = this.notes.filter(n => idSet.has(n.id) && isHighlight(n));
        if (removed.length === 0) return;

        const removedIds = new Set(removed.map(n => n.id));
        this.notes = this.notes.filter(n => !removedIds.has(n.id));
        this.focusedHighlightIds = this.focusedHighlightIds.filter(id => !removedIds.has(id));

        for (const id of removedIds) {
            await repoDeleteNote(id, this.getBookId());
        }
        this.persistNotes();
        this.renderNotesUI();

        if (this.callbacks.showToast) this.callbacks.showToast('已移除高亮');
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    async deleteNote(id) {
        const target = this.notes.find(n => n.id === id);
        if (!target || !isNote(target)) return;
        await this.deleteAnnotation(id, '已删除笔记');
    }

    async deleteAnnotation(id, toastMessage = '已删除标注') {
        if (!id) return;
        const existed = this.notes.some(n => n.id === id);
        if (!existed) return;

        this.notes = this.notes.filter(n => n.id !== id);
        this.focusedNoteIds = this.focusedNoteIds.filter(noteId => noteId !== id);
        this.focusedHighlightIds = this.focusedHighlightIds.filter(noteId => noteId !== id);
        await repoDeleteNote(id, this.getBookId());
        this.persistNotes();
        this.renderNotesUI();

        if (this.callbacks.showToast) this.callbacks.showToast(toastMessage);
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
        if (!existingNote || !isNote(existingNote)) {
            this.createNote({
                quote: quote || (existingNote ? existingNote.quote : ''),
                page: targetPage || (existingNote ? existingNote.page : 1),
                chapter: existingNote ? existingNote.chapter : null,
                location: existingNote ? existingNote.location : null
            });
            return;
        }

        this.editingNoteId = existingNoteId;
        this.modalQuote = existingNote.quote || quote || '';
        this.modalPage = Number(targetPage || existingNote.page) || 1;
        this.modalChapter = existingNote.chapter || null;
        this.modalLocation = existingNote.location || null;

        if (this.elements) {
            domOpenNoteModal({
                elements: this.elements,
                quote: this.modalQuote,
                existingNote
            });
        }
    }

    closeNoteModal() {
        this.editingNoteId = null;
        this.modalQuote = null;
        this.modalPage = null;
        this.modalChapter = null;
        this.modalLocation = null;
        if (this.elements) {
            domCloseNoteModal(this.elements);
        }
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
        if (!this.elements) return;

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
        if (ids.length === 0) return;
        this.switchTab('tab-highlights');
        if (this.callbacks.ensureSidebarExpanded) {
            this.callbacks.ensureSidebarExpanded();
        }
        this.focusedNoteIds = ids;
        this.focusedHighlightIds = [];
        this.renderNotesUI();
        this.scrollCardIntoView(ids[0]);
    }

    focusHighlights(highlightIds = []) {
        const ids = uniqueIds(highlightIds);
        if (ids.length === 0) return;
        this.focusedHighlightIds = ids;
        this.focusedNoteIds = [];
        this.switchTab('tab-highlights');
        this.renderNotesUI();
        if (typeof document === 'undefined') return;
        const visible = ids.find(id => document.getElementById(`card-${id}`));
        if (visible) this.scrollCardIntoView(visible);
    }

    clearFocusedAnnotations() {
        if (this.focusedNoteIds.length === 0 && this.focusedHighlightIds.length === 0) return;
        this.focusedNoteIds = [];
        this.focusedHighlightIds = [];
        this.renderNotesUI();
    }

    highlightNoteCard(noteId) {
        domHighlightNoteCard(noteId);
    }

    scrollCardIntoView(noteId) {
        if (!noteId || typeof document === 'undefined') return;
        const card = document.getElementById(`card-${noteId}`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    renderNotesUI() {
        if (!this.elements) return;
        const sidebarNotes = this.getSidebarNotes();
        this._renderedSidebarIds = JSON.stringify(sidebarNotes.map(note => note.id));
        renderNotesList({
            elements: this.elements,
            notes: sidebarNotes,
            notesScope: this.notesScope,
            showHighlightsInSidebar: this.showHighlightsInSidebar,
            focusedNoteIds: this.focusedNoteIds,
            focusedHighlightIds: this.focusedHighlightIds,
            onJump: (note) => {
                if (this.callbacks.onJump) {
                    this.callbacks.onJump(note);
                }
            },
            onEdit: (note) => {
                if (!isNote(note)) return;
                this.openNoteModal(note.quote, note.id, note.page);
            },
            onDelete: (note) => {
                if (isHighlight(note)) this.deleteHighlight(note.id);
                else this.deleteNote(note.id);
            }
        });
    }

    initUI(elements) {
        this.elements = elements;
        if (!elements || typeof document === 'undefined') return;

        // Tab Switching
        if (elements.tabBtns) {
            elements.tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchTab(btn.getAttribute('data-tab'));
                });
            });
        }

        // Toggle Highlights in Sidebar
        if (elements.btnToggleShowHighlights) {
            elements.btnToggleShowHighlights.addEventListener('click', () => {
                this.toggleShowHighlightsInSidebar();
            });
        }

        // Note Modal Controls
        if (elements.btnCloseModal) {
            elements.btnCloseModal.addEventListener('click', () => this.closeNoteModal());
        }
        if (elements.btnCancelModal) {
            elements.btnCancelModal.addEventListener('click', () => this.closeNoteModal());
        }
        if (elements.noteModal) {
            elements.noteModal.addEventListener('click', (e) => {
                if (e.target === elements.noteModal) {
                    this.closeNoteModal();
                }
            });
        }
        if (elements.btnConfirmModal) {
            elements.btnConfirmModal.addEventListener('click', () => {
                const comment = elements.modalNoteTextarea ? elements.modalNoteTextarea.value : '';
                const pending = this.callbacks.getPendingSelection ? this.callbacks.getPendingSelection() : null;
                const quote = this.modalQuote || (pending ? pending.text : '');
                const page = this.modalPage || (pending ? pending.page : (this.callbacks.getCurrentPage ? this.callbacks.getCurrentPage() : 1));
                const chapter = this.modalChapter || (this.callbacks.getCurrentChapter ? this.callbacks.getCurrentChapter() : '章节选区');
                const location = this.modalLocation || (pending ? pending.location : null);
                this.saveModalNote({ quote, comment, page, chapter, location });
                if (window.getSelection) window.getSelection().removeAllRanges();
            });
        }
    }
}

function normalizeList(list) {
    return (Array.isArray(list) ? list : []).map(normalizeAnnotation).filter(Boolean);
}

function uniqueIds(ids) {
    const seen = new Set();
    const result = [];
    (Array.isArray(ids) ? ids : []).forEach(id => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        result.push(id);
    });
    return result;
}
