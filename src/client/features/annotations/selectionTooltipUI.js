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
    updateContextMenu(tooltip, context);

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

function updateContextMenu(tooltip, context) {
    const noteCount = context && Array.isArray(context.noteIds) ? context.noteIds.length : 0;
    const highlightCount = context && Array.isArray(context.highlightIds) ? context.highlightIds.length : 0;

    const viewBtn = tooltip.querySelector('#btn-hl-view-notes');
    const operateBtn = tooltip.querySelector('#btn-hl-operate');
    const addBtn = tooltip.querySelector('#btn-hl-add-thought');
    const removeBtn = tooltip.querySelector('#btn-hl-remove');

    if (viewBtn) {
        viewBtn.hidden = noteCount === 0;
        viewBtn.innerHTML = `<i class="ri-chat-1-line"></i> 查看笔记（${noteCount}）`;
    }
    if (operateBtn) operateBtn.hidden = highlightCount === 0;
    if (addBtn) addBtn.hidden = false;
    if (removeBtn) removeBtn.hidden = highlightCount === 0;
    const divider = tooltip.querySelector('.tooltip-divider');
    if (divider) divider.hidden = highlightCount === 0;
}
