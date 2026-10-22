/* ==========================================================================
   PaperRenderer - Canvas DOM Renderer for Reader (Feature Layer)
   Handles single/double spread pages, center crease spine, highlight mounting,
   inline link interception, and smooth anchor scrolling.
   ========================================================================== */

import { clearChapterFlow } from './chapterColumnView.js';
import { renderAnnotationTokens } from './annotationRenderer.js';

/** @param {import('../../app/contracts.js').PaperSpreadOptions} options */
export function renderPaperSpread({
    elements,
    readerEngine,
    layoutSystem,
    notes = [],
    textIndent = '2em',
    preserveScroll = false,
    onLinkClick = null
}) {
    if (!elements || !readerEngine || !readerEngine.hasBook()) return;

    clearChapterFlow(elements);

    const viewport = document.getElementById('reader-viewport');
    const savedScrollTop = (viewport && preserveScroll) ? viewport.scrollTop : 0;

    const currentPage = readerEngine.getCurrentPage();
    const totalPages = readerEngine.getTotalPages();
    const isDouble = (layoutSystem && typeof layoutSystem.isDoublePageEffective === 'function')
        ? layoutSystem.isDoublePageEffective()
        : false;

    if (!isDouble) {
        // SINGLE PAGE MODE
        if (elements.currentPageSpan) elements.currentPageSpan.textContent = currentPage;
        if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = totalPages;
        if (elements.pageUnit) elements.pageUnit.textContent = '页';

        if (elements.bookPaperRight) elements.bookPaperRight.style.display = 'none';
        if (elements.spreadSpine) elements.spreadSpine.style.display = 'none';
        if (elements.paperContainer) elements.paperContainer.classList.remove('spread-active');

        const htmlContent = readerEngine.getPageContent(currentPage);

        if (elements.bookPaper) {
            elements.bookPaper.innerHTML = htmlContent;
            elements.bookPaper.style.setProperty('--book-text-indent', textIndent);
            applyHighlightsToPaper(elements.bookPaper, currentPage, notes);
        }

        if (elements.btnPrevPage) elements.btnPrevPage.disabled = (currentPage <= 1);
        if (elements.btnNextPage) elements.btnNextPage.disabled = (currentPage >= totalPages);
    } else {
        // DOUBLE PAGE SPREAD MODE
        const spread = readerEngine.getSpreadPages(currentPage);
        const leftPage = spread.leftPage;
        const rightPage = spread.rightPage;

        if (elements.currentPageSpan) {
            elements.currentPageSpan.textContent = String(spread.label).replace('-', '–');
        }
        if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = totalPages;
        if (elements.pageUnit) elements.pageUnit.textContent = '页';

        if (elements.paperContainer) elements.paperContainer.classList.add('spread-active');
        if (elements.spreadSpine) elements.spreadSpine.style.display = 'block';
        if (elements.bookPaperRight) elements.bookPaperRight.style.display = 'block';

        // Render Left Page
        const leftHtml = readerEngine.getPageContent(leftPage);
        if (elements.bookPaper) {
            elements.bookPaper.innerHTML = leftHtml;
            elements.bookPaper.style.setProperty('--book-text-indent', textIndent);
            applyHighlightsToPaper(elements.bookPaper, leftPage, notes);
        }

        // Render Right Page
        if (rightPage && rightPage <= totalPages) {
            const rightHtml = readerEngine.getPageContent(rightPage);
            if (elements.bookPaperRight) {
                elements.bookPaperRight.innerHTML = rightHtml;
                elements.bookPaperRight.style.setProperty('--book-text-indent', textIndent);
                applyHighlightsToPaper(elements.bookPaperRight, rightPage, notes);
            }
        } else if (elements.bookPaperRight) {
            elements.bookPaperRight.innerHTML = `
                <div class="spread-blank-page">
                    <i class="ri-book-open-line"></i>
                    <span class="spread-blank-title">全书完</span>
                    <p class="spread-blank-sub">已到达本书最后一页</p>
                </div>
            `;
        }

        if (elements.btnPrevPage) elements.btnPrevPage.disabled = (leftPage <= 1);
        if (elements.btnNextPage) elements.btnNextPage.disabled = (leftPage + 1 >= totalPages);
    }

    interceptInTextLinks(elements, readerEngine.getCurrentBook(), onLinkClick);

    if (viewport) {
        viewport.scrollTop = savedScrollTop;
    }
}

/** @param {HTMLElement} targetPaper
 * @param {number} targetPage
 * @param {import('../../domain/annotation.js').Annotation[]} notes */
export function applyHighlightsToPaper(targetPaper, targetPage, notes = []) {
    if (!targetPaper) return;

    const notesForPage = (Array.isArray(notes) ? notes : []).filter(n => Number(n.page) === Number(targetPage));
    try {
        renderAnnotationTokens(targetPaper, notesForPage, targetPage);
    } catch (e) {
        console.error("高亮渲染异常:", e);
    }
}

export function showHighlightActionTooltip(markEl, note, elements) {
    if (!elements || !elements.highlightActionTooltip || !markEl) return;

    const markRect = markEl.getBoundingClientRect();
    const readerRect = elements.readerPanel.getBoundingClientRect();

    elements.highlightActionTooltip.style.left = `${markRect.left + markRect.width / 2 - readerRect.left}px`;
    elements.highlightActionTooltip.style.top = `${markRect.top - readerRect.top}px`;
    elements.highlightActionTooltip.style.display = 'flex';
}

export function hideHighlightActionTooltip(elements) {
    if (elements && elements.highlightActionTooltip) {
        elements.highlightActionTooltip.style.display = 'none';
    }
}

/** @param {import('../../app/elements.js').AppElements} elements
 * @param {import('../../domain/book.js').Book | null} currentBookObj
 * @param {((href: string) => void) | null} onLinkClick */
export function interceptInTextLinks(elements, currentBookObj, onLinkClick) {
    const linkSelector = (elements.bookPaperRight && elements.bookPaperRight.style.display !== 'none')
        ? '#book-paper a[href], #book-paper-right a[href]'
        : '#book-paper a[href]';

    document.querySelectorAll(linkSelector).forEach(a => {
        const href = a.getAttribute('href');
        if (!href) return;

        if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (typeof onLinkClick === 'function') {
                    onLinkClick(href);
                }
            });
        }
    });
}

export function scrollToAnchor(anchor, elements) {
    if (!anchor || !elements) return;

    setTimeout(() => {
        let targetEl = elements.bookPaper ? (
            elements.bookPaper.querySelector(`#${CSS.escape(anchor)}`)
            || elements.bookPaper.querySelector(`[name="${anchor}"]`)
            || elements.bookPaper.querySelector(`[id*="${anchor}"]`)
        ) : null;

        if (!targetEl && elements.bookPaperRight) {
            targetEl = elements.bookPaperRight.querySelector(`#${CSS.escape(anchor)}`)
                || elements.bookPaperRight.querySelector(`[name="${anchor}"]`)
                || elements.bookPaperRight.querySelector(`[id*="${anchor}"]`);
        }

        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 120);
}
