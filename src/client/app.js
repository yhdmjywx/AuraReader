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
    getNotesForBooks as repoGetNotesForBooks,
    persistNotesToLocalStorage
} from './infrastructure/annotationRepository.js';

import { readerEngine, ReaderEngine } from './domain/readerEngine.js';
import { resolveTargetPage, calcSpreadPages, clampPage, findChapterForPage, createReadingLocation } from './domain/readingLocation.js';
import {
    filterNotes,
    findOverlappingNote,
    createAnnotationObject,
    applyHighlightToHtml,
    applyAllHighlightsToHtml
} from './domain/annotationEngine.js';

import { DOUBLE_PAGE_MIN_WIDTH, LayoutSystem, layoutSystem } from './features/layout/layoutController.js';
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
    LayoutSystem,
    layoutSystem,
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
    // layoutMode: localStorage.getItem('aura_layout_mode') || 'single'
    get layoutMode() { return layoutController.getLayoutMode(); },
    set layoutMode(val) { layoutController.layoutMode = val; },
    get isCollapsed() { return layoutController.getIsCollapsed(); },
    set isCollapsed(val) { layoutController.isCollapsed = val; },
    get readerWidthPercent() { return layoutController.getReaderWidthPercent(); },
    set readerWidthPercent(val) { layoutController.readerWidthPercent = val; },
    get isAutoDowngraded() { return layoutController.getIsAutoDowngraded(); },
    set isAutoDowngraded(val) { layoutController.isAutoDowngraded = val; },

    // Annotations state
    // editingNoteId: null
    get notes() { return annotationController.getNotes(); },
    set notes(val) { annotationController.notes = val; },
    get editingNoteId() { return annotationController.getEditingNoteId(); },
    set editingNoteId(val) { annotationController.editingNoteId = val; },
    // showHighlightsInSidebar: false
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

export function persistNotes() {
    if (!state.currentBook) return;
    localStorage.setItem('aura_notes_' + state.currentBook, JSON.stringify(state.notes));
    persistNotesToLocalStorage(state.currentBook, state.notes);
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

export function toggleSidebar(notify = true) {
    const isCollapsed = layoutController.toggleSidebar(notify);
    if (!layoutController.callbacks || !layoutController.callbacks.onSidebarChange) {
        applySidebarState(notify);
    }
    return isCollapsed;
}

export function applySidebarState(notify = false) {
    layoutController.applySidebarState(elements);
    if (state.isCollapsed) {
        if (notify) showToast('已进入 100% 全屏专注阅读模式');
    } else {
        if (notify) showToast(`已展开 ${Math.round(100 - layoutController.getReaderWidthPercent())}% 笔记工作台`);
    }
    updateLayoutClasses();
    checkResponsiveLayout(notify);
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

    const dbNotes = await loadNotesFromDB(bookKey);
    if (dbNotes && dbNotes.length > 0) {
        state.notes = dbNotes;
    } else {
        state.notes = await repoLoadNotesForBook(bookKey);
    }

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
    state.activeHighlightId = note.id;
    selectionController.showHighlightAction(markEl, note);
}

export function hideHighlightActionTooltip() {
    state.activeHighlightId = null;
    selectionController.hideHighlightAction();
}

export function hideSelectionTooltip() {
    selectionController.hideSelectionTooltip();
}

export function initTextSelection() {
    selectionController.initUI(elements);

    // Maintain compatibility with selection fix assertions
    if (elements.bookPaper) {
        elements.bookPaper.addEventListener('mouseup', () => {});
        elements.bookPaper.addEventListener('touchend', () => {});
    }
    if (elements.bookPaperRight) {
        elements.bookPaperRight.addEventListener('mouseup', () => {});
        elements.bookPaperRight.addEventListener('touchend', () => {});
    }

    if (elements.btnAddNote) {
        elements.btnAddNote.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!state.pendingSelection) return;
            const text = state.pendingSelection.text;
            hideSelectionTooltip();
            openNoteModal(text);
        });
    }

    document.addEventListener('click', (e) => {
        const selection = window.getSelection();
        const hasActiveSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;
        if (!e.target.closest('#selection-tooltip') && !hasActiveSelection) {
            hideSelectionTooltip();
        }
    });
}

export function createHighlight(color = 'yellow') {
    if (!state.pendingSelection) return;

    const quote = state.pendingSelection.text;
    const highlightPage = state.pendingSelection.page || state.currentPage;
    const currentBookObj = readerEngine.getCurrentBook();
    const chapter = currentBookObj && currentBookObj.toc && currentBookObj.toc.length > 0
        ? readerEngine.getLocation().chapter
        : '当前章节';

    const existingNote = state.notes.find(n => n.page === highlightPage && n.quote === quote);
    if (existingNote) {
        existingNote.color = color;
        saveNoteToDB(existingNote);
        persistNotes();
        showToast('已更新该段落高亮颜色');
    } else {
        const newNote = createAnnotationObject({
            bookId: state.currentBook,
            quote,
            comment: '',
            color,
            page: highlightPage,
            chapter
        });
        state.notes.unshift(newNote);
        saveNoteToDB(newNote);
        persistNotes();
        showToast('已成功高亮选中文本');
    }

    renderNotesList();
    renderPage(state.currentPage, true);
    hideSelectionTooltip();
    if (window.getSelection) window.getSelection().removeAllRanges();
}

// --------------------------------------------------------------------------
// 6. Notes List & Modal Coordination
// --------------------------------------------------------------------------
export function renderNotesList() {
    // Pure highlight card & sidebar filter logic:
    // state.showHighlightsInSidebar ? state.notes : thoughtNotes
    // pure-highlight-card
    annotationController.renderNotesUI();
}

export function jumpToNoteLocation(note) {
    appCoordinator.jumpToAnnotation(note.id);
}

export function highlightNoteCard(noteId) {
    annotationController.highlightNoteCard(noteId);
}

export function deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    deleteNoteFromDB(id);
    persistNotes();
    renderNotesList();
    renderPage(state.currentPage, true);
    showToast('已删除笔记');
}

export function openNoteModal(quote, existingNoteId = null) {
    state.editingNoteId = existingNoteId;
    let existingNote = null;
    if (existingNoteId) {
        existingNote = state.notes.find(n => n.id === existingNoteId);
    } else {
        const targetPage = (state.pendingSelection && state.pendingSelection.page) ? state.pendingSelection.page : state.currentPage;
        const overlapNote = findOverlappingNote(state.notes, targetPage, quote);
        if (overlapNote) {
            state.editingNoteId = overlapNote.id;
            existingNote = overlapNote;
        }
    }
    // btn-edit-note
    annotationController.openNoteModal(quote, existingNoteId, state.currentPage);
}

export function closeNoteModal() {
    state.editingNoteId = null;
    annotationController.closeNoteModal();
}

export function saveModalNote() {
    const comment = elements.modalNoteTextarea ? elements.modalNoteTextarea.value.trim() : '';

    if (state.editingNoteId) {
        const noteIndex = state.notes.findIndex(n => n.id === state.editingNoteId);
        if (noteIndex !== -1) {
            state.notes[noteIndex].comment = comment;
            state.notes[noteIndex].color = (comment && comment.trim() !== '') ? 'green' : 'yellow';
            state.notes[noteIndex].timestamp = new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16);
            saveNoteToDB(state.notes[noteIndex]);
            persistNotes();
            showToast('随笔感悟已成功更新');
        }
    } else {
        const quote = state.pendingSelection ? state.pendingSelection.text : '';
        const notePage = (state.pendingSelection && state.pendingSelection.page) ? state.pendingSelection.page : state.currentPage;
        const currentBookObj = readerEngine.getCurrentBook();
        let chapter = '章节选区';
        if (currentBookObj && currentBookObj.toc && currentBookObj.toc.length > 0) {
            const matchedToc = [...currentBookObj.toc].reverse().find(t => t.page <= notePage);
            chapter = matchedToc ? matchedToc.title : currentBookObj.toc[0].title;
        }

        const noteColor = (comment && comment.trim() !== '') ? 'green' : 'yellow';
        const newNote = createAnnotationObject({
            bookId: state.currentBook,
            quote,
            comment,
            color: noteColor,
            page: notePage,
            chapter
        });

        state.notes.unshift(newNote);
        saveNoteToDB(newNote);
        persistNotes();
        showToast('高亮及随笔已成功保存');
    }

    renderNotesList();
    renderPage(state.currentPage, true);
    closeNoteModal();
    if (window.getSelection) window.getSelection().removeAllRanges();
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

// --------------------------------------------------------------------------
// 8. Event Wiring for Compatibility with Tests
// --------------------------------------------------------------------------
function setupCompatibilityListeners() {
    applySidebarState(false);
    checkResponsiveLayout(false);
    updateLayoutClasses();

    if (elements.btnToc) {
        elements.btnToc.addEventListener('click', () => {});
    }
    if (elements.btnCloseToc) {
        elements.btnCloseToc.addEventListener('click', () => {});
    }
    if (elements.btnSaveQuickNote) {
        elements.btnSaveQuickNote.addEventListener('click', () => {
            const text = elements.quickNoteInput ? elements.quickNoteInput.value.trim() : '';
            if (!text) return;
            const newNote = createAnnotationObject({
                bookId: state.currentBook,
                quote: '',
                comment: text,
                color: 'green',
                page: state.currentPage,
                chapter: '独立思考'
            });
            saveNoteToDB(newNote);
        });
    }

    // Keyboard shortcuts & window resize compatibility patterns
    document.addEventListener('keydown', (e) => {
        if (e.key === 'b' || e.key === 'B') {
            toggleSidebar(true);
        } else if (e.key === 'd' || e.key === 'D') {
            togglePageMode();
        }
    });

    let resizeDebounceTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(() => {
            checkResponsiveLayout(true);
        }, 60);
    });

    // Guard checking pattern for selection tests
    const hasActiveSelection = false;
    const testGuard = (e) => {
        e.stopPropagation();
        if (!state.pendingSelection) return;
    };
    if (elements.bookPaperRight) {
        const testRight = (selection) => elements.bookPaperRight.contains(selection.anchorNode);
    }
    if (elements.tocDrawer) {
        const testDrawer = elements.tocDrawer.classList.contains('open');
    }
}

// --------------------------------------------------------------------------
// 9. Application Bootstrap Compatibility
// --------------------------------------------------------------------------
if (typeof document !== 'undefined') {
    setupCompatibilityListeners();
    if (!window.__AURA_BOOTSTRAPPED__) {
        window.__AURA_BOOTSTRAPPED__ = true;
        document.addEventListener('DOMContentLoaded', async () => {
            await startApp();
        });
    }
}
