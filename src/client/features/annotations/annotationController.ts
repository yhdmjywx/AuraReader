import { noteTimestamp } from '../../domain/format.js';
import { eventElement } from '../../app/dom.js';
import { pendingNoteWrites, type NoteEditBaseline } from '../../infrastructure/annotationRecovery.js';
import { cachedBookVersion, operationId } from '../../infrastructure/storageClient.js';
import type { NoteRecord } from '../../../shared/storage.js';
import type { Annotation, AnnotationInput } from '../../domain/annotation.js';
import type { AnnotationCallbacks, NoteDraft } from '../../app/contracts.js';
import type { AppElements } from '../../app/elements.js';
/* ==========================================================================
   AnnotationController - Notes & Highlights Feature Controller
   Authority owner of: notes, editingNoteId, showHighlightsInSidebar, activeTab.
   Highlights and notes are independent records distinguished by kind.
   ========================================================================== */

import {
    saveNoteToDB as repoSaveNote,
    deleteNoteFromDB as repoDeleteNote,
    loadNotesForBook as repoLoadNotesForBook, displayedNote, displayedNoteBaseline
} from '../../infrastructure/annotationRepository.js';

import {
    createAnnotationObject,
    isHighlight,
    isNote,
    normalizeAnnotation
} from '../../domain/annotationEngine.js';

import {
    renderNotesList,
    focusInlineEditor,
    highlightNoteCard as domHighlightNoteCard
} from './notesUI.js';

export class AnnotationController {
    private listeners = new Set<() => void>();
    private reactView = false;
    private pendingWrites = 0;
    get saveState() { return this.inlineWriteErrors.size ? 'error' : this.pendingWrites ? 'saving' : 'saved'; }
    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    private changed() { for (const listener of this.listeners) listener(); }
    useReactView(enabled: boolean) { this.reactView = enabled; this.renderNotesUI(); }
    callbacks: AnnotationCallbacks;
    notes: Annotation[];
    editingNoteId: string | null;
    inlineEdit: { note: Annotation; opening: boolean; baseline?: NoteEditBaseline; external?: Annotation | null } | null;
    private noteBaselines = new Map<string, NoteEditBaseline>();
    private deferredNotes = new Map<string, NoteRecord>();
    private displayedBookGeneration?: string;
    _inlineWrites: Promise<void>;
    private inlineWriteErrors = new Map<string, { bookId: string; recoveryAvailable: boolean }>();
    showHighlightsInSidebar: boolean;
    notesScope: 'page' | 'book';
    _renderedSidebarIds: string | null;
    activeTab: string;
    focusedNoteIds: string[];
    focusedHighlightIds: string[];
    elements: AppElements | null;
    constructor({
        callbacks = {}
    }: { callbacks?: AnnotationCallbacks } = {}) {
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
        if (!draft) return this.notes;
        return this.notes.some(note => note.id === draft.id) ? this.notes.map(note => note.id === draft.id ? draft : note) : [draft, ...this.notes];
    }

    // This changes presentation only. getNotes() continues to return the full
    // collection for rendering, persistence, and book-wide exports.
    setNotesScope(scope: 'page' | 'book' = 'page') {
        if (scope !== 'page' && scope !== 'book') throw new Error("Note scope must be page or book.");
        this.notesScope = scope;
        this.renderNotesUI();
        return scope;
    }

    getSidebarNotes() {
        const quoted = this.getRenderingNotes().filter(note => String(note.quote || '').trim());
        if (this.notesScope === 'book') return quoted;
        const visible = this.callbacks.getVisibleAnnotationIds?.() || new Set();
        return quoted.filter(note => note.id === this.editingNoteId || visible.has(String(note.id)));
    }

    refreshVisibleNotes(finishHiddenEditor = false) {
        if (this.notesScope !== 'page') return;
        if (finishHiddenEditor && this.inlineEdit && !this.callbacks.getVisibleAnnotationIds?.().has(String(this.editingNoteId))) {
            this.finishInlineEdit();
        }
        const key = JSON.stringify(this.getSidebarNotes().map(note => note.id));
        if (key !== this._renderedSidebarIds) this.renderNotesUI();
    }

    requireQuote(quote: string) {
        if (String(quote || '').trim()) return true;
        this.callbacks.showToast?.("Select text in the book to quote first.");
        return false;
    }

    getEditingNoteId() {
        return this.editingNoteId;
    }

    getShowHighlightsInSidebar() {
        return this.showHighlightsInSidebar;
    }

    async loadNotesForBook(bookId: string) {
        await this.finishInlineEdit();
        const loaded = bookId ? await repoLoadNotesForBook(bookId) : [];
        this.setNotesForBook(loaded, bookId);
        this.renderNotesUI();
        return this.notes;
    }

    // Install prepared data synchronously; the coordinator renders only after
    // the reader and session have also switched to this book.
    setNotesForBook(notes: AnnotationInput[], bookId?: string) {
        this.noteBaselines.clear();
        this.deferredNotes.clear();
        this.displayedBookGeneration = bookId ? cachedBookVersion(bookId)?.generation : undefined;
        this.notes = normalizeList(notes);
        for (const note of notes) this.rememberBaseline(note);
        this.notesScope = 'page';
        this.focusedNoteIds = [];
        this.focusedHighlightIds = [];
        this._renderedSidebarIds = null;
    }

    private rememberBaseline(note: AnnotationInput) {
        const version = displayedNoteBaseline(note);
        if (version && note.id) this.noteBaselines.set(note.id, { ...version, chain: operationId() });
    }

    applyExternalNotes(records: NoteRecord[], generation?: string) {
        const changedPages = new Set<number>();
        if (generation && this.displayedBookGeneration && generation !== this.displayedBookGeneration) return changedPages;
        const pending = new Set(pendingNoteWrites(this.getBookId()).map(entry => entry.id));
        const notes = new Map(this.notes.map(note => [note.id, note]));
        let changed = false;
        for (const row of records) {
            if (row.bookId !== this.getBookId()) continue;
            if (pending.has(row.id)) { this.deferredNotes.set(row.id, row); continue; }
            this.deferredNotes.delete(row.id);
            const current = notes.get(row.id);
            const baseline = this.noteBaselines.get(row.id);
            if (baseline && baseline.expected >= row.revision && baseline.generation === generation) continue;
            const next = displayedNote(row, generation);
            if (this.inlineEdit?.note.id === row.id) {
                // Keep the live editor and its original revision, even if the
                // committed note is removed or its source changes.
                this.inlineEdit.external = next;
            } else {
                this.noteBaselines.delete(row.id);
                if (next) this.rememberBaseline(next);
            }
            if (next) notes.set(row.id, next); else notes.delete(row.id);
            if (JSON.stringify(current) === JSON.stringify(next)) continue;
            changed = true;
            const geometry = (note?: Annotation | null) => note && [note.kind, note.page, note.quote, note.location];
            if (JSON.stringify(geometry(current)) !== JSON.stringify(geometry(next))) {
                if (current) changedPages.add(current.page);
                if (next) changedPages.add(next.page);
            }
        }
        if (changed) { this.notes = [...notes.values()]; this.renderNotesUI(); }
        return changedPages;
    }

    getBookId() {
        return this.callbacks.getCurrentBookId ? this.callbacks.getCurrentBookId() : 'crisis-era';
    }

    async addOrUpdateNote(noteObj: AnnotationInput) {
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
        this.renderNotesUI();

        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    async createHighlight({ quote, page = 1, chapter = "Chapter selection", color = 'yellow', location = null }: NoteDraft & { color?: string }) {
        const highlightPage = Number(page) || 1;
        const cleanQuote = quote || '';
        const existingHighlight = this.notes.find(n => {
            return isHighlight(n) && Number(n.page) === highlightPage && (n.quote || '') === cleanQuote;
        });

        if (existingHighlight) {
            if (this.callbacks.onFocusAnnotation) this.callbacks.onFocusAnnotation(existingHighlight);
            else if (this.callbacks.showToast) this.callbacks.showToast("Jumped to existing highlight");
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
        if (this.callbacks.showToast) this.callbacks.showToast("Text highlighted");

        this.renderNotesUI();
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
        return newNote;
    }

    createNote({ quote = '', page = 1, chapter = null, location = null }: NoteDraft = {}) {
        const pending = this.callbacks.getPendingSelection ? this.callbacks.getPendingSelection() : null;
        const selectedQuote = quote || (pending ? pending.text : '');
        if (!this.requireQuote(selectedQuote)) return;
        this.finishInlineEdit();
        const note = createAnnotationObject({
            kind: 'note', bookId: this.getBookId(), quote: selectedQuote, comment: '', color: 'green',
            page: Number(page || pending?.page) || 1,
            chapter: chapter || this.callbacks.getCurrentChapter?.() || "Chapter selection",
            location: location || pending?.location || null
        });
        this.beginInlineEdit(note);
        return note;
    }

    beginInlineEdit(note: Annotation) {
        if (this.editingNoteId === note.id && this.inlineEdit) return;
        this.finishInlineEdit();
        this.editingNoteId = note.id;
        const generation = this.displayedBookGeneration || cachedBookVersion(note.bookId)?.generation;
        const baseline = this.noteBaselines.get(note.id) || (generation && !this.notes.some(item => item.id === note.id)
            ? { chain: operationId(), expected: 0, generation } : undefined);
        const draft = { ...note };
        this.inlineEdit = { note: draft, opening: true, baseline };
        if (baseline) this.noteBaselines.set(note.id, baseline);
        const editSession = this.inlineEdit;
        this.renderNotesUI();
        // Include unsaved drafts only in the reading surface, never in exports
        // or storage. This also gives the new editor its existing margin anchor.
        if (!this.notes.some(item => item.id === note.id)) {
            this.callbacks.onNotesChanged?.(this.getRenderingNotes());
        }
        if (this.inlineEdit !== editSession) return;
        editSession.opening = false;
        // The body and margin lanes are now mounted in their final positions.
        focusInlineEditor(this.elements, note.id);
        const win = this.elements?.notesList?.ownerDocument.defaultView;
        win?.requestAnimationFrame?.(() => {
            if (this.inlineEdit !== editSession) return;
            const editor = this.elements?.notesList?.querySelector<HTMLTextAreaElement>('.note-editor');
            if (editor && editor.ownerDocument.activeElement !== editor) focusInlineEditor(this.elements, note.id);
        });
    }

    updateInlineNote(id: string, comment: string) {
        const note = this.inlineEdit?.note;
        if (!note || id !== note.id || note.comment === comment) return;
        note.comment = comment;
        this.changed();
        this.callbacks.onAnnotationContentChanged?.(note);
        note.timestamp = noteTimestamp();
        const index = this.notes.findIndex(item => item.id === id);
        if (index === -1 && !comment.trim()) return;
        if (index === -1) this.notes.unshift(note);
        else this.notes[index] = note;
        // Save the raw input, including trailing newlines. No list or body
        // rerender is needed when only a note's own words have changed.
        this.writeInlineNote(note, false, this.inlineEdit?.baseline);
    }

    writeInlineNote(note: Annotation, remove = false, baseline?: NoteEditBaseline) {
        this.pendingWrites++;
        this.changed();
        const snapshot: Annotation = JSON.parse(JSON.stringify(note));
        // Start transactions immediately, in input order. The repository must
        // not mirror an older completed transaction over newer local input.
        const write = remove
            ? repoDeleteNote(snapshot.id, snapshot.bookId, baseline)
            : repoSaveNote(snapshot, baseline);
        this._inlineWrites = Promise.all([this._inlineWrites, write]).then(() => {
            this.inlineWriteErrors.delete(snapshot.id);
        }).catch(error => {
            this.inlineWriteErrors.set(snapshot.id, { bookId: snapshot.bookId, recoveryAvailable: error.recoveryAvailable === true });
            console.error("Could not persist notes", error);
            this.callbacks.showToast?.(error.recoveryAvailable === false
                ? "Notes are not confirmed saved. Keep this window open."
                : error.status === 409 ? "Note save conflict. Your input is preserved locally. Keep this window open."
                    : "Notes are preserved in the local cache. The database is temporarily unavailable for writes.", { kind: 'error' });
        }).finally(() => {
            this.pendingWrites--; this.changed();
            const remote = this.deferredNotes.get(snapshot.id);
            if (!remote || pendingNoteWrites(snapshot.bookId).some(entry => entry.id === snapshot.id)) return;
            const changes = this.applyExternalNotes([remote], this.displayedBookGeneration);
            if (changes.size) this.callbacks.onNotesChanged?.(this.getRenderingNotes());
        });
    }

    finishInlineEdit() {
        const session = this.inlineEdit;
        if (!session) return this._inlineWrites;
        const editor = this.elements?.notesList?.querySelector<HTMLTextAreaElement>('.note-editor');
        if (editor) this.updateInlineNote(session.note.id, editor.value);
        this.inlineEdit = null;
        this.editingNoteId = null;
        const note = session.note;
        if (session.external !== undefined && !pendingNoteWrites(note.bookId).some(entry => entry.id === note.id)) {
            this.noteBaselines.delete(note.id);
            if (session.external) this.rememberBaseline(session.external);
        }
        const blank = !note.comment.trim();
        if (blank) {
            const existed = this.notes.some(item => item.id === note.id);
            this.notes = this.notes.filter(item => item.id !== note.id);
            if (existed) {
                this.writeInlineNote(note, true, session.baseline);
            }
        }
        this.renderNotesUI();
        if (blank) this.callbacks.onNotesChanged?.(this.notes);
        return this._inlineWrites;
    }

    async assertInlineWritesSaved() {
        await this._inlineWrites;
        // Durable entries are removed by the repository only after acknowledgment.
        // A later recovery must release the close guard; non-durable failures stay.
        for (const [id, failure] of this.inlineWriteErrors) {
            if (failure.recoveryAvailable && !pendingNoteWrites(failure.bookId).some(entry => entry.id === id)) this.inlineWriteErrors.delete(id);
        }
        if (this.inlineWriteErrors.size) throw new Error("Some notes could not be saved. This window remains open. Resolve conflicts or restore writes, then try again.");
    }

    async saveModalNote({ quote = '', comment = '', page = 1, chapter = "Chapter selection", location = null }: NoteDraft & { comment?: string } = {}) {
        // Compatibility for programmatic callers; the UI uses inline autosave.
        if (this.inlineEdit) {
            const editor = this.elements?.notesList?.querySelector<HTMLTextAreaElement>('.note-editor');
            if (editor) editor.value = comment;
            this.updateInlineNote(this.inlineEdit.note.id, comment);
            await this.finishInlineEdit();
            return;
        }
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
            this.notes[noteIndex].timestamp = noteTimestamp();
            await repoSaveNote(this.notes[noteIndex]);
            if (this.callbacks.showToast) this.callbacks.showToast("Note updated");
        } else {
            if (!this.requireQuote(quote)) return;
            if (!cleanComment) {
                if (this.callbacks.showToast) this.callbacks.showToast("Enter a note first.");
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
            if (this.callbacks.showToast) this.callbacks.showToast("Note saved");
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

    async deleteHighlight(id: string) {
        await this.deleteHighlights([id]);
    }

    async deleteHighlights(ids: string[] = []) {
        await this.callbacks.beforeDeleteAnnotations?.();
        const idSet = new Set(ids.filter(Boolean));
        const removed = this.notes.filter(n => idSet.has(n.id) && isHighlight(n));
        if (removed.length === 0) return;

        const removedIds = new Set(removed.map(n => n.id));
        this.notes = this.notes.filter(n => !removedIds.has(n.id));
        this.focusedHighlightIds = this.focusedHighlightIds.filter(id => !removedIds.has(id));

        for (const id of removedIds) {
            await repoDeleteNote(id, this.getBookId());
        }
        this.renderNotesUI();

        if (this.callbacks.showToast) this.callbacks.showToast("Highlight removed");
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    async deleteNote(id: string) {
        const target = this.notes.find(n => n.id === id);
        if (!target || !isNote(target)) return;
        await this.deleteAnnotation(id, "Note deleted");
    }

    async deleteAnnotation(id: string, toastMessage = "Annotation deleted") {
        await this.callbacks.beforeDeleteAnnotations?.();
        if (!id) return;
        if (this.editingNoteId === id) await this.finishInlineEdit();
        const existed = this.notes.some(n => n.id === id);
        if (!existed) return;

        this.notes = this.notes.filter(n => n.id !== id);
        this.focusedNoteIds = this.focusedNoteIds.filter(noteId => noteId !== id);
        this.focusedHighlightIds = this.focusedHighlightIds.filter(noteId => noteId !== id);
        await repoDeleteNote(id, this.getBookId());
        this.renderNotesUI();

        if (this.callbacks.showToast) this.callbacks.showToast(toastMessage);
        if (this.callbacks.onNotesChanged) {
            this.callbacks.onNotesChanged(this.notes);
        }
    }

    openNoteModal(quote: string, existingNoteId: string | null = null, targetPage = 1) {
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

        this.beginInlineEdit(existingNote);
    }

    closeNoteModal() {
        return this.finishInlineEdit();
    }

    toggleShowHighlightsInSidebar() {
        this.showHighlightsInSidebar = !this.showHighlightsInSidebar;
        this.renderNotesUI();
        if (this.callbacks.showToast) {
            this.callbacks.showToast(this.showHighlightsInSidebar ? "Highlights are now shown with notes." : "Only notes are now shown.");
        }
    }

    switchTab(tabId: string) {
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

    focusNotes(noteIds: string[] = []) {
        const ids = uniqueIds(noteIds);
        if (ids.length === 0) return;
        this.switchTab('tab-highlights');
        this.focusedNoteIds = ids;
        this.focusedHighlightIds = [];
        this.renderNotesUI();
        this.scrollCardIntoView(ids[0]);
    }

    focusHighlights(highlightIds: string[] = []) {
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

    highlightNoteCard(noteId: string) {
        domHighlightNoteCard(noteId);
    }

    scrollCardIntoView(noteId: string) {
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
        this.changed();
        if (this.reactView) return;
        renderNotesList({
            elements: this.elements,
            notes: sidebarNotes,
            getGoalAction: this.callbacks.getGoalAction,
            onLinkGoal: this.callbacks.onLinkGoal ? id => { Promise.resolve(this.callbacks.onLinkGoal?.(id)).catch(error => this.callbacks.showToast?.(String(error.message || error), { kind: 'error' })); } : null,
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
                if (!isNote(note)) return;
                this.openNoteModal(note.quote, note.id, note.page);
            },
            onDelete: (note) => {
                if (isHighlight(note)) this.deleteHighlight(note.id);
                else this.deleteNote(note.id);
            }
        });
    }

    initUI(elements: AppElements) {
        this.elements = elements;
        if (!elements || typeof document === 'undefined') return;

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
            if (!eventElement(event)?.closest('.note-editor')) this.finishInlineEdit();
        }, true);
        document.addEventListener('focusin', event => {
            if (this.inlineEdit?.opening) return;
            if (!eventElement(event)?.closest('.note-editor')) this.finishInlineEdit();
        });
        window.addEventListener('pagehide', () => this.finishInlineEdit());
    }
}

function normalizeList(list: AnnotationInput[]): Annotation[] {
    return (Array.isArray(list) ? list : []).map(normalizeAnnotation).filter((note): note is Annotation => note !== null);
}

function uniqueIds(ids: string[]) {
    const seen = new Set();
    const result: string[] = [];
    (Array.isArray(ids) ? ids : []).forEach(id => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        result.push(id);
    });
    return result;
}
