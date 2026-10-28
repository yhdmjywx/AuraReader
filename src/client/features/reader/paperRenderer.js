import { readerViewport } from './readerDom.js';
/* ==========================================================================
   PaperRenderer - Canvas DOM Renderer for Reader (Feature Layer)
   Handles the reading page, highlight mounting,
   inline link interception, and smooth anchor scrolling.
   ========================================================================== */

import { clearChapterFlow } from './chapterColumnView.js';
import { renderAnnotationTokens } from './annotationRenderer.js';

/** @param {import('../../app/contracts.js').PaperOptions} options */
export function renderPaper({
    elements,
    readerEngine,
    notes = [],
    textIndent = '2em',
    preserveScroll = false,
    onLinkClick = null
}) {
    if (!elements || !readerEngine || !readerEngine.hasBook()) return;

    clearChapterFlow(elements);

    const viewport = readerViewport(elements);
    const savedScrollTop = (viewport && preserveScroll) ? viewport.scrollTop : 0;

    const currentPage = readerEngine.getCurrentPage();
    const totalPages = readerEngine.getTotalPages();
    if (elements.currentPageSpan) elements.currentPageSpan.textContent = currentPage;
    if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = totalPages;
    if (elements.pageUnit) elements.pageUnit.textContent = '页';


    const htmlContent = readerEngine.getPageContent(currentPage);

    if (elements.bookPaper) {
        elements.bookPaper.innerHTML = htmlContent;
        elements.bookPaper.style.setProperty('--book-text-indent', textIndent);
        applyHighlightsToPaper(elements.bookPaper, currentPage, notes);
    }

    if (elements.btnPrevPage) elements.btnPrevPage.disabled = (currentPage <= 1);
    if (elements.btnNextPage) elements.btnNextPage.disabled = (currentPage >= totalPages);

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
    elements.bookPaper?.querySelectorAll('a[href]').forEach(a => {
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

    const timer = setTimeout(() => {
        let targetEl = elements.bookPaper ? (
            elements.bookPaper.querySelector(`#${CSS.escape(anchor)}`)
            || elements.bookPaper.querySelector(`[name="${anchor}"]`)
            || elements.bookPaper.querySelector(`[id*="${anchor}"]`)
        ) : null;


        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 120);
    return () => clearTimeout(timer);
}
