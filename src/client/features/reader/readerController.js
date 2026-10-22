/* ==========================================================================
   ReaderController - Reading Interaction & View Management Feature Controller
   Authority owner of: currentPage, currentLeftPage, currentRightPage,
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
    renderPaperSpread,
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
    constructor({
        readerEngine = null,
        layoutController = null,
        callbacks = {}
    } = {}) {
        this.engine = readerEngine || new ReaderEngine();
        this.layoutController = layoutController;
        this.callbacks = callbacks; // onMarkClick, onLinkClick, showToast, onPageChange

        const storage = (typeof localStorage !== 'undefined') ? localStorage : null;
        this.fontSize = 18;
        this.fontFamily = "'Inter', sans-serif";
        this.textIndent = (storage && storage.getItem('aura_text_indent')) || '2em';
        this.paperTheme = 'white';

        this.currentPage = 1;
        this.currentLeftPage = 1;
        this.currentRightPage = null;
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

    setLayoutController(controller) {
        this.layoutController = controller;
    }

    setBook(bookKey, bookObj) {
        this.engine.setBook(bookKey, bookObj);
        this.bookStructure = buildBookStructure(bookObj);
        const loc = this.engine.getLocation();
        this.currentPage = loc.page;
        this.currentLeftPage = loc.page;
        this.currentRightPage = null;
        this.totalPages = loc.totalPages;
        this.flowAnchorText = '';
        this._flowPage = 0;

        if (this.elements) {
            if (this.elements.currentBookTitle) this.elements.currentBookTitle.textContent = bookObj.title;
            if (this.elements.currentBookTag) this.elements.currentBookTag.textContent = bookObj.format || 'EPUB';
            if (this.elements.totalPagesSpan) this.elements.totalPagesSpan.textContent = this.totalPages;
        }

        this.renderTOC(bookObj.toc || []);
        this._volumeTitlePages = [];
        this.fonts.prepareForBook();
        return loc;
    }

    getCurrentPage() {
        return this.currentPage;
    }

    getCurrentLeftPage() {
        return this.currentLeftPage;
    }

    getCurrentRightPage() {
        return this.currentRightPage;
    }

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
        if (!elements || typeof document === 'undefined') return new Set();
        return collectVisibleAnnotationIds(
            [elements.bookPaper, elements.bookPaperRight],
            document.getElementById('reader-viewport')
        );
    }

    scheduleViewportChange() {
        if (this._viewportUpdatePending || !this.callbacks.onViewportChange) return;
        this._viewportUpdatePending = true;
        const update = () => {
            this._viewportUpdatePending = false;
            this.callbacks.onViewportChange?.();
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(update);
        else setTimeout(update, 0);
    }

    isChapterFlow() {
        return isChapterFlowBook(this.getCurrentBook());
    }

    effectiveReaderMode() {
        if (!this.layoutController || typeof this.layoutController.getEffectiveReaderMode !== 'function') {
            return 'single';
        }
        return this.layoutController.getEffectiveReaderMode();
    }

    rememberAnchor() {
        if (!this.isChapterFlow() || !this.elements || !this.elements.bookPaper) return this.flowAnchorText;
        const viewport = document.getElementById('reader-viewport');
        const sentence = readTopLeftSentence(this.elements.bookPaper, viewport);
        if (sentence) this.flowAnchorText = sentence;
        return this.flowAnchorText;
    }

    renderPage(pageNum, preserveScroll = false, notes = [], options = {}) {
        if (this.isChapterFlow()) {
            return this.renderChapterPage(pageNum, preserveScroll, notes, options);
        }
        if (!preserveScroll) notes = this.callbacks.beforeNavigate?.() || notes;
        const loc = this.engine.goToPage(pageNum);
        this.currentPage = loc.page;
        this.currentLeftPage = loc.page;
        this.totalPages = this.engine.getTotalPages();

        const isDouble = this.layoutController ? this.layoutController.isDoublePageEffective() : false;
        if (isDouble) {
            const spread = this.engine.getSpreadPages(loc.page);
            this.currentLeftPage = spread.leftPage;
            this.currentRightPage = spread.rightPage;
        } else {
            this.currentRightPage = null;
        }

        if (this.elements) {
            renderPaperSpread({
                elements: this.elements,
                readerEngine: this.engine,
                layoutSystem: this.layoutController,
                notes,
                textIndent: this.textIndent,
                preserveScroll,
                onMarkClick: (markEl, note) => {
                    if (this.callbacks.onMarkClick) {
                        this.callbacks.onMarkClick(markEl, note);
                    }
                },
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
        if (this.callbacks.onPageRendered) {
            this.callbacks.onPageRendered();
        }
        this.scheduleViewportChange();

        return loc;
    }

    nextPage(notes = []) {
        if (this.isChapterFlow()) return this.stepChapter(1, notes);
        const isDouble = this.layoutController ? this.layoutController.isDoublePageEffective() : false;
        const loc = this.engine.nextPage(isDouble);
        return this.renderPage(loc.page, false, notes);
    }

    prevPage(notes = []) {
        if (this.isChapterFlow()) return this.stepChapter(-1, notes);
        const isDouble = this.layoutController ? this.layoutController.isDoublePageEffective() : false;
        const loc = this.engine.prevPage(isDouble);
        return this.renderPage(loc.page, false, notes);
    }

    goToPage(pageNum, offset = 0, notes = []) {
        const loc = this.engine.goToPage(pageNum, offset);
        return this.renderPage(loc.page, false, notes);
    }

    handleInTextLinkClick(href, notes = []) {
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

    scrollToAnchor(anchor) {
        if (this.elements) {
            domScrollToAnchor(anchor, this.elements);
        }
    }

    scrollToHighlight(noteId) {
        return this.scrollToAnnotation(noteId);
    }

    scrollToAnnotation(annotationId) {
        if (!this.elements || !annotationId) return null;
        const token = findAnnotationToken(this.elements.bookPaper, annotationId)
            || findAnnotationToken(this.elements.bookPaperRight, annotationId);
        if (!token) return null;
        token.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return token;
    }

    renderTOC(tocItems = []) {
        if (!this.elements) return;
        const items = ensureTocHierarchy(tocItems);
        domRenderTOC(items, this.elements, (item) => {
            const notes = this.callbacks.getNotes ? this.callbacks.getNotes() : [];
            if (this.isChapterFlow()) {
                this.flowAnchorText = '';
                this.renderChapterPage(item.page, false, notes, {
                    toStart: !item.anchor,
                    anchorId: item.anchor || ''
                });
            } else {
                this.renderPage(item.page, false, notes);
                if (item.anchor) this.scrollToAnchor(item.anchor);
            }
            domCloseTOC(this.elements);
            if (this.callbacks.showToast) {
                this.callbacks.showToast(`跳转至：${item.title}`);
            }
        });
    }

    applyHighlights(targetPaper, targetPage, notes = [], onMarkClick = null) {
        applyHighlightsToPaper(targetPaper, targetPage, notes, onMarkClick || this.callbacks.onMarkClick);
    }

    initUI(elements) {
        this.elements = elements;
        if (!elements || typeof document === 'undefined') return;

        // Navigation Buttons
        if (elements.btnPrevPage) {
            elements.btnPrevPage.addEventListener('click', () => {
                const notes = this.callbacks.getNotes ? this.callbacks.getNotes() : [];
                this.prevPage(notes);
            });
        }
        if (elements.btnNextPage) {
            elements.btnNextPage.addEventListener('click', () => {
                const notes = this.callbacks.getNotes ? this.callbacks.getNotes() : [];
                this.nextPage(notes);
            });
        }

        // Font Controls
        this.fonts.initUI(elements);

        if (elements.btnFontDec) {
            elements.btnFontDec.addEventListener('click', () => {
                if (this.fontSize > 13) {
                    this.rememberAnchor();
                    this.fontSize -= 1;
                    if (elements.fontSizeLabel) elements.fontSizeLabel.textContent = `${this.fontSize}px`;
                    this.applyTypography();
                    this.refitAfterTypography();
                }
            });
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
            });
        }

        if (elements.indentSelect) {
            elements.indentSelect.value = this.textIndent;
            elements.indentSelect.addEventListener('change', (e) => {
                this.rememberAnchor();
                this.textIndent = e.target.value;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('aura_text_indent', this.textIndent);
                }
                this.applyTypography();
                this.refitAfterTypography();
                if (this.callbacks.showToast) {
                    this.callbacks.showToast(`已切换首行缩进：${e.target.options[e.target.selectedIndex].text}`);
                }
            });
        }

        const viewport = document.getElementById('reader-viewport');
        if (viewport) {
            // Capture scrolls from both the vertical viewport and its paged
            // chapter strip (horizontal scroll events do not bubble).
            viewport.addEventListener('scroll', () => this.scheduleViewportChange(), { capture: true, passive: true });
            viewport.addEventListener('load', () => this.scheduleViewportChange(), { capture: true });
            viewport.addEventListener('scroll', () => {
                if (!this.isChapterFlow() || this.effectiveReaderMode() !== 'scroll') return;
                this.syncChapterChrome();
                clearTimeout(this._anchorTimer);
                this._anchorTimer = setTimeout(() => this.rememberAnchor(), 120);
            });
        }

        // Paper Theme Buttons
        if (elements.paperBtns) {
            elements.paperBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    elements.paperBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.paperTheme = btn.getAttribute('data-paper');
                    if (elements.readerPanel) {
                        elements.readerPanel.className = `reader-panel paper-${this.paperTheme}`;
                    }
                    this.scheduleViewportChange();
                });
            });
        }

        // TOC Drawer Controls
        if (elements.btnToc) {
            elements.btnToc.addEventListener('click', (e) => {
                e.stopPropagation();
                domToggleTOC(elements);
            });
        }
        if (elements.btnCloseToc) {
            elements.btnCloseToc.addEventListener('click', (e) => {
                e.stopPropagation();
                domCloseTOC(elements);
            });
        }
        document.addEventListener('click', (e) => {
            if (elements.tocDrawer && elements.tocDrawer.classList.contains('open')) {
                if (!e.target.closest('#toc-drawer') && !e.target.closest('#btn-toc')) {
                    domCloseTOC(elements);
                }
            }
        });
    }

    applyTypography() {
        const elements = this.elements;
        if (!elements) return;
        const papers = [elements.bookPaper, elements.bookPaperRight];
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

    refitChapter(notes = []) {
        if (!this.isChapterFlow() || !this.elements) return this.getLocation();
        if (this._flowPage !== this.currentPage) {
            return this.renderChapterPage(this.currentPage, false, notes, { placeAnchor: true });
        }
        this.applyTypography();
        this.layoutAndPlace(notes, { placeAnchor: true, preserve: true });
        return this.getLocation();
    }

    showQuote(page, quote, notes = []) {
        this.flowAnchorText = String(quote || '').trim();
        return this.renderChapterPage(page || this.currentPage, false, notes, {
            placeAnchor: true,
            anchorText: this.flowAnchorText
        });
    }

    renderChapterPage(pageNum, preserveScroll = false, notes = [], options = {}) {
        if (!preserveScroll) notes = this.callbacks.beforeNavigate?.() || notes;
        const sourcePage = Number(pageNum);
        const flow = readingUnitForPage(this.bookStructure, sourcePage);
        const loc = this.engine.goToPage(flow.page);
        this._volumeTitlePages = flow.prefixPages;
        this.currentPage = loc.page;
        this.currentLeftPage = loc.page;
        this.currentRightPage = null;
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
        if (this.callbacks.onPageRendered) this.callbacks.onPageRendered();
        return loc;
    }

    paintChapter(page, notes) {
        const elements = this.elements;
        if (!elements || !elements.bookPaper) return;
        elements.bookPaper.innerHTML = this.engine.getPageContent(page);
        elements.bookPaper.dataset.flowPage = String(page);
        this._flowPage = page;
        this.applyTypography();
        applyHighlightsToPaper(elements.bookPaper, page, notes, (markEl, note) => {
            if (this.callbacks.onMarkClick) this.callbacks.onMarkClick(markEl, note);
        });
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

    layoutAndPlace(notes, options = {}) {
        const elements = this.elements;
        if (!elements) return;
        const mode = this.effectiveReaderMode();
        const laid = layoutChapterStrip(elements, mode);
        if (laid && laid.mode !== 'scroll' && laid.hostHeight < 40 && !options.retried) {
            requestAnimationFrame(() => this.layoutAndPlace(notes, { ...options, retried: true }));
            return;
        }
        const viewport = document.getElementById('reader-viewport');
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

    stepChapter(direction, notes = []) {
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

function findAnnotationToken(paper, annotationId) {
    if (!paper || !annotationId || typeof paper.querySelector !== 'function') return null;
    const escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(annotationId) : String(annotationId).replace(/"/g, '\\"');
    return paper.querySelector(`[data-highlight-ids~="${escaped}"], [data-note-ids~="${escaped}"]`);
}
