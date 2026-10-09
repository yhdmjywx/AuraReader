/* ==========================================================================
   AnnotationController - Notes & Highlights Feature Controller
   Authority owner of: notes, editingNoteId, showHighlightsInSidebar, activeTab.
   Coordinates AnnotationRepository, AnnotationEngine, NotesUI.
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
    findOverlappingNote
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
        this.callbacks = callbacks; // onNotesChanged, onJump, showToast, getCurrentBookId
        this.notes = [];
        this.editingNoteId = null;
        this.showHighlightsInSidebar = false;
        this.activeTab = 'tab-highlights';
        this.elements = null;
    }

    getNotes() {
        return this.notes;
    }

    getEditingNoteId() {
        return this.editingNoteId;
    }

    getShowHighlightsInSidebar() {
        return this.showHighlightsInSidebar;
    }

    async loadNotesForBook(bookId) {
        if (!bookId) {
            this.notes = [];
            this.renderNotesUI();
            return [];
        }

        let loaded = await repoLoadNotesFromDB(bookId);
        if (!loaded || loaded.length === 0) {
            loaded = await repoLoadNotesForBook(bookId);
        }

        this.notes = loaded || [];
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
        const idx = this.notes.findIndex(n => n.id === noteObj.id);
        if (idx !== -1) {
            this.notes[idx] = noteObj;
        } else {
            this.notes.unshift(noteObj);
        }

        await repoSaveNote(noteObj);
        this.persistNotes();
        this.renderNotesUI();

        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    async createHighlight({ quote, page = 1, chapter = '章节选区', color = 'yellow' }) {
        const highlightPage = Number(page) || 1;
        const existingNote = this.notes.find(n => n.page === highlightPage && n.quote === quote);

        if (existingNote) {
            existingNote.color = color;
            await repoSaveNote(existingNote);
            this.persistNotes();
            if (this.callbacks.showToast) this.callbacks.showToast('已更新该段落高亮颜色');
        } else {
            const newNote = createAnnotationObject({
                bookId: this.getBookId(),
                quote,
                comment: '',
                color,
                page: highlightPage,
                chapter
            });
            this.notes.unshift(newNote);
            await repoSaveNote(newNote);
            this.persistNotes();
            if (this.callbacks.showToast) this.callbacks.showToast('已成功高亮选中文本');
        }

        this.renderNotesUI();
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    async saveModalNote({ quote = '', comment = '', page = 1, chapter = '章节选区' }) {
        const cleanComment = (comment || '').trim();

        if (this.editingNoteId) {
            const noteIndex = this.notes.findIndex(n => n.id === this.editingNoteId);
            if (noteIndex !== -1) {
                this.notes[noteIndex].comment = cleanComment;
                this.notes[noteIndex].color = cleanComment ? 'green' : 'yellow';
                this.notes[noteIndex].timestamp = new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16);
                await repoSaveNote(this.notes[noteIndex]);
                this.persistNotes();
                if (this.callbacks.showToast) this.callbacks.showToast('随笔感悟已成功更新');
            }
        } else {
            const noteColor = cleanComment ? 'green' : 'yellow';
            const newNote = createAnnotationObject({
                bookId: this.getBookId(),
                quote,
                comment: cleanComment,
                color: noteColor,
                page: Number(page) || 1,
                chapter
            });

            this.notes.unshift(newNote);
            await repoSaveNote(newNote);
            this.persistNotes();
            if (this.callbacks.showToast) this.callbacks.showToast('高亮及随笔已成功保存');
        }

        this.closeNoteModal();
        this.renderNotesUI();

        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    async saveQuickNote(comment, page = 1, chapter = '独立思考') {
        const text = (comment || '').trim();
        if (!text) {
            if (this.callbacks.showToast) this.callbacks.showToast('请输入笔记内容');
            return;
        }

        const newNote = createAnnotationObject({
            bookId: this.getBookId(),
            quote: '',
            comment: text,
            color: 'green',
            page: Number(page) || 1,
            chapter
        });

        this.notes.unshift(newNote);
        await repoSaveNote(newNote);
        this.persistNotes();
        this.renderNotesUI();

        if (this.elements && this.elements.quickNoteInput) {
            this.elements.quickNoteInput.value = '';
        }

        if (this.callbacks.showToast) this.callbacks.showToast('已保存独立随笔');
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    async deleteNote(id) {
        this.notes = this.notes.filter(n => n.id !== id);
        await repoDeleteNote(id, this.getBookId());
        this.persistNotes();
        this.renderNotesUI();

        if (this.callbacks.showToast) this.callbacks.showToast('已删除笔记');
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    openNoteModal(quote, existingNoteId = null, targetPage = 1) {
        this.editingNoteId = existingNoteId;
        this.modalQuote = quote;
        this.modalPage = targetPage;

        let existingNote = null;
        if (existingNoteId) {
            existingNote = this.notes.find(n => n.id === existingNoteId);
        } else {
            const overlap = findOverlappingNote(this.notes, targetPage, quote);
            if (overlap) {
                this.editingNoteId = overlap.id;
                existingNote = overlap;
            }
        }

        if (this.elements) {
            domOpenNoteModal({
                elements: this.elements,
                quote,
                existingNote
            });
        }
    }

    closeNoteModal() {
        this.editingNoteId = null;
        this.modalQuote = null;
        this.modalPage = null;
        if (this.elements) {
            domCloseNoteModal(this.elements);
        }
    }

    toggleShowHighlightsInSidebar() {
        this.showHighlightsInSidebar = !this.showHighlightsInSidebar;
        this.renderNotesUI();
        if (this.callbacks.showToast) {
            this.callbacks.showToast(this.showHighlightsInSidebar ? '已开启：笔记区显示全部划线' : '已恢复：笔记区仅显示随笔思考');
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

    highlightNoteCard(noteId) {
        domHighlightNoteCard(noteId);
    }

    renderNotesUI() {
        if (!this.elements) return;
        renderNotesList({
            elements: this.elements,
            notes: this.notes,
            showHighlightsInSidebar: this.showHighlightsInSidebar,
            onJump: (note) => {
                if (this.callbacks.onJump) {
                    this.callbacks.onJump(note);
                }
            },
            onEdit: (note) => {
                this.openNoteModal(note.quote, note.id, note.page);
            },
            onDelete: (id) => {
                this.deleteNote(id);
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

        // Quick Note Save
        if (elements.btnSaveQuickNote) {
            elements.btnSaveQuickNote.addEventListener('click', () => {
                const comment = elements.quickNoteInput ? elements.quickNoteInput.value : '';
                const ctx = this.callbacks.getReadingContext ? this.callbacks.getReadingContext() : { page: 1, chapter: '独立思考' };
                this.saveQuickNote(comment, ctx.page, ctx.chapter);
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
                const chapter = this.callbacks.getCurrentChapter ? this.callbacks.getCurrentChapter() : '章节选区';
                this.saveModalNote({ quote, comment, page, chapter });
                if (window.getSelection) window.getSelection().removeAllRanges();
            });
        }
    }
}
