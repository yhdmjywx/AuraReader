/* ==========================================================================
   TocUI - Table of Contents Popover Presentation
   Pure UI presentation. Renders multi-level TOC lists, displays page numbers,
   and delegates chapter navigation to the reader controller.
   ========================================================================== */

import { syncScrollHint } from '../../components/ui/scrollHint.js';

/** @param {import('../../domain/book.js').TocEntry[]} tocItems
 * @param {import('../../app/elements.js').AppElements} elements
 * @param {((entry: import('../../domain/book.js').TocEntry) => void) | null} onSelectChapter */
export function renderTOC(tocItems = [], elements, onSelectChapter = null) {
    if (!elements || !elements.tocList) return;

    const list = elements.tocList;
    const document = list.ownerDocument;
    list.replaceChildren();
    const items = Array.isArray(tocItems) ? tocItems : [];

    items.forEach(item => {
        const title = item && item.title ? String(item.title).trim() : '';
        if (!title) return;

        const level = Math.max(0, Math.min(Number(item.level) || 0, 6));
        const li = document.createElement('li');
        li.className = `toc-item toc-level-${level}${item.hasChildren ? ' toc-branch' : ''}`;
        const label = document.createElement('span');
        label.className = 'toc-title';
        label.textContent = title;
        let row;
        if (item.navigable === false) {
            row = document.createElement('div');
            row.setAttribute('role', 'heading');
            row.setAttribute('aria-level', String(level + 1));
            row.append(label);
        } else {
            row = document.createElement('button');
            row.type = 'button';
            row.title = title;
            const page = document.createElement('small');
            page.className = 'toc-page';
            page.textContent = `P.${item.page || 1}`;
            row.append(label, page);
            row.addEventListener('click', () => onSelectChapter?.(item));
        }
        row.className = 'toc-row';
        row.style.setProperty('--toc-depth', String(level));
        li.append(row);
        list.append(li);
    });
    syncScrollHint(elements.tocDrawer, list);
}

function setTocOpen(elements, open) {
    const popover = elements?.tocDrawer;
    if (!popover) return;
    if (!open && popover.contains(popover.ownerDocument.activeElement)) {
        elements.btnToc?.focus({ preventScroll: true });
    }
    popover.hidden = !open;
    popover.classList.toggle('open', open);
    syncScrollHint(popover, elements.tocList);
    elements.btnToc?.setAttribute('aria-expanded', String(open));
    if (elements.btnToc) elements.btnToc.title = open ? 'Close contents' : 'Open contents';
}

export function openTOC(elements) {
    setTocOpen(elements, true);
}

export function closeTOC(elements) {
    setTocOpen(elements, false);
}

export function toggleTOC(elements) {
    setTocOpen(elements, !elements?.tocDrawer?.classList.contains('open'));
}
