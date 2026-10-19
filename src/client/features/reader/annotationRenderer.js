/* ==========================================================================
   AnnotationRenderer - Mounts non-nested annotation tokens onto a page.
   One span per merged text fragment. Highlight and note ids stay separate.
   ========================================================================== */

import { normalizeAnnotation } from '../../domain/annotationEngine.js';
import { buildSegments, resolveAnnotationRange } from '../../domain/annotationRangeEngine.js';

export function renderAnnotationTokens(root, annotations = [], page = null) {
    if (!root || typeof document === 'undefined' || !root.ownerDocument) return;
    if (page != null) root.dataset.annotationPage = String(page);
    if (!Array.isArray(annotations) || annotations.length === 0) return;

    const index = buildTextIndex(root);
    if (!index.text) return;

    const ranges = [];
    annotations.forEach(raw => {
        const annotation = normalizeAnnotation(raw);
        if (!annotation || !annotation.id) return;
        const range = resolveAnnotationRange(index.text, annotation);
        if (!range) return;
        ranges.push({
            id: annotation.id,
            kind: annotation.kind,
            start: range.start,
            end: range.end
        });
    });

    const segments = buildSegments(ranges);
    if (segments.length === 0) return;
    applySegments(root, segments);
}

export function rangeOffsets(root, range) {
    if (!root || !range) return null;
    const start = boundaryOffset(root, range.startContainer, range.startOffset);
    const end = boundaryOffset(root, range.endContainer, range.endOffset);
    if (start == null || end == null || end <= start) return null;
    return { start, end };
}

export function selectionLocation(root, range, page, sectionId) {
    const offsets = rangeOffsets(root, range);
    if (!offsets) return null;
    const validPage = Number(page) || 1;
    return {
        sectionId: sectionId || `chapter-${validPage}`,
        page: validPage,
        start: offsets.start,
        end: offsets.end,
        offset: offsets.start
    };
}

function applySegments(root, segments) {
    const initial = buildTextIndex(root);
    const splits = new Map();

    segments.forEach(segment => {
        markSplit(initial, segment.start, splits);
        markSplit(initial, segment.end, splits);
    });

    splits.forEach((offsets, node) => {
        const ordered = Array.from(offsets).sort((a, b) => b - a);
        ordered.forEach(offset => {
            if (offset > 0 && offset < node.textContent.length) {
                node.splitText(offset);
            }
        });
    });

    const refreshed = buildTextIndex(root);
    for (let i = refreshed.nodes.length - 1; i >= 0; i--) {
        const item = refreshed.nodes[i];
        if (!item.node.textContent) continue;
        const segment = segments.find(candidate => candidate.start <= item.start && candidate.end >= item.end);
        if (!segment) continue;
        wrapTextNode(item.node, segment, item.start, item.end, root.dataset.annotationPage || '');
    }
}

function markSplit(index, offset, splits) {
    const item = index.nodes.find(node => offset > node.start && offset < node.end);
    if (!item) return;
    if (!splits.has(item.node)) splits.set(item.node, new Set());
    splits.get(item.node).add(offset - item.start);
}

function wrapTextNode(textNode, segment, start, end, page) {
    const parent = textNode.parentNode;
    if (!parent) return;
    if (parent.classList && parent.classList.contains('annotation-token')) return;

    const span = textNode.ownerDocument.createElement('span');
    span.className = 'annotation-token';
    if (segment.highlightIds.length > 0) {
        span.classList.add('has-highlight');
        span.setAttribute('data-highlight-ids', segment.highlightIds.join(' '));
    }
    if (segment.noteIds.length > 0) {
        span.classList.add('has-note');
        span.setAttribute('data-note-ids', segment.noteIds.join(' '));
    }
    span.setAttribute('data-start', String(start));
    span.setAttribute('data-end', String(end));
    if (page) span.setAttribute('data-page', String(page));
    parent.insertBefore(span, textNode);
    span.appendChild(textNode);
}

function buildTextIndex(root) {
    const nodes = [];
    const walker = sourceTextWalker(root);
    let offset = 0;
    let current = walker.nextNode();
    while (current) {
        const text = current.textContent || '';
        if (text.length > 0) {
            nodes.push({ node: current, start: offset, end: offset + text.length });
            offset += text.length;
        }
        current = walker.nextNode();
    }
    return {
        nodes,
        text: nodes.map(item => item.node.textContent).join('')
    };
}

function boundaryOffset(root, container, offset) {
    if (!container || !root) return null;
    if (container.nodeType === 3) return textNodeOffset(root, container, offset);
    if (container.nodeType !== 1) return null;

    if (offset <= 0) {
        const first = firstTextNode(container);
        if (first) return textNodeOffset(root, first, 0);
        return textBeforeElement(root, container);
    }

    if (offset >= container.childNodes.length) {
        const last = lastTextNode(container);
        if (last) return textNodeOffset(root, last, last.textContent.length);
        return textBeforeElement(root, container);
    }

    const child = container.childNodes[offset];
    if (!child) return textBeforeElement(root, container);
    if (child.nodeType === 3) return textNodeOffset(root, child, 0);
    const first = firstTextNode(child);
    if (first) return textNodeOffset(root, first, 0);
    return textBeforeElement(root, child);
}

function textNodeOffset(root, targetNode, nodeOffset) {
    const walker = sourceTextWalker(root);
    let count = 0;
    let current = walker.nextNode();
    while (current) {
        if (current === targetNode) {
            const safeOffset = Math.max(0, Math.min(nodeOffset, current.textContent.length));
            return count + safeOffset;
        }
        count += current.textContent.length;
        current = walker.nextNode();
    }
    return null;
}

function firstTextNode(element) {
    if (!element || element.nodeType !== 1) return null;
    const walker = sourceTextWalker(element);
    return walker.nextNode();
}

function lastTextNode(element) {
    if (!element || element.nodeType !== 1) return null;
    const walker = sourceTextWalker(element);
    let last = null;
    let current = walker.nextNode();
    while (current) {
        last = current;
        current = walker.nextNode();
    }
    return last;
}

function textBeforeElement(root, element) {
    const walker = sourceTextWalker(root);
    let count = 0;
    let current = walker.nextNode();
    while (current) {
        if (element.contains && element.contains(current)) return count;
        const position = element.compareDocumentPosition(current);
        if (position & 4) return count;
        count += current.textContent.length;
        current = walker.nextNode();
    }
    return count;
}

function sourceTextWalker(root) {
    // The prepended divider has its own original page/offset coordinate space.
    // It must not shift the first chapter's existing or newly selected ranges.
    return root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const divider = node.parentElement?.closest('[data-volume-title-page]');
            return divider && !divider.contains(root) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
    });
}
