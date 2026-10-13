/* ==========================================================================
   ReaderController - Reading Interaction & View Management Feature Controller
   Authority owner of: currentPage, currentLeftPage, currentRightPage,
   font & paper settings (fontSize, fontFamily, textIndent, paperTheme).
   Coordinates ReaderEngine, PaperRenderer, TocUI.
   ========================================================================== */

import { ReaderEngine } from '../../domain/readerEngine.js';
import { resolveTargetPage, ensureTocHierarchy } from '../../domain/readingLocation.js';
import {
    renderPaperSpread,
    applyHighlightsToPaper,
    scrollToAnchor as domScrollToAnchor
} from './paperRenderer.js';
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
    }

    setLayoutController(controller) {
        this.layoutController = controller;
    }

    setBook(bookKey, bookObj) {
        this.engine.setBook(bookKey, bookObj);
        const loc = this.engine.getLocation();
        this.currentPage = loc.page;
        this.currentLeftPage = loc.page;
        this.currentRightPage = null;
        this.totalPages = loc.totalPages;

        if (this.elements) {
            if (this.elements.currentBookTitle) this.elements.currentBookTitle.textContent = bookObj.title;
            if (this.elements.currentBookTag) this.elements.currentBookTag.textContent = bookObj.format || 'EPUB';
            if (this.elements.totalPagesSpan) this.elements.totalPagesSpan.textContent = this.totalPages;
        }

        this.renderTOC(bookObj.toc || []);
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

    renderPage(pageNum, preserveScroll = false, notes = []) {
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

        return loc;
    }

    nextPage(notes = []) {
        const isDouble = this.layoutController ? this.layoutController.isDoublePageEffective() : false;
        const loc = this.engine.nextPage(isDouble);
        return this.renderPage(loc.page, false, notes);
    }

    prevPage(notes = []) {
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

        this.renderPage(targetPage, false, notes);
        if (this.callbacks.showToast) {
            this.callbacks.showToast(`书内关联跳转至 P.${targetPage}`);
        }

        const [, anchor] = href.split('#');
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
            this.renderPage(item.page, false, (this.callbacks.getNotes ? this.callbacks.getNotes() : []));
            domCloseTOC(this.elements);
            if (this.callbacks.showToast) {
                this.callbacks.showToast(`跳转至：${item.title}`);
            }
            if (item.anchor) {
                this.scrollToAnchor(item.anchor);
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
        if (elements.fontFamilySelect) {
            elements.fontFamilySelect.addEventListener('change', (e) => {
                this.fontFamily = e.target.value;
                if (elements.bookPaper) elements.bookPaper.style.fontFamily = this.fontFamily;
                if (elements.bookPaperRight) elements.bookPaperRight.style.fontFamily = this.fontFamily;
            });
        }

        if (elements.btnFontDec) {
            elements.btnFontDec.addEventListener('click', () => {
                if (this.fontSize > 13) {
                    this.fontSize -= 1;
                    if (elements.fontSizeLabel) elements.fontSizeLabel.textContent = `${this.fontSize}px`;
                    if (elements.bookPaper) elements.bookPaper.style.fontSize = `${this.fontSize}px`;
                    if (elements.bookPaperRight) elements.bookPaperRight.style.fontSize = `${this.fontSize}px`;
                }
            });
        }

        if (elements.btnFontInc) {
            elements.btnFontInc.addEventListener('click', () => {
                if (this.fontSize < 32) {
                    this.fontSize += 1;
                    if (elements.fontSizeLabel) elements.fontSizeLabel.textContent = `${this.fontSize}px`;
                    if (elements.bookPaper) elements.bookPaper.style.fontSize = `${this.fontSize}px`;
                    if (elements.bookPaperRight) elements.bookPaperRight.style.fontSize = `${this.fontSize}px`;
                }
            });
        }

        if (elements.indentSelect) {
            elements.indentSelect.value = this.textIndent;
            elements.indentSelect.addEventListener('change', (e) => {
                this.textIndent = e.target.value;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('aura_text_indent', this.textIndent);
                }
                if (elements.bookPaper) elements.bookPaper.style.setProperty('--book-text-indent', this.textIndent);
                if (elements.bookPaperRight) elements.bookPaperRight.style.setProperty('--book-text-indent', this.textIndent);
                if (this.callbacks.showToast) {
                    this.callbacks.showToast(`已切换首行缩进：${e.target.options[e.target.selectedIndex].text}`);
                }
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
}

function findAnnotationToken(paper, annotationId) {
    if (!paper || !annotationId || typeof paper.querySelector !== 'function') return null;
    const escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(annotationId) : String(annotationId).replace(/"/g, '\\"');
    return paper.querySelector(`[data-highlight-ids~="${escaped}"], [data-note-ids~="${escaped}"]`);
}
