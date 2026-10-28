export interface GoalActionState { visible: boolean; disabled: boolean; linked: boolean }
import type { Annotation, AnnotationLocation } from '../domain/annotation.js';
import type { Book, ReaderMode } from '../domain/book.js';

export type AsyncAction<T extends unknown[] = []> = (...args: T) => void | Promise<unknown>;
export interface NoteDraft {
    quote?: string; page?: number; chapter?: string | null;
    location?: Partial<AnnotationLocation> | null;
}
export interface PendingSelection {
    text: string; page: number; range: Range;
    location: AnnotationLocation | null;
}
export interface ReadingContext {
    currentPage: number;
    currentLeftPage?: number;
    currentRightPage?: number | null;
    chapterFlow?: boolean;
    sectionId?: string;
    chapter?: string;
    notes?: Annotation[];
}
export interface ActiveAnnotationContext {
    key: string; highlightIds: string[]; noteIds: string[];
    primaryKind: 'note' | 'highlight' | null;
    targetElement: HTMLElement;
    page: number; quote: string; location: AnnotationLocation | null;
}
export interface ReaderCallbacks {
    showToast?: (message: string) => void;
    getNotes?: () => Annotation[];
    beforeNavigate?: () => Annotation[];
    onPageRendered?: () => void;
    onViewportChange?: () => void;
    onPageChange?: (location: import('../domain/book.js').ReadingLocation) => void;
    onMarkClick?: (element: HTMLElement, annotation: Annotation) => void;
}
export interface AnnotationCallbacks {
    getGoalAction?: (id: string) => GoalActionState;
    onLinkGoal?: AsyncAction<[id: string]>;
    beforeDeleteAnnotations?: AsyncAction;
    onAnnotationContentChanged?: (note: Annotation) => void;
    showToast?: (message: string) => void;
    getCurrentBookId?: () => string;
    getVisibleAnnotationIds?: () => Set<string>;
    getPendingSelection?: () => PendingSelection | null;
    getCurrentChapter?: () => string;
    getCurrentPage?: () => number;
    getReadingContext?: () => { page: number; chapter: string };
    onNotesChanged?: (notes: Annotation[]) => void;
    onJump?: (note: Annotation) => void;
    onFocusAnnotation?: (note: Annotation) => void;
}
export interface SelectionCallbacks {
    getGoalAction?: (id: string) => GoalActionState;
    onLinkGoal?: AsyncAction<[id: string]>;
    getReadingContext?: () => ReadingContext;
    onCreateHighlight?: AsyncAction<[color: string, selection: PendingSelection]>;
    onCreateNote?: (draft: NoteDraft) => void;
    onOpenNoteModal?: (quote: string, id: string | null, page: number) => void;
    onDeleteHighlight?: AsyncAction<[ids: string[]]>;
    onDeleteNotes?: AsyncAction<[ids: string[]]>;
    onAnnotationActivated?: (context: ActiveAnnotationContext) => void;
    onClearFocus?: () => void;
}
export interface LayoutChange { layoutMode: ReaderMode; isAutoDowngraded: boolean; isDoubleEffective: boolean }
export interface ResponsiveChange { changed: boolean; isAutoDowngraded: boolean; reason?: string }
export interface LayoutCallbacks {
    beforeGeometryChange?: () => void;
    onLayoutChange?: (change: LayoutChange) => void;
    onResponsiveChange?: (change: ResponsiveChange) => void;
}
export interface FontCallbacks {
    getBook?: () => Book | null;
    beforeChange?: () => void;
    onChange?: () => void;
    onReady?: () => void;
    notify?: (message: string) => void;
}
export interface ShelfCallbacks {
    onImportFile?: AsyncAction<[file: File]>;
    showToast?: (message: string) => void;
    onOpen?: () => void;
    onOpenBook?: AsyncAction<[id: string]>;
    onDeleteBook?: AsyncAction<[id: string]>;
}
export interface BackupData { books?: Book[]; notes?: import('../../shared/storage.js').StoredAnnotation[]; goalStates?: import('../domain/goal.js').GoalBackupState[]; goalGraph?: import('../domain/goal.js').GoalGraphBackup }
export interface BackupCallbacks {
    showToast?: (message: string) => void;
    getCurrentBook?: () => Book | null;
    getCurrentNotes?: () => Annotation[];
    getCurrentPage?: () => number;
    closeExportPanel?: () => void;
    beforeRestore?: AsyncAction;
    beforeExport?: AsyncAction;
    onRestoreBackup?: AsyncAction<[{ data: BackupData; importedBooksCount: number; importedNotesCount: number }]>;
}
export interface ShellCallbacks {
    onThemeChanged?: () => void;
    onOpenPanel?: () => void;
    onPrevPage?: () => void;
    onNextPage?: () => void;
    onTogglePageMode?: () => void;
    onSwitchDemo?: () => void;
    onImportFile?: AsyncAction<[file: File]>;
    onWindowResize?: (notify: boolean) => void;
}
export interface ChapterRenderOptions {
    toStart?: boolean; toEnd?: boolean; placeAnchor?: boolean; preserve?: boolean;
    anchorText?: string; anchorId?: string; anchorPage?: number; retried?: boolean;
}

export interface NotesRenderOptions {
    getGoalAction?: ((id: string) => GoalActionState) | null;
    onLinkGoal?: ((id: string) => void) | null;
    elements: import('./elements.js').AppElements;
    notes?: Annotation[];
    notesScope?: 'page' | 'book';
    showHighlightsInSidebar?: boolean;
    focusedNoteIds?: string[];
    focusedHighlightIds?: string[];
    editingNoteId?: string | null;
    onInput?: ((id: string, comment: string) => void) | null;
    onFinish?: (() => void) | null;
    onJump?: ((note: Annotation) => void) | null;
    onEdit?: ((note: Annotation) => void) | null;
    onDelete?: ((note: Annotation) => void) | null;
}
export interface PaperSpreadOptions {
    elements: import('./elements.js').AppElements;
    readerEngine: import('../domain/readerEngine.js').ReaderEngine;
    layoutSystem?: import('../features/layout/layoutController.js').LayoutController | null;
    notes?: Annotation[];
    textIndent?: string;
    preserveScroll?: boolean;
    onLinkClick?: ((href: string) => void) | null;
}
