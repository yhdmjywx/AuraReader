/* ==========================================================================
   TocUI - Table of Contents Drawer Presentation (Feature Layer)
   Pure UI presentation. Renders multi-level TOC lists, displays page numbers,
   and delegates chapter navigation & drawer toggle to coordinator.
   ========================================================================== */

export function renderTOC(tocItems = [], elements, onSelectChapter = null) {
    if (!elements || !elements.tocList) return;

    elements.tocList.innerHTML = '';
    const items = Array.isArray(tocItems) ? tocItems : [];

    items.forEach(item => {
        const title = item && item.title ? String(item.title).trim() : '';
        if (!title) return;

        const level = Math.max(0, Math.min(Number(item.level) || 0, 6));
        const li = document.createElement('li');
        li.className = `toc-item toc-level-${level}${item.hasChildren ? ' toc-branch' : ''}`;
        li.setAttribute('aria-level', String(level + 1));
        li.innerHTML = `<span class="toc-title">${escapeHtml(title)}</span><small class="toc-page">P.${item.page || 1}</small>`;

        li.addEventListener('click', () => {
            if (typeof onSelectChapter === 'function') {
                onSelectChapter(item);
            }
        });

        elements.tocList.appendChild(li);
    });
}

function syncTocTrigger(elements) {
    if (!elements || !elements.btnToc || !elements.tocDrawer) return;
    const open = elements.tocDrawer.classList.contains('open');
    elements.btnToc.classList.toggle('is-open', open);
    elements.btnToc.setAttribute('aria-expanded', open ? 'true' : 'false');
}

export function openTOC(elements) {
    if (elements && elements.tocDrawer) {
        elements.tocDrawer.classList.add('open');
        syncTocTrigger(elements);
    }
}

export function closeTOC(elements) {
    if (elements && elements.tocDrawer) {
        elements.tocDrawer.classList.remove('open');
        syncTocTrigger(elements);
    }
}

export function toggleTOC(elements) {
    if (elements && elements.tocDrawer) {
        elements.tocDrawer.classList.toggle('open');
        syncTocTrigger(elements);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
