/* ==========================================================================
   SelectionTooltipUI - Floating Tooltip & Annotation Context Menu
   Positions the selection bubble and the shared highlight-action tooltip.
   ========================================================================== */

export function showSelectionTooltip(elements, rect) {
    if (!elements || !elements.selectionTooltip || !elements.readerPanel || !rect) return;
    const readerRect = elements.readerPanel.getBoundingClientRect();
    elements.selectionTooltip.style.left = `${rect.left + rect.width / 2 - readerRect.left}px`;
    elements.selectionTooltip.style.top = `${rect.top - readerRect.top}px`;
    elements.selectionTooltip.style.display = 'flex';
}

export function hideSelectionTooltip(elements) {
    if (elements && elements.selectionTooltip) {
        elements.selectionTooltip.style.display = 'none';
    }
}

export function showHighlightActionTooltip(elements, targetEl, context) {
    if (!elements || !elements.highlightActionTooltip || !elements.readerPanel || !targetEl) return;
    const tooltip = elements.highlightActionTooltip;
    const highlightCount = context?.highlightIds?.length || 0;
    const noteCount = context?.noteIds?.length || 0;
    if (!highlightCount && !noteCount) {
        hideHighlightActionTooltip(elements);
        return;
    }
    const highlightButton = tooltip.querySelector('#btn-hl-remove');
    const noteButton = tooltip.querySelector('#btn-note-remove');
    if (highlightButton) highlightButton.hidden = !highlightCount;
    if (noteButton) {
        noteButton.hidden = !noteCount;
        noteButton.querySelector('span').textContent = noteCount > 1 ? `删除笔记（${noteCount}）` : '删除笔记';
    }

    const markRect = targetEl.getBoundingClientRect();
    const readerRect = elements.readerPanel.getBoundingClientRect();
    tooltip.style.left = `${markRect.left + markRect.width / 2 - readerRect.left}px`;
    tooltip.style.top = `${markRect.top - readerRect.top}px`;
    tooltip.style.display = 'flex';
}

export function hideHighlightActionTooltip(elements) {
    if (elements && elements.highlightActionTooltip) {
        elements.highlightActionTooltip.style.display = 'none';
    }
}
