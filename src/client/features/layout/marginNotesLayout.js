// Presentation geometry only. Annotation contents, ranges and persistence stay
// with the existing controllers and repositories.
import { intersectVisibleRects } from '../reader/visibleAnnotations.js';

export function marginGeometry(width, mode = 'single') {
    const w = Math.max(1, Number(width) || 1);
    const double = mode === 'double';
    const readingWidth = double ? 1192 : Math.min(560, Math.max(1, w - 32));
    let placement = 'right', noteWidth = 260, gap = 48;
    let readingLeft = (w - readingWidth) / 2;
    if (double) {
        gap = 24;
        if (w >= 1612) {
            placement = 'flanks';
            noteWidth = Math.min(260, (w - 1260) / 2);
        } else if (w >= 1424) {
            noteWidth = Math.min(220, w - 1248);
            readingLeft = (w - readingWidth - gap - noteWidth) / 2;
        } else placement = 'bottom';
    } else if (readingLeft + readingWidth + gap + noteWidth > w - 24) {
        gap = 32;
        noteWidth = 220;
        readingLeft = (w - readingWidth - gap - noteWidth) / 2;
        if (readingLeft < 16) {
            placement = 'bottom';
            readingLeft = (w - readingWidth) / 2;
        }
    }
    return {
        placement, readingWidth, readingLeft, noteWidth, gap,
        leftNoteLeft: readingLeft - gap - noteWidth,
        rightNoteLeft: readingLeft + readingWidth + gap,
        bandHeight: placement === 'bottom' ? 168 : 0
    };
}

export function isImmersiveNotes(elements) {
    return !!elements?.workspaceContainer?.classList.contains('immersive-notes');
}

export function applyMarginGeometry(elements, mode) {
    if (!isImmersiveNotes(elements)) return;
    const workspace = elements.workspaceContainer;
    const width = workspace.clientWidth || workspace.ownerDocument.defaultView?.innerWidth || 1200;
    const geometry = marginGeometry(width, mode);
    workspace.dataset.notesPlacement = geometry.placement;
    workspace.style.setProperty('--reading-width', `${geometry.readingWidth}px`);
    workspace.style.setProperty('--reading-left', `${geometry.readingLeft}px`);
    workspace.style.setProperty('--reading-right', `${Math.max(0, width - geometry.readingLeft - geometry.readingWidth)}px`);
    workspace.style.setProperty('--note-band-height', `${geometry.bandHeight}px`);
    workspace._marginGeometry = geometry;
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
        list.querySelectorAll('.margin-notes-lane').forEach(lane => lane.remove());
        return;
    }
    const bounds = workspace.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    const win = workspace.ownerDocument.defaultView;
    const paper = elements.bookPaper;
    if (elements.notesPanel && paper && win) {
        const paperStyle = win.getComputedStyle(paper);
        // Use the destination theme token, not an intermediate animated color.
        elements.notesPanel.style.setProperty('--margin-note-color', paperStyle.getPropertyValue('--bg-paper-text').trim() || paperStyle.color);
    }
    const anchors = annotationAnchors(elements, view, bounds.left + geometry.readingLeft + geometry.readingWidth / 2);
    const top = geometry.placement === 'bottom' ? view.bottom - bounds.top + 12 : view.top - bounds.top + 32;
    const height = geometry.placement === 'bottom' ? 144 : Math.max(1, view.bottom - bounds.top - top - 32);
    const lane = side => {
        let node = list.querySelector(`[data-margin-side="${side}"]`);
        if (!node) {
            node = workspace.ownerDocument.createElement('div');
            node.className = 'margin-notes-lane';
            node.dataset.marginSide = side;
            node.setAttribute('role', 'group');
            node.setAttribute('aria-label', side === 'left' ? '左页笔记' : '当前可见正文的笔记');
            list.appendChild(node);
        }
        const bottom = geometry.placement === 'bottom';
        node.style.left = `${bottom ? 16 : side === 'left' ? geometry.leftNoteLeft : geometry.rightNoteLeft}px`;
        node.style.top = `${top}px`;
        node.style.width = `${bottom ? Math.max(1, workspace.clientWidth - 32) : geometry.noteWidth}px`;
        node.style.height = `${height}px`;
        return node;
    };
    const groups = new Map();
    cards.forEach(card => {
        const anchor = anchors.get(card.dataset.annotationId);
        const side = geometry.placement === 'flanks' && anchor?.side === 'left' ? 'left' : 'right';
        const target = lane(side);
        if (card.parentElement !== target) target.appendChild(card);
        if (!groups.has(target)) groups.set(target, []);
        groups.get(target).push({ card, y: anchor ? anchor.top - bounds.top - top : 0 });
    });
    list.querySelectorAll('.margin-notes-lane').forEach(node => {
        if (!groups.has(node)) node.remove();
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
        if (geometry.placement === 'bottom') {
            // Flex order follows source order without moving an active node.
            entries.forEach(({ card }, order) => card.style.order = String(order));
        }
    }
}

function annotationAnchors(elements, view, middle) {
    const anchors = new Map();
    for (const paper of [elements.bookPaper, elements.bookPaperRight]) {
        if (!paper || paper.hidden || paper.style.display === 'none') continue;
        const paperRect = paper.getBoundingClientRect();
        const clip = intersectVisibleRects(view, paperRect);
        if (!clip) continue;
        for (const token of paper.querySelectorAll('.annotation-token')) {
            for (const rect of token.getClientRects()) {
                const visible = intersectVisibleRects(clip, rect);
                if (!visible) continue;
                const side = (visible.left + visible.right) / 2 < middle ? 'left' : 'right';
                const ids = `${token.getAttribute('data-note-ids') || ''} ${token.getAttribute('data-highlight-ids') || ''}`.trim().split(/\s+/);
                ids.filter(Boolean).forEach(id => {
                    const point = { top: visible.top, side };
                    const previous = anchors.get(id);
                    if (!previous || (side === 'left' && previous.side === 'right') || (side === previous.side && point.top < previous.top)) anchors.set(id, point);
                });
            }
        }
    }
    return anchors;
}
