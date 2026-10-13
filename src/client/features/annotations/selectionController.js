/* ==========================================================================
   SelectionController - Text Selection & Tooltip Action Feature Controller
   Authority owner of: pendingSelection, activeHighlightId.
   Coordinates DOM Selection, floating bubble, guard against premature dismissal.
   ========================================================================== */

import {
    showSelectionTooltip,
    hideSelectionTooltip,
    showHighlightActionTooltip,
    hideHighlightActionTooltip
} from './selectionTooltipUI.js';

export class SelectionController {
    constructor({
        callbacks = {}
    } = {}) {
        this.callbacks = callbacks; // onCreateHighlight, onOpenNoteModal, onDeleteNote, getReadingContext
        this.pendingSelection = null;
        this.activeHighlightId = null;
        this.elements = null;
    }

    getPendingSelection() {
        return this.pendingSelection;
    }

    clearSelection() {
        this.pendingSelection = null;
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }
    }

    showHighlightAction(targetEl, note) {
        this.hideSelectionTooltip();
        if (!note) return;
        this.activeHighlightId = note.id;
        if (this.elements) {
            showHighlightActionTooltip(this.elements, targetEl, note);
        }
    }

    hideHighlightAction() {
        this.activeHighlightId = null;
        if (this.elements) {
            hideHighlightActionTooltip(this.elements);
        }
    }

    hideSelectionTooltip() {
        if (this.elements) {
            hideSelectionTooltip(this.elements);
        }
    }

    handleSelection() {
        if (!this.elements) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            this.hideSelectionTooltip();
            return;
        }

        const selectedText = selection.toString().trim();
        const isInLeft = this.elements.bookPaper && this.elements.bookPaper.contains(selection.anchorNode);
        const isInRight = this.elements.bookPaperRight && this.elements.bookPaperRight.contains(selection.anchorNode);
        if (!selectedText || (!isInLeft && !isInRight)) {
            this.hideSelectionTooltip();
            return;
        }

        this.hideHighlightAction();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) return;

        const ctx = this.callbacks.getReadingContext ? this.callbacks.getReadingContext() : { currentPage: 1 };
        const effectivePage = ctx.chapterFlow
            ? (ctx.currentPage || 1)
            : (isInRight ? (ctx.currentRightPage || (ctx.currentPage + 1)) : (ctx.currentLeftPage || ctx.currentPage));

        this.pendingSelection = {
            text: selectedText,
            range,
            page: effectivePage
        };

        if (this.elements) {
            showSelectionTooltip(this.elements, rect);
        }
    }

    initUI(elements) {
        this.elements = elements;
        if (!elements || typeof document === 'undefined') return;

        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString().trim()) {
                this.hideSelectionTooltip();
            }
        });

        if (elements.bookPaper) {
            elements.bookPaper.addEventListener('mouseup', () => setTimeout(() => this.handleSelection(), 30));
            elements.bookPaper.addEventListener('touchend', () => setTimeout(() => this.handleSelection(), 30));
        }

        if (elements.bookPaperRight) {
            elements.bookPaperRight.addEventListener('mouseup', () => setTimeout(() => this.handleSelection(), 30));
            elements.bookPaperRight.addEventListener('touchend', () => setTimeout(() => this.handleSelection(), 30));
        }

        // Color Tooltip Buttons
        document.querySelectorAll('.tooltip-btn[data-color]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = btn.getAttribute('data-color') || 'yellow';
                if (this.callbacks.onCreateHighlight && this.pendingSelection) {
                    this.callbacks.onCreateHighlight(color, this.pendingSelection);
                }
                this.hideSelectionTooltip();
                this.clearSelection();
            });
        });

        // Add Note Button
        if (elements.btnAddNote) {
            elements.btnAddNote.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.pendingSelection) return;
                const text = this.pendingSelection.text;
                const page = this.pendingSelection.page;
                this.hideSelectionTooltip();
                if (this.callbacks.onOpenNoteModal) {
                    this.callbacks.onOpenNoteModal(text, null, page);
                }
            });
        }

        // Highlight Mini Action Tooltip Buttons
        if (elements.btnHlAddThought) {
            elements.btnHlAddThought.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.activeHighlightId) return;
                const noteId = this.activeHighlightId;
                const ctx = this.callbacks.getReadingContext ? this.callbacks.getReadingContext() : { notes: [] };
                const note = ctx.notes ? ctx.notes.find(n => n.id === noteId) : null;
                this.hideHighlightAction();
                if (note && this.callbacks.onOpenNoteModal) {
                    this.callbacks.onOpenNoteModal(note.quote, note.id, note.page);
                }
            });
        }

        if (elements.btnHlRemove) {
            elements.btnHlRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.activeHighlightId) return;
                const noteId = this.activeHighlightId;
                this.hideHighlightAction();
                if (this.callbacks.onDeleteNote) {
                    this.callbacks.onDeleteNote(noteId);
                }
            });
        }

        // Outside Click Listener with Guard
        document.addEventListener('click', (e) => {
            const selection = window.getSelection();
            const hasActiveSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;

            if (!e.target.closest('#selection-tooltip') && !hasActiveSelection) {
                this.hideSelectionTooltip();
            }

            if (!e.target.closest('#highlight-action-tooltip') && !e.target.closest('mark')) {
                this.hideHighlightAction();
            }
        });
    }
}
