/* ==========================================================================
   SelectionTooltipUI - Floating Tooltip & Highlight Action Presentation (Feature Layer)
   Handles floating bubble positioning, coordinate normalization, and show/hide animation.
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

export function showHighlightActionTooltip(elements, targetEl, note) {
    if (!elements || !elements.highlightActionTooltip || !elements.readerPanel || !targetEl) return;
    const markRect = targetEl.getBoundingClientRect();
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
