/* ==========================================================================
   Chapter column view - DOM layout for one EPUB chapter strip.
   scroll: vertical strip. single: 1 column. double: 2 columns.
   ========================================================================== */

import {
    columnMetrics,
    countColumns,
    columnFromScroll,
    sentenceSlice
} from '../../domain/chapterFlow.js';

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figcaption';

export function clearChapterFlow(elements) {
    if (!elements) return;
    const viewport = document.getElementById('reader-viewport');
    if (viewport) viewport.classList.remove('chapter-paged', 'chapter-scroll');
    if (elements.paperContainer) elements.paperContainer.classList.remove('chapter-flow');
    if (elements.bookPaper) {
        elements.bookPaper.classList.remove('chapter-flow', 'mode-scroll', 'mode-single', 'mode-double');
        elements.bookPaper.style.columnWidth = '';
        elements.bookPaper.style.columnGap = '';
        elements.bookPaper.style.columnFill = '';
        elements.bookPaper.style.height = '';
        elements.bookPaper.style.overflow = '';
        elements.bookPaper.style.width = '';
    }
    if (elements.pageUnit) elements.pageUnit.textContent = '页';
}

export function layoutChapterStrip(elements, mode) {
    const viewport = document.getElementById('reader-viewport');
    const paper = elements && elements.bookPaper;
    const container = elements && elements.paperContainer;
    if (!viewport || !paper || !container) return null;

    viewport.classList.remove('chapter-paged', 'chapter-scroll');
    container.classList.add('chapter-flow');
    container.classList.remove('spread-active');
    paper.classList.add('chapter-flow');
    paper.classList.remove('mode-scroll', 'mode-single', 'mode-double');
    if (elements.bookPaperRight) elements.bookPaperRight.style.display = 'none';
    if (elements.spreadSpine) elements.spreadSpine.style.display = 'none';

    if (mode === 'scroll') {
        viewport.classList.add('chapter-scroll');
        paper.classList.add('mode-scroll');
        paper.style.columnWidth = '';
        paper.style.columnGap = '';
        paper.style.columnFill = '';
        paper.style.height = 'auto';
        paper.style.overflow = 'visible';
        paper.style.width = '100%';
        return { mode, metrics: null };
    }

    viewport.classList.add('chapter-paged');
    paper.classList.add(mode === 'double' ? 'mode-double' : 'mode-single');
    const hostHeight = container.clientHeight || viewport.clientHeight;
    const hostWidth = container.clientWidth || viewport.clientWidth;
    paper.style.boxSizing = 'border-box';
    paper.style.width = `${Math.max(1, hostWidth)}px`;
    paper.style.height = `${Math.max(1, hostHeight)}px`;
    paper.style.padding = '28px 0 32px';
    paper.style.overflow = 'hidden';
    const metrics = columnMetrics(paper.clientWidth || hostWidth, mode);
    paper.style.columnFill = 'auto';
    paper.style.columnWidth = `${metrics.colWidth}px`;
    paper.style.columnGap = `${metrics.gap}px`;
    balanceDoubleTail(paper, mode);
    return { mode, metrics, hostWidth, hostHeight };
}

export function readTopLeftSentence(root, viewport) {
    if (!root || !viewport || typeof document === 'undefined') return '';
    const view = viewport.getBoundingClientRect();
    const probes = [
        [16, 20],
        [28, 36],
        [48, 64],
        [16, 96]
    ];
    for (const [dx, dy] of probes) {
        const x = Math.min(view.right - 4, view.left + dx);
        const y = Math.min(view.bottom - 4, view.top + dy);
        const hit = caretAt(x, y);
        if (!hit || !root.contains(hit.node)) continue;
        const sentence = sentenceFromHit(root, hit.node, hit.offset);
        if (sentence) return sentence;
    }
    return '';
}

export function placeSentenceAtTopLeft(root, viewport, sentence, mode) {
    if (!root || !sentence) return false;
    removeFlowBreak(root);
    const pos = locateSnippet(root, sentence);
    if (!pos) return false;
    if (mode === 'scroll') {
        const range = rangeAt(pos.node, pos.offset);
        if (!range || !viewport) return false;
        const rect = range.getBoundingClientRect();
        const view = viewport.getBoundingClientRect();
        viewport.scrollTop += rect.top - view.top;
        return true;
    }
    if (isDocumentStart(root, pos.node, pos.offset)) {
        balanceDoubleTail(root, mode);
        root.scrollLeft = 0;
        return true;
    }
    const marker = insertColumnBreak(pos.node, pos.offset);
    if (!marker) return false;
    balanceDoubleTail(root, mode);
    const rect = marker.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    root.scrollLeft += rect.left - host.left;
    return true;
}

export function placeAnchorIdAtTopLeft(root, viewport, anchor, mode) {
    if (!root || !anchor) return false;
    let target = null;
    try {
        target = root.querySelector(`#${CSS.escape(anchor)}`)
            || root.querySelector(`[name="${anchor}"]`)
            || root.querySelector(`[id*="${anchor}"]`);
    } catch (e) {
        target = root.querySelector(`[id="${anchor}"]`);
    }
    if (!target) return false;
    const text = target.textContent || '';
    const sentence = sentenceSlice(text, 0) || text.trim().slice(0, 40);
    return placeSentenceAtTopLeft(root, viewport, sentence, mode);
}

export function shiftStrip(elements, mode, direction) {
    const viewport = document.getElementById('reader-viewport');
    const paper = elements && elements.bookPaper;
    if (!viewport || !paper) return 'edge';
    if (mode === 'scroll') {
        const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        if (direction > 0) {
            if (viewport.scrollTop >= max - 2) return 'edge';
            viewport.scrollTop = Math.min(max, viewport.scrollTop + viewport.clientHeight);
            return 'moved';
        }
        if (viewport.scrollTop <= 2) return 'edge';
        viewport.scrollTop = Math.max(0, viewport.scrollTop - viewport.clientHeight);
        return 'moved';
    }
    const max = Math.max(0, paper.scrollWidth - paper.clientWidth);
    const step = paper.clientWidth || 1;
    if (direction > 0) {
        const next = Math.min(max, paper.scrollLeft + step);
        if (next <= paper.scrollLeft + 1) return 'edge';
        paper.scrollLeft = next;
        return 'moved';
    }
    if (paper.scrollLeft <= 2) return 'edge';
    const snapped = Math.floor((paper.scrollLeft - 1) / step) * step;
    paper.scrollLeft = Math.max(0, snapped);
    return 'moved';
}

export function scrollStripToStart(elements, mode) {
    const viewport = document.getElementById('reader-viewport');
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll') {
        if (viewport) viewport.scrollTop = 0;
        return;
    }
    if (paper) paper.scrollLeft = 0;
}

export function scrollStripToEnd(elements, mode) {
    const viewport = document.getElementById('reader-viewport');
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll') {
        if (!viewport) return;
        viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        return;
    }
    if (!paper) return;
    paper.scrollLeft = Math.max(0, paper.scrollWidth - paper.clientWidth);
}

export function atStripStart(elements, mode) {
    const viewport = document.getElementById('reader-viewport');
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll') return !viewport || viewport.scrollTop <= 2;
    return !paper || paper.scrollLeft <= 2;
}

export function atStripEnd(elements, mode) {
    const viewport = document.getElementById('reader-viewport');
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll') {
        if (!viewport) return true;
        return viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 2;
    }
    if (!paper) return true;
    return paper.scrollLeft >= paper.scrollWidth - paper.clientWidth - 2;
}

export function writeChapterIndicator(elements, mode) {
    const viewport = document.getElementById('reader-viewport');
    const paper = elements && elements.bookPaper;
    if (!elements || !elements.currentPageSpan || !elements.totalPagesSpan) return { current: 1, total: 1 };
    let current = 1;
    let total = 1;
    let label = '1';
    if (mode === 'scroll') {
        const height = viewport ? viewport.clientHeight : 1;
        const scrollHeight = viewport ? viewport.scrollHeight : 1;
        const scrollTop = viewport ? viewport.scrollTop : 0;
        total = Math.max(1, Math.ceil(scrollHeight / Math.max(1, height)));
        current = Math.min(total, Math.floor(scrollTop / Math.max(1, height)) + 1);
        label = String(current);
        if (elements.pageUnit) elements.pageUnit.textContent = '屏';
    } else if (paper) {
        const metrics = columnMetrics(paper.clientWidth, mode);
        const measured = countColumns(paper.scrollWidth, metrics.stride);
        const contentTotal = Number(paper.dataset.contentColumns) || measured;
        total = contentTotal;
        current = columnFromScroll(paper.scrollLeft, metrics.stride, measured);
        if (current > contentTotal) current = contentTotal;
        const right = current + metrics.columns - 1;
        label = (mode === 'double' && right > current && right <= contentTotal) ? `${current}–${right}` : String(current);
        if (elements.pageUnit) elements.pageUnit.textContent = '栏';
    }
    elements.currentPageSpan.textContent = label;
    elements.totalPagesSpan.textContent = String(total);
    return { current, total };
}

function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos && pos.offsetNode) return { node: pos.offsetNode, offset: pos.offset };
    }
    if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(x, y);
        if (range) return { node: range.startContainer, offset: range.startOffset };
    }
    return null;
}

function sentenceFromHit(root, node, offset) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element) return '';
    const block = (element.closest && element.closest(BLOCK_SELECTOR)) || root;
    const text = block.textContent || '';
    if (node.nodeType !== Node.TEXT_NODE) {
        const nested = firstText(element);
        const local = nested ? offsetInside(block, nested.node, nested.offset) : 0;
        return sentenceSlice(text, local);
    }
    return sentenceSlice(text, offsetInside(block, node, offset));
}

function firstText(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node) return null;
    return { node, offset: 0 };
}

function offsetInside(block, node, offset) {
    if (!block || !node) return 0;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let count = 0;
    let current = walker.nextNode();
    while (current) {
        if (current === node) return count + (Number(offset) || 0);
        count += current.textContent.length;
        current = walker.nextNode();
    }
    return 0;
}

function locateSnippet(root, snippet) {
    const needle = String(snippet || '').replace(/\s+/g, '').slice(0, 40);
    if (!needle) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts = [];
    let raw = '';
    let compact = '';
    const compactMap = [];
    let node = walker.nextNode();
    while (node) {
        const text = node.textContent || '';
        const start = raw.length;
        raw += text;
        parts.push({ node, start });
        for (let i = 0; i < text.length; i++) {
            if (!/\s/.test(text[i])) {
                compact += text[i];
                compactMap.push(start + i);
            }
        }
        node = walker.nextNode();
    }
    const found = compact.indexOf(needle);
    if (found < 0) return null;
    const rawIndex = compactMap[found];
    const part = [...parts].reverse().find(item => item.start <= rawIndex);
    if (!part) return null;
    return { node: part.node, offset: rawIndex - part.start };
}

function rangeAt(node, offset) {
    const range = document.createRange();
    const safe = Math.max(0, Math.min(node.textContent.length, offset));
    range.setStart(node, safe);
    range.setEnd(node, safe);
    return range;
}

function isDocumentStart(root, node, offset) {
    if (offset > 0) {
        const head = node.textContent.slice(0, offset);
        if (head.replace(/\s+/g, '') !== '') return false;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
        if (current === node) return true;
        if ((current.textContent || '').replace(/\s+/g, '') !== '') return false;
        current = walker.nextNode();
    }
    return false;
}

function insertColumnBreak(node, offset) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.parentNode) return null;
    let target = node;
    let at = Math.max(0, Math.min(target.textContent.length, offset));
    if (at > 0 && at < target.textContent.length) {
        target = target.splitText(at);
        at = 0;
    }
    const marker = document.createElement('div');
    marker.className = 'flow-break';
    marker.setAttribute('aria-hidden', 'true');
    if (at === 0) target.parentNode.insertBefore(marker, target);
    else target.parentNode.insertBefore(marker, target.nextSibling);
    return marker;
}

function removeFlowBreak(root) {
    root.querySelectorAll('.flow-break, .flow-tail').forEach(node => node.remove());
}

function balanceDoubleTail(paper, mode) {
    if (!paper) return;
    paper.querySelectorAll('.flow-tail').forEach(node => node.remove());
    if (mode !== 'double') {
        delete paper.dataset.contentColumns;
        return;
    }
    const metrics = columnMetrics(paper.clientWidth, mode);
    const total = countColumns(paper.scrollWidth, metrics.stride);
    paper.dataset.contentColumns = String(total);
    if (total % 2 === 0) return;
    const tail = document.createElement('div');
    tail.className = 'flow-tail';
    tail.setAttribute('aria-hidden', 'true');
    paper.appendChild(tail);
}
