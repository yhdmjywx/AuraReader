import type { AppElements } from '../../app/elements.js';
import type { Annotation, AnnotationLocation } from '../../domain/annotation.js';
import type { Book, ReaderMode, ReadingLocation } from '../../domain/book.js';
import { SelectionController } from '../annotations/selectionController.js';
import { LayoutController } from '../layout/layoutController.js';
import { ReaderController } from './readerController.js';

export interface ReaderSnapshot {
    mounted: boolean;
    location: ReadingLocation;
    mode: ReaderMode;
    fontSize: number;
    visibleAnnotationIds: string[];
    selection: { text: string; page: number; location: AnnotationLocation | null } | null;
    activeAnnotationIds: string[];
}

/** Framework boundary: the reader owns paper descendants; the app owns data and surrounding UI. */
export class ReaderRuntime {
    private root: HTMLElement | null = null;
    private annotations: Annotation[] = [];
    private listeners = new Set<() => void>();
    private detach: (() => void)[] = [];
    private observer?: ResizeObserver;
    private resizeTimer?: ReturnType<typeof setTimeout>;
    private snapshot: ReaderSnapshot;

    constructor(
        readonly reader = new ReaderController({ layoutController: new LayoutController() }),
        readonly selection = new SelectionController()
    ) {
        reader.callbacks.getNotes ??= () => this.annotations;
        selection.callbacks.getReadingContext ??= () => ({
            currentPage: reader.getCurrentPage(), chapterFlow: reader.isChapterFlow(),
            sectionId: reader.getLocation().sectionId, chapter: reader.getLocation().chapter,
        });
        this.snapshot = this.readSnapshot();
    }

    // Stable function identities and a cached snapshot are suitable for useSyncExternalStore.
    getSnapshot = () => this.snapshot;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    private readSnapshot(): ReaderSnapshot {
        const pending = this.selection.getPendingSelection();
        const active = this.selection.getActiveAnnotationContext();
        return {
            mounted: !!this.root, location: this.reader.getLocation(),
            mode: this.reader.effectiveReaderMode() === 'scroll' ? 'scroll' : 'single', fontSize: this.reader.fontSize,
            visibleAnnotationIds: [...this.reader.getVisibleAnnotationIds()].sort(),
            selection: pending ? { text: pending.text, page: pending.page,
                location: pending.location ? { ...pending.location } : null } : null,
            activeAnnotationIds: [...(active?.highlightIds || []), ...(active?.noteIds || [])],
        };
    }
    private publish = () => {
        const next = this.readSnapshot();
        if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
        this.snapshot = next;
        for (const listener of this.listeners) listener();
    };

    mount(root: HTMLElement, controls: AppElements = {}) {
        if (this.root === root) return;
        this.destroy();
        const elements: AppElements = {
            ...controls, readerPanel: root,
            readerViewport: root.querySelector<HTMLElement>('[data-reader-viewport], .reader-viewport'),
            paperContainer: root.querySelector<HTMLElement>('[data-reader-container], .paper-container'),
            bookPaper: root.querySelector<HTMLElement>('[data-reader-paper], .book-paper'),
        };
        if (!elements.readerViewport || !elements.paperContainer || !elements.bookPaper) {
            throw new Error("The reader requires viewport, container, and paper elements.");
        }
        this.root = root;
        this.reader.initUI(elements);
        this.selection.initUI(elements);
        this.detach = [this.reader.subscribe(this.publish), this.selection.subscribe(this.publish)];
        const view = root.ownerDocument.defaultView as (Window & typeof globalThis) | null;
        if (view?.ResizeObserver) {
            let size = '';
            this.observer = new view.ResizeObserver(entries => {
                const { width, height } = entries[0]!.contentRect;
                const next = `${width}:${height}`;
                if (!width || !height || next === size) return;
                size = next;
                clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(() => {
                    if (this.root?.getClientRects().length) this.relayout();
                }, 60);
            });
            this.observer.observe(elements.workspaceContainer || root);
        }
        if (this.reader.getCurrentBook()) {
            this.reader.renderPage(this.reader.getCurrentPage(), true, this.reader.callbacks.getNotes?.() || []);
        }
        this.publish();
    }

    setBook(book: Book, annotations: Annotation[] = []) {
        this.annotations = annotations;
        this.reader.setBook(book.id, book);
        this.reader.renderPage(1, false, annotations);
        this.publish();
    }
    setAnnotations(annotations: Annotation[]) {
        this.annotations = annotations;
        this.reader.refreshAnnotations(annotations);
        this.publish();
    }
    setLayout(options: { mode?: ReaderMode; fontSize?: number; textIndent?: string }) {
        this.reader.rememberAnchor();
        if (options.mode) this.reader.layoutController?.setPageMode(options.mode);
        if (options.fontSize !== undefined) this.reader.fontSize = options.fontSize;
        if (options.textIndent !== undefined) this.reader.textIndent = options.textIndent;
        this.relayout();
    }
    nextPage() { return this.reader.nextPage(this.reader.callbacks.getNotes?.() || []); }
    prevPage() { return this.reader.prevPage(this.reader.callbacks.getNotes?.() || []); }
    goToPage(page: number) { return this.reader.goToPage(page, 0, this.reader.callbacks.getNotes?.() || []); }
    relayout() {
        if (!this.root || !this.reader.getCurrentBook()) return;
        this.reader.layoutController?.updateLayoutClasses(this.reader.elements);
        const notes = this.reader.callbacks.getNotes?.() || [];
        if (this.reader.isChapterFlow()) this.reader.refitChapter(notes);
        else this.reader.renderPage(this.reader.getCurrentPage(), true, notes);
        this.publish();
    }
    destroy() {
        this.observer?.disconnect(); this.observer = undefined;
        clearTimeout(this.resizeTimer);
        this.detach.splice(0).forEach(unsubscribe => unsubscribe());
        this.selection.destroy();
        this.reader.destroy();
        this.root = null;
        this.publish();
    }
}
