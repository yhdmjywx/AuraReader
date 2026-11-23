import { eventElement } from '../../app/dom.js';
import { readerAbortController, readerViewport } from './readerDom.js';
import { syncReaderDocumentSize } from './readerDocument.js';
import { preparePublicationContent } from './publicationContent.js';
import { layoutFixedDocument, preparePublicationDocument, publicationDocument, refreshReadiumStyles } from './publicationDocument.js';
import { resolveEpubUrl } from '../../infrastructure/epubPaths.js';
import { readingAxis, readingViewport, setReadingOffset } from './readingAxis.js';
import { marginGeometry, isImmersiveNotes } from '../layout/marginNotesLayout.js';
import { applyLineSpacing, readLineSpacing } from './readingTypography.js';
import type { Book, ReadingLocation, TocEntry } from '../../domain/book.js';
import type { Annotation } from '../../domain/annotation.js';
import type { BookStructure } from '../../domain/bookStructure.js';
import type { AppElements } from '../../app/elements.js';
import type { ReaderCallbacks, ChapterRenderOptions } from '../../app/contracts.js';
import type { LayoutController } from '../layout/layoutController.js';
/* ==========================================================================
   ReaderController - Reading Interaction & View Management Feature Controller
   Authority owner of: currentPage,
   font & paper settings (fontSize, fontFamily, textIndent, paperTheme).
   Coordinates ReaderEngine, PaperRenderer, TocUI.
   ========================================================================== */

import { ReaderEngine } from '../../domain/readerEngine.js';
import { FontController } from './fontController.js';
import { collectVisibleAnnotationIds } from './visibleAnnotations.js';
import { buildBookStructure, readingUnitForPage } from '../../infrastructure/bookStructure.js';
import { resolveTargetPage, ensureTocHierarchy } from '../../domain/readingLocation.js';
import { isChapterFlowBook } from '../../domain/chapterFlow.js';
import {
    renderPaper,
    applyHighlightsToPaper,
    scrollToAnchor as domScrollToAnchor,
    interceptInTextLinks
} from './paperRenderer.js';
import {
    layoutChapterStrip,
    fitChapterImages,
    readTopLeftSentence,
    captureReadingPosition,
    restoreReadingPosition,
    placeSentenceAtTopLeft,
    placeAnchorIdAtTopLeft,
    shiftStrip,
    scrollStripToStart,
    scrollStripToEnd,
    atStripStart,
    atStripEnd,
    writeChapterIndicator
} from './chapterColumnView.js';
import {
    renderTOC as domRenderTOC,
    openTOC as domOpenTOC,
    closeTOC as domCloseTOC,
    toggleTOC as domToggleTOC
} from './tocUI.js';

export class ReaderController {
    private bindings?: AbortController;
    private documentBindings?: AbortController;
    private listeners = new Set<(event: 'render' | 'viewport' | 'location') => void>();
    private cancelViewport?: () => void;
    private cancelLayout?: () => void;
    private cancelAnchor?: () => void;
    private cancelSettingsLayout?: () => void;

    subscribe(listener: (event: 'render' | 'viewport' | 'location') => void) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    private emit(event: 'render' | 'viewport' | 'location') {
        for (const listener of this.listeners) listener(event);
    }
    destroy() {
        this.rememberAnchor();
        this.bindings?.abort(); this.bindings = undefined;
        this.documentBindings?.abort(); this.documentBindings = undefined;
        clearTimeout(this._anchorTimer);
        this.cancelViewport?.(); this.cancelLayout?.(); this.cancelAnchor?.();
        this.cancelSettingsLayout?.(); this.cancelSettingsLayout = undefined;
        this.cancelViewport = this.cancelLayout = undefined;
        this._viewportUpdatePending = false;
        this.fonts.destroy();
        this.closeTOC();
        this.elements?.bookPaper?.replaceChildren();
        this.elements?.tocList?.replaceChildren();
        this.elements = null;
    }
    engine: ReaderEngine;
    layoutController: LayoutController | null;
    callbacks: ReaderCallbacks;
    fontSize: number;
    fontSizeOverride = false;
    lineSpacing = 1.85;
    lineSpacingOverride = false;
    fontFamily: string;
    textIndent: string;
    paperTheme: string;
    currentPage: number;
    totalPages: number;
    elements: AppElements | null;
    flowAnchorText: string;
    _flowPage: number;
    _volumeTitlePages: number[];
    bookStructure: BookStructure | null;
    fonts: FontController;
    _viewportUpdatePending?: boolean;
    _anchorTimer?: ReturnType<typeof setTimeout>;
    constructor({
        readerEngine = null,
        layoutController = null,
        callbacks = {}
    }: { readerEngine?: ReaderEngine | null; layoutController?: LayoutController | null; callbacks?: ReaderCallbacks } = {}) {
        this.engine = readerEngine || new ReaderEngine();
        this.layoutController = layoutController;
        this.callbacks = callbacks; // onMarkClick, onLinkClick, showToast, onPageChange

        const storage = (typeof localStorage !== 'undefined') ? localStorage : null;
        this.fontSize = 18;
        this.fontFamily = "'Inter', sans-serif";
        this.textIndent = (storage && storage.getItem('aura_text_indent')) || '2em';
        this.paperTheme = 'white';

        this.currentPage = 1;
        this.totalPages = 1;
        this.elements = null;
        this.flowAnchorText = '';
        this._flowPage = 0;
        this._volumeTitlePages = [];
        this.bookStructure = null;
        this.fonts = new FontController({
            getBook: () => this.getCurrentBook(),
            getDocument: () => this.elements?.bookPaper?.ownerDocument || globalThis.document,
            beforeChange: () => this.rememberAnchor(),
            onChange: () => { this.applyTypography(); this.refitAfterTypography(); },
            onReady: () => {
                if (this.isChapterFlow() && !this._flowPage) { this.applyTypography(); return; }
                this.applyTypography(); this.refitAfterTypography();
            },
            notify: (message, options) => this.callbacks.showToast?.(message, options)
        });
    }

    setLayoutController(controller: LayoutController) {
        this.layoutController = controller;
    }

    setBook(bookKey: string, bookObj: Book) {
        this.cancelSettingsLayout?.(); this.cancelSettingsLayout = undefined;
        this.engine.setBook(bookKey, bookObj);
        this.bookStructure = buildBookStructure(bookObj);
        const loc = this.engine.getLocation();
        this.currentPage = loc.page;
        this.totalPages = loc.totalPages;
        this.flowAnchorText = '';
        this._flowPage = 0;

        if (this.elements) {
            if (this.elements.currentBookTitle) {
                this.elements.currentBookTitle.textContent = bookObj.title;
                this.elements.currentBookTitle.title = bookObj.title;
            }
            if (this.elements.currentBookTag) this.elements.currentBookTag.textContent = bookObj.format || 'EPUB';
            if (this.elements.totalPagesSpan) this.elements.totalPagesSpan.textContent = String(this.totalPages);
        }

        this.renderTOC(bookObj.toc || []);
        this._volumeTitlePages = [];
        this.fonts.prepareForBook();
        return loc;
    }

    getCurrentPage() {
        return this.currentPage;
    }
    getFirstPage() { return this.getCurrentBook()?.epub?.documents.find(document => document.linear !== false)?.page || 1; }

    clearBook() {
        this.cancelSettingsLayout?.(); this.cancelSettingsLayout = undefined;
        clearTimeout(this._anchorTimer);
        this.engine.setBook('', null);
        this.bookStructure = null; this.flowAnchorText = ''; this._flowPage = 0; this._volumeTitlePages = [];
        this.currentPage = this.totalPages = 1;
        for (const paper of [this.elements?.bookPaper]) paper?.replaceChildren();
        if (this.elements?.currentBookTitle) {
            this.elements.currentBookTitle.textContent = "No book open";
            this.elements.currentBookTitle.removeAttribute('title');
        }
        this.renderTOC([]);
        this.refreshReadingSettingsControls();
        this.emit('location');
    }

    closeTOC() { if (this.elements) domCloseTOC(this.elements); }

    getTotalPages() {
        return this.totalPages;
    }

    getCurrentBook() {
        return this.engine.getCurrentBook();
    }

    getLocation() {
        return this.engine.getLocation();
    }

    getVisibleAnnotationIds() {
        const elements = this.elements;
        if (!elements || typeof globalThis.document === 'undefined') return new Set<string>();
        return collectVisibleAnnotationIds(
            [elements.bookPaper],
            readerViewport(elements)
        );
    }

    scheduleViewportChange() {
        if (this._viewportUpdatePending || !this.elements) return;
        this._viewportUpdatePending = true;
        const update = () => {
            this._viewportUpdatePending = false;
            this.cancelViewport = undefined;
            this.callbacks.onViewportChange?.();
            this.emit('viewport');
        };
        const view = this.elements.bookPaper?.ownerDocument.defaultView;
        if (view?.requestAnimationFrame) {
            const id = view.requestAnimationFrame(update);
            this.cancelViewport = () => view.cancelAnimationFrame(id);
        } else {
            const id = setTimeout(update, 0);
            this.cancelViewport = () => clearTimeout(id);
        }
    }

    isChapterFlow() {
        return isChapterFlowBook(this.getCurrentBook());
    }

    effectiveReaderMode() {
        if (!this.layoutController || typeof this.layoutController.getLayoutMode !== 'function') {
            return 'single';
        }
        return this.layoutController.getLayoutMode();
    }

    rememberAnchor() {
        if (!this.isChapterFlow() || !this.elements || !this.elements.bookPaper) return this.flowAnchorText;
        const viewport = readerViewport(this.elements);
        const sentence = readTopLeftSentence(this.elements.bookPaper, viewport);
        if (sentence) this.flowAnchorText = sentence;
        return this.flowAnchorText;
    }

    renderPage(pageNum: number, preserveScroll = false, notes: Annotation[] = [], options: ChapterRenderOptions = {}): ReadingLocation {
        if (this.isChapterFlow()) {
            return this.renderChapterPage(pageNum, preserveScroll, notes, options);
        }
        if (!preserveScroll) notes = this.callbacks.beforeNavigate?.() || notes;
        const loc = this.engine.goToPage(pageNum);
        this.currentPage = loc.page;
        this.totalPages = this.engine.getTotalPages();

        if (this.elements) {
            renderPaper({
                elements: this.elements,
                readerEngine: this.engine,
                notes,
                textIndent: this.textIndent,
                preserveScroll,
                onLinkClick: (href) => {
                    this.handleInTextLinkClick(href, notes);
                }
            });

            this.applyTypography();
            if (this.layoutController && typeof this.layoutController.updateLayoutClasses === 'function') {
                this.layoutController.updateLayoutClasses(this.elements);
            }
        }

        if (this.callbacks.onPageChange) {
            this.callbacks.onPageChange(this.getLocation());
        }
        this.emit('location');
        if (this.callbacks.onPageRendered) {
            this.callbacks.onPageRendered();
        }
        this.emit('render');
        this.scheduleViewportChange();

        return loc;
    }

    refreshAnnotations(notes: Annotation[] = [], changedPages?: ReadonlySet<number>) {
        const elements = this.elements;
        if (!elements) return;
        const viewport = readerViewport(elements);
        const surfaces = [viewport, elements.bookPaper, elements.bookPaper ? readingViewport(elements.bookPaper) : null].filter((node): node is HTMLElement => !!node);
        const positions = surfaces.map(node => ({ node, left: node.scrollLeft, top: node.scrollTop }));
        if (elements.bookPaper) {
            if (!changedPages || changedPages.has(this.currentPage)) applyHighlightsToPaper(elements.bookPaper, this.currentPage, notes);
            for (const title of elements.bookPaper.querySelectorAll<HTMLElement>('[data-volume-title-page]')) {
                const page = Number(title.dataset.volumeTitlePage);
                if (!changedPages || changedPages.has(page)) applyHighlightsToPaper(title, page, notes);
            }
        }
        for (const { node, left, top } of positions) {
            node.scrollLeft = left;
            node.scrollTop = top;
        }
        this.callbacks.onPageRendered?.();
        this.emit('render');
    }

    nextPage(notes: Annotation[] = []): ReadingLocation {
        if (this.isChapterFlow()) return this.stepChapter(1, notes);
        const loc = this.engine.nextPage();
        return this.renderPage(loc.page, false, notes);
    }

    prevPage(notes: Annotation[] = []): ReadingLocation {
        if (this.isChapterFlow()) return this.stepChapter(-1, notes);
        const loc = this.engine.prevPage();
        return this.renderPage(loc.page, false, notes);
    }

    goToPage(pageNum: number, offset = 0, notes: Annotation[] = []) {
        const loc = this.engine.goToPage(pageNum, offset);
        return this.renderPage(loc.page, false, notes);
    }

    handleInTextLinkClick(href: string, notes: Annotation[] = []) {
        const currentBookObj = this.engine.getCurrentBook();
        const map = currentBookObj ? (currentBookObj.hrefToPageMap || {}) : {};
        const resolved = resolveEpubUrl(href);
        const targetPage = currentBookObj?.epub ? (resolved && map[resolved.path]) : resolveTargetPage(href, map, this.currentPage);
        if (!targetPage) return;
        const anchor = resolved?.fragment || '';

        if (this.isChapterFlow()) {
            this.flowAnchorText = '';
            this.renderChapterPage(targetPage, false, notes, { toStart: !anchor, anchorId: anchor || '' });
            if (this.callbacks.showToast) {
                this.callbacks.showToast(`Followed book link to chapter ${targetPage}`);
            }
            return;
        }

        this.renderPage(targetPage, false, notes);
        if (this.callbacks.showToast) {
            this.callbacks.showToast(`Followed book link to p.${targetPage}`);
        }

        if (anchor && this.elements) {
            this.scrollToAnchor(anchor);
        }
    }

    scrollToAnchor(anchor: string) {
        if (this.elements) {
            this.cancelAnchor?.();
            this.cancelAnchor = domScrollToAnchor(anchor, this.elements);
        }
    }

    scrollToHighlight(noteId: string) {
        return this.scrollToAnnotation(noteId);
    }

    scrollToAnnotation(annotationId: string) {
        if (!this.elements || !annotationId) return null;
        const token = findAnnotationToken(this.elements.bookPaper, annotationId);
        if (!token) return null;
        token.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return token;
    }

    renderTOC(tocItems: TocEntry[] = []) {
        if (!this.elements) return;
        const items = ensureTocHierarchy(tocItems);
        domRenderTOC(items, this.elements, (item) => {
            if (item.navigable === false) return;
            const notes = this.callbacks.getNotes ? this.callbacks.getNotes() : [];
            if (this.isChapterFlow()) {
                this.flowAnchorText = '';
                this.renderChapterPage(item.page || 1, false, notes, {
                    toStart: !item.anchor,
                    anchorId: item.anchor || ''
                });
            } else {
                this.renderPage(item.page || 1, false, notes);
                if (item.anchor) this.scrollToAnchor(item.anchor);
            }
            domCloseTOC(this.elements);
            if (this.callbacks.showToast) {
                this.callbacks.showToast(`Jumped to: ${item.title}`);
            }
        });
    }

    applyHighlights(targetPaper: HTMLElement, targetPage: number, notes: Annotation[] = [], onMarkClick: ReaderCallbacks['onMarkClick'] | null = null) {
        applyHighlightsToPaper(targetPaper, targetPage, notes);
    }

    initUI(elements: AppElements) {
        this.destroy();
        this.elements = elements;
        if (!elements || typeof globalThis.document === 'undefined') return;
        const document = elements.readerPanel?.ownerDocument || elements.bookPaper?.ownerDocument || globalThis.document;
        this.bindings = readerAbortController(document);
        const signal = this.bindings.signal;
        const contentDocument = elements.bookPaper?.ownerDocument || document;
        this.documentBindings = readerAbortController(contentDocument);
        const contentSignal = this.documentBindings.signal;
        if (contentDocument !== document) {
            // App keyboard shortcuts stay in their original command handler.
            contentDocument.addEventListener('keydown', event => {
                if (event.defaultPrevented || event.isComposing || eventElement(event)?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
                const forwarded = new document.defaultView!.KeyboardEvent('keydown', {
                    key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
                    altKey: event.altKey, shiftKey: event.shiftKey, bubbles: true, cancelable: true
                });
                if (!document.dispatchEvent(forwarded)) event.preventDefault();
            }, { signal: contentSignal });
            contentDocument.addEventListener('click', () => {
                if (this.callbacks.onReadingDocumentClick) this.callbacks.onReadingDocumentClick();
                else domCloseTOC(elements);
            }, { signal: contentSignal });
            contentDocument.addEventListener('scroll', () => {
                this.scheduleViewportChange();
                if (!this.isChapterFlow() || this.effectiveReaderMode() !== 'scroll') return;
                this.syncChapterChrome();
                clearTimeout(this._anchorTimer);
                this._anchorTimer = setTimeout(() => this.rememberAnchor(), 120);
            }, { capture: true, signal: contentSignal });
            contentDocument.addEventListener('load', event => {
                if (eventElement(event)?.tagName === 'IMG' && this.isChapterFlow()) {
                    this.refitChapter(this.callbacks.getNotes?.() || []);
                }
                syncReaderDocumentSize(elements); this.scheduleViewportChange();
            }, { capture: true, signal: contentSignal });
        }

        // Navigation Buttons
        if (elements.btnPrevPage) {
            elements.btnPrevPage.addEventListener('click', () => {
                const notes = this.callbacks.getNotes ? this.callbacks.getNotes() : [];
                this.prevPage(notes);
            }, { signal });
        }
        if (elements.btnNextPage) {
            elements.btnNextPage.addEventListener('click', () => {
                const notes = this.callbacks.getNotes ? this.callbacks.getNotes() : [];
                this.nextPage(notes);
            }, { signal });
        }

        // Font Controls
        this.fonts.initUI(elements, signal);

        elements.btnLineSpacingDec?.addEventListener('click', () => this.changeLineSpacing(-1), { signal });
        elements.btnLineSpacingInc?.addEventListener('click', () => this.changeLineSpacing(1), { signal });
        elements.btnReadingWidthDec?.addEventListener('click', () => this.changeReadingWidth(-1), { signal });
        elements.btnReadingWidthInc?.addEventListener('click', () => this.changeReadingWidth(1), { signal });
        this.refreshReadingSettingsControls();

        if (elements.btnFontDec) {
            elements.btnFontDec.addEventListener('click', () => {
                if (this.fontSize > 13) {
                    this.rememberAnchor();
                    this.fontSize -= 1;
                    this.fontSizeOverride = true;
                    if (elements.fontSizeLabel) elements.fontSizeLabel.textContent = `${this.fontSize}px`;
                    this.applyTypography();
                    this.refitAfterTypography();
                }
            }, { signal });
        }

        if (elements.btnFontInc) {
            elements.btnFontInc.addEventListener('click', () => {
                if (this.fontSize < 32) {
                    this.rememberAnchor();
                    this.fontSize += 1;
                    this.fontSizeOverride = true;
                    if (elements.fontSizeLabel) elements.fontSizeLabel.textContent = `${this.fontSize}px`;
                    this.applyTypography();
                    this.refitAfterTypography();
                }
            }, { signal });
        }

        if (elements.indentSelect) {
            elements.indentSelect.value = this.textIndent;
            elements.indentSelect.addEventListener('change', (e) => {
                this.rememberAnchor();
                const input = e.currentTarget as HTMLSelectElement;
                this.textIndent = input.value;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('aura_text_indent', this.textIndent);
                }
                this.applyTypography();
                this.refitAfterTypography();
                if (this.callbacks.showToast) {
                    this.callbacks.showToast(`First-line indent: ${input.options[input.selectedIndex].text}`, { anchor: input });
                }
            }, { signal });
        }

        const viewport = readerViewport(this.elements);
        if (viewport) {
            let lastWheelTurn = -Infinity;
            const onWheel = (event: WheelEvent) => {
                if (event.defaultPrevented || !this.getCurrentBook()) return;
                if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
                if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
                if (eventElement(event)?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
                const paper = elements.bookPaper!;
                if (this.effectiveReaderMode() === 'scroll') {
                    const axis = readingAxis(paper);
                    if (axis.vertical) { event.preventDefault(); setReadingOffset(paper, axis.position + event.deltaY); this.scheduleViewportChange(); }
                    return;
                }
                event.preventDefault();
                // A wheel gesture may emit many events; limit repeated page turns.
                const now = Date.now();
                if (now - lastWheelTurn < 250) return;
                lastWheelTurn = now;
                const notes = this.callbacks.getNotes?.() || [];
                if (event.deltaY > 0) this.nextPage(notes);
                else this.prevPage(notes);
            };
            viewport.addEventListener('wheel', onWheel, { passive: false, signal });
            if (contentDocument !== document) contentDocument.addEventListener('wheel', onWheel, { passive: false, signal: contentSignal });
            // Capture scrolls from both the vertical viewport and its paged
            // chapter strip (horizontal scroll events do not bubble).
            viewport.addEventListener('scroll', () => this.scheduleViewportChange(), { capture: true, passive: true, signal });
            viewport.addEventListener('load', () => this.scheduleViewportChange(), { capture: true, signal });
            viewport.addEventListener('scroll', () => {
                if (!this.isChapterFlow() || this.effectiveReaderMode() !== 'scroll') return;
                this.syncChapterChrome();
                clearTimeout(this._anchorTimer);
                this._anchorTimer = setTimeout(() => this.rememberAnchor(), 120);
            }, { signal });
        }

        // Paper Theme Buttons
        if (elements.paperBtns) {
            elements.paperBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    elements.paperBtns?.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.paperTheme = btn.getAttribute('data-paper') || 'white';
                    if (elements.bookPaper) elements.bookPaper.ownerDocument.documentElement.dataset.userPaper = this.paperTheme;
                    if (elements.readerPanel) {
                        elements.readerPanel.className = `reader-panel paper-${this.paperTheme}`;
                    }
                    this.callbacks.onPaperChanged?.();
                    this.scheduleViewportChange();
                }, { signal });
            });
        }

        elements.btnToc?.addEventListener('click', () => {
            if (!elements.tocDrawer?.classList.contains('open')) this.callbacks.onOpenContents?.();
            domToggleTOC(elements);
        }, { signal });
        document.addEventListener('click', (e) => {
            if (!elements.tocDrawer?.classList.contains('open')) return;
            const path = e.composedPath();
            if (!path.some(node => node === elements.tocDrawer || node === elements.btnToc)) domCloseTOC(elements);
        }, { capture: true, signal });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || !elements.tocDrawer?.classList.contains('open')) return;
            e.preventDefault();
            domCloseTOC(elements);
        }, { capture: true, signal });
    }

    applyTypography() {
        if (this.elements?.bookPaper) {
            const book = this.getCurrentBook();
            // The English application language must not override source-book language.
            this.elements.bookPaper.lang = String(publicationDocument(book, this.currentPage)?.language || book?.language || book?.languages?.[0] || '').replace(/_/g, '-');
        }
        const elements = this.elements;
        if (!elements) return;
        const papers = [elements.bookPaper];
        papers.forEach(paper => {
            if (!paper) return;
            this.fonts.apply(paper);
            this.fontFamily = this.fonts.resolved().family;
            if (paper.dataset.layout === 'pre-paginated') {
                applyLineSpacing(paper, null);
                return;
            }
            if (paper.dataset.authored === 'true' && !this.fontSizeOverride) {
                paper.style.removeProperty('font-size');
                this.fontSize = parseFloat(paper.ownerDocument.defaultView!.getComputedStyle(paper).fontSize) || 18;
                if (elements.fontSizeLabel) elements.fontSizeLabel.textContent = `${this.fontSize}px`;
            } else paper.style.setProperty('font-size', `${this.fontSize}px`, 'important');
            paper.style.setProperty('--book-text-indent', this.textIndent);
            paper.classList.toggle('reader-user-indent', !!globalThis.localStorage?.getItem('aura_text_indent'));
            applyLineSpacing(paper, this.lineSpacingOverride ? this.lineSpacing : null);
            if (!this.lineSpacingOverride) this.lineSpacing = readLineSpacing(paper);
        });
        // Width must be current before the chapter strip measures its columns.
        this.layoutController?.updateLayoutClasses(elements);
        this.refreshReadingSettingsControls();
    }

    private readingSettingsUnavailable() {
        if (!this.getCurrentBook()) return 'Open a book to adjust reading layout';
        if (this.elements?.bookPaper?.dataset.layout === 'pre-paginated') return 'Fixed-layout books keep their page layout';
        return '';
    }

    private readingWidthGeometry(preferred = this.layoutController?.readingWidth || 560) {
        const elements = this.elements;
        if (!elements?.workspaceContainer || !isImmersiveNotes(elements)) return null;
        const workspace = elements.workspaceContainer;
        return marginGeometry(workspace.clientWidth || workspace.ownerDocument.defaultView?.innerWidth || 1200, preferred);
    }

    refreshReadingSettingsControls() {
        const elements = this.elements;
        if (!elements) return;
        const reason = this.readingSettingsUnavailable();
        const fixed = elements.bookPaper?.dataset.layout === 'pre-paginated';
        const preferred = this.layoutController?.readingWidth || 560;
        const geometry = this.readingWidthGeometry(fixed ? 560 : preferred);
        const width = geometry?.readingWidth || elements.paperContainer?.clientWidth || 560;
        const maximum = this.readingWidthGeometry(800)?.readingWidth || width;
        if (elements.lineSpacingLabel) {
            elements.lineSpacingLabel.textContent = `${this.lineSpacing.toFixed(2)}×`;
            elements.lineSpacingLabel.title = reason || 'Body line height relative to font size';
            elements.lineSpacingLabel.setAttribute('aria-label', reason || `Line spacing ${this.lineSpacing.toFixed(2)} times`);
        }
        if (elements.readingWidthLabel) {
            elements.readingWidthLabel.textContent = `${Math.round(width)}px`;
            const description = reason || (width < preferred ? `Preferred ${preferred}px; available ${Math.round(width)}px` : `Reading width ${Math.round(width)}px`);
            elements.readingWidthLabel.title = description;
            elements.readingWidthLabel.setAttribute('aria-label', description);
        }
        const controls: [HTMLButtonElement | null | undefined, boolean, string][] = [
            [elements.btnLineSpacingDec, this.lineSpacing <= 1.20, 'Decrease line spacing'],
            [elements.btnLineSpacingInc, this.lineSpacing >= 2.40, 'Increase line spacing'],
            [elements.btnReadingWidthDec, !geometry || width <= 320, 'Decrease reading width'],
            [elements.btnReadingWidthInc, !geometry || width >= Math.min(800, maximum), 'Increase reading width'],
        ];
        for (const [button, limit, label] of controls) if (button) {
            button.disabled = !!reason || limit;
            button.title = reason || label;
        }
    }

    changeLineSpacing(direction: number) {
        if (this.readingSettingsUnavailable()) return;
        const value = Math.max(1.20, Math.min(2.40, Math.round((this.lineSpacing + Math.sign(direction) * 0.05) * 100) / 100));
        if (!direction || value === this.lineSpacing) return;
        this.queueReadingSettingsLayout();
        this.lineSpacing = value;
        this.lineSpacingOverride = true;
        this.refreshReadingSettingsControls();
    }

    changeReadingWidth(direction: number) {
        if (this.readingSettingsUnavailable() || !this.layoutController) return;
        const geometry = this.readingWidthGeometry();
        if (!geometry || !direction) return;
        const width = geometry.readingWidth;
        const maximum = this.readingWidthGeometry(800)!.readingWidth;
        if (direction < 0 ? width <= 320 : width >= Math.min(800, maximum)) return;
        const preferred = Math.max(320, Math.min(800, width + Math.sign(direction) * 40));
        this.queueReadingSettingsLayout();
        this.layoutController.readingWidth = preferred;
        this.refreshReadingSettingsControls();
    }

    private queueReadingSettingsLayout() {
        if (this.cancelSettingsLayout || !this.elements) return;
        this.rememberAnchor();
        const position = captureReadingPosition(this.elements.bookPaper, readerViewport(this.elements));
        const view = this.elements.readerPanel?.ownerDocument.defaultView || this.elements.bookPaper?.ownerDocument.defaultView;
        const update = () => {
            this.cancelSettingsLayout = undefined;
            if (!this.elements || !this.getCurrentBook()) return;
            if (this.isChapterFlow()) {
                this.applyTypography();
                this.layoutAndPlace(this.callbacks.getNotes?.() || [], { preserve: true });
                if (!restoreReadingPosition(this.elements.bookPaper, readerViewport(this.elements), position, this.effectiveReaderMode()) && this.flowAnchorText) {
                    placeSentenceAtTopLeft(this.elements.bookPaper, readerViewport(this.elements), this.flowAnchorText, this.effectiveReaderMode());
                }
                this.syncChapterChrome();
            }
            else {
                this.applyTypography();
                syncReaderDocumentSize(this.elements);
                this.callbacks.onPageRendered?.();
                this.emit('render');
                this.scheduleViewportChange();
            }
        };
        if (view?.requestAnimationFrame) {
            const id = view.requestAnimationFrame(update);
            this.cancelSettingsLayout = () => view.cancelAnimationFrame(id);
        } else {
            const id = setTimeout(update, 0);
            this.cancelSettingsLayout = () => clearTimeout(id);
        }
    }

    refitAfterTypography() {
        if (!this.isChapterFlow()) {
            this.scheduleViewportChange();
            return;
        }
        this.refitChapter(this.callbacks.getNotes ? this.callbacks.getNotes() : []);
    }

    refitChapter(notes: Annotation[] = []): ReadingLocation {
        if (!this.isChapterFlow() || !this.elements) return this.getLocation();
        if (this._flowPage !== this.currentPage) {
            return this.renderChapterPage(this.currentPage, false, notes, { placeAnchor: true });
        }
        this.applyTypography();
        this.layoutAndPlace(notes, { placeAnchor: true, preserve: true });
        return this.getLocation();
    }

    showQuote(page: number, quote: string, notes: Annotation[] = []): ReadingLocation {
        this.flowAnchorText = String(quote || '').trim();
        return this.renderChapterPage(page || this.currentPage, false, notes, {
            placeAnchor: true,
            anchorText: this.flowAnchorText
        });
    }

    renderChapterPage(pageNum: number, preserveScroll = false, notes: Annotation[] = [], options: ChapterRenderOptions = {}): ReadingLocation {
        if (!preserveScroll) notes = this.callbacks.beforeNavigate?.() || notes;
        const sourcePage = Number(pageNum);
        const source = publicationDocument(this.getCurrentBook(), sourcePage);
        const flow = source?.layout === 'pre-paginated' ? { page: sourcePage, prefixPages: [] } : readingUnitForPage(this.bookStructure, sourcePage);
        const loc = this.engine.goToPage(flow.page);
        this._volumeTitlePages = flow.prefixPages;
        this.currentPage = loc.page;
        this.totalPages = this.engine.getTotalPages();
        this.paintChapter(loc.page, notes);
        const anchorText = options.anchorText || (preserveScroll ? this.flowAnchorText : '');
        const placeAnchor = !!(options.placeAnchor || options.anchorText || options.anchorId || (preserveScroll && anchorText));
        this.layoutAndPlace(notes, {
            toStart: !placeAnchor && !options.toEnd,
            toEnd: !!options.toEnd && !placeAnchor,
            placeAnchor,
            anchorText,
            anchorId: options.anchorId || '',
            anchorPage: sourcePage
        });
        if (this.callbacks.onPageChange) this.callbacks.onPageChange(this.getLocation());
        this.emit('location');
        if (this.callbacks.onPageRendered) this.callbacks.onPageRendered();
        this.emit('render');
        return loc;
    }

    paintChapter(page: number, notes: Annotation[]) {
        const elements = this.elements;
        if (!elements || !elements.bookPaper) return;
        preparePublicationDocument(elements.bookPaper, this.getCurrentBook(), page, () => {
            if (this.elements && this._flowPage === page) this.refitChapter(this.callbacks.getNotes?.() || []);
        });
        elements.bookPaper.innerHTML = this.engine.getPageContent(page);
        preparePublicationContent(elements.bookPaper, this.getCurrentBook(), page);
        elements.bookPaper.dataset.flowPage = String(page);
        this._flowPage = page;
        this.applyTypography();
        applyHighlightsToPaper(elements.bookPaper, page, notes);
        const document = elements.bookPaper.ownerDocument;
        const prefixes = document.createDocumentFragment();
        for (const titlePage of this._volumeTitlePages) {
            const title = document.createElement('div');
            title.dataset.volumeTitlePage = String(titlePage);
            title.style.display = 'contents';
            title.innerHTML = this.engine.getPageContent(titlePage);
            preparePublicationContent(title, this.getCurrentBook(), titlePage);
            applyHighlightsToPaper(title, titlePage, notes);
            prefixes.appendChild(title);
        }
        elements.bookPaper.prepend(prefixes);
        interceptInTextLinks(elements, this.engine.getCurrentBook(), (href) => {
            this.handleInTextLinkClick(href, this.callbacks.getNotes ? this.callbacks.getNotes() : notes);
        });
    }

    layoutAndPlace(notes: Annotation[], options: ChapterRenderOptions = {}): void {
        const elements = this.elements;
        if (!elements) return;
        const mode = this.effectiveReaderMode();
        const source = publicationDocument(this.getCurrentBook(), this.currentPage);
        if (source?.layout === 'pre-paginated') {
            layoutFixedDocument(elements, source);
            this.syncChapterChrome();
            return;
        }
        refreshReadiumStyles(elements.bookPaper!);
        elements.bookPaper?.classList.remove('fixed-layout');
        const frame = elements.bookPaper?.ownerDocument.defaultView?.frameElement as HTMLIFrameElement | null;
        if (frame) { frame.style.transform = ''; frame.style.transformOrigin = ''; frame.style.marginLeft = ''; frame.style.width = '100%'; }
        if (elements.paperContainer) { elements.paperContainer.style.height = ''; elements.paperContainer.style.position = ''; }
        const laid = layoutChapterStrip(elements, mode);
        syncReaderDocumentSize(elements);
        fitChapterImages(elements, mode);
        if (mode === 'scroll') syncReaderDocumentSize(elements);
        if (laid && laid.mode !== 'scroll' && laid.hostHeight < 40 && !options.retried) {
            const view = elements.bookPaper!.ownerDocument.defaultView!;
            this.cancelLayout?.();
            const id = view.requestAnimationFrame(() => {
                this.cancelLayout = undefined;
                this.layoutAndPlace(notes, { ...options, retried: true });
            });
            this.cancelLayout = () => view.cancelAnimationFrame(id);
            return;
        }
        const viewport = readerViewport(this.elements);
        const paper = elements.bookPaper;
        if (options.anchorId && paper) {
            placeAnchorIdAtTopLeft(paper, viewport, options.anchorId, mode, options.anchorPage);
        } else if (options.placeAnchor) {
            const sentence = options.anchorText || this.flowAnchorText;
            if (sentence && paper) placeSentenceAtTopLeft(paper, viewport, sentence, mode);
        } else if (options.toEnd) {
            scrollStripToEnd(elements, mode);
        } else if (options.toStart || !options.preserve) {
            scrollStripToStart(elements, mode);
        }
        this.syncChapterChrome();
        clearTimeout(this._anchorTimer);
        this._anchorTimer = setTimeout(() => this.rememberAnchor(), 60);
    }

    stepChapter(direction: number, notes: Annotation[] = []): ReadingLocation {
        notes = this.callbacks.beforeNavigate?.() || notes;
        const mode = this.effectiveReaderMode();
        const fixed = publicationDocument(this.getCurrentBook(), this.currentPage)?.layout === 'pre-paginated';
        const moved = fixed ? 'edge' : shiftStrip(this.elements, mode, direction);
        if (moved === 'moved') {
            this.syncChapterChrome();
            clearTimeout(this._anchorTimer);
            this._anchorTimer = setTimeout(() => this.rememberAnchor(), 60);
            return this.getLocation();
        }
        let target = (direction < 0 ? (this._volumeTitlePages[0] || this.currentPage) : this.currentPage) + direction;
        const documents = this.getCurrentBook()?.epub?.documents;
        while (documents?.some(document => document.page === target && document.linear === false)) target += direction;
        if (target < 1 || target > this.totalPages) {
            this.syncChapterChrome();
            return this.getLocation();
        }
        this.flowAnchorText = '';
        return this.renderChapterPage(target, false, notes, { toEnd: direction < 0, toStart: direction > 0 });
    }

    syncChapterChrome() {
        const elements = this.elements;
        if (!elements || !this.isChapterFlow()) return;
        const mode = this.effectiveReaderMode();
        const fixed = publicationDocument(this.getCurrentBook(), this.currentPage)?.layout === 'pre-paginated';
        if (fixed) {
            if (elements.currentPageSpan) elements.currentPageSpan.textContent = String(this.currentPage);
            if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = String(this.totalPages);
            if (elements.pageUnit) elements.pageUnit.textContent = ' pages';
        } else writeChapterIndicator(elements, mode);
        const atStart = fixed || atStripStart(elements, mode);
        const atEnd = fixed || atStripEnd(elements, mode);
        const documents = this.getCurrentBook()?.epub?.documents;
        const hasPrevious = documents ? documents.some(document => document.linear !== false && document.page < (this._volumeTitlePages[0] || this.currentPage)) : this.currentPage > 1;
        const hasNext = documents ? documents.some(document => document.linear !== false && document.page > this.currentPage) : this.currentPage < this.totalPages;
        if (elements.btnPrevPage) elements.btnPrevPage.disabled = !hasPrevious && atStart;
        if (elements.btnNextPage) elements.btnNextPage.disabled = !hasNext && atEnd;
        if (this.layoutController && typeof this.layoutController.updateLayoutClasses === 'function') {
            this.layoutController.updateLayoutClasses(elements);
        }
        this.refreshReadingSettingsControls();
        this.scheduleViewportChange();
    }
}

function findAnnotationToken(paper: HTMLElement | null | undefined, annotationId: string): HTMLElement | null {
    if (!paper || !annotationId || typeof paper.querySelector !== 'function') return null;
    const escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(annotationId) : String(annotationId).replace(/"/g, '\\"');
    return paper.querySelector(`[data-highlight-ids~="${escaped}"], [data-note-ids~="${escaped}"]`);
}
