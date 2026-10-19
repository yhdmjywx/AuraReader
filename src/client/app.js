/* ==========================================================================
   AuraReader Workstation - Application Facade & Export Compatibility Layer
   Thin facade delegating all operations to modular architecture:
   - Bootstrap: main.js
   - App Coordinator: appCoordinator.js
   - Session: session.js
   - Shell: appShell.js
   - Feature Controllers: readerController, annotationController, selectionController,
     shelfController, layoutController, backupController
   - Domain: readerEngine, readingLocation, annotationEngine
   - Infrastructure: bookRepository, annotationRepository, epubParser, exporters
   ========================================================================== */

import {
    initDB as repoInitDB,
    saveBookToDB as repoSaveBook,
    loadBookFromDB as repoLoadBook,
    getAllBooksFromDB as repoGetAllBooks,
    deleteBookFromDB as repoDeleteBook,
    demoBooks,
    seedNotes
} from './infrastructure/bookRepository.js';

import {
    saveNoteToDB as repoSaveNote,
    deleteNoteFromDB as repoDeleteNote,
    loadNotesFromDB as repoLoadNotes,
    loadNotesForBook as repoLoadNotesForBook,
    getNotesForBooks as repoGetNotesForBooks
} from './infrastructure/annotationRepository.js';

import { readerEngine, ReaderEngine } from './domain/readerEngine.js';
import { resolveTargetPage, calcSpreadPages, clampPage, findChapterForPage, createReadingLocation, ensureTocHierarchy } from './domain/readingLocation.js';
import {
    filterNotes,
    findOverlappingNote,
    createAnnotationObject,
    applyHighlightToHtml,
    applyAllHighlightsToHtml
} from './domain/annotationEngine.js';

import { DOUBLE_PAGE_MIN_WIDTH, LayoutController } from './features/layout/layoutController.js';
import { ReaderController } from './features/reader/readerController.js';
import { AnnotationController } from './features/annotations/annotationController.js';
import { SelectionController } from './features/annotations/selectionController.js';
import { ShelfController } from './features/shelf/shelfController.js';
import { BackupController } from './features/backup/backupController.js';
import { Session } from './app/session.js';
import { AppShell } from './app/appShell.js';
import { AppCoordinator } from './app/appCoordinator.js';

import {
    appInstance,
    session,
    coordinator as appCoordinator,
    reader as readerController,
    annotations as annotationController,
    selection as selectionController,
    shelf as shelfController,
    layout as layoutController,
    backup as backupController,
    appShell,
    elements,
    queryElements,
    bootstrapApp,
    startApp
} from './main.js';

// Re-export domain, controller & infrastructure utilities
export {
    demoBooks,
    seedNotes,
    DOUBLE_PAGE_MIN_WIDTH,
    readerEngine,
    ReaderEngine,
    resolveTargetPage,
    calcSpreadPages,
    clampPage,
    findChapterForPage,
    createReadingLocation,
    filterNotes,
    findOverlappingNote,
    createAnnotationObject,
    applyHighlightToHtml,
    applyAllHighlightsToHtml,
    appInstance,
    appCoordinator,
    readerController,
    annotationController,
    selectionController,
    shelfController,
    layoutController,
    backupController,
    session,
    appShell,
    elements,
    queryElements,
    bootstrapApp,
    startApp,
    LayoutController,
    ReaderController,
    AnnotationController,
    SelectionController,
    ShelfController,
    BackupController,
    AppCoordinator,
    AppShell,
    Session
};

// --------------------------------------------------------------------------
// 1. Unified State Facade (Delegates authority to respective controllers)
// --------------------------------------------------------------------------
export const state = {
    // Session state
    get currentBook() { return session.getCurrentBookId(); },
    set currentBook(val) { session.setCurrentBookId(val); },

    // Reader state
    get currentPage() { return readerController.getCurrentPage(); },
    set currentPage(val) { readerController.currentPage = val; },
    get currentLeftPage() { return readerController.getCurrentLeftPage(); },
    set currentLeftPage(val) { readerController.currentLeftPage = val; },
    get currentRightPage() { return readerController.getCurrentRightPage(); },
    set currentRightPage(val) { readerController.currentRightPage = val; },
    get totalPages() { return readerController.getTotalPages(); },
    set totalPages(val) { readerController.totalPages = val; },
    get fontSize() { return readerController.fontSize; },
    set fontSize(val) { readerController.fontSize = val; },
    get fontFamily() { return readerController.fontFamily; },
    set fontFamily(val) { readerController.fontFamily = val; },
    get textIndent() { return readerController.textIndent; },
    set textIndent(val) { readerController.textIndent = val; },
    get paperTheme() { return readerController.paperTheme; },
    set paperTheme(val) { readerController.paperTheme = val; },

    // Layout state
    get layoutMode() { return layoutController.getLayoutMode(); },
    set layoutMode(val) { layoutController.layoutMode = val; },
    get isAutoDowngraded() { return layoutController.getIsAutoDowngraded(); },
    set isAutoDowngraded(val) { layoutController.isAutoDowngraded = val; },

    // Annotations state
    get notes() { return annotationController.getNotes(); },
    set notes(val) { annotationController.notes = val; },
    get editingNoteId() { return annotationController.getEditingNoteId(); },
    set editingNoteId(val) { annotationController.editingNoteId = val; },
    get showHighlightsInSidebar() { return annotationController.getShowHighlightsInSidebar(); },
    set showHighlightsInSidebar(val) { annotationController.showHighlightsInSidebar = val; },
    get activeTab() { return annotationController.activeTab; },
    set activeTab(val) { annotationController.activeTab = val; },

    // Selection state
    get pendingSelection() { return selectionController.getPendingSelection(); },
    set pendingSelection(val) { selectionController.pendingSelection = val; },
    get activeHighlightId() { return selectionController.activeHighlightId; },
    set activeHighlightId(val) { selectionController.activeHighlightId = val; },

    // App Theme
    get appTheme() { return appShell.appTheme; },
    set appTheme(val) { appShell.appTheme = val; }
};

// --------------------------------------------------------------------------
// 2. Persistence Repository Facade
// --------------------------------------------------------------------------
export async function initDB() {
    const db = await repoInitDB();
    await refreshShelfUI();
    return db;
}

export async function saveBookToDB(bookObj) {
    await repoSaveBook(bookObj);
    await refreshShelfUI();
}

export async function loadBookFromDB(bookId) {
    return repoLoadBook(bookId);
}

export async function getAllBooksFromDB() {
    return repoGetAllBooks();
}

export async function deleteBookFromDB(bookId) {
    await repoDeleteBook(bookId);
    await refreshShelfUI();
}

export async function saveNoteToDB(noteObj) {
    await repoSaveNote(noteObj);
}

export async function deleteNoteFromDB(noteId) {
    await repoDeleteNote(noteId, state.currentBook);
}

export async function loadNotesFromDB(bookId) {
    return repoLoadNotes(bookId);
}

// --------------------------------------------------------------------------
// 3. Layout Facade
// --------------------------------------------------------------------------
export function isDoublePageEffective() {
    return layoutController.isDoublePageEffective();
}

export function checkResponsiveLayout() {
    const notify = arguments.length > 0 ? arguments[0] : true;
    const availWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
        ? elements.readerPanel.clientWidth
        : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
    const res = layoutController.checkResponsiveLayout(availWidth);
    if (res.changed && (!layoutController.callbacks || !layoutController.callbacks.onResponsiveChange)) {
        if (notify) {
            if (res.isAutoDowngraded) {
                showToast('可用空间不足，已自适应降级为单页展示');
            } else {
                showToast('可用空间充足，已自动恢复双页展开模式');
            }
        }
        updateLayoutClasses();
        renderPage(state.currentPage, true);
    }
}

export function togglePageMode() {
    const nextMode = (state.layoutMode === 'double') ? 'single' : 'double';
    setPageMode(nextMode);
}

export function setPageMode(mode) {
    const availWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
        ? elements.readerPanel.clientWidth
        : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
    const res = layoutController.setPageMode(mode, availWidth);
    if (!layoutController.callbacks || !layoutController.callbacks.onLayoutChange) {
        if (mode === 'double' && res.isAutoDowngraded) {
            showToast('已开启双页模式（当前可用宽度受限，临时以单页呈现）');
        } else {
            showToast(mode === 'double' ? '已开启双页展开模式' : '已切换为单页阅读模式');
        }
        updateLayoutClasses();
        renderPage(state.currentPage, true);
    }
    return res;
}

export function updateLayoutClasses() {
    layoutController.updateLayoutClasses(elements);
}

// --------------------------------------------------------------------------
// 4. Reading Facade & Book Loading
// --------------------------------------------------------------------------
export async function loadBook(bookKey) {
    state.currentBook = bookKey;
    let book = await loadBookFromDB(bookKey);
    if (!book && demoBooks[bookKey]) {
        book = demoBooks[bookKey];
    }
    if (!book) return;

    readerController.setBook(bookKey, book);
    const loc = readerController.getLocation();
    state.currentPage = loc.page;
    state.totalPages = loc.totalPages;

    if (elements.currentBookTitle) elements.currentBookTitle.textContent = book.title;
    if (elements.currentBookTag) elements.currentBookTag.textContent = book.format || 'EPUB';
    if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = state.totalPages;

    renderTOC(book.toc || []);

    state.notes = await repoLoadNotesForBook(bookKey);

    renderNotesList();
    renderPage(1);
}

export function renderPage(pageNum, preserveScroll = false) {
    return readerController.renderPage(pageNum, preserveScroll, state.notes);
}

export function renderTOC(tocItems) {
    readerController.renderTOC(tocItems);
}

// --------------------------------------------------------------------------
// 5. Highlights, Tooltip & Selection Actions
// --------------------------------------------------------------------------
export function applyHighlightsToPaper(targetPaper = elements.bookPaper, targetPage = state.currentPage) {
    readerController.applyHighlights(targetPaper, targetPage, state.notes, function (markEl, note) {
        highlightNoteCard(note.id);
        const target = markEl || this;
        showHighlightActionTooltip(this, note);
    });
}

export function showHighlightActionTooltip(markEl, note) {
    hideSelectionTooltip();
    if (!note) return;
    selectionController.showHighlightAction(markEl, note);
}

export function hideHighlightActionTooltip() {
    selectionController.hideHighlightAction();
}

export function hideSelectionTooltip() {
    selectionController.hideSelectionTooltip();
}

export function initTextSelection() {
    selectionController.initUI(elements);
}

export async function createHighlight(color = 'yellow') {
    if (!state.pendingSelection) return;

    const pending = state.pendingSelection;
    await annotationController.createHighlight({
        quote: pending.text,
        page: pending.page || state.currentPage,
        chapter: readerController.getLocation().chapter,
        color,
        location: pending.location || null
    });

    hideSelectionTooltip();
    if (window.getSelection) window.getSelection().removeAllRanges();
}

// --------------------------------------------------------------------------
// 6. Notes List & Modal Coordination
// --------------------------------------------------------------------------
export function renderNotesList() {
    annotationController.renderNotesUI();
}

export function setNotesScope(scope = 'page') {
    return annotationController.setNotesScope(scope);
}

export function jumpToNoteLocation(note) {
    appCoordinator.jumpToAnnotation(note.id);
}

export function highlightNoteCard(noteId) {
    annotationController.highlightNoteCard(noteId);
}

export function deleteNote(id) {
    return annotationController.deleteNote(id);
}

export function deleteHighlight(id) {
    return annotationController.deleteHighlight(id);
}

export function deleteAnnotation(id) {
    return annotationController.deleteAnnotation(id);
}

export function openNoteModal(quote, existingNoteId = null) {
    // Retain the exported name for integrations; editing is now inline.
    const page = (state.pendingSelection && state.pendingSelection.page) ? state.pendingSelection.page : state.currentPage;
    if (existingNoteId) {
        annotationController.openNoteModal(quote, existingNoteId, page);
        return;
    }
    annotationController.createNote({
        quote,
        page,
        location: state.pendingSelection ? state.pendingSelection.location : null
    });
}

export function closeNoteModal() {
    return annotationController.closeNoteModal();
}

export function saveModalNote() {
    return annotationController.finishInlineEdit();
}

// --------------------------------------------------------------------------
// 7. Shelf & Toast Facade
// --------------------------------------------------------------------------
export async function refreshShelfUI() {
    await shelfController.refreshShelf();
}

export function showToast(msg) {
    appShell.showToast(msg);
}
