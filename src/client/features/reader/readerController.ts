import { eventElement } from '../../app/dom.js';
import { readerAbortController, readerViewport } from './readerDom.js';
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
    readTopLeftSentence,
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
    private listeners = new Set<(event: 'render' | 'viewport' | 'location') => void>();
    private cancelViewport?: () => void;
    private cancelLayout?: () => void;
    private cancelAnchor?: () => void;

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
        clearTimeout(this._anchorTimer);
        this.cancelViewport?.(); this.cancelLayout?.(); this.cancelAnchor?.();
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
            beforeChange: () => this.rememberAnchor(),
            onChange: () => { this.applyTypography(); this.refitAfterTypography(); },
            onReady: () => {
                if (this.isChapterFlow() && !this._flowPage) { this.applyTypography(); return; }
                this.rememberAnchor(); this.applyTypography(); this.refitAfterTypography();
            },
            notify: message => this.callbacks.showToast?.(message)
        });
    }

    setLayoutController(controller: LayoutController) {
        this.layoutController = controller;
    }

    setBook(bookKey: string, bookObj: Book) {
        this.engine.setBook(bookKey, bookObj);
        this.bookStructure = buildBookStructure(bookObj);
        const loc = this.engine.getLocation();
        this.currentPage = loc.page;
        this.totalPages = loc.totalPages;
        this.flowAnchorText = '';
        this._flowPage = 0;

        if (this.elements) {
            if (this.elements.currentBookTitle) this.elements.currentBookTitle.textContent = bookObj.title;
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

    clearBook() {
        clearTimeout(this._anchorTimer);
        this.engine.setBook('', null);
        this.bookStructure = null; this.flowAnchorText = ''; this._flowPage = 0; this._volumeTitlePages = [];
        this.currentPage = this.totalPages = 1;
        for (const paper of [this.elements?.bookPaper]) paper?.replaceChildren();
        if (this.elements?.currentBookTitle) this.elements.currentBookTitle.textContent = '未打开书籍';
        this.renderTOC([]);
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

    refreshAnnotations(notes: Annotation[] = []) {
        const elements = this.elements;
        if (!elements) return;
        const viewport = readerViewport(elements);
        const surfaces = [viewport, elements.bookPaper].filter((node): node is HTMLElement => !!node);
        const positions = surfaces.map(node => ({ node, left: node.scrollLeft, top: node.scrollTop }));
        if (elements.bookPaper) {
            applyHighlightsToPaper(elements.bookPaper, this.currentPage, notes);
            for (const title of elements.bookPaper.querySelectorAll<HTMLElement>('[data-volume-title-page]')) {
                applyHighlightsToPaper(title, Number(title.dataset.volumeTitlePage), notes);
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
        const targetPage = resolveTargetPage(href, map, this.currentPage);
        const [, anchor] = String(href || '').split('#');

        if (this.isChapterFlow()) {
            this.flowAnchorText = '';
            this.renderChapterPage(targetPage, false, notes, { toStart: !anchor, anchorId: anchor || '' });
            if (this.callbacks.showToast) {
                this.callbacks.showToast(`书内关联跳转至第 ${targetPage} 章`);
            }
            return;
        }

        this.renderPage(targetPage, false, notes);
        if (this.callbacks.showToast) {
            this.callbacks.showToast(`书内关联跳转至 P.${targetPage}`);
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
                this.callbacks.showToast(`跳转至：${item.title}`);
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
        const document = elements.bookPaper?.ownerDocument || globalThis.document;
        this.bindings = readerAbortController(document);
        const signal = this.bindings.signal;

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

        if (elements.btnFontDec) {
            elements.btnFontDec.addEventListener('click', () => {
                if (this.fontSize > 13) {
                    this.rememberAnchor();
                    this.fontSize -= 1;
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
                    this.callbacks.showToast(`已切换首行缩进：${input.options[input.selectedIndex].text}`);
                }
            }, { signal });
        }

        const viewport = readerViewport(this.elements);
        if (viewport) {
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
                    if (elements.readerPanel) {
                        elements.readerPanel.className = `reader-panel paper-${this.paperTheme}`;
                    }
                    this.scheduleViewportChange();
                }, { signal });
            });
        }

        // TOC Drawer Controls
        if (elements.btnToc) {
            elements.btnToc.addEventListener('click', (e) => {
                e.stopPropagation();
                domToggleTOC(elements);
            }, { signal });
        }
        if (elements.btnCloseToc) {
            elements.btnCloseToc.addEventListener('click', (e) => {
                e.stopPropagation();
                domCloseTOC(elements);
            }, { signal });
        }
        document.addEventListener('click', (e) => {
            if (elements.tocDrawer && elements.tocDrawer.classList.contains('open')) {
                if (!eventElement(e)?.closest('#toc-drawer') && !eventElement(e)?.closest('#btn-toc')) {
                    domCloseTOC(elements);
                }
            }
        }, { signal });
    }

    applyTypography() {
        const elements = this.elements;
        if (!elements) return;
        const papers = [elements.bookPaper];
        papers.forEach(paper => {
            if (!paper) return;
            paper.style.fontSize = `${this.fontSize}px`;
            this.fonts.apply(paper);
            this.fontFamily = this.fonts.resolved().family;
            paper.style.setProperty('--book-text-indent', this.textIndent);
        });
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
        const flow = readingUnitForPage(this.bookStructure, sourcePage);
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
        elements.bookPaper.innerHTML = this.engine.getPageContent(page);
        elements.bookPaper.dataset.flowPage = String(page);
        this._flowPage = page;
        this.applyTypography();
        applyHighlightsToPaper(elements.bookPaper, page, notes);
        const prefixes = document.createDocumentFragment();
        for (const titlePage of this._volumeTitlePages) {
            const title = document.createElement('div');
            title.dataset.volumeTitlePage = String(titlePage);
            title.style.display = 'contents';
            title.innerHTML = this.engine.getPageContent(titlePage);
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
        const laid = layoutChapterStrip(elements, mode);
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
        const moved = shiftStrip(this.elements, mode, direction);
        if (moved === 'moved') {
            this.syncChapterChrome();
            clearTimeout(this._anchorTimer);
            this._anchorTimer = setTimeout(() => this.rememberAnchor(), 60);
            return this.getLocation();
        }
        const target = (direction < 0 ? (this._volumeTitlePages[0] || this.currentPage) : this.currentPage) + direction;
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
        writeChapterIndicator(elements, mode);
        const atStart = atStripStart(elements, mode);
        const atEnd = atStripEnd(elements, mode);
        if (elements.btnPrevPage) elements.btnPrevPage.disabled = (this._volumeTitlePages[0] || this.currentPage) <= 1 && atStart;
        if (elements.btnNextPage) elements.btnNextPage.disabled = this.currentPage >= this.totalPages && atEnd;
        if (this.layoutController && typeof this.layoutController.updateLayoutClasses === 'function') {
            this.layoutController.updateLayoutClasses(elements);
        }
        this.scheduleViewportChange();
    }
}

function findAnnotationToken(paper: HTMLElement | null | undefined, annotationId: string): HTMLElement | null {
    if (!paper || !annotationId || typeof paper.querySelector !== 'function') return null;
    const escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(annotationId) : String(annotationId).replace(/"/g, '\\"');
    return paper.querySelector(`[data-highlight-ids~="${escaped}"], [data-note-ids~="${escaped}"]`);
}
