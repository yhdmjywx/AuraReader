import { readerViewport } from './readerDom.js';
/* ==========================================================================
   Chapter column view - DOM layout for one EPUB chapter strip.
   scroll: vertical strip. single: one column per screen.
   ========================================================================== */

import {
    columnMetrics,
    countColumns,
    columnFromScroll,
    sentenceSlice,
    screenStep,
    screenStartForColumn
} from '../../domain/chapterFlow.js';

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figcaption';

export function clearChapterFlow(elements) {
    if (!elements) return;
    const viewport = readerViewport(elements);
    if (viewport) viewport.classList.remove('chapter-paged', 'chapter-scroll');
    if (elements.paperContainer) elements.paperContainer.classList.remove('chapter-flow');
    if (elements.bookPaper) {
        elements.bookPaper.classList.remove('chapter-flow', 'mode-scroll', 'mode-single');
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
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    const container = elements && elements.paperContainer;
    if (!viewport || !paper || !container) return null;

    viewport.classList.remove('chapter-paged', 'chapter-scroll');
    container.classList.add('chapter-flow');
    paper.classList.add('chapter-flow');
    paper.classList.remove('mode-scroll', 'mode-single');

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
    paper.classList.add('mode-single');
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
    return { mode, metrics, hostWidth, hostHeight };
}

export function readTopLeftSentence(root, viewport) {
    if (!root || typeof document === 'undefined') return '';
    const view = root.getBoundingClientRect();
    if (!view.width || !view.height) {
        if (!viewport) return '';
    }
    const probes = [
        [56, 40],
        [88, 52],
        [56, 84],
        [120, 40]
    ];
    for (const [dx, dy] of probes) {
        const x = Math.min(view.right - 4, view.left + dx);
        const y = Math.min(view.bottom - 4, view.top + dy);
        const hit = caretAt(x, y, root.ownerDocument);
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
        root.scrollLeft = 0;
        return true;
    }
    const block = insertColumnBreak(root, pos.node, pos.offset);
    if (!block) return false;
    snapBlockToScreen(root, block, mode);
    return true;
}

/** @param {number | null | undefined} sourcePage */
export function placeAnchorIdAtTopLeft(root, viewport, anchor, mode, sourcePage = null) {
    if (!root || !anchor) return false;
    let target = null;
    const candidates = [...root.querySelectorAll('[name], [id]')].filter(element => {
        const title = element.closest('[data-volume-title-page]');
        return !sourcePage || Number(title?.dataset.volumeTitlePage || root.dataset.flowPage) === Number(sourcePage);
    });
    target = candidates.find(element => element.id === anchor)
        || candidates.find(element => element.getAttribute('name') === anchor)
        || candidates.find(element => element.id.includes(anchor));
    if (!target) return false;
    const text = target.textContent || '';
    const sentence = sentenceSlice(text, 0) || text.trim().slice(0, 40);
    return placeSentenceAtTopLeft(root, viewport, sentence, mode);
}

export function shiftStrip(elements, mode, direction) {
    const viewport = readerViewport(elements);
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
    const frame = pagedFrame(paper, mode);
    const index = Math.round(paper.scrollLeft / frame.step);
    const lastIndex = Math.round(frame.maxStart / frame.step);
    if (direction > 0) {
        if (index >= lastIndex) return 'edge';
        paper.scrollLeft = (index + 1) * frame.step;
        return 'moved';
    }
    if (index <= 0) return 'edge';
    paper.scrollLeft = (index - 1) * frame.step;
    return 'moved';
}

export function scrollStripToStart(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll') {
        if (viewport) viewport.scrollTop = 0;
        return;
    }
    if (paper) paper.scrollLeft = 0;
}

export function scrollStripToEnd(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll') {
        if (!viewport) return;
        viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        return;
    }
    if (!paper) return;
    paper.scrollLeft = pagedFrame(paper, mode).maxStart;
}

export function atStripStart(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll') return !viewport || viewport.scrollTop <= 2;
    return !paper || paper.scrollLeft <= 2;
}

export function atStripEnd(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll') {
        if (!viewport) return true;
        return viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 2;
    }
    if (!paper) return true;
    const frame = pagedFrame(paper, mode);
    return Math.round(paper.scrollLeft / frame.step) >= Math.round(frame.maxStart / frame.step);
}

export function writeChapterIndicator(elements, mode) {
    const viewport = readerViewport(elements);
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
        const contentTotal = contentColumnCount(paper, metrics);
        total = contentTotal;
        current = columnFromScroll(paper.scrollLeft, metrics.stride, contentTotal);
        if (current > contentTotal) current = contentTotal;
        label = String(current);
        if (elements.pageUnit) elements.pageUnit.textContent = '栏';
    }
    elements.currentPageSpan.textContent = label;
    elements.totalPagesSpan.textContent = String(total);
    return { current, total };
}

function caretAt(x, y, document) {
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
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node) return null;
    return { node, offset: 0 };
}

function offsetInside(block, node, offset) {
    if (!block || !node) return 0;
    const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
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
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
    const range = node.ownerDocument.createRange();
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
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
        if (current === node) return true;
        if ((current.textContent || '').replace(/\s+/g, '') !== '') return false;
        current = walker.nextNode();
    }
    return false;
}

function contentColumnCount(paper, metrics) {
    let total = countColumns(paper.scrollWidth, metrics.stride);
    return Math.max(1, total);
}

function pagedFrame(paper, mode) {
    const metrics = columnMetrics(paper.clientWidth, mode);
    const step = screenStep(metrics);
    const contentTotal = contentColumnCount(paper, metrics);
    const maxStart = screenStartForColumn(contentTotal, metrics);
    return { metrics, step, contentTotal, maxStart };
}

function insertColumnBreak(paper, node, offset) {
    if (!paper || !node || node.nodeType !== Node.TEXT_NODE || !node.parentNode) return null;
    let target = node;
    let at = Math.max(0, Math.min(target.textContent.length, offset));
    if (at > 0 && at < target.textContent.length) {
        target = target.splitText(at);
        at = 0;
    }
    if (at > 0) return null;
    const block = liftToColumnChild(paper, target);
    if (!block) return null;
    block.classList.add('flow-start');
    return block;
}

function liftToColumnChild(paper, textNode) {
    let node = textNode;
    while (node.parentNode && node.parentNode !== paper) {
        const parent = node.parentNode;
        if (node.previousSibling) {
            const clone = parent.cloneNode(false);
            if (clone.removeAttribute) clone.removeAttribute('id');
            let sib = node;
            while (sib) {
                const next = sib.nextSibling;
                clone.appendChild(sib);
                sib = next;
            }
            if (!parent.parentNode) return null;
            parent.parentNode.insertBefore(clone, parent.nextSibling);
            node = clone;
        } else {
            node = parent;
        }
    }
    if (!node.parentNode) return null;
    if (node.nodeType === Node.TEXT_NODE) {
        const wrap = paper.ownerDocument.createElement('div');
        node.parentNode.insertBefore(wrap, node);
        wrap.appendChild(node);
        node = wrap;
    }
    return node;
}

function snapBlockToScreen(paper, block, mode) {
    const metrics = columnMetrics(paper.clientWidth, mode);
    const stride = Math.max(1, metrics.stride);
    const rect = block.getBoundingClientRect();
    const host = paper.getBoundingClientRect();
    const contentX = paper.scrollLeft + rect.left - host.left;
    const columnNumber = Math.max(1, Math.round(contentX / stride) + 1);
    paper.scrollLeft = screenStartForColumn(columnNumber, metrics);
}

function removeFlowBreak(root) {
    root.querySelectorAll('.flow-start').forEach(node => node.classList.remove('flow-start'));
}
