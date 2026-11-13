import { readerRect } from '../reader/readerDocument.js';
import { readingViewportRect } from '../reader/readingAxis.js';
// Presentation geometry only. Annotation contents, ranges and persistence stay
// with the existing controllers and repositories.
import { intersectVisibleRects } from '../reader/visibleAnnotations.js';

export function marginGeometry(width, preferredWidth = 560) {
    const w = Math.max(1, Number(width) || 1);
    const preferred = Math.min(800, Math.max(320, Number(preferredWidth) || 560));
    let readingWidth = Math.min(preferred, Math.max(1, w - 32));
    let placement = 'right', noteWidth = 260, gap = 48;
    let readingLeft = (w - readingWidth) / 2;
    if (readingLeft + readingWidth + gap + noteWidth > w - 24) {
        gap = 32;
        noteWidth = 220;
        // In narrow windows keep notes beside the text, without a bottom band.
        readingWidth = Math.min(readingWidth, Math.max(1, w - 32 - gap - noteWidth));
        readingLeft = (w - readingWidth - gap - noteWidth) / 2;
    }
    return {
        placement, readingWidth, readingLeft, noteWidth, gap,
        rightNoteLeft: readingLeft + readingWidth + gap
    };
}

export function isImmersiveNotes(elements) {
    return !!elements?.workspaceContainer?.classList.contains('immersive-notes');
}

export function applyMarginGeometry(elements, preferredWidth = 560) {
    if (!isImmersiveNotes(elements)) return;
    const workspace = elements.workspaceContainer;
    const width = workspace.clientWidth || workspace.ownerDocument.defaultView?.innerWidth || 1200;
    const geometry = marginGeometry(width, elements.bookPaper?.dataset.layout === 'pre-paginated' ? 560 : preferredWidth);
    workspace.dataset.notesPlacement = geometry.placement;
    workspace.style.setProperty('--reading-width', `${geometry.readingWidth}px`);
    workspace.style.setProperty('--reading-left', `${geometry.readingLeft}px`);
    workspace.style.setProperty('--reading-right', `${Math.max(0, width - geometry.readingLeft - geometry.readingWidth)}px`);
    workspace._marginGeometry = geometry;
}

export function moveNoteCard(card, target, before = null) {
    if (card.parentElement === target && card.nextSibling === before) return;
    if (typeof target.moveBefore === 'function' && card.isConnected) target.moveBefore(card, before);
    else {
        const editor = card.querySelector('.note-editor');
        const active = editor && card.ownerDocument.activeElement === editor;
        const start = editor?.selectionStart, end = editor?.selectionEnd;
        if (active) editor.dataset.repositioning = 'true';
        target.insertBefore(card, before);
        if (active) {
            editor.focus({ preventScroll: true });
            editor.setSelectionRange(start, end);
            delete editor.dataset.repositioning;
        }
    }
}

export function positionMarginNotes(elements) {
    if (!isImmersiveNotes(elements) || !elements.notesList) return;
    const workspace = elements.workspaceContainer;
    const geometry = workspace._marginGeometry;
    const viewport = workspace.ownerDocument.getElementById('reader-viewport');
    if (!geometry || !viewport) return;
    const list = elements.notesList;
    const cards = [...list.querySelectorAll('.note-card')];
    if (!cards.length) {
        if (list.dataset.renderer !== 'react') list.querySelectorAll('.margin-notes-lane').forEach(lane => lane.remove());
        return;
    }
    const bounds = workspace.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    const win = workspace.ownerDocument.defaultView;
    const paper = elements.bookPaper;
    if (elements.notesPanel && paper && win) {
        const paperStyle = paper.ownerDocument.defaultView.getComputedStyle(paper);
        // Use the destination theme token, not an intermediate animated color.
        elements.notesPanel.style.setProperty('--margin-note-color', paperStyle.getPropertyValue('--bg-paper-text').trim() || paperStyle.color);
    }
    const anchors = annotationAnchors(elements, view);
    const top = view.top - bounds.top + 32;
    const height = Math.max(1, view.bottom - bounds.top - top - 32);
    const lane = side => {
        let node = list.querySelector(`[data-margin-side="${side}"]`);
        if (!node) {
            node = workspace.ownerDocument.createElement('div');
            node.className = 'margin-notes-lane';
            node.dataset.marginSide = side;
            node.setAttribute('role', 'group');
            node.setAttribute('aria-label', "Notes for visible text");
            list.appendChild(node);
        }
        node.style.left = `${geometry.rightNoteLeft}px`;
        node.style.top = `${top}px`;
        node.style.width = `${geometry.noteWidth}px`;
        node.style.height = `${height}px`;
        return node;
    };
    const groups = new Map();
    cards.forEach(card => {
        const anchor = anchors.get(card.dataset.annotationId);
        const side = 'right';
        const target = lane(side);
        if (card.parentElement !== target && list.dataset.renderer !== 'react') moveNoteCard(card, target);
        if (!groups.has(target)) groups.set(target, []);
        groups.get(target).push({ card, y: anchor ? anchor.top - bounds.top - top : 0 });
    });
    list.querySelectorAll('.margin-notes-lane').forEach(node => {
        if (!groups.has(node) && list.dataset.renderer !== 'react') node.remove();
    });
    for (const [target, entries] of groups) {
        // Keep an overflowing lane scrollable and stable while its source text
        // scrolls. Never rebuild cards or steal a focused edit/delete button.
        entries.sort((a, b) => a.y - b.y);
        let bottom = 0;
        for (const { card, y } of entries) {
            const pos = Math.max(bottom, Math.min(Math.max(0, y), Math.max(0, height - card.offsetHeight)));
            card.style.top = `${pos}px`;
            bottom = pos + card.offsetHeight + 24;
        }
    }
}

function annotationAnchors(elements, view) {
    const anchors = new Map();
    for (const paper of [elements.bookPaper]) {
        if (!paper || paper.hidden || paper.style.display === 'none') continue;
        const paperRect = readerRect(readingViewportRect(paper), paper.ownerDocument);
        const clip = intersectVisibleRects(view, paperRect);
        if (!clip) continue;
        for (const token of paper.querySelectorAll('.annotation-token')) {
            for (const rect of token.getClientRects()) {
                const visible = intersectVisibleRects(clip, readerRect(rect, token.ownerDocument));
                if (!visible) continue;
                const ids = `${token.getAttribute('data-note-ids') || ''} ${token.getAttribute('data-highlight-ids') || ''}`.trim().split(/\s+/);
                ids.filter(Boolean).forEach(id => {
                    const point = { top: visible.top };
                    const previous = anchors.get(id);
                    if (!previous || point.top < previous.top) anchors.set(id, point);
                });
            }
        }
    }
    return anchors;
}
