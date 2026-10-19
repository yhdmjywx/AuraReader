/* ==========================================================================
   AuraReader Workstation - Main Application Bootstrap Layer
   Responsible ONLY for application lifecycle, module wiring, dependency injection,
   state restoration, and initial launch.
   Does NOT perform direct DOM rendering, pagination, or note persistence itself.
   ========================================================================== */

import { initDB } from './infrastructure/bookRepository.js';
import { Session } from './app/session.js';
import { LayoutController } from './features/layout/layoutController.js';
import { positionMarginNotes } from './features/layout/marginNotesLayout.js';
import { ReaderEngine, readerEngine } from './domain/readerEngine.js';
import { ReaderController } from './features/reader/readerController.js';
import { AnnotationController } from './features/annotations/annotationController.js';
import { SelectionController } from './features/annotations/selectionController.js';
import { ShelfController } from './features/shelf/shelfController.js';
import { BackupController } from './features/backup/backupController.js';
import { AppShell } from './app/appShell.js';
import { AppCoordinator } from './app/appCoordinator.js';

export function queryElements() {
    if (typeof document === 'undefined') return {};
    return {
        appHeader: document.querySelector('.app-header'),
        workspaceContainer: document.getElementById('workspace-container'),
        readerPanel: document.getElementById('reader-panel'),
        notesPanel: document.getElementById('notes-panel'),

        // Reader Controls
        bookPaper: document.getElementById('book-paper'),
        bookPaperRight: document.getElementById('book-paper-right'),
        paperContainer: document.getElementById('paper-container'),
        spreadSpine: document.getElementById('spread-spine'),
        currentBookTitle: document.getElementById('current-book-title'),
        currentPageSpan: document.getElementById('current-page'),
        totalPagesSpan: document.getElementById('total-pages'),
        pageUnit: document.getElementById('page-unit'),
        btnModeScroll: document.getElementById('btn-mode-scroll'),
        btnPrevPage: document.getElementById('btn-prev-page'),
        btnNextPage: document.getElementById('btn-next-page'),
        btnPageMode: document.getElementById('btn-page-mode'),
        textPageMode: document.getElementById('text-page-mode'),
        iconPageMode: document.getElementById('icon-page-mode'),
        fontFamilySelect: document.getElementById('font-family-select'),
        fontPicker: document.getElementById('font-picker'),
        fontMenu: document.getElementById('font-menu'),
        fontChoiceLabel: document.getElementById('font-choice-label'),
        fontMainView: document.getElementById('font-main-view'),
        fontMoreView: document.getElementById('font-more-view'),
        btnMoreFonts: document.getElementById('btn-more-fonts'),
        btnFontBack: document.getElementById('btn-font-back'),
        fontSearch: document.getElementById('font-search'),
        btnReadSystemFonts: document.getElementById('btn-read-system-fonts'),
        btnImportFont: document.getElementById('btn-import-font'),
        fontFileInput: document.getElementById('font-file-input'),
        fontStatus: document.getElementById('font-status'),
        fontBrowserList: document.getElementById('font-browser-list'),
        indentSelect: document.getElementById('indent-select'),
        fontSizeLabel: document.getElementById('font-size-label'),
        btnFontDec: document.getElementById('btn-font-dec'),
        btnFontInc: document.getElementById('btn-font-inc'),
        paperBtns: document.querySelectorAll('.paper-btn'),
        btnThemeToggle: document.getElementById('btn-theme-toggle'),
        btnAppearance: document.getElementById('btn-appearance'),
        appearancePanel: document.getElementById('appearance-panel'),
        btnExportMenu: document.getElementById('btn-export-menu'),
        exportPanel: document.getElementById('export-panel'),
        exportBookTitle: document.getElementById('export-book-title'),
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
        btnHlRemove: document.getElementById('btn-hl-remove'),
        btnNoteRemove: document.getElementById('btn-note-remove'),

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

        // Header Export Panel / Backup
        btnExportMarkdown: document.getElementById('btn-export-markdown'),
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

        // Modal, Shelf & Toast
        btnShelf: document.getElementById('btn-shelf'),
        shelfOverlay: document.getElementById('shelf-overlay'),
        btnCloseShelf: document.getElementById('btn-close-shelf'),
        shelfGrid: document.getElementById('shelf-grid'),
        shelfBookCount: document.getElementById('shelf-book-count'),
        toastMsg: document.getElementById('toast-msg')
    };
}

export function bootstrapApp() {
    const elements = queryElements();

    // 1. Create Feature Controllers
    const layout = new LayoutController();
    const session = new Session('crisis-era');
    const appShell = new AppShell();

    const reader = new ReaderController({
        readerEngine,
        layoutController: layout,
        callbacks: {
            showToast: (msg) => appShell.showToast(msg)
        }
    });

    const annotations = new AnnotationController({
        callbacks: {
            showToast: (msg) => appShell.showToast(msg),
            getCurrentBookId: () => session.getCurrentBookId()
        }
    });

    const selection = new SelectionController({
        callbacks: {
            getReadingContext: () => ({
                currentLeftPage: reader.getCurrentLeftPage(),
                currentRightPage: reader.getCurrentRightPage(),
                currentPage: reader.getCurrentPage(),
                chapterFlow: reader.isChapterFlow(),
                sectionId: reader.getLocation().sectionId,
                chapter: reader.getLocation().chapter,
                notes: annotations.getNotes()
            })
        }
    });

    const shelf = new ShelfController({
        callbacks: {
            showToast: (msg) => appShell.showToast(msg)
        }
    });

    const backup = new BackupController({
        callbacks: {
            showToast: (msg) => appShell.showToast(msg),
            getCurrentBook: () => reader.getCurrentBook(),
            getCurrentNotes: () => annotations.getNotes()
        }
    });

    // 2. Create Central Coordinator
    const coordinator = new AppCoordinator({
        session,
        readerController: reader,
        annotationController: annotations,
        shelfController: shelf,
        layoutController: layout,
        selectionController: selection,
        backupController: backup,
        appShell
    });

    // 3. Connect Cross-Module Callbacks
    reader.callbacks.getNotes = () => annotations.getRenderingNotes();
    reader.callbacks.beforeNavigate = () => {
        annotations.finishInlineEdit();
        return annotations.getRenderingNotes();
    };
    reader.callbacks.onPageRendered = () => {
        selection.restoreActiveTokens();
        annotations.refreshVisibleNotes();
        positionMarginNotes(elements);
    };
    reader.callbacks.onViewportChange = () => {
        annotations.refreshVisibleNotes(true);
        positionMarginNotes(elements);
    };
    annotations.callbacks.getVisibleAnnotationIds = () => reader.getVisibleAnnotationIds();

    annotations.callbacks.onNotesChanged = (notes) => {
        reader.renderPage(reader.getCurrentPage(), true, notes);
    };
    annotations.callbacks.onJump = (note) => {
        coordinator.jumpToAnnotation(note.id);
    };
    annotations.callbacks.getReadingContext = () => ({
        page: reader.getCurrentPage(),
        chapter: reader.getLocation().chapter
    });
    annotations.callbacks.getPendingSelection = () => selection.getPendingSelection();
    annotations.callbacks.getCurrentPage = () => reader.getCurrentPage();
    annotations.callbacks.getCurrentChapter = () => reader.getLocation().chapter;
    annotations.callbacks.onFocusAnnotation = (record) => {
        coordinator.jumpToAnnotation(record.id, { showMenu: true });
    };

    selection.callbacks.onCreateHighlight = async (color, pending) => {
        await coordinator.addAnnotation({
            type: 'highlight',
            quote: pending.text,
            page: pending.page,
            chapter: reader.getLocation().chapter,
            color,
            location: pending.location || null
        });
    };
    selection.callbacks.onCreateNote = ({ quote, page, location }) => {
        annotations.createNote({
            quote,
            page,
            chapter: reader.getLocation().chapter,
            location
        });
    };
    selection.callbacks.onOpenNoteModal = (quote, noteId, page) => {
        annotations.openNoteModal(quote, noteId, page);
    };
    selection.callbacks.onDeleteHighlight = async (ids) => {
        await annotations.deleteHighlights(ids);
    };
    selection.callbacks.onDeleteNotes = async (ids) => {
        await Promise.all(ids.map(id => annotations.deleteNote(id)));
    };
    selection.callbacks.onAnnotationActivated = (ctx) => {
        if (ctx.noteIds && ctx.noteIds.length) annotations.focusNotes(ctx.noteIds);
        else annotations.clearFocusedAnnotations();
    };
    selection.callbacks.onClearFocus = () => annotations.clearFocusedAnnotations();

    shelf.callbacks.onOpenBook = async (bookId) => {
        await coordinator.openBook(bookId);
    };
    shelf.callbacks.onDeleteBook = async (bookId) => {
        await coordinator.deleteBook(bookId);
    };

    backup.callbacks.onRestoreBackup = async ({ data, importedBooksCount, importedNotesCount }) => {
        if (data.books && data.books.length > 0 && data.books[0].id) {
            await coordinator.openBook(data.books[0].id);
        } else {
            await coordinator.openBook('crisis-era');
        }
        await shelf.refreshShelf();
        const activeTitle = reader.getCurrentBook() ? reader.getCurrentBook().title : '恢复图书';
        appShell.showToast(`🎉 成功从备份恢复！已为您自动打开《${activeTitle}》，加载 ${importedBooksCount} 本图书，${importedNotesCount} 条划线随笔`);
    };
    backup.callbacks.beforeRestore = () => annotations.finishInlineEdit();

    const syncReaderLayout = () => {
        layout.updateLayoutClasses(elements);
        const notes = annotations.getNotes();
        if (reader.isChapterFlow()) reader.refitChapter(notes);
        else reader.renderPage(reader.getCurrentPage(), true, notes);
    };
    layout.callbacks.beforeGeometryChange = () => reader.rememberAnchor();
    layout.callbacks.onLayoutChange = (res) => {
        syncReaderLayout();
        if (appShell) {
            if (res.layoutMode === 'scroll') {
                appShell.showToast('已切换为连续滚动');
            } else if (res.layoutMode === 'double' && res.isAutoDowngraded) {
                appShell.showToast('已开启双页模式（当前可用宽度受限，临时以单页呈现）');
            } else {
                appShell.showToast(res.layoutMode === 'double' ? '已开启双页展开模式' : '已切换为单页阅读模式');
            }
        }
    };
    layout.callbacks.onResponsiveChange = (res) => {
        syncReaderLayout();
        if (res.isAutoDowngraded) {
            appShell.showToast('可用空间不足，已自适应降级为单页展示');
        } else {
            appShell.showToast('可用空间充足，已自动恢复双页展开模式');
        }
    };
    // 4. Initialize UI Listeners (Browser DOM only)
    if (typeof document !== 'undefined') {
        reader.initUI(elements);
        annotations.initUI(elements);
        selection.initUI(elements);
        shelf.initUI(elements);
        backup.initUI(elements);
        layout.initUI(elements);

        appShell.init(elements, {
            onPrevPage: () => reader.prevPage(annotations.getNotes()),
            onNextPage: () => reader.nextPage(annotations.getNotes()),
            onTogglePageMode: () => {
                const availWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
                    ? elements.readerPanel.clientWidth
                    : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
                layout.togglePageMode(availWidth);
            },
            onSwitchDemo: () => {
                const nextKey = session.getCurrentBookId() === 'crisis-era' ? 'deep-work' : 'crisis-era';
                coordinator.openBook(nextKey);
            },
            onImportFile: (file) => coordinator.importBook(file),
            onWindowResize: (notify) => {
                const availWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
                    ? elements.readerPanel.clientWidth
                    : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
                const resp = layout.checkResponsiveLayout(availWidth);
                if (!resp || !resp.changed) {
                    syncReaderLayout();
                }
            }
        });

        // 5. Initial Execution & Mounting
        layout.updateLayoutClasses(elements);
        const initWidth = (elements.readerPanel && elements.readerPanel.clientWidth > 0)
            ? elements.readerPanel.clientWidth
            : ((typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth : 1200);
        layout.checkResponsiveLayout(initWidth);
    }

    return {
        session,
        coordinator,
        reader,
        annotations,
        selection,
        shelf,
        layout,
        backup,
        appShell,
        elements
    };
}

export const appInstance = bootstrapApp();
export const {
    session,
    coordinator,
    reader,
    annotations,
    selection,
    shelf,
    layout,
    backup,
    appShell,
    elements
} = appInstance;

let isStarted = false;

export async function startApp() {
    if (isStarted) return appInstance;
    isStarted = true;

    try {
        localStorage.removeItem('aura_sync_secret');
        localStorage.removeItem('aura_sync_last_time');
        localStorage.removeItem('aura_api_key');
    } catch (e) {
        // ignore
    }

    try { await initDB(); }
    catch (error) {
        isStarted = false;
        appInstance.appShell.showToast(error.message || '数据库迁移未完成，旧数据已保留');
        console.error('数据库启动／迁移停止', error);
        throw error;
    }
    await appInstance.reader.fonts.ready;
    await appInstance.coordinator.openBook('crisis-era');
    return appInstance;
}

if (typeof document !== 'undefined') {
    if (!window.__AURA_BOOTSTRAPPED__) {
        window.__AURA_BOOTSTRAPPED__ = true;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', async () => {
                await startApp().catch(() => {});
            });
        } else {
            startApp().catch(() => {});
        }
    }
}
