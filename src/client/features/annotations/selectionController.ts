import { readerRect } from '../reader/readerDocument.js';
import { readerAbortController } from '../reader/readerDom.js';
import { eventElement } from '../../app/dom.js';
import type { Annotation, AnnotationLocation } from '../../domain/annotation.js';
import type { ActiveAnnotationContext, SelectionCallbacks, PendingSelection } from '../../app/contracts.js';
import type { AppElements } from '../../app/elements.js';
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
    private bindings?: AbortController;
    private hostBindings?: AbortController;
    private selectionTimer?: ReturnType<typeof setTimeout>;
    private listeners = new Set<() => void>();
    private tooltipPinned = false;
    pinSelectionTooltip(pinned: boolean) { this.tooltipPinned = pinned; }
    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    private changed() { for (const listener of this.listeners) listener(); }
    destroy() {
        this.tooltipPinned = false;
        this.bindings?.abort(); this.bindings = undefined;
        this.hostBindings?.abort(); this.hostBindings = undefined;
        clearTimeout(this.selectionTimer);
        this.hideSelectionTooltip(); this.clearAnnotationContext();
        this.pendingSelection = null;
        this.pointerOrigin = null; this.pointerMoved = false;
        this.elements = null;
        this.changed();
    }
    callbacks: SelectionCallbacks;
    pendingSelection: PendingSelection | null;
    activeAnnotationContext: ActiveAnnotationContext | null;
    menuOpen: boolean;
    pointerOrigin: {x: number; y: number} | null;
    pointerMoved: boolean;
    elements: AppElements | null;
    constructor({
        callbacks = {}
    }: { callbacks?: SelectionCallbacks } = {}) {
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

    set activeHighlightId(val: string | null) {
        if (!val) this.clearAnnotationContext();
    }

    clearSelection() {
        this.pendingSelection = null;
        this.changed();
        this.elements?.bookPaper?.ownerDocument.getSelection()?.removeAllRanges();
    }

    showHighlightAction(targetEl: HTMLElement, note: Annotation) {
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
        if (this.tooltipPinned) return;
        if (this.elements) {
            hideSelectionTooltip(this.elements);
        }
    }

    clearAnnotationContext() {
        const hadContext = !!this.activeAnnotationContext || this.menuOpen;
        this.activeAnnotationContext = null;
        this.menuOpen = false;
        clearActiveTokens(this.elements?.bookPaper);
        if (this.elements) hideHighlightActionTooltip(this.elements);
        if (hadContext && this.callbacks.onClearFocus) this.callbacks.onClearFocus();
        if (hadContext) this.changed();
    }

    activateToken(token: HTMLElement, page: number, { force = false, notify = true, showMenu = true } = {}) {
        if (!token) return false;
        const highlightIds = splitIds(token.getAttribute('data-highlight-ids'));
        const noteIds = splitIds(token.getAttribute('data-note-ids'));
        const key = annotationContextKey(highlightIds, noteIds);
        if (!force && this.activeAnnotationContext && this.activeAnnotationContext.key === key) {
            return false;
        }

        const root = token.closest('[data-volume-title-page]') || token.closest('.book-paper') || token.parentElement;
        const quoteInfo = collectTokenQuote(root, token);
        const reading = this.callbacks.getReadingContext?.();
        const resolvedPage = Number(page) || Number(token.dataset.page) || 1;
        if (quoteInfo.location) {
            quoteInfo.location.sectionId = token.closest('[data-volume-title-page]')
                ? `chapter-${resolvedPage}` : (reading?.sectionId || quoteInfo.location.sectionId);
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
        this.changed();
        return true;
    }

    activateAnnotationId(annotationId: string, { notify = false, showMenu = false } = {}) {
        if (!annotationId || typeof globalThis.document === 'undefined') return false;
        const token = findTokenByAnnotationId(annotationId, this.elements?.bookPaper);
        if (!token) return false;
        const page = Number(token.dataset.page) || (this.activeAnnotationContext && this.activeAnnotationContext.page) || 1;
        return this.activateToken(token, page, { force: true, notify, showMenu });
    }

    restoreActiveTokens() {
        if (!this.activeAnnotationContext) return;
        const tokens = findTokensByKey(this.activeAnnotationContext.key, this.elements?.bookPaper);
        if (tokens.length === 0) {
            this.clearAnnotationContext();
            return;
        }
        this.applyActiveClasses();
        this.activeAnnotationContext.targetElement = tokens[0];
        if (this.menuOpen) this.showMenuForContext();
    }

    applyActiveClasses() {
        clearActiveTokens(this.elements?.bookPaper);
        if (!this.activeAnnotationContext) return;
        findTokensByKey(this.activeAnnotationContext.key, this.elements?.bookPaper).forEach(token => token.classList.add('is-active'));
    }

    showMenuForContext() {
        if (!this.activeAnnotationContext || !this.elements) return;
        if (!this.activeAnnotationContext.highlightIds.length && !this.activeAnnotationContext.noteIds.length) {
            this.hideMenu();
            return;
        }
        const target = this.activeAnnotationContext.targetElement || findTokensByKey(this.activeAnnotationContext.key, this.elements?.bookPaper)[0];
        if (!target) return;
        this.activeAnnotationContext.targetElement = target;
        this.refreshGoalAction();
        this.menuOpen = true;
        this.hideSelectionTooltip();
        showHighlightActionTooltip(this.elements, target, this.activeAnnotationContext);
    }

    handleAnnotationClick(event: MouseEvent, paper: HTMLElement) {
        if (!paper || !event) return;
        if (this.pointerMoved || hasTextSelection(this.elements?.bookPaper?.ownerDocument.getSelection())) return;

        const eventTarget = eventElement(event);
        const token = eventTarget?.closest<HTMLElement>('.annotation-token');
        if (!token || !paper.contains(token)) {
            this.clearAnnotationContext();
            return;
        }

        event.stopPropagation();
        const page = Number(token.dataset.page) || Number(paper.dataset.annotationPage) || 1;
        const changed = this.activateToken(token, page);
        if (!changed) return;
    }

    handleSelection() {
        if (!this.elements) return;
        const selection = this.elements.bookPaper?.ownerDocument.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            this.hideSelectionTooltip();
            return;
        }

        const selectedText = selection.toString().trim();
        const isInLeft = this.elements.bookPaper && this.elements.bookPaper.contains(selection.anchorNode);
        if (!selectedText || !isInLeft) {
            this.hideSelectionTooltip();
            return;
        }

        this.hideHighlightAction();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) return;

        const ctx = this.callbacks.getReadingContext ? this.callbacks.getReadingContext() : { currentPage: 1 };
        let effectivePage = ctx.currentPage || 1;
        let root = this.elements.bookPaper;
        if (!root) return;
        const dividerAt = (node: Node) => (node.nodeType === 1 ? node as Element : node.parentElement)?.closest<HTMLElement>('[data-volume-title-page]');
        const startDivider = dividerAt(range.startContainer);
        const endDivider = dividerAt(range.endContainer);
        // Cross-spine selections were never a single annotation. Keep the
        // original per-document coordinates instead of inventing a new range.
        if (startDivider !== endDivider || (!startDivider && [...root.querySelectorAll('[data-volume-title-page]')]
            .some(divider => range.intersectsNode(divider)))) {
            this.pendingSelection = null;
            this.hideSelectionTooltip();
            return;
        }
        if (startDivider) {
            root = startDivider;
            effectivePage = Number(startDivider.dataset.volumeTitlePage);
        }

        this.pendingSelection = {
            text: selectedText,
            range,
            page: effectivePage,
            location: selectionLocation(root, range, effectivePage, startDivider ? `chapter-${effectivePage}` : ctx.sectionId)
        };

        if (this.elements) {
            showSelectionTooltip(this.elements, readerRect(rect, root.ownerDocument));
        }
        this.changed();
    }

    refreshGoalAction() {
        const control = this.elements?.btnAnnotationGoal;
        if (!control) return;
        const context = this.activeAnnotationContext;
        const ids = [...new Set([...(context?.highlightIds || []), ...(context?.noteIds || [])])];
        const state = ids.length === 1 ? this.callbacks.getGoalAction?.(ids[0]!) : undefined;
        control.hidden = !state?.visible; control.disabled = !state || state.disabled;
        control.title = state?.linked ? 'Added to goal' : 'Add to goal';
        control.setAttribute('aria-label', control.title);
        control.classList.toggle('is-linked', !!state?.linked);
        const label = control.querySelector('span'); if (label) label.textContent = state?.linked ? 'Linked' : 'Goal';
        const glyph = control.querySelector('i'); if (glyph) glyph.className = state?.linked ? 'ri-check-line' : 'ri-links-line';
    }

    initUI(elements: AppElements) {
        this.destroy();
        this.elements = elements;
        if (!elements || typeof globalThis.document === 'undefined') return;
        const document = elements.bookPaper?.ownerDocument || globalThis.document;
        this.bindings = readerAbortController(document);
        const signal = this.bindings.signal;
        const hostDocument = elements.readerPanel?.ownerDocument || document;
        this.hostBindings = readerAbortController(hostDocument);
        const hostSignal = this.hostBindings.signal;
        const scheduleSelection = () => {
            clearTimeout(this.selectionTimer);
            this.selectionTimer = setTimeout(() => this.handleSelection(), 30);
        };

        document.addEventListener('selectionchange', () => {
            const selection = document.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString().trim()) {
                this.hideSelectionTooltip();
            }
        }, { signal });

        const bindPaper = (paper: HTMLElement | null | undefined) => {
            if (!paper) return;
            paper.addEventListener('pointerdown', (event) => {
                this.pointerOrigin = { x: event.clientX, y: event.clientY };
                this.pointerMoved = false;
            }, { signal });
            paper.addEventListener('pointermove', (event) => {
                if (!this.pointerOrigin) return;
                const dx = Math.abs(event.clientX - this.pointerOrigin.x);
                const dy = Math.abs(event.clientY - this.pointerOrigin.y);
                if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) this.pointerMoved = true;
            }, { signal });
            paper.addEventListener('click', (event) => this.handleAnnotationClick(event, paper), { signal });
            paper.addEventListener('mouseup', scheduleSelection, { signal });
            paper.addEventListener('touchend', scheduleSelection, { signal });
        };

        bindPaper(elements.bookPaper);

        (elements.selectionTooltip || elements.readerPanel || document).querySelectorAll('.tooltip-btn[data-color]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = btn.getAttribute('data-color') || 'yellow';
                if (this.callbacks.onCreateHighlight && this.pendingSelection) {
                    this.callbacks.onCreateHighlight(color, this.pendingSelection);
                }
                this.hideSelectionTooltip();
                this.clearSelection();
            }, { signal: hostSignal });
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
            }, { signal: hostSignal });
        }

        elements.btnAnnotationGoal?.addEventListener('click', event => {
            event.stopPropagation();
            const context = this.activeAnnotationContext;
            const ids = [...new Set([...(context?.highlightIds || []), ...(context?.noteIds || [])])];
            if (ids.length !== 1 || elements.btnAnnotationGoal?.disabled) return;
            const result = this.callbacks.onLinkGoal?.(ids[0]!);
            this.clearAnnotationContext();
            Promise.resolve(result).catch(error => console.error("Could not add to goal", error));
        }, { signal: hostSignal });
        if (elements.btnHlRemove) {
            elements.btnHlRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                const ctx = this.activeAnnotationContext;
                if (!ctx || !ctx.highlightIds.length) return;
                const ids = ctx.highlightIds.slice();
                this.clearAnnotationContext();
                if (this.callbacks.onDeleteHighlight) this.callbacks.onDeleteHighlight(ids);
            }, { signal: hostSignal });
        }

        if (elements.btnNoteRemove) {
            elements.btnNoteRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                const ctx = this.activeAnnotationContext;
                if (!ctx || !ctx.noteIds.length) return;
                const ids = ctx.noteIds.slice();
                this.clearAnnotationContext();
                this.callbacks.onDeleteNotes?.(ids);
            }, { signal: hostSignal });
        }

        const dismiss = (e: Event) => {
            const selection = document.getSelection();
            const hasActiveSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;

            if (!eventElement(e)?.closest('#selection-tooltip') && !hasActiveSelection) {
                this.hideSelectionTooltip();
            }

            if (this.pointerMoved || hasActiveSelection) return;
            if (eventElement(e)?.closest('#highlight-action-tooltip') || eventElement(e)?.closest('.annotation-token')) return;
            if (eventElement(e)?.closest('#notes-panel')) return;
            this.hideHighlightAction();
        };
        document.addEventListener('click', dismiss, { signal });
        if (hostDocument !== document) hostDocument.addEventListener('click', dismiss, { signal: hostSignal });
    }
}

function splitIds(value: string | null) {
    if (!value) return [];
    return String(value).split(/\s+/).filter(Boolean);
}

function hasTextSelection(selection: Selection | null | undefined) {
    return !!(selection && selection.rangeCount > 0 && !selection.isCollapsed && selection.toString().trim());
}

function clearActiveTokens(root?: HTMLElement | null) {
    if (!root) return;
    root.querySelectorAll('.annotation-token.is-active').forEach(token => token.classList.remove('is-active'));
}

function findTokensByKey(key: string, root?: HTMLElement | null) {
    if (!root || !key) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('.annotation-token')).filter(token => tokenKey(token) === key);
}

function findTokenByAnnotationId(annotationId: string, root?: HTMLElement | null): HTMLElement | null {
    if (!root || !annotationId) return null;
    return [...root.querySelectorAll<HTMLElement>('.annotation-token')].find(token =>
        [...splitIds(token.dataset.highlightIds || ''), ...splitIds(token.dataset.noteIds || '')].includes(annotationId)) || null;
}

function tokenKey(token: Element) {
    return annotationContextKey(
        splitIds(token.getAttribute('data-highlight-ids')),
        splitIds(token.getAttribute('data-note-ids'))
    );
}

function collectTokenQuote(root: Element | null, token: HTMLElement) {
    const key = tokenKey(token);
    const tokens = root
        ? Array.from(root.querySelectorAll<HTMLElement>('.annotation-token')).filter(item => tokenKey(item) === key)
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
