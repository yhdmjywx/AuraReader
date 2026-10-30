import type { GoalController } from '../features/goals/goalController.js';
import type { GoalSourceLink } from '../domain/goal.js';
import type { StoredAnnotation } from '../../shared/storage.js';
import { bookVersion, readBooks } from '../infrastructure/storageClient.js';
import { stageBookIntent } from '../infrastructure/goalLibraryRepository.js';
import type { Session } from './session.js';
import type { ReaderController } from '../features/reader/readerController.js';
import type { AnnotationController } from '../features/annotations/annotationController.js';
import type { SelectionController } from '../features/annotations/selectionController.js';
import type { ShelfController } from '../features/shelf/shelfController.js';
import type { LayoutController } from '../features/layout/layoutController.js';
import type { BackupController } from '../features/backup/backupController.js';
import type { AppShell } from './appShell.js';
import type { ReaderMode } from '../domain/book.js';
import type { NoteDraft } from './contracts.js';
import { errorMessage } from '../infrastructure/storageError.js';
import JSZip from 'jszip';
import { AppNavigation } from './navigation.js';
interface CoordinatorDependencies {
    goalController?: GoalController;
    session: Session;
    readerController: ReaderController;
    annotationController: AnnotationController;
    shelfController?: ShelfController;
    layoutController?: LayoutController;
    selectionController?: SelectionController;
    backupController?: BackupController;
    appShell?: AppShell;
    navigation?: AppNavigation;
}
export type OpenBookResult = { status: 'opened' } | { status: 'superseded' } | { status: 'failed'; message: string };
interface OpenBookOptions { goalId?: string | null; navigationRequest?: number; source?: GoalSourceLink }
export type AnnotationDraft = NoteDraft & { type?: 'note' | 'highlight'; color?: string; comment?: string };
/* ==========================================================================
   AppCoordinator - Cross-Module Task Coordinator
   Coordinates cross-feature tasks across Reader, Annotations, Shelf,
   Layout, Selection, and Backup without embedding HTML/DB implementation details.
   ========================================================================== */

import {
    loadBookFromDB,
    saveBookToDB,
    deleteBookFromDB,
    demoBooks,
    getSeedNotes
} from '../infrastructure/bookRepository.js';

import { parseEpub, parseTxt } from '../infrastructure/epubParser.js';
import { loadNotesForBook, saveNoteToDB } from '../infrastructure/annotationRepository.js';
import { isNote } from '../domain/annotationEngine.js';

const demos: Record<string, (typeof demoBooks)[keyof typeof demoBooks]> = demoBooks;

export class AppCoordinator {
    session: Session;
    reader: ReaderController;
    annotations: AnnotationController;
    shelf?: ShelfController;
    layout?: LayoutController;
    selection?: SelectionController;
    backup?: BackupController;
    shell?: AppShell;
    goals?: GoalController;
    private openBookRequestId: number;
    onBookOpened?: () => void;
    onBookRemoved?: () => Promise<void>;
    navigation: AppNavigation;
    constructor({
        session,
        readerController,
        annotationController,
        shelfController,
        layoutController,
        selectionController,
        backupController,
        appShell,
        goalController,
        navigation
    }: CoordinatorDependencies) {
        this.session = session;
        this.reader = readerController;
        this.annotations = annotationController;
        this.shelf = shelfController;
        this.layout = layoutController;
        this.selection = selectionController;
        this.backup = backupController;
        this.shell = appShell;
        this.goals = goalController;
        this.navigation = navigation || goalController?.navigation || new AppNavigation();
        this.openBookRequestId = 0;
    }

    async openBook(bookId: string, sourceRequestId?: number, options: OpenBookOptions = {}): Promise<OpenBookResult> {
        if (!bookId) return { status: 'failed', message: "Choose a book" };
        if (options.navigationRequest !== undefined && !this.navigation.isCurrent(options.navigationRequest)) return { status: 'superseded' };
        if (sourceRequestId === undefined) this.sourceRequest++;
        else if (sourceRequestId !== this.sourceRequest) return { status: 'superseded' };
        const navigationRequest = options.navigationRequest ?? this.navigation.begin();
        const requestId = ++this.openBookRequestId;
        const current = () => requestId === this.openBookRequestId && this.navigation.isCurrent(navigationRequest);
        this.shell?.setBookLoading?.(true);

        try {
            // Finish the old book's editor before reading, while it still owns
            // the session. Reads below must not replace any current UI state.
            await this.goals?.finishInlineEdit();
            await this.annotations.finishInlineEdit();
            await this.annotations.assertInlineWritesSaved?.();
            await this.goals?.assertWritesSaved?.();
            if (!current()) return { status: 'superseded' };

            let book = await loadBookFromDB(bookId);
            if (!current()) return { status: 'superseded' };
            if (!book && demos[bookId]) {
                book = { id: bookId, ...demos[bookId] };
                await saveBookToDB(book);
                if (!current()) return { status: 'superseded' };
                // Factory examples are installed only when explicitly opened.
                for (const note of (getSeedNotes() as StoredAnnotation[]).filter(note => note.bookId === bookId)) await saveNoteToDB(note);
                if (!current()) return { status: 'superseded' };
            }
            if (!book) {
                throw new Error("Could not load this book. Please import it again.");
            }

            const notes = await loadNotesForBook(bookId);
            if (!current()) return { status: 'superseded' };
            if (options.source && ((await bookVersion(bookId)).generation !== options.source.generation || !notes.some(n => n.id === options.source!.annotationId))) {
                throw new Error("The source has been deleted or changed.");
            }
            if (!current()) return { status: 'superseded' };

            // No await between installing the complete data and rendering it.
            // Session subscribers see the matching reader and annotations.
            this.annotations.setNotesForBook(notes);
            this.reader.setBook(bookId, book);
            if (options.goalId !== undefined) {
                if (options.goalId) this.goals?.selectGoal(options.goalId);
                else this.goals?.goHome();
            }
            this.session.setCurrentBookId(bookId);
            this.navigation.commit('reader', navigationRequest);
            this.onBookOpened?.();
            this.reader.renderPage(1, false, this.annotations.getNotes());
            this.annotations.refreshVisibleNotes();
            this.goals?.bookChanged();

            try { await this.shelf?.refreshShelf(); }
            catch (error) { this.shell?.showToast(errorMessage(error, "Book opened, but the library list could not refresh."), { kind: 'error' }); }
            if (requestId === this.openBookRequestId) {
                this.shell?.showToast(`Opened: “${book.title}”`);
            }
            return { status: 'opened' };
        } catch (error) {
            // A superseded request may fail after the latest book has opened.
            if (current()) {
                console.error("Could not open book:", error);
                this.shell?.showToast(errorMessage(error, "Could not open this book. Please try again."), { kind: 'error' });
                return { status: 'failed', message: errorMessage(error, "Could not open this book. Please try again.") };
            }
            return { status: 'superseded' };
        } finally {
            if (requestId === this.openBookRequestId) this.shell?.setBookLoading?.(false);
        }
    }

    async importBook(file: File, targetGoalId?: string): Promise<string | undefined> {
        if (!file) return;
        const navigationRequest = this.navigation.begin();

        if (this.shell) {
            this.shell.showToast(`Importing book: ${file.name}...`);
        }

        try {
            const ext = file.name.split('.').pop()?.toLowerCase();
            let bookObj = null;

            if (ext === 'epub' || ext === 'equb' || ext === 'zip') {
                const arrayBuffer = await file.arrayBuffer();
                bookObj = await parseEpub(arrayBuffer, file.name, JSZip);
            } else {
                const text = await file.text();
                if (text.startsWith('PK')) {
                    const arrayBuffer = await file.arrayBuffer();
                    bookObj = await parseEpub(arrayBuffer, file.name, JSZip);
                } else {
                    bookObj = parseTxt(text, file.name);
                }
            }

            if (!bookObj) throw new Error("This file format could not be read.");

            const saved = await saveBookToDB(bookObj);
            if (targetGoalId) {
                try {
                    if (!saved?.generation) throw new Error('The saved book version is unavailable');
                    stageBookIntent({ goalId: targetGoalId, bookId: bookObj.id, generation: saved.generation });
                    await this.goals?.addBook(targetGoalId, bookObj.id, saved.generation);
                }
                catch (error) { throw new Error(`Book saved in the library. Goal association is pending: ${errorMessage(error, 'Please retry adding the book')}`); }
                await this.shelf?.refreshShelf(); return bookObj.id;
            }
            const opened = await this.openBook(bookObj.id, undefined, { navigationRequest, ...(this.navigation.surface === 'home' ? { goalId: null } : {}) });
            if (opened.status === 'failed') throw new Error(`Book imported, but could not be opened: ${opened.message}`);

            if (this.shell) {
                this.shell.showToast(`Imported: “${bookObj.title}”`);
            }
            return bookObj.id;
        } catch (err) {
            console.error("Book import failed:", err);
            if (this.shell) {
                this.shell.showToast(`Book import failed: ${errorMessage(err, "This file format could not be read.")}`, { kind: 'error' });
            }
            if (targetGoalId) throw err;
        }
    }

    async addAnnotation(data: AnnotationDraft) {
        if (!data) return;

        const page = data.page || this.reader.getCurrentPage();
        const chapter = data.chapter || (this.reader.getLocation() ? this.reader.getLocation().chapter : "Chapter selection");

        if (data.type === 'note') {
            this.annotations.createNote({
                quote: data.quote,
                page,
                chapter,
                location: data.location || null
            });
        } else if (data.type === 'highlight' || (data.quote && !data.comment)) {
            await this.annotations.createHighlight({
                quote: data.quote,
                page,
                chapter,
                color: data.color || 'yellow',
                location: data.location || null
            });
        } else {
            await this.annotations.saveModalNote({
                quote: data.quote,
                comment: data.comment,
                page,
                chapter,
                location: data.location || null
            });
        }

        // Reader updates highlights on paper (only if onNotesChanged callback is not already handling it)
        const hasOnNotesChanged = this.annotations && this.annotations.callbacks && typeof this.annotations.callbacks.onNotesChanged === 'function';
        if (!hasOnNotesChanged && this.reader) {
            this.reader.renderPage(this.reader.getCurrentPage(), true, this.annotations ? this.annotations.getNotes() : []);
        }
    }

    async jumpToGoalSource(source: GoalSourceLink) {
        const request = ++this.sourceRequest;
        const navigationRequest = this.navigation.begin();
        const fromHome = this.navigation.surface === 'home';
        await this.goals?.finishInlineEdit();
        await this.annotations.finishInlineEdit(); await this.annotations.assertInlineWritesSaved();
        await this.goals?.assertWritesSaved();
        await readBooks();
        const book = await bookVersion(source.bookId);
        if (request !== this.sourceRequest || !this.navigation.isCurrent(navigationRequest)) return;
        if (book.generation !== source.generation) { this.shell?.showToast("The source has been deleted or changed.", { kind: 'error' }); return; }
        if (this.session.getCurrentBookId() !== source.bookId) {
            const result = await this.openBook(source.bookId, request, { navigationRequest, source, ...(fromHome ? { goalId: null } : {}) });
            if (result.status !== 'opened') return;
        }
        if (request !== this.sourceRequest || !this.navigation.isCurrent(navigationRequest) || this.session.getCurrentBookId() !== source.bookId) return;
        const latest = await bookVersion(source.bookId);
        if (request !== this.sourceRequest || !this.navigation.isCurrent(navigationRequest)) return;
        if (latest.generation !== source.generation) { this.shell?.showToast("The source has changed.", { kind: 'error' }); return; }
        if (!this.annotations.getNotes().some(n => n.id === source.annotationId)) { this.shell?.showToast("The source annotation no longer exists.", { kind: 'error' }); return; }
        if (fromHome) this.goals?.goHome();
        this.navigation.commit('reader', navigationRequest); this.jumpToAnnotation(source.annotationId);
    }
    private sourceRequest = 0;
    jumpToAnnotation(annotationId: string, options: { showMenu?: boolean } = {}) {
        if (!this.annotations) return;
        const request = this.navigation.request, bookId = this.session.getCurrentBookId();
        const current = () => this.navigation.isCurrent(request) && this.navigation.surface === 'reader' && this.session.getCurrentBookId() === bookId;
        if (!current()) return;
        const notes = this.annotations.getNotes();
        const note = notes.find(n => n.id === annotationId);
        if (!note) return;

        const quote = (note.quote || '').trim();
        if (!quote) {
            if (isNote(note)) this.annotations.focusNotes([note.id]);
            else this.annotations.focusHighlights([note.id]);
            if (this.shell) this.shell.showToast("Jumped to note");
            return;
        }

        const showMenu = !!options.showMenu;
        if (this.reader && this.reader.isChapterFlow && this.reader.isChapterFlow()) {
            this.reader.showQuote(note.page, quote, notes);
            if (this.selection && typeof this.selection.activateAnnotationId === 'function') {
                setTimeout(() => { if (current()) this.selection?.activateAnnotationId(note.id, { notify: false, showMenu }); }, 30);
            }
            if (this.shell) this.shell.showToast(`Jumped to chapter ${note.page} source`);
            return;
        }

        const needsRender = this.reader.getCurrentPage() !== note.page;
        if (this.reader) {
            if (needsRender) {
                this.reader.renderPage(note.page, false, notes);
            }

            const scroll = this.reader.scrollToAnnotation || this.reader.scrollToHighlight;
            if (typeof scroll === 'function') {
                setTimeout(() => {
                    if (!current()) return;
                    scroll.call(this.reader, note.id);
                    if (this.selection && typeof this.selection.activateAnnotationId === 'function') {
                        this.selection.activateAnnotationId(note.id, { notify: false, showMenu });
                    }
                }, needsRender ? 120 : 30);
            }
        }

        if (this.shell) {
            this.shell.showToast(`Jumped to p.${note.page} source`);
        }
    }

    async deleteBook(bookId: string) {
        if (!bookId) return;
        if (this.session.getCurrentBookId() === bookId) await this.annotations.finishInlineEdit?.();
        if (this.session.getCurrentBookId() === bookId) await this.goals?.finishInlineEdit();
        if (this.session.getCurrentBookId() === bookId) {
            await this.annotations.assertInlineWritesSaved(); await this.goals?.assertWritesSaved();
        }
        await deleteBookFromDB(bookId);
        if (this.shelf) {
            await this.shelf.refreshShelf();
        }

        if (this.session.getCurrentBookId() === bookId) {
            this.clearReadingSession();
            if (this.onBookRemoved) await this.onBookRemoved();
            else this.navigation.show('home');
        }
    }

    clearReadingSession() {
        const request = this.navigation.begin(); this.openBookRequestId++; this.sourceRequest++;
        this.shell?.setBookLoading(false);
        this.annotations.setNotesForBook([]);
        this.reader.clearBook();
        this.session.clearBook();
        this.navigation.commit('home', request);
    }

    async restoreBackup(file: File) {
        if (!file || !this.backup) return;
        await this.backup.importFullBackup(file);
    }

    changeReadingLayout(mode: ReaderMode) {
        if (!this.layout) return;
        this.layout.setPageMode(mode);
        this.reader.renderPage(this.reader.getCurrentPage(), true, this.annotations.getNotes());
    }
}
