/* ==========================================================================
   SelectionController - Text Selection & Annotation Click Context
   Authority owner of: pendingSelection, activeAnnotationContext.
   A drag keeps the native selection. A click on a token opens one context.
   ========================================================================== */

import {
    showSelectionTooltip,
    hideSelectionTooltip,
    showHighlightActionTooltip,
    hideHighlightActionTooltip
} from './selectionTooltipUI.js';
import { selectionLocation } from '../reader/annotationRenderer.js';
import {
    annotationContextKey,
    primaryKindFor
} from '../../domain/annotationRangeEngine.js';

const DRAG_THRESHOLD = 5;

export class SelectionController {
    constructor({
        callbacks = {}
    } = {}) {
        this.callbacks = callbacks;
        this.pendingSelection = null;
        this.activeAnnotationContext = null;
        this.menuOpen = false;
        this.pointerOrigin = null;
        this.pointerMoved = false;
        this.elements = null;
    }

    getPendingSelection() {
        return this.pendingSelection;
    }

    getActiveAnnotationContext() {
        return this.activeAnnotationContext;
    }

    get activeHighlightId() {
        const ctx = this.activeAnnotationContext;
        return ctx && ctx.highlightIds && ctx.highlightIds.length ? ctx.highlightIds[0] : null;
    }

    set activeHighlightId(val) {
        if (!val) this.clearAnnotationContext();
    }

    clearSelection() {
        this.pendingSelection = null;
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }
    }

    showHighlightAction(targetEl, note) {
        this.hideSelectionTooltip();
        if (!targetEl) return;
        if (targetEl.classList && targetEl.classList.contains('annotation-token')) {
            const page = Number(targetEl.dataset.page) || (note && note.page) || 1;
            this.activateToken(targetEl, page, { force: true, notify: false, showMenu: true });
            return;
        }
        if (!note) return;
        const highlightIds = note.kind === 'note' ? [] : [note.id];
        const noteIds = note.kind === 'note' ? [note.id] : [];
        this.activeAnnotationContext = {
            key: annotationContextKey(highlightIds, noteIds),
            highlightIds,
            noteIds,
            primaryKind: primaryKindFor(highlightIds, noteIds),
            targetElement: targetEl,
            page: note.page || 1,
            quote: note.quote || '',
            location: note.location || null
        };
        this.showMenuForContext();
    }

    hideHighlightAction() {
        this.clearAnnotationContext();
    }

    hideMenu() {
        this.menuOpen = false;
        if (this.elements) hideHighlightActionTooltip(this.elements);
    }

    hideSelectionTooltip() {
        if (this.elements) {
            hideSelectionTooltip(this.elements);
        }
    }

    clearAnnotationContext() {
        const hadContext = !!this.activeAnnotationContext || this.menuOpen;
        this.activeAnnotationContext = null;
        this.menuOpen = false;
        clearActiveTokens();
        if (this.elements) hideHighlightActionTooltip(this.elements);
        if (hadContext && this.callbacks.onClearFocus) this.callbacks.onClearFocus();
    }

    activateToken(token, page, { force = false, notify = true, showMenu = true } = {}) {
        if (!token) return false;
        const highlightIds = splitIds(token.getAttribute('data-highlight-ids'));
        const noteIds = splitIds(token.getAttribute('data-note-ids'));
        const key = annotationContextKey(highlightIds, noteIds);
        if (!force && this.activeAnnotationContext && this.activeAnnotationContext.key === key) {
            return false;
        }

        const root = token.closest('.book-paper') || token.parentElement;
        const quoteInfo = collectTokenQuote(root, token);
        const reading = this.callbacks.getReadingContext ? this.callbacks.getReadingContext() : {};
        const resolvedPage = Number(page) || Number(token.dataset.page) || 1;
        if (quoteInfo.location) {
            quoteInfo.location.sectionId = reading.sectionId || quoteInfo.location.sectionId;
            quoteInfo.location.page = resolvedPage;
        }

        this.activeAnnotationContext = {
            key,
            highlightIds,
            noteIds,
            primaryKind: primaryKindFor(highlightIds, noteIds),
            targetElement: token,
            page: resolvedPage,
            quote: quoteInfo.quote,
            location: quoteInfo.location
        };
        this.applyActiveClasses();
        if (showMenu) this.showMenuForContext();
        else this.hideMenu();

        if (notify && this.callbacks.onAnnotationActivated) {
            this.callbacks.onAnnotationActivated(this.activeAnnotationContext);
        }
        return true;
    }

    activateAnnotationId(annotationId, { notify = false, showMenu = false } = {}) {
        if (!annotationId || typeof document === 'undefined') return false;
        const token = findTokenByAnnotationId(annotationId);
        if (!token) return false;
        const page = Number(token.dataset.page) || (this.activeAnnotationContext && this.activeAnnotationContext.page) || 1;
        return this.activateToken(token, page, { force: true, notify, showMenu });
    }

    restoreActiveTokens() {
        if (!this.activeAnnotationContext) return;
        const tokens = findTokensByKey(this.activeAnnotationContext.key);
        if (tokens.length === 0) {
            this.clearAnnotationContext();
            return;
        }
        this.applyActiveClasses();
        this.activeAnnotationContext.targetElement = tokens[0];
        if (this.menuOpen) this.showMenuForContext();
    }

    applyActiveClasses() {
        clearActiveTokens();
        if (!this.activeAnnotationContext) return;
        findTokensByKey(this.activeAnnotationContext.key).forEach(token => token.classList.add('is-active'));
    }

    showMenuForContext() {
        if (!this.activeAnnotationContext || !this.elements) return;
        if (!this.activeAnnotationContext.highlightIds.length && !this.activeAnnotationContext.noteIds.length) {
            this.hideMenu();
            return;
        }
        const target = this.activeAnnotationContext.targetElement || findTokensByKey(this.activeAnnotationContext.key)[0];
        if (!target) return;
        this.activeAnnotationContext.targetElement = target;
        this.menuOpen = true;
        this.hideSelectionTooltip();
        showHighlightActionTooltip(this.elements, target, this.activeAnnotationContext);
    }

    handleAnnotationClick(event, paper) {
        if (!paper || !event) return;
        if (this.pointerMoved || hasTextSelection()) return;

        const eventTarget = event.target && event.target.nodeType === 3 ? event.target.parentElement : event.target;
        const token = eventTarget && eventTarget.closest ? eventTarget.closest('.annotation-token') : null;
        if (!token || !paper.contains(token)) {
            this.clearAnnotationContext();
            return;
        }

        event.stopPropagation();
        const page = Number(paper.dataset.annotationPage) || Number(token.dataset.page) || 1;
        const changed = this.activateToken(token, page);
        if (!changed) return;
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
        const root = isInRight ? this.elements.bookPaperRight : this.elements.bookPaper;

        this.pendingSelection = {
            text: selectedText,
            range,
            page: effectivePage,
            location: selectionLocation(root, range, effectivePage, ctx.sectionId)
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

        const bindPaper = (paper) => {
            if (!paper) return;
            paper.addEventListener('pointerdown', (event) => {
                this.pointerOrigin = { x: event.clientX, y: event.clientY };
                this.pointerMoved = false;
            });
            paper.addEventListener('pointermove', (event) => {
                if (!this.pointerOrigin) return;
                const dx = Math.abs(event.clientX - this.pointerOrigin.x);
                const dy = Math.abs(event.clientY - this.pointerOrigin.y);
                if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) this.pointerMoved = true;
            });
            paper.addEventListener('click', (event) => this.handleAnnotationClick(event, paper));
            paper.addEventListener('mouseup', () => setTimeout(() => this.handleSelection(), 30));
            paper.addEventListener('touchend', () => setTimeout(() => this.handleSelection(), 30));
        };

        bindPaper(elements.bookPaper);
        bindPaper(elements.bookPaperRight);

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

        if (elements.btnAddNote) {
            elements.btnAddNote.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.pendingSelection) return;
                const text = this.pendingSelection.text;
                const page = this.pendingSelection.page;
                const location = this.pendingSelection.location;
                this.hideSelectionTooltip();
                // Clear the body selection before handing focus to the editor.
                // Removing it afterwards can disturb the native input caret.
                this.clearSelection();
                if (this.callbacks.onCreateNote) {
                    this.callbacks.onCreateNote({ quote: text, page, location });
                } else if (this.callbacks.onOpenNoteModal) {
                    this.callbacks.onOpenNoteModal(text, null, page);
                }
            });
        }

        if (elements.btnHlRemove) {
            elements.btnHlRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                const ctx = this.activeAnnotationContext;
                if (!ctx || !ctx.highlightIds.length) return;
                const ids = ctx.highlightIds.slice();
                this.clearAnnotationContext();
                if (this.callbacks.onDeleteHighlight) this.callbacks.onDeleteHighlight(ids);
            });
        }

        if (elements.btnNoteRemove) {
            elements.btnNoteRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                const ctx = this.activeAnnotationContext;
                if (!ctx || !ctx.noteIds.length) return;
                const ids = ctx.noteIds.slice();
                this.clearAnnotationContext();
                this.callbacks.onDeleteNotes?.(ids);
            });
        }

        document.addEventListener('click', (e) => {
            const selection = window.getSelection();
            const hasActiveSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;

            if (!e.target.closest('#selection-tooltip') && !hasActiveSelection) {
                this.hideSelectionTooltip();
            }

            if (this.pointerMoved || hasActiveSelection) return;
            if (e.target.closest('#highlight-action-tooltip') || e.target.closest('.annotation-token')) return;
            if (e.target.closest('#notes-panel')) return;
            this.hideHighlightAction();
        });
    }
}

function splitIds(value) {
    if (!value) return [];
    return String(value).split(/\s+/).filter(Boolean);
}

function hasTextSelection() {
    if (typeof window === 'undefined' || !window.getSelection) return false;
    const selection = window.getSelection();
    return !!(selection && selection.rangeCount > 0 && !selection.isCollapsed && selection.toString().trim());
}

function clearActiveTokens() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.annotation-token.is-active').forEach(token => token.classList.remove('is-active'));
}

function findTokensByKey(key) {
    if (typeof document === 'undefined' || !key) return [];
    return Array.from(document.querySelectorAll('.annotation-token')).filter(token => tokenKey(token) === key);
}

function findTokenByAnnotationId(annotationId) {
    if (typeof document === 'undefined' || !annotationId || typeof CSS === 'undefined' || !CSS.escape) {
        return document && annotationId
            ? document.querySelector(`[data-highlight-ids~="${annotationId}"], [data-note-ids~="${annotationId}"]`)
            : null;
    }
    const escaped = CSS.escape(annotationId);
    return document.querySelector(`[data-highlight-ids~="${escaped}"], [data-note-ids~="${escaped}"]`);
}

function tokenKey(token) {
    return annotationContextKey(
        splitIds(token.getAttribute('data-highlight-ids')),
        splitIds(token.getAttribute('data-note-ids'))
    );
}

function collectTokenQuote(root, token) {
    const key = tokenKey(token);
    const tokens = root
        ? Array.from(root.querySelectorAll('.annotation-token')).filter(item => tokenKey(item) === key)
        : [token];
    tokens.sort((a, b) => Number(a.dataset.start) - Number(b.dataset.start));

    let contiguous = tokens.length > 0;
    for (let i = 1; i < tokens.length; i++) {
        if (Number(tokens[i].dataset.start) !== Number(tokens[i - 1].dataset.end)) {
            contiguous = false;
            break;
        }
    }

    const used = contiguous ? tokens : [token];
    const start = Number(used[0].dataset.start);
    const end = Number(used[used.length - 1].dataset.end);
    const page = Number(token.dataset.page) || 1;
    const location = Number.isFinite(start) && Number.isFinite(end) && end > start
        ? {
            sectionId: `chapter-${page}`,
            page,
            start,
            end,
            offset: start
        }
        : null;

    return {
        quote: used.map(item => item.textContent).join(''),
        location
    };
}
