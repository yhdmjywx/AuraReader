import { GoalController } from './features/goals/goalController.js';
import { GoalHome } from './features/goals/goalHome.js';
import { updateNoteGoalActions } from './features/annotations/notesUI.js';
import type { AppElements } from './app/elements.js';
import { errorMessage } from './infrastructure/storageError.js';
import { countLabel } from './domain/format.js';
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
import { findChapterForPage } from './domain/readingLocation.js';
import { ReaderController } from './features/reader/readerController.js';
import { ReaderRuntime } from './features/reader/readerRuntime.js';
import { AnnotationController } from './features/annotations/annotationController.js';
import { SelectionController } from './features/annotations/selectionController.js';
import { ShelfController } from './features/shelf/shelfController.js';
import { BackupController } from './features/backup/backupController.js';
import { AppShell } from './app/appShell.js';
import { AppCoordinator } from './app/appCoordinator.js';
import { AppNavigation } from './app/navigation.js';
import { ReadingToolsDisclosure } from './features/workbench/readingToolsDisclosure.js';

export function queryElements(): AppElements {
    if (typeof document === 'undefined') return {};
    return {
        appHeader: document.querySelector<HTMLElement>('.app-header'),
        workspaceContainer: document.getElementById('workspace-container'),
        readerPanel: document.getElementById('reader-panel'),
        readerViewport: document.getElementById('reader-viewport'),
        notesPanel: document.getElementById('notes-panel'),
        goalPanel: document.getElementById('goal-panel'),
        goalSidebar: document.getElementById('goal-sidebar'),
        goalResizer: document.getElementById('goal-resizer'),
        btnGoalSidebar: document.getElementById('btn-goal-sidebar') as HTMLButtonElement | null,
        btnGoalBack: document.getElementById('btn-goal-back') as HTMLButtonElement | null,
        goalPage: document.getElementById('goal-page'), goalPageContent: document.getElementById('goal-page-content'),
        readingWorkspace: document.getElementById('reading-workspace'),
        btnAnnotationGoal: document.getElementById('btn-annotation-goal') as HTMLButtonElement | null,

        // Reader Controls
        bookPaper: document.getElementById('book-paper'),
        paperContainer: document.getElementById('paper-container'),
        currentBookTitle: document.getElementById('current-book-title'),
        currentPageSpan: document.getElementById('current-page'),
        totalPagesSpan: document.getElementById('total-pages'),
        pageUnit: document.getElementById('page-unit'),
        btnModeScroll: document.getElementById('btn-mode-scroll') as HTMLButtonElement | null,
        btnPrevPage: document.getElementById('btn-prev-page') as HTMLButtonElement | null,
        btnNextPage: document.getElementById('btn-next-page') as HTMLButtonElement | null,
        btnModeSingle: document.getElementById('btn-mode-single') as HTMLButtonElement | null,
        fontFamilySelect: document.getElementById('font-family-select') as HTMLButtonElement | null,
        fontPicker: document.getElementById('font-picker'),
        fontMenu: document.getElementById('font-menu'),
        fontChoiceLabel: document.getElementById('font-choice-label'),
        fontMainView: document.getElementById('font-main-view'),
        fontMoreView: document.getElementById('font-more-view'),
        btnMoreFonts: document.getElementById('btn-more-fonts') as HTMLButtonElement | null,
        btnFontBack: document.getElementById('btn-font-back') as HTMLButtonElement | null,
        fontSearch: document.getElementById('font-search') as HTMLInputElement | null,
        btnReadSystemFonts: document.getElementById('btn-read-system-fonts') as HTMLButtonElement | null,
        btnImportFont: document.getElementById('btn-import-font') as HTMLButtonElement | null,
        fontFileInput: document.getElementById('font-file-input') as HTMLInputElement | null,
        fontStatus: document.getElementById('font-status'),
        fontBrowserList: document.getElementById('font-browser-list'),
        indentInput: document.getElementById('indent') as HTMLInputElement | null,
        indentLabel: document.getElementById('indent-label'),
        fontSizeLabel: document.getElementById('font-size-label'),
        fontSizeInput: document.getElementById('font-size') as HTMLInputElement | null,
        lineSpacingLabel: document.getElementById('line-spacing-label'),
        lineSpacingInput: document.getElementById('line-spacing') as HTMLInputElement | null,
        readingWidthLabel: document.getElementById('reading-width-label'),
        readingWidthInput: document.getElementById('reading-width') as HTMLInputElement | null,
        paperBtns: document.querySelectorAll<HTMLElement>('.paper-btn'),
        btnThemeToggle: document.getElementById('btn-theme-toggle') as HTMLButtonElement | null,
        btnAppearance: document.getElementById('btn-appearance') as HTMLButtonElement | null,
        appearancePanel: document.getElementById('appearance-panel'),
        btnExportMenu: document.getElementById('btn-export-menu') as HTMLButtonElement | null,
        exportPanel: document.getElementById('export-panel'),
        exportBookTitle: document.getElementById('export-book-title'),
        fileInput: document.getElementById('file-input') as HTMLInputElement | null,

        // TOC Drawer
        btnToc: document.getElementById('btn-toc') as HTMLButtonElement | null,
        tocDrawer: document.getElementById('toc-drawer'),
        tocList: document.getElementById('toc-list'),

        // Floating Selection Tooltip
        selectionTooltip: document.getElementById('selection-tooltip'),
        btnAddNote: document.getElementById('btn-add-note') as HTMLButtonElement | null,
        highlightActionTooltip: document.getElementById('highlight-action-tooltip'),
        btnHlRemove: document.getElementById('btn-hl-remove') as HTMLButtonElement | null,
        btnNoteRemove: document.getElementById('btn-note-remove') as HTMLButtonElement | null,

        // Tabs
        tabBtns: document.querySelectorAll<HTMLElement>('.tab-btn'),
        tabContents: document.querySelectorAll<HTMLElement>('.tab-content'),

        // Notes Tab
        notesList: document.getElementById('notes-list'),
        emptyNotesState: document.getElementById('empty-notes-state'),
        countHighlights: document.getElementById('count-highlights'),
        notesTotalCount: document.getElementById('notes-total-count'),
        btnToggleShowHighlights: document.getElementById('btn-toggle-show-highlights') as HTMLButtonElement | null,
        countPureHighlights: document.getElementById('count-pure-highlights'),

        // Header Export Panel / Backup
        btnExportMarkdown: document.getElementById('btn-export-markdown') as HTMLButtonElement | null,
        btnExportChapters: document.getElementById('btn-export-chapters') as HTMLButtonElement | null,
        chapterExportEntry: document.getElementById('chapter-export-entry'),
        chapterExportOptions: document.getElementById('chapter-export-options'),
        chapterExportCustom: document.getElementById('chapter-export-custom'),
        chapterExportList: document.getElementById('chapter-export-list'),
        btnCollapseChapterExport: document.getElementById('btn-collapse-chapter-export') as HTMLButtonElement | null,
        btnExportCurrentChapter: document.getElementById('btn-export-current-chapter') as HTMLButtonElement | null,
        btnExportAllChapters: document.getElementById('btn-export-all-chapters') as HTMLButtonElement | null,
        btnSelectChapters: document.getElementById('btn-select-chapters') as HTMLButtonElement | null,
        btnCancelChapterExport: document.getElementById('btn-cancel-chapter-export') as HTMLButtonElement | null,
        btnConfirmChapterExport: document.getElementById('btn-confirm-chapter-export') as HTMLButtonElement | null,
        btnExportFullBackup: document.getElementById('btn-export-full-backup') as HTMLButtonElement | null,
        btnImportFullBackup: document.getElementById('btn-import-full-backup') as HTMLButtonElement | null,
        backupFileInput: document.getElementById('backup-file-input') as HTMLInputElement | null,
        backupSelectModal: document.getElementById('backup-select-modal'),
        btnCloseBackupModal: document.getElementById('btn-close-backup-modal') as HTMLButtonElement | null,
        btnCancelBackupModal: document.getElementById('btn-cancel-backup-modal') as HTMLButtonElement | null,
        btnConfirmExportBackup: document.getElementById('btn-confirm-export-backup') as HTMLButtonElement | null,
        btnSelectAllBackup: document.getElementById('btn-select-all-backup') as HTMLButtonElement | null,
        btnDeselectAllBackup: document.getElementById('btn-deselect-all-backup') as HTMLButtonElement | null,
        backupBookCheckboxList: document.getElementById('backup-book-checkbox-list'),
        chkBackupIncludeNotes: document.getElementById('chk-backup-include-notes') as HTMLInputElement | null,

        // Modal, Shelf & Toast
        btnShelf: document.getElementById('btn-shelf') as HTMLButtonElement | null,
        shelfPanel: document.getElementById('shelf-panel'),
        btnImportBook: document.getElementById('btn-import-book') as HTMLButtonElement | null,
        shelfList: document.getElementById('shelf-list'),
        shelfBookCount: document.getElementById('shelf-book-count'),
        toastMsg: document.getElementById('toast-msg')
    };
}

export function bootstrapApp() {
    const elements = queryElements();

    // 1. Create Feature Controllers
    const layout = new LayoutController();
    const session = new Session('');
    const appShell = new AppShell();
    const navigation = new AppNavigation('home');

    const reader = new ReaderController({
        readerEngine,
        layoutController: layout,
        callbacks: {
            showToast: (msg, options) => appShell.showToast(msg, options)
        }
    });

    const annotations = new AnnotationController({
        callbacks: {
            showToast: (msg, options) => appShell.showToast(msg, options),
            getCurrentBookId: () => session.getCurrentBookId()
        }
    });

    const selection = new SelectionController({
        callbacks: {
            getReadingContext: () => ({
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
            showToast: (msg, options) => appShell.showToast(msg, options)
        }
    });

    const readerRuntime = new ReaderRuntime(reader, selection);

    const backup = new BackupController({
        callbacks: {
            showToast: (msg, options) => appShell.showToast(msg, options),
            getCurrentBook: () => reader.getCurrentBook(),
            getCurrentNotes: () => annotations.getNotes(),
            getCurrentPage: () => reader.getCurrentPage(),
            closeExportPanel: () => appShell.closeExportPanel()
        }
    });

    const goals: GoalController = new GoalController({
        getAnnotations: () => annotations.getNotes(), getLocation: () => reader.getLocation(),
        getMode: () => layout.getLayoutMode(), showToast: (message, options) => appShell.showToast(message, options),
        jump: (id, source) => source ? coordinator.jumpToGoalSource(source) : coordinator.jumpToAnnotation(id),
        finishAnnotations: () => annotations.finishInlineEdit(), annotationsSaved: () => annotations.assertInlineWritesSaved()
    }, navigation);

    // 2. Create Central Coordinator
    const coordinator: AppCoordinator = new AppCoordinator({
        session,
        goalController: elements.goalPanel ? goals : undefined,
        readerController: reader,
        annotationController: annotations,
        shelfController: shelf,
        layoutController: layout,
        selectionController: selection,
        backupController: backup,
        appShell,
        navigation
    });
    const closeReadingTools = (except?: 'contents' | 'library') => {
        if (except !== 'contents') reader.closeTOC();
        if (except !== 'library') shelf.closeShelf();
        appShell.closeAppearance();
        appShell.closeExportPanel();
    };
    const toolsRoot = elements.workspaceContainer?.querySelector<HTMLElement>('#reading-tools');
    const readingTools = toolsRoot ? new ReadingToolsDisclosure(toolsRoot) : null;
    const syncReadingToolsBook = () => readingTools?.setBook(navigation.surface === 'reader' ? session.getCurrentBookId() : '');
    session.subscribe(syncReadingToolsBook);
    reader.callbacks.onOpenContents = () => closeReadingTools('contents');
    reader.callbacks.onSelectContents = () => readingTools?.dismiss();
    reader.callbacks.onPageTurn = () => readingTools?.pageTurned();
    reader.callbacks.onReadingScroll = (distance, viewport) => readingTools?.scrolled(distance, viewport);
    reader.callbacks.onReadingDocumentClick = () => {
        closeReadingTools();
        readingTools?.outsideClick();
    };
    reader.callbacks.onPaperChanged = () => appShell.syncWindowControls();

    const homeHost = typeof document !== 'undefined' ? document.getElementById('goal-home') : null;
    const home = homeHost ? new GoalHome(homeHost, {
        goals, coordinator, currentBookId: () => session.getCurrentBookId(),
        finishAnnotations: async () => { await annotations.finishInlineEdit(); await annotations.assertInlineWritesSaved(); },
        beforeOpen: () => { closeReadingTools(); reader.rememberAnchor(); }
    }) : null;
    const brand = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.brand') : null;
    if (brand && home) {
        brand.setAttribute('role', 'button'); brand.tabIndex = 0; brand.setAttribute('aria-label', 'Open reading home');
        const openHome = () => { home.open().catch(error => appShell.showToast(errorMessage(error, 'Could not open reading home'), { kind: 'error' })); };
        brand.addEventListener('click', openHome);
        brand.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openHome(); } });
    }
    coordinator.onBookRemoved = async () => { await home?.open(); };
    navigation.subscribe(surface => {
        closeReadingTools();
        syncReadingToolsBook();
        selection.hideSelectionTooltip(); selection.hideHighlightAction(); goals.actions.close(false);
        appShell.setBookLoading(false);
        if (elements.btnGoalBack) elements.btnGoalBack.setAttribute('aria-label', navigation.returnTarget === 'home' || !session.getCurrentBookId() ? 'Back to home' : 'Back to reading');
        appShell.presentSurface(surface);
    });
    goals.callbacks.openCollection = area => { if (home) void home.open().then(() => home.showArea(area)).catch(error => appShell.showToast(errorMessage(error, 'Could not open goals'), { kind: 'error' })); };

    const goalAction = (id: string) => ({ visible: goals.visible, disabled: !goals.canLink(id) || goals.linked(id), linked: goals.linked(id) });
    annotations.callbacks.getGoalAction = goalAction;
    annotations.callbacks.onLinkGoal = id => goals.linkAnnotation(id);
    annotations.callbacks.beforeDeleteAnnotations = () => goals.finishInlineEdit();
    annotations.callbacks.onAnnotationContentChanged = () => goals.refreshAnnotations();
    selection.callbacks.getGoalAction = goalAction;
    selection.callbacks.onLinkGoal = id => goals.linkAnnotation(id).catch(error => { appShell.showToast(error.message, { kind: 'error' }); });
    goals.callbacks.onActionsChanged = () => {
        updateNoteGoalActions(elements, goalAction); selection.refreshGoalAction();
        home?.changed();
    };
    goals.callbacks.onBeforeSidebarResize = () => reader.rememberAnchor();
    goals.callbacks.chooseBook = () => { void home?.open().catch(error => appShell.showToast(errorMessage(error, 'Could not open reading home'), { kind: 'error' })); };
    goals.callbacks.onSurfaceChanged = () => requestAnimationFrame(() => appShell.callbacks.onWindowResize?.(false));

    // 3. Connect Cross-Module Callbacks
    shelf.callbacks.onImportFile = file => coordinator.importBook(file);
    reader.callbacks.getNotes = () => annotations.getRenderingNotes();
    reader.callbacks.beforeNavigate = () => {
        annotations.finishInlineEdit();
        goals.finishInlineEdit().catch(() => {});
        return annotations.getRenderingNotes();
    };
    reader.callbacks.onPageRendered = () => {
        selection.restoreActiveTokens();
        annotations.refreshVisibleNotes();
        positionMarginNotes(elements);
        goals.updateReadingContext();
    };
    reader.callbacks.onViewportChange = () => {
        annotations.refreshVisibleNotes(true);
        positionMarginNotes(elements);
        goals.updateReadingContext();
    };
    annotations.callbacks.getVisibleAnnotationIds = () => reader.getVisibleAnnotationIds();

    annotations.callbacks.onNotesChanged = (notes) => {
        reader.refreshAnnotations(notes);
        goals.refreshAnnotations();
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
            chapter: reader.isChapterFlow() ? findChapterForPage(reader.getCurrentBook()?.toc, pending.page) : reader.getLocation().chapter,
            color,
            location: pending.location || null
        });
    };
    selection.callbacks.onCreateNote = ({ quote, page, location }) => {
        annotations.createNote({
            quote,
            page,
            chapter: reader.isChapterFlow() ? findChapterForPage(reader.getCurrentBook()?.toc, page || reader.getCurrentPage()) : reader.getLocation().chapter,
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

    shelf.callbacks.onOpen = () => closeReadingTools('library');
    shelf.callbacks.onOpenBook = async (bookId) => {
        await coordinator.openBook(bookId);
    };
    shelf.callbacks.onDeleteBook = async (bookId) => {
        await coordinator.deleteBook(bookId);
    };

    backup.callbacks.onRestoreBackup = async ({ data, importedBooksCount, importedNotesCount }) => {
        if (data.books?.some(book => book.id === session.getCurrentBookId())) coordinator.clearReadingSession();
        await shelf.refreshShelf();
        await home?.open();
        appShell.showToast(`Restored from backup: ${countLabel(importedBooksCount, 'book')}, ${countLabel(importedNotesCount, 'annotation')}. Choose a book on the home page.`);
    };
    const finishReadingEdits = async () => { await goals.finishInlineEdit(); await annotations.finishInlineEdit(); await annotations.assertInlineWritesSaved(); await goals.assertWritesSaved(); };
    backup.callbacks.beforeRestore = finishReadingEdits;
    backup.callbacks.beforeExport = finishReadingEdits;

    const syncReaderLayout = () => {
        if (goals.page || home?.active) return;
        layout.updateLayoutClasses(elements);
        readerRuntime.relayout();
    };
    layout.callbacks.beforeGeometryChange = () => { goals.finishInlineEdit().catch(() => {}); reader.rememberAnchor(); };
    layout.callbacks.onLayoutChange = (res) => {
        syncReaderLayout();
        appShell.showToast(res.layoutMode === 'scroll' ? "Continuous scroll enabled" : "Single page enabled", {
            anchor: document.getElementById(res.layoutMode === 'scroll' ? 'btn-mode-scroll' : 'btn-mode-single')
        });
    };
    // 4. Initialize UI Listeners (Browser DOM only)
    if (typeof document !== 'undefined') {
        if (elements.readerPanel) readerRuntime.mount(elements.readerPanel, elements);
        annotations.initUI(elements);
        shelf.initUI(elements);
        backup.initUI(elements);
        layout.initUI(elements);
        goals.initUI(elements);
        window.addEventListener('pagehide', () => { goals.finishInlineEdit().catch(() => {}); });

        appShell.init(elements, {
            onThemeChanged: () => { positionMarginNotes(elements); goals.updateReadingContext(); },
            onOpenPanel: () => { shelf.closeShelf(); reader.closeTOC(); },
            onCloseAppearance: () => reader.fonts.close(false),
            onPrevPage: () => { if (!goals.page && !home?.active) reader.prevPage(annotations.getNotes()); },
            onNextPage: () => { if (!goals.page && !home?.active) reader.nextPage(annotations.getNotes()); },
            onImportFile: (file) => coordinator.importBook(file),
            onWindowResize: (notify) => {
                if (goals.page || home?.active) return;

                syncReaderLayout();
            }
        });

        // 5. Initial Execution & Mounting
        layout.updateLayoutClasses(elements);

    }

    return {
        session,
        coordinator,
        reader,
        readerRuntime,
        annotations,
        selection,
        shelf,
        layout,
        backup,
        appShell,
        goals,
        home,
        navigation,
        elements
    };
}

export const appInstance = bootstrapApp();
export const {
    session,
    coordinator,
    reader,
    readerRuntime,
    annotations,
    selection,
    shelf,
    layout,
    backup,
    appShell,
    goals,
    home,
    navigation,
    elements
} = appInstance;

let startup: Promise<ReturnType<typeof bootstrapApp>> | null = null;

export function startApp(): Promise<ReturnType<typeof bootstrapApp>> {
    if (startup) return startup;
    startup = initializeApp().catch(error => { startup = null; throw error; });
    return startup;
}

async function initializeApp() {

    try {
        localStorage.removeItem('aura_sync_secret');
        localStorage.removeItem('aura_sync_last_time');
        localStorage.removeItem('aura_api_key');
    } catch (e) {
        // ignore
    }

    try { await initDB(); }
    catch (error) {
        appInstance.appShell.showToast(errorMessage(error, "Database migration is incomplete. Legacy data is preserved."), { kind: 'error' });
        console.error("Database startup or migration stopped", error);
        throw error;
    }
    await appInstance.reader.fonts.ready;
    if (appInstance.elements.goalPanel) await appInstance.goals.initialize();
    if (!appInstance.goals.disabled) {
        try { await appInstance.goals.recoverBookIntents(); }
        catch (error) { appInstance.appShell.showToast(errorMessage(error, 'Book association needs a retry in reading home'), { kind: 'error' }); }
    }
    if (appInstance.home) await appInstance.home.open();
    return appInstance;
}

function showStartupError(error: unknown) {
    const host = document.getElementById('app-status');
    if (!host) return;
    host.hidden = false;
    const message = document.createElement('p'); message.textContent = errorMessage(error, "The library is temporarily unavailable. Please try again.");
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = "Retry";
    retry.addEventListener('click', () => { retry.disabled = true; void startApp().catch(showStartupError); });
    host.replaceChildren(message, retry);
}

if (typeof document !== 'undefined') {
    if (!window.__AURA_BOOTSTRAPPED__) {
        window.__AURA_BOOTSTRAPPED__ = true;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', async () => {
                await startApp().catch(showStartupError);
            });
        } else {
            startApp().catch(showStartupError);
        }
    }
}
