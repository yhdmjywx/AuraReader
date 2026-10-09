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
        const li = document.createElement('li');
        li.className = 'toc-item';
        if (item.level) {
            li.style.paddingLeft = `${16 + Math.min(item.level, 4) * 14}px`;
        }
        li.innerHTML = `<span>${escapeHtml(item.title)}</span><small>P.${item.page || 1}</small>`;

        li.addEventListener('click', () => {
            if (typeof onSelectChapter === 'function') {
                onSelectChapter(item);
            }
        });

        elements.tocList.appendChild(li);
    });
}

export function openTOC(elements) {
    if (elements && elements.tocDrawer) {
        elements.tocDrawer.classList.add('open');
    }
}

export function closeTOC(elements) {
    if (elements && elements.tocDrawer) {
        elements.tocDrawer.classList.remove('open');
    }
}

export function toggleTOC(elements) {
    if (elements && elements.tocDrawer) {
        elements.tocDrawer.classList.toggle('open');
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
