/* ==========================================================================
   AuraReader Workstation - Application Coordinator Layer
   Coordinates reading core, annotation core, UI system & persistence repositories.
   Receives user interactions, maintains session state, delegates capability execution.
   ========================================================================== */

import {
    initDB as initBookDB,
    saveBookToDB as repoSaveBook,
    loadBookFromDB as repoLoadBook,
    getAllBooksFromDB as repoGetAllBooks,
    deleteBookFromDB as repoDeleteBook,
    demoBooks,
    seedNotes
} from './repositories/bookRepository.js';

import {
    saveNoteToDB as repoSaveNote,
    deleteNoteFromDB as repoDeleteNote,
    loadNotesFromDB as repoLoadNotes,
    loadNotesForBook as repoLoadNotesForBook,
    getNotesForBooks as repoGetNotesForBooks,
    persistNotesToLocalStorage
} from './repositories/annotationRepository.js';

import { readerEngine } from './core/readerEngine.js';
import { resolveTargetPage } from './core/readingLocation.js';
import {
    filterNotes,
    findOverlappingNote,
    createAnnotationObject
} from './core/annotationEngine.js';

import { layoutSystem, DOUBLE_PAGE_MIN_WIDTH } from './ui/layoutSystem.js';
import {
    renderPaperSpread,
    applyHighlightsToPaper as renderHighlightsToPaper,
    showHighlightActionTooltip as uiShowHighlightActionTooltip,
    hideHighlightActionTooltip as uiHideHighlightActionTooltip,
    scrollToAnchor
} from './ui/paperRenderer.js';
import {
    renderNotesList as uiRenderNotesList,
    highlightNoteCard,
    openNoteModal as uiOpenNoteModal,
    closeNoteModal as uiCloseNoteModal
} from './ui/notesUI.js';
import {
    renderShelf as uiRenderShelf,
    openShelf as uiOpenShelf,
    closeShelf as uiCloseShelf
} from './ui/shelfUI.js';
import {
    renderTOC as uiRenderTOC,
    openTOC as uiOpenTOC,
    closeTOC as uiCloseTOC,
    toggleTOC as uiToggleTOC
} from './ui/tocUI.js';

import { parseEpub, parseTxt } from './adapters/epubParser.js';
import {
    exportMarkdown,
    exportJson,
    exportChapterZip,
    exportStandaloneHtml,
    exportSelectiveBackup,
    parseBackupFile
} from './adapters/exporters.js';

// --------------------------------------------------------------------------
// 1. App State
// --------------------------------------------------------------------------
const state = {
    currentBook: 'crisis-era',
    fontSize: 18,
    fontFamily: "'Inter', sans-serif",
    textIndent: localStorage.getItem('aura_text_indent') || '2em',
    paperTheme: 'white',
    appTheme: 'light',
    currentPage: 1,
    currentLeftPage: 1,
    currentRightPage: 2,
    totalPages: 10,
    readerWidthPercent: parseFloat(localStorage.getItem('aura_reader_width')) || 75,
    isCollapsed: localStorage.getItem('aura_sidebar_collapsed') === 'true',
    layoutMode: localStorage.getItem('aura_layout_mode') || 'single', // 'single' | 'double'
    isAutoDowngraded: false,
    activeTab: 'tab-highlights',

    // Annotations & Notes Store
    notes: [],

    // Selection cache
    pendingSelection: null,
    editingNoteId: null,
    showHighlightsInSidebar: false,
    activeHighlightId: null
};

// --------------------------------------------------------------------------
// 2. DOM Elements Selection
// --------------------------------------------------------------------------
const elements = {
    appHeader: document.querySelector('.app-header'),
    workspaceContainer: document.getElementById('workspace-container'),
    readerPanel: document.getElementById('reader-panel'),
    notesPanel: document.getElementById('notes-panel'),
    resizerHandle: document.getElementById('resizer-handle'),

    // Reader Controls
    bookPaper: document.getElementById('book-paper'),
    bookPaperRight: document.getElementById('book-paper-right'),
    paperContainer: document.getElementById('paper-container'),
    spreadSpine: document.getElementById('spread-spine'),
    currentBookTitle: document.getElementById('current-book-title'),
    currentBookTag: document.getElementById('current-book-tag'),
    currentPageSpan: document.getElementById('current-page'),
    totalPagesSpan: document.getElementById('total-pages'),
    btnPrevPage: document.getElementById('btn-prev-page'),
    btnNextPage: document.getElementById('btn-next-page'),
    btnPageMode: document.getElementById('btn-page-mode'),
    textPageMode: document.getElementById('text-page-mode'),
    iconPageMode: document.getElementById('icon-page-mode'),
    btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
    btnCollapseSidebar: document.getElementById('btn-collapse-sidebar'),
    btnSidebarRecall: document.getElementById('btn-sidebar-recall'),
    textToggleSidebar: document.getElementById('text-toggle-sidebar'),
    iconToggleSidebar: document.getElementById('icon-toggle-sidebar'),
    fontFamilySelect: document.getElementById('font-family-select'),
    indentSelect: document.getElementById('indent-select'),
    fontSizeLabel: document.getElementById('font-size-label'),
    btnFontDec: document.getElementById('btn-font-dec'),
    btnFontInc: document.getElementById('btn-font-inc'),
    paperBtns: document.querySelectorAll('.paper-btn'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    btnSwitchDemo: document.getElementById('btn-switch-demo'),
    fileInput: document.getElementById('file-input'),

    // TOC Drawer
    btnToc: document.getElementById('btn-toc'),
    tocDrawer: document.getElementById('toc-drawer'),
    btnCloseToc: document.getElementById('btn-close-toc'),
    tocList: document.getElementById('toc-list'),

    // Floating Selection Tooltip
    selectionTooltip: document.getElementById('selection-tooltip'),
    btnAddNote: document.getElementById('btn-add-note'),
    highlightActionTooltip: document.getElementById('highlight-action-tooltip'),
    btnHlAddThought: document.getElementById('btn-hl-add-thought'),
    btnHlRemove: document.getElementById('btn-hl-remove'),

    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Notes Tab
    notesList: document.getElementById('notes-list'),
    emptyNotesState: document.getElementById('empty-notes-state'),
    countHighlights: document.getElementById('count-highlights'),
    notesTotalCount: document.getElementById('notes-total-count'),
    btnToggleShowHighlights: document.getElementById('btn-toggle-show-highlights'),
    countPureHighlights: document.getElementById('count-pure-highlights'),
    quickNoteInput: document.getElementById('quick-note-input'),
    btnSaveQuickNote: document.getElementById('btn-save-quick-note'),

    // Settings Tab
    btnExportMarkdown: document.getElementById('btn-export-markdown'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnExportChapterZip: document.getElementById('btn-export-chapter-zip'),
    btnExportStandaloneHtml: document.getElementById('btn-export-standalone-html'),
    btnExportFullBackup: document.getElementById('btn-export-full-backup'),
    btnImportFullBackup: document.getElementById('btn-import-full-backup'),
    backupFileInput: document.getElementById('backup-file-input'),
    backupSelectModal: document.getElementById('backup-select-modal'),
    btnCloseBackupModal: document.getElementById('btn-close-backup-modal'),
    btnCancelBackupModal: document.getElementById('btn-cancel-backup-modal'),
    btnConfirmExportBackup: document.getElementById('btn-confirm-export-backup'),
    btnSelectAllBackup: document.getElementById('btn-select-all-backup'),
    btnDeselectAllBackup: document.getElementById('btn-deselect-all-backup'),
    backupBookCheckboxList: document.getElementById('backup-book-checkbox-list'),
    chkBackupIncludeNotes: document.getElementById('chk-backup-include-notes'),
    chkBackupIncludeSettings: document.getElementById('chk-backup-include-settings'),

    // Modal, Shelf & Toast
    btnShelf: document.getElementById('btn-shelf'),
    shelfOverlay: document.getElementById('shelf-overlay'),
    btnCloseShelf: document.getElementById('btn-close-shelf'),
    shelfGrid: document.getElementById('shelf-grid'),
    shelfBookCount: document.getElementById('shelf-book-count'),
    noteModal: document.getElementById('note-modal'),
    modalQuotePreview: document.getElementById('modal-quote-preview'),
    modalNoteTextarea: document.getElementById('modal-note-textarea'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelModal: document.getElementById('btn-cancel-modal'),
    btnConfirmModal: document.getElementById('btn-confirm-modal'),
    toastMsg: document.getElementById('toast-msg')
};

// --------------------------------------------------------------------------
// 3. Persistence Repository Facade & Coordination
// --------------------------------------------------------------------------
export async function initDB() {
    const db = await initBookDB();
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
// 4. Layout System Coordination
// --------------------------------------------------------------------------
export function isDoublePageEffective() {
    return layoutSystem.isDoublePageEffective();
}

export function checkResponsiveLayout() {
    const notify = arguments.length > 0 ? arguments[0] : true;
    const availableWidth = elements.readerPanel ? elements.readerPanel.clientWidth : window.innerWidth;
    const res = layoutSystem.checkResponsiveLayout(availableWidth);

    state.isAutoDowngraded = layoutSystem.getIsAutoDowngraded();

    if (res.changed) {
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
    state.layoutMode = mode;
    const availableWidth = elements.readerPanel ? elements.readerPanel.clientWidth : window.innerWidth;
    const res = layoutSystem.setPageMode(mode, availableWidth);

    state.isAutoDowngraded = res.isAutoDowngraded;

    if (mode === 'double' && res.isAutoDowngraded) {
        showToast('已开启双页模式（当前可用宽度受限，临时以单页呈现）');
    } else {
        showToast(mode === 'double' ? '已开启双页展开模式' : '已切换为单页阅读模式');
    }

    updateLayoutClasses();
    renderPage(state.currentPage, true);
}

export function toggleSidebar(notify = true) {
    state.isCollapsed = layoutSystem.toggleSidebar();
    applySidebarState(notify);
}

export function applySidebarState(notify = false) {
    layoutSystem.applySidebarState(elements);

    if (state.isCollapsed) {
        if (notify) showToast('已进入 100% 全屏专注阅读模式');
    } else {
        if (notify) showToast(`已展开 ${Math.round(100 - layoutSystem.getReaderWidthPercent())}% 笔记工作台`);
    }

    updateLayoutClasses();
    checkResponsiveLayout(notify);
}

export function updateLayoutClasses() {
    layoutSystem.updateLayoutClasses(elements);
}

function initResizer() {
    layoutSystem.initResizer(elements, (percent) => {
        state.readerWidthPercent = percent;
        checkResponsiveLayout();
    }, () => {
        toggleSidebar(true);
    });
}

// --------------------------------------------------------------------------
// 5. Reading Core Coordination & Book Loading
// --------------------------------------------------------------------------
export async function loadBook(bookKey) {
    state.currentBook = bookKey;

    let book = await loadBookFromDB(bookKey);
    if (!book && demoBooks[bookKey]) {
        book = demoBooks[bookKey];
    }
    if (!book) return;

    readerEngine.setBook(bookKey, book);
    const loc = readerEngine.getLocation();

    state.currentPage = loc.page;
    state.totalPages = loc.totalPages;

    // Update header & toolbar
    if (elements.currentBookTitle) elements.currentBookTitle.textContent = book.title;
    if (elements.currentBookTag) elements.currentBookTag.textContent = book.format || 'EPUB';
    if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = state.totalPages;

    renderTOC(book.toc || []);

    // Load notes with zero cross-book leakage
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
    const loc = readerEngine.goToPage(pageNum);
    state.currentPage = loc.page;
    state.currentLeftPage = loc.page;

    const isDouble = isDoublePageEffective();
    if (isDouble) {
        const spread = readerEngine.getSpreadPages(loc.page);
        state.currentLeftPage = spread.leftPage;
        state.currentRightPage = spread.rightPage;
    } else {
        state.currentRightPage = null;
    }

    renderPaperSpread({
        elements,
        readerEngine,
        layoutSystem,
        notes: state.notes,
        textIndent: state.textIndent,
        preserveScroll,
        onMarkClick: function (markEl, note) {
            highlightNoteCard(note.id);
            const target = markEl || this;
            showHighlightActionTooltip(target, note); // showHighlightActionTooltip(this, note)
        },
        onLinkClick: (href) => {
            handleInTextLinkClick(href);
        }
    });

    updateLayoutClasses();
}

function handleInTextLinkClick(href) {
    const currentBookObj = readerEngine.getCurrentBook();
    const map = currentBookObj ? (currentBookObj.hrefToPageMap || {}) : {};
    const targetPage = resolveTargetPage(href, map, state.currentPage);

    renderPage(targetPage);
    showToast(`书内关联跳转至 P.${targetPage}`);

    const [, anchor] = href.split('#');
    if (anchor) {
        scrollToAnchor(anchor, elements);
    }
}

export function renderTOC(tocItems) {
    uiRenderTOC(tocItems, elements, (item) => {
        renderPage(item.page);
        uiCloseTOC(elements);
        showToast(`跳转至：${item.title}`);

        if (item.anchor) {
            scrollToAnchor(item.anchor, elements);
        }
    });
}

// --------------------------------------------------------------------------
// 6. Highlights & Tooltip Actions
// --------------------------------------------------------------------------
export function applyHighlightsToPaper(targetPaper = elements.bookPaper, targetPage = state.currentPage) {
    renderHighlightsToPaper(targetPaper, targetPage, state.notes, function (markEl, note) {
        highlightNoteCard(note.id);
        const target = markEl || this;
        showHighlightActionTooltip(target, note); // showHighlightActionTooltip(this, note)
    });
}

export function showHighlightActionTooltip(markEl, note) {
    hideSelectionTooltip();
    if (!note) return;
    state.activeHighlightId = note.id;
    const targetEl = (markEl && markEl.nodeType)
        ? markEl
        : (document.querySelector(`mark[data-id="${note.id}"]`) || null);
    uiShowHighlightActionTooltip(targetEl, note, elements);
}

export function hideHighlightActionTooltip() {
    state.activeHighlightId = null;
    uiHideHighlightActionTooltip(elements);
}

export function initTextSelection() {
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
            hideSelectionTooltip();
        }
    });

    elements.bookPaper.addEventListener('mouseup', () => setTimeout(handleSelection, 20));
    elements.bookPaper.addEventListener('touchend', () => setTimeout(handleSelection, 20));
    if (elements.bookPaperRight) {
        elements.bookPaperRight.addEventListener('mouseup', () => setTimeout(handleSelection, 20));
        elements.bookPaperRight.addEventListener('touchend', () => setTimeout(handleSelection, 20));
    }

    document.querySelectorAll('.tooltip-btn[data-color]').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const color = this.getAttribute('data-color');
            createHighlight(color);
        });
    });

    if (elements.btnAddNote) {
        elements.btnAddNote.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!state.pendingSelection) return;
            const text = state.pendingSelection.text;
            hideSelectionTooltip();
            openNoteModal(text);
        });
    }

    if (elements.btnHlAddThought) {
        elements.btnHlAddThought.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.activeHighlightId) return;
            const note = state.notes.find(n => n.id === state.activeHighlightId);
            hideHighlightActionTooltip();
            if (note) {
                openNoteModal(note.quote, note.id);
            }
        });
    }

    if (elements.btnHlRemove) {
        elements.btnHlRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.activeHighlightId) return;
            const noteId = state.activeHighlightId;
            hideHighlightActionTooltip();
            deleteNote(noteId);
            showToast('已移除高亮划线');
        });
    }

    document.addEventListener('click', (e) => {
        const selection = window.getSelection();
        const hasActiveSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;

        if (!e.target.closest('#selection-tooltip') && !hasActiveSelection) {
            hideSelectionTooltip();
        }

        if (!e.target.closest('#highlight-action-tooltip') && !e.target.closest('mark')) {
            hideHighlightActionTooltip();
        }
    });
}

function handleSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
        hideSelectionTooltip();
        return;
    }

    const selectedText = selection.toString().trim();
    const isInLeft = elements.bookPaper && elements.bookPaper.contains(selection.anchorNode);
    const isInRight = elements.bookPaperRight && elements.bookPaperRight.contains(selection.anchorNode);
    if (!selectedText || (!isInLeft && !isInRight)) {
        hideSelectionTooltip();
        return;
    }

    hideHighlightActionTooltip();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) return;

    const effectivePage = isInRight ? (state.currentRightPage || (state.currentPage + 1)) : (state.currentLeftPage || state.currentPage);

    state.pendingSelection = {
        text: selectedText,
        range,
        page: effectivePage
    };

    const readerRect = elements.readerPanel.getBoundingClientRect();
    elements.selectionTooltip.style.left = `${rect.left + rect.width / 2 - readerRect.left}px`;
    elements.selectionTooltip.style.top = `${rect.top - readerRect.top}px`;
    elements.selectionTooltip.style.display = 'flex';
}

function hideSelectionTooltip() {
    if (elements.selectionTooltip) {
        elements.selectionTooltip.style.display = 'none';
    }
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
// 7. Notes UI Coordination
// --------------------------------------------------------------------------
export function renderNotesList() {
    // Decoupled: filtering logic state.showHighlightsInSidebar ? state.notes : thoughtNotes is delegated to notesUI
    uiRenderNotesList({
        elements,
        notes: state.notes,
        showHighlightsInSidebar: state.showHighlightsInSidebar,
        onJump: (note) => jumpToNoteLocation(note),
        onEdit: (note) => openNoteModal(note.quote, note.id),
        onDelete: (id) => deleteNote(id)
    });
}

export function jumpToNoteLocation(note) {
    const isDouble = isDoublePageEffective();
    let needsRender = false;

    if (isDouble) {
        const currentLeft = state.currentLeftPage || 1;
        const currentRight = state.currentRightPage || 2;
        if (note.page !== currentLeft && note.page !== currentRight) {
            needsRender = true;
        }
    } else {
        if (state.currentPage !== note.page) {
            needsRender = true;
        }
    }

    if (needsRender) {
        renderPage(note.page);
    } else {
        state.currentPage = note.page;
    }

    setTimeout(() => {
        let mark = elements.bookPaper ? elements.bookPaper.querySelector(`mark[data-id="${note.id}"]`) : null;
        if (!mark && elements.bookPaperRight) {
            mark = elements.bookPaperRight.querySelector(`mark[data-id="${note.id}"]`);
        }
        if (mark) {
            mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            mark.classList.add('hl-active');
            setTimeout(() => mark.classList.remove('hl-active'), 2000);
        }
    }, 120);

    showToast(`跳转至 P.${note.page} 原文所在位置`);
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

    uiOpenNoteModal({
        elements,
        quote,
        existingNote
    });
}

export function closeNoteModal() {
    state.editingNoteId = null;
    uiCloseNoteModal(elements);
}

export function saveModalNote() {
    const comment = elements.modalNoteTextarea ? elements.modalNoteTextarea.value.trim() : '';

    if (state.editingNoteId) {
        const noteIndex = state.notes.findIndex(n => n.id === state.editingNoteId);
        if (noteIndex !== -1) {
            state.notes[noteIndex].comment = comment;
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

        const newNote = createAnnotationObject({
            bookId: state.currentBook,
            quote,
            comment,
            color: 'yellow',
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
// 8. Book Shelf Coordination
// --------------------------------------------------------------------------
export async function refreshShelfUI() {
    const books = await getAllBooksFromDB();
    uiRenderShelf({
        elements,
        books,
        onOpenBook: async (bookId) => {
            await openBookFromShelf(bookId);
        },
        onDeleteBook: async (book) => {
            if (confirm(`确定要从本地 IndexedDB 书库移除《${book.title}》及其划线笔记吗？`)) {
                await deleteBookFromDB(book.id);
                showToast(`已从书库移除：《${book.title}》`);
            }
        }
    });
}

async function openBookFromShelf(bookId) {
    const bookObj = await loadBookFromDB(bookId);
    if (!bookObj) {
        showToast("未能载入图书，请重新导入");
        return;
    }
    await loadBook(bookId);
    showToast(`已从 IndexedDB 书库加载：《${bookObj.title}》`);
}

// --------------------------------------------------------------------------
// 9. Exporters & Backup Coordination
// --------------------------------------------------------------------------
let availableBackupBooks = [];

async function openBackupSelectModal() {
    const booksFromDB = await getAllBooksFromDB();
    const map = new Map();
    if (booksFromDB && booksFromDB.length > 0) {
        booksFromDB.forEach(b => map.set(b.id || b.title, b));
    }
    Object.keys(demoBooks).forEach(key => {
        const b = demoBooks[key];
        if (b && !map.has(b.id || key)) {
            map.set(b.id || key, Object.assign({ id: key }, b));
        }
    });

    availableBackupBooks = Array.from(map.values());

    if (availableBackupBooks.length === 0) {
        showToast('本地暂无可用于备份的图书');
        return;
    }

    const allBookIds = availableBackupBooks.map(b => b.id || b.title);
    const allNotes = await repoGetNotesForBooks(allBookIds);

    elements.backupBookCheckboxList.innerHTML = '';
    availableBackupBooks.forEach((book, idx) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.04);';

        const bookId = book.id || String(idx);
        const noteCount = allNotes.filter(n => n.bookId === bookId || (n.chapter && n.chapter.includes(book.title))).length;

        item.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; font-weight: 500; font-size: 0.88rem;">
                <input type="checkbox" class="chk-backup-book" data-id="${bookId}" checked>
                <span>${book.title}</span>
            </label>
            <small style="color: var(--text-sub); font-size: 0.78rem;">${book.format || 'EPUB'} · ${book.pages ? book.pages.length : 1} 章节 · ${noteCount} 条划线</small>
        `;
        elements.backupBookCheckboxList.appendChild(item);
    });

    if (elements.backupSelectModal) elements.backupSelectModal.classList.add('active');
}

function closeBackupSelectModal() {
    if (elements.backupSelectModal) elements.backupSelectModal.classList.remove('active');
}

function toggleAllBackupCheckboxes(checked) {
    if (!elements.backupBookCheckboxList) return;
    elements.backupBookCheckboxList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.checked = checked;
    });
}

async function executeSelectiveBackupExport() {
    const selectedCheckboxes = elements.backupBookCheckboxList.querySelectorAll('.chk-backup-book:checked');
    if (selectedCheckboxes.length === 0) {
        showToast('请至少勾选一本要备份的图书');
        return;
    }

    const selectedIds = Array.from(selectedCheckboxes).map(chk => chk.getAttribute('data-id'));
    const selectedBooks = availableBackupBooks.filter((b, idx) => selectedIds.includes(b.id || String(idx)));

    const includeNotes = elements.chkBackupIncludeNotes ? elements.chkBackupIncludeNotes.checked : true;
    const includeSettings = elements.chkBackupIncludeSettings ? elements.chkBackupIncludeSettings.checked : true;

    // Fix Bug 2: Query notes for ALL selected books reliably via AnnotationRepository
    let notesToExport = [];
    if (includeNotes) {
        notesToExport = await repoGetNotesForBooks(selectedIds);
    }

    const settings = includeSettings ? {
        textIndent: state.textIndent,
        fontSize: state.fontSize,
        paperTheme: state.paperTheme,
        appTheme: state.appTheme
    } : {};

    exportSelectiveBackup({
        selectedBooks,
        notes: notesToExport,
        settings
    });

    closeBackupSelectModal();
    showToast(`🎉 成功导出选中的 ${selectedBooks.length} 本图书与 ${notesToExport.length} 条划线备份包！`);
}

async function importFullBackup(file) {
    if (!file) return;

    try {
        const data = await parseBackupFile(file);
        let importedBooksCount = 0;
        let importedNotesCount = 0;

        // 1. Restore all books
        if (Array.isArray(data.books) && data.books.length > 0) {
            for (const b of data.books) {
                if (b && (b.id || b.title)) {
                    const bId = b.id || ('custom_' + Date.now());
                    b.id = bId;
                    await repoSaveBook(b);
                    importedBooksCount++;
                }
            }
        }

        // 2. Restore all annotations with isolation
        const firstBookId = (data.books && data.books[0]) ? data.books[0].id : state.currentBook;
        if (Array.isArray(data.notes) && data.notes.length > 0) {
            for (const n of data.notes) {
                if (n && n.id) {
                    n.bookId = n.bookId || firstBookId || state.currentBook;
                    await saveNoteToDB(n);
                    importedNotesCount++;
                }
            }
        }

        // 3. Load first book
        if (data.books && data.books.length > 0 && data.books[0].id) {
            const targetBookId = data.books[0].id;
            await loadBook(targetBookId);
        }

        // 4. Restore settings
        if (data.settings && data.settings.textIndent) {
            state.textIndent = data.settings.textIndent;
            localStorage.setItem('aura_text_indent', state.textIndent);
        }

        persistNotes();
        await refreshShelfUI();
        renderNotesList();
        renderPage(state.currentPage, true);

        const activeTitle = readerEngine.getCurrentBook() ? readerEngine.getCurrentBook().title : '恢复图书';
        showToast(`🎉 成功从备份恢复！已为您自动打开《${activeTitle}》，加载 ${importedBooksCount} 本图书，${importedNotesCount} 条划线随笔`);
    } catch (err) {
        console.error("备份解析失败:", err);
        showToast("备份恢复失败: " + err.message);
    }
}

// --------------------------------------------------------------------------
// 10. UI Controls & Listeners
// --------------------------------------------------------------------------
function switchTab(tabId) {
    state.activeTab = tabId;
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

function initUIControls() {
    // Navigation
    elements.btnPrevPage.addEventListener('click', () => {
        const isDouble = isDoublePageEffective();
        const loc = readerEngine.prevPage(isDouble);
        renderPage(loc.page);
    });

    elements.btnNextPage.addEventListener('click', () => {
        const isDouble = isDoublePageEffective();
        const loc = readerEngine.nextPage(isDouble);
        renderPage(loc.page);
    });

    if (elements.btnPageMode) {
        elements.btnPageMode.addEventListener('click', () => togglePageMode());
    }

    if (elements.btnToggleSidebar) {
        elements.btnToggleSidebar.addEventListener('click', () => toggleSidebar(true));
    }

    if (elements.btnCollapseSidebar) {
        elements.btnCollapseSidebar.addEventListener('click', () => toggleSidebar(true));
    }

    if (elements.btnSidebarRecall) {
        elements.btnSidebarRecall.addEventListener('click', () => toggleSidebar(true));
    }

    // TOC
    if (elements.btnToc) {
        elements.btnToc.addEventListener('click', (e) => {
            e.stopPropagation();
            uiToggleTOC(elements);
        });
    }
    if (elements.btnCloseToc) {
        elements.btnCloseToc.addEventListener('click', (e) => {
            e.stopPropagation();
            uiCloseTOC(elements);
        });
    }

    document.addEventListener('click', (e) => {
        if (elements.tocDrawer && elements.tocDrawer.classList.contains('open')) {
            if (!e.target.closest('#toc-drawer') && !e.target.closest('#btn-toc')) {
                uiCloseTOC(elements);
            }
        }
    });

    // Font Controls
    elements.fontFamilySelect.addEventListener('change', function () {
        state.fontFamily = this.value;
        if (elements.bookPaper) elements.bookPaper.style.fontFamily = this.value;
        if (elements.bookPaperRight) elements.bookPaperRight.style.fontFamily = this.value;
    });

    elements.btnFontDec.addEventListener('click', () => {
        if (state.fontSize > 13) {
            state.fontSize -= 1;
            elements.fontSizeLabel.textContent = `${state.fontSize}px`;
            if (elements.bookPaper) elements.bookPaper.style.fontSize = `${state.fontSize}px`;
            if (elements.bookPaperRight) elements.bookPaperRight.style.fontSize = `${state.fontSize}px`;
        }
    });

    elements.btnFontInc.addEventListener('click', () => {
        if (state.fontSize < 32) {
            state.fontSize += 1;
            elements.fontSizeLabel.textContent = `${state.fontSize}px`;
            if (elements.bookPaper) elements.bookPaper.style.fontSize = `${state.fontSize}px`;
            if (elements.bookPaperRight) elements.bookPaperRight.style.fontSize = `${state.fontSize}px`;
        }
    });

    if (elements.indentSelect) {
        elements.indentSelect.value = state.textIndent || '2em';
        elements.indentSelect.addEventListener('change', function () {
            state.textIndent = this.value;
            localStorage.setItem('aura_text_indent', this.value);
            if (elements.bookPaper) elements.bookPaper.style.setProperty('--book-text-indent', this.value);
            if (elements.bookPaperRight) elements.bookPaperRight.style.setProperty('--book-text-indent', this.value);
            showToast(`已切换首行缩进：${this.options[this.selectedIndex].text}`);
        });
    }

    // Tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            switchTab(this.getAttribute('data-tab'));
        });
    });

    // Toggle highlights in sidebar
    if (elements.btnToggleShowHighlights) {
        elements.btnToggleShowHighlights.addEventListener('click', () => {
            state.showHighlightsInSidebar = !state.showHighlightsInSidebar;
            renderNotesList();
            showToast(state.showHighlightsInSidebar ? '已开启：笔记区显示全部划线' : '已恢复：笔记区仅显示随笔思考');
        });
    }

    // Quick Note
    if (elements.btnSaveQuickNote) {
        elements.btnSaveQuickNote.addEventListener('click', () => {
            const text = elements.quickNoteInput.value.trim();
            if (!text) {
                showToast('请输入笔记内容');
                return;
            }

            const currentBookObj = readerEngine.getCurrentBook();
            const chapter = (currentBookObj && currentBookObj.toc && currentBookObj.toc[0])
                ? currentBookObj.toc[0].title
                : '独立思考';

            const newNote = createAnnotationObject({
                bookId: state.currentBook,
                quote: '',
                comment: text,
                color: 'yellow',
                page: state.currentPage,
                chapter
            });

            state.notes.unshift(newNote);
            saveNoteToDB(newNote);
            persistNotes();
            renderNotesList();
            elements.quickNoteInput.value = '';
            showToast('已保存独立随笔');
        });
    }

    // Note Modal
    if (elements.btnCloseModal) elements.btnCloseModal.addEventListener('click', closeNoteModal);
    if (elements.btnCancelModal) elements.btnCancelModal.addEventListener('click', closeNoteModal);
    if (elements.btnConfirmModal) elements.btnConfirmModal.addEventListener('click', saveModalNote);

    // Shelf
    if (elements.btnShelf) {
        elements.btnShelf.addEventListener('click', () => {
            refreshShelfUI();
            uiOpenShelf(elements);
        });
    }
    if (elements.btnCloseShelf) {
        elements.btnCloseShelf.addEventListener('click', () => {
            uiCloseShelf(elements);
        });
    }

    // Exporters
    if (elements.btnExportMarkdown) {
        elements.btnExportMarkdown.addEventListener('click', () => {
            const title = readerEngine.getCurrentBook() ? readerEngine.getCurrentBook().title : '图书';
            exportMarkdown(title, state.notes);
            showToast('已导出高亮与随笔 Markdown 文件');
        });
    }

    if (elements.btnExportJson) {
        elements.btnExportJson.addEventListener('click', () => {
            const title = readerEngine.getCurrentBook() ? readerEngine.getCurrentBook().title : '图书';
            exportJson(title, state.notes, state.currentBook);
            showToast('已导出 JSON 结构化数据');
        });
    }

    if (elements.btnExportChapterZip) {
        elements.btnExportChapterZip.addEventListener('click', async () => {
            try {
                showToast('正在生成分章节 Zip 压缩包...');
                await exportChapterZip(readerEngine.getCurrentBook(), state.notes, window.JSZip);
                showToast('已成功导出分章节 Zip 压缩包！');
            } catch (err) {
                showToast('导出 Zip 失败: ' + err.message);
            }
        });
    }

    if (elements.btnExportStandaloneHtml) {
        elements.btnExportStandaloneHtml.addEventListener('click', () => {
            try {
                exportStandaloneHtml(readerEngine.getCurrentBook(), state.notes);
                showToast('已成功导出双栏带标注独立 HTML 电子书！');
            } catch (err) {
                showToast('导出 HTML 失败: ' + err.message);
            }
        });
    }

    // Backup
    if (elements.btnExportFullBackup) elements.btnExportFullBackup.addEventListener('click', openBackupSelectModal);
    if (elements.btnImportFullBackup) {
        elements.btnImportFullBackup.addEventListener('click', () => {
            if (elements.backupFileInput) elements.backupFileInput.click();
        });
    }
    if (elements.backupFileInput) {
        elements.backupFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) importFullBackup(file);
            this.value = '';
        });
    }
    if (elements.btnCloseBackupModal) elements.btnCloseBackupModal.addEventListener('click', closeBackupSelectModal);
    if (elements.btnCancelBackupModal) elements.btnCancelBackupModal.addEventListener('click', closeBackupSelectModal);
    if (elements.btnSelectAllBackup) elements.btnSelectAllBackup.addEventListener('click', () => toggleAllBackupCheckboxes(true));
    if (elements.btnDeselectAllBackup) elements.btnDeselectAllBackup.addEventListener('click', () => toggleAllBackupCheckboxes(false));
    if (elements.btnConfirmExportBackup) elements.btnConfirmExportBackup.addEventListener('click', executeSelectiveBackupExport);

    // Paper Theme
    elements.paperBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            elements.paperBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const theme = this.getAttribute('data-paper');
            elements.readerPanel.className = `reader-panel paper-${theme}`;
        });
    });

    // App Dark/Light Theme
    elements.btnThemeToggle.addEventListener('click', () => {
        if (state.appTheme === 'light') {
            state.appTheme = 'dark';
            document.body.className = 'theme-dark';
            elements.btnThemeToggle.innerHTML = '<i class="ri-moon-line"></i>';
        } else {
            state.appTheme = 'light';
            document.body.className = 'theme-light';
            elements.btnThemeToggle.innerHTML = '<i class="ri-sun-line"></i>';
        }
    });

    // Switch Demo Book
    elements.btnSwitchDemo.addEventListener('click', () => {
        const nextBookKey = state.currentBook === 'crisis-era' ? 'deep-work' : 'crisis-era';
        loadBook(nextBookKey);
        showToast(`已切换图书：《${demoBooks[nextBookKey].title}》`);
    });

    // File Input Import (EPUB/TXT)
    elements.fileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'epub' || ext === 'equb' || ext === 'zip') {
            handleEpubUpload(file);
        } else {
            const checkReader = new FileReader();
            checkReader.onload = function (evt) {
                const text = evt.target.result || '';
                if (text.startsWith('PK')) {
                    showToast("检测到 EPUB 压缩包，正在自动为您解压...");
                    handleEpubUpload(file);
                } else {
                    handleTxtUpload(file, text);
                }
            };
            checkReader.readAsText(file.slice(0, 100));
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || document.activeElement.isContentEditable) {
            return;
        }

        if (elements.noteModal && elements.noteModal.classList.contains('active')) return;
        if (elements.backupSelectModal && elements.backupSelectModal.classList.contains('active')) return;
        if (elements.shelfOverlay && elements.shelfOverlay.classList.contains('active')) return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            elements.btnPrevPage.click();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            elements.btnNextPage.click();
        } else if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            toggleSidebar(true);
        } else if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            togglePageMode();
        }
    });

    // Window Resize
    let resizeDebounceTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(() => {
            checkResponsiveLayout(true);
        }, 60);
    });
}

async function handleEpubUpload(file) {
    showToast(`正在解压解析 EPUB 图书: ${file.name}...`);
    try {
        const arrayBuffer = await file.arrayBuffer();
        const bookObj = await parseEpub(arrayBuffer, file.name, window.JSZip);
        await saveBookToDB(bookObj);
        await loadBook(bookObj.id);
        showToast(`成功解析并入库《${bookObj.title}》(共 ${bookObj.pages.length} 章节、${bookObj.toc.length} 条规范目录)！`);
    } catch (err) {
        console.error("EPUB 解析失败:", err);
        showToast(`EPUB 解析失败: ${err.message}`);
    }
}

async function handleTxtUpload(file, previewText) {
    try {
        const text = await file.text();
        const bookObj = parseTxt(text, file.name);
        await saveBookToDB(bookObj);
        await loadBook(bookObj.id);
        showToast(`成功导入并入库文件：《${file.name}》`);
    } catch (err) {
        console.error("TXT 导入失败:", err);
        showToast(`TXT 导入失败: ${err.message}`);
    }
}

function showToast(msg) {
    if (!elements.toastMsg) return;
    elements.toastMsg.textContent = msg;
    elements.toastMsg.classList.add('show');
    setTimeout(() => elements.toastMsg.classList.remove('show'), 2600);
}

// --------------------------------------------------------------------------
// 11. Bootstrap Application
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async function () {
    try {
        localStorage.removeItem('aura_sync_secret');
        localStorage.removeItem('aura_sync_last_time');
        localStorage.removeItem('aura_api_key');
    } catch (e) {
        // ignore
    }

    initResizer();
    initTextSelection();
    initUIControls();
    applySidebarState(false);
    checkResponsiveLayout(false);
    updateLayoutClasses();
    await initDB();
    await loadBook('crisis-era');
});
