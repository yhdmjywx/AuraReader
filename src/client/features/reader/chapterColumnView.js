import { readingAxis, readingViewportRect, setReadingOffset } from './readingAxis.js';
import { readerRect } from './readerDocument.js';
import { readerViewport } from './readerDom.js';
/* ==========================================================================
   Chapter column view - DOM layout for one EPUB chapter strip.
   scroll: vertical strip. single: one column per screen.
   ========================================================================== */

import {
    columnMetrics,
    columnFromScroll,
    sentenceSlice
} from '../../domain/chapterFlow.js';

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figcaption';
const imageHeightStyles = new WeakMap();

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
        elements.bookPaper.style.height = elements.bookPaper.tagName === 'BODY' ? 'auto' : '';
        elements.bookPaper.style.overflow = elements.bookPaper.tagName === 'BODY' ? 'visible' : '';
        elements.bookPaper.style.width = '';
    }
    if (elements.pageUnit) elements.pageUnit.textContent = ' page';
}

export function layoutChapterStrip(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements?.bookPaper;
    const container = elements?.paperContainer;
    if (!viewport || !paper || !container) return null;
    const axis = readingAxis(paper);
    const scroller = axis.scroller;
    paper.dataset.axis = axis.vertical ? 'vertical' : 'horizontal';
    const continuous = mode === 'scroll' && !axis.vertical;
    viewport.classList.toggle('chapter-scroll', continuous);
    viewport.classList.toggle('chapter-paged', !continuous);
    container.classList.add('chapter-flow');
    paper.classList.add('chapter-flow');
    paper.classList.toggle('mode-scroll', mode === 'scroll');
    paper.classList.toggle('mode-single', mode !== 'scroll');
    paper.style.columnCount = 'auto';
    if (continuous) {
        paper.style.columnWidth = 'auto'; paper.style.columnGap = '0px'; paper.style.columnFill = '';
        paper.style.height = 'auto'; paper.style.overflow = 'visible'; paper.style.width = '100%';
        scroller.style.setProperty('columns', 'auto', 'important');
        scroller.style.setProperty('height', 'auto', 'important');
        scroller.style.setProperty('padding', '0', 'important');
        scroller.style.setProperty('--RS__maxMediaHeight', 'none');
        setReadingOffset(paper, 0);
        return { mode, metrics: null };
    }
    const hostHeight = container.clientHeight || viewport.clientHeight;
    const hostWidth = container.clientWidth || viewport.clientWidth;
    scroller.style.removeProperty('--RS__maxMediaHeight');
    paper.style.boxSizing = 'border-box';
    paper.style.width = `${Math.max(1, hostWidth)}px`;
    paper.style.height = paper === scroller ? `${Math.max(1, hostHeight)}px` : 'auto';
    scroller.style.setProperty('height', `${Math.max(1, hostHeight)}px`, 'important');
    paper.style.padding = '28px 0 32px';
    scroller.style.setProperty('padding', '0', 'important');
    paper.style.overflow = paper === scroller ? (axis.vertical && mode === 'scroll' ? 'auto' : 'hidden') : 'visible';
    scroller.style.setProperty('overflow', axis.vertical && mode === 'scroll' ? 'auto' : 'hidden', 'important');
    if (axis.vertical) {
        paper.style.height = `${Math.max(1, hostHeight)}px`;
        paper.style.columnWidth = 'auto'; paper.style.columnGap = '0px';
        scroller.style.setProperty('columns', 'auto', 'important');
        return { mode, metrics: null, hostWidth, hostHeight };
    }
    const metrics = columnMetrics(paper.clientWidth || hostWidth, mode);
    if (scroller !== paper) {
        // Root padding belongs to each viewport, rather than fragmenting with BODY.
        scroller.style.setProperty('box-sizing', 'border-box');
        scroller.style.setProperty('padding', '28px 0 32px', 'important');
        paper.style.padding = '0';
    }
    paper.style.columnWidth = 'auto'; paper.style.columnGap = '0px';
    scroller.style.setProperty('columns', `${metrics.colWidth}px auto`, 'important');
    scroller.style.setProperty('column-fill', 'auto');
    scroller.style.setProperty('column-gap', `${metrics.gap}px`, 'important');
    return { mode, metrics, hostWidth, hostHeight };
}

/** Fit replaced images inside the content area, including their surrounding spacing. */
export function fitChapterImages(elements, mode) {
    const paper = elements?.bookPaper;
    if (!paper) return;
    const axis = readingAxis(paper);
    const view = paper.ownerDocument.defaultView;
    const rootStyle = view.getComputedStyle(axis.scroller);
    const number = value => parseFloat(value) || 0;
    const contentHeight = axis.scroller.clientHeight - number(rootStyle.paddingTop) - number(rootStyle.paddingBottom);
    for (const image of paper.querySelectorAll('img')) {
        if (!imageHeightStyles.has(image)) imageHeightStyles.set(image, {
            value: image.style.getPropertyValue('max-height'), priority: image.style.getPropertyPriority('max-height')
        });
        const original = imageHeightStyles.get(image);
        if (original.value) image.style.setProperty('max-height', original.value, original.priority);
        else image.style.removeProperty('max-height');
        const paragraph = image.closest('p');
        if (paragraph && !paragraph.textContent.trim()) paragraph.style.setProperty('text-indent', '0', 'important');
        if (mode === 'scroll' || axis.vertical) continue;
        const style = view.getComputedStyle(image);
        let spacing = number(style.marginTop) + number(style.marginBottom);
        if (style.display.startsWith('inline')) spacing += number(view.getComputedStyle(image.parentElement).lineHeight);
        let parent = image.parentElement;
        while (parent && parent !== axis.scroller) {
            const parentStyle = view.getComputedStyle(parent);
            spacing += number(parentStyle.marginTop) + number(parentStyle.marginBottom)
                + number(parentStyle.paddingTop) + number(parentStyle.paddingBottom)
                + number(parentStyle.borderTopWidth) + number(parentStyle.borderBottomWidth);
            parent = parent.parentElement;
        }
        const authorLimit = style.maxHeight.endsWith('px') ? number(style.maxHeight) : Infinity;
        const limit = Math.max(1, Math.min(authorLimit, contentHeight - spacing));
        image.style.setProperty('max-height', `${limit}px`, 'important');
    }
}

function clippedReadingRect(root, viewport) {
    let view = readingViewportRect(root);
    if (viewport && viewport.ownerDocument !== root.ownerDocument) {
        const host = readerRect(view, root.ownerDocument);
        const clip = viewport.getBoundingClientRect();
        const scaleX = view.width ? host.width / view.width : 1;
        const scaleY = view.height ? host.height / view.height : 1;
        view = { left: view.left + Math.max(0, clip.left - host.left) / scaleX,
            top: view.top + Math.max(0, clip.top - host.top) / scaleY,
            right: view.right - Math.max(0, host.right - clip.right) / scaleX,
            bottom: view.bottom - Math.max(0, host.bottom - clip.bottom) / scaleY,
            width: view.width, height: view.height };
    }
    return view;
}

/** Plain source offset only: no DOM or Range escapes the reader boundary. */
export function captureReadingPosition(root, viewport) {
    if (!root || !viewport) return null;
    const view = clippedReadingRect(root, viewport);
    if (!view.width || !view.height) return null;
    const reversed = readingAxis(root).reversed;
    for (const [dx, dy] of [[56, 40], [88, 52], [56, 84], [120, 40]]) {
        const x = reversed ? Math.max(view.left + 4, view.right - dx) : Math.min(view.right - 4, view.left + dx);
        const hit = caretAt(x, Math.min(view.bottom - 4, view.top + dy), root.ownerDocument);
        if (!hit || !root.contains(hit.node) || hit.node.nodeType !== 3 || !hit.node.textContent?.trim()) continue;
        const offset = Math.min(hit.offset, Math.max(0, hit.node.textContent.length - 1));
        const range = rangeAt(hit.node, offset);
        if (!range || typeof range.getBoundingClientRect !== 'function') continue;
        range.setEnd(hit.node, offset + 1);
        const rect = range.getBoundingClientRect();
        if (rect.right <= view.left || rect.left >= view.right || rect.bottom <= view.top || rect.top >= view.bottom) continue;
        const projected = readerRect(rect, root.ownerDocument);
        return { offset: offsetInside(root, hit.node, offset), source: root.dataset.sourceKey,
            viewportY: projected.top - viewport.getBoundingClientRect().top };
    }
    return null;
}

/** Restore the screen containing the captured character without splitting source blocks. */
export function restoreReadingPosition(root, viewport, position, mode) {
    if (!root || !viewport || !position || position.source !== root.dataset.sourceKey) return false;
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = position.offset, node;
    while ((node = walker.nextNode())) {
        const length = node.textContent.length;
        if (remaining >= length) { remaining -= length; continue; }
        const range = rangeAt(node, remaining);
        if (!range || typeof range.getBoundingClientRect !== 'function') return false;
        range.setEnd(node, remaining + 1);
        const rect = range.getBoundingClientRect(), axis = readingAxis(root);
        if (mode === 'scroll' && !axis.vertical) {
            const projected = readerRect(rect, root.ownerDocument);
            viewport.scrollTop += projected.top - viewport.getBoundingClientRect().top - position.viewportY;
        } else {
            const host = readingViewportRect(root);
            const absolute = axis.position + (axis.reversed ? host.right - rect.right : rect.left - host.left);
            setReadingOffset(root, Math.floor(Math.max(0, absolute) / axis.step) * axis.step);
        }
        return true;
    }
    return false;
}

export function readTopLeftSentence(root, viewport) {
    if (!root || typeof document === 'undefined') return '';
    const view = clippedReadingRect(root, viewport);
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
        const x = readingAxis(root).reversed ? Math.max(view.left + 4, view.right - dx) : Math.min(view.right - 4, view.left + dx);
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
    if (mode === 'scroll' && !readingAxis(root).vertical) {
        const range = rangeAt(pos.node, pos.offset);
        if (!range || !viewport) return false;
        const rect = readerRect(range.getBoundingClientRect(), root.ownerDocument);
        const view = viewport.getBoundingClientRect();
        viewport.scrollTop += rect.top - view.top;
        return true;
    }
    if (isDocumentStart(root, pos.node, pos.offset)) {
        setReadingOffset(root, 0);
        return true;
    }
    const axis = readingAxis(root);
    if (axis.vertical || axis.reversed) {
        const range = rangeAt(pos.node, pos.offset);
        if (!range) return false;
        const rect = range.getBoundingClientRect(), host = readingViewportRect(root);
        setReadingOffset(root, axis.position + (axis.reversed ? host.right - rect.right : rect.left - host.left));
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
    if (!sentence) {
        const block = target.closest(BLOCK_SELECTOR) || target.nextElementSibling || target;
        if (mode === 'scroll' && viewport && !readingAxis(root).vertical) {
            const rect = readerRect(block.getBoundingClientRect(), root.ownerDocument);
            viewport.scrollTop += rect.top - viewport.getBoundingClientRect().top;
        } else snapBlockToScreen(root, block, mode);
        return true;
    }
    return placeSentenceAtTopLeft(root, viewport, sentence, mode);
}

export function shiftStrip(elements, mode, direction) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (!viewport || !paper) return 'edge';
    if (mode === 'scroll' && (!paper || !readingAxis(paper).vertical)) {
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
    const axis = readingAxis(paper);
    const lastIndex = Math.ceil(frame.maxStart / frame.step);
    const index = axis.position >= axis.max - 2 ? lastIndex : Math.round(axis.position / frame.step);
    if (direction > 0) {
        if (index >= lastIndex) return 'edge';
        setReadingOffset(paper, (index + 1) * frame.step);
        return 'moved';
    }
    if (index <= 0) return 'edge';
    setReadingOffset(paper, (index - 1) * frame.step);
    return 'moved';
}

export function scrollStripToStart(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll' && (!paper || !readingAxis(paper).vertical)) {
        if (viewport) viewport.scrollTop = 0;
        return;
    }
    if (paper) setReadingOffset(paper, 0);
}

export function scrollStripToEnd(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll' && (!paper || !readingAxis(paper).vertical)) {
        if (!viewport) return;
        viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        return;
    }
    if (!paper) return;
    setReadingOffset(paper, readingAxis(paper).max);
}

export function atStripStart(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll' && (!paper || !readingAxis(paper).vertical)) return !viewport || viewport.scrollTop <= 2;
    return !paper || readingAxis(paper).position <= 2;
}

export function atStripEnd(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (mode === 'scroll' && (!paper || !readingAxis(paper).vertical)) {
        if (!viewport) return true;
        return viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 2;
    }
    if (!paper) return true;
    const axis = readingAxis(paper);
    return axis.position >= axis.max - 2;
}

export function writeChapterIndicator(elements, mode) {
    const viewport = readerViewport(elements);
    const paper = elements && elements.bookPaper;
    if (!elements || !elements.currentPageSpan || !elements.totalPagesSpan) return { current: 1, total: 1 };
    let current = 1;
    let total = 1;
    let label = '1';
    if (mode === 'scroll' && (!paper || !readingAxis(paper).vertical)) {
        const height = viewport ? viewport.clientHeight : 1;
        const scrollHeight = viewport ? viewport.scrollHeight : 1;
        const scrollTop = viewport ? viewport.scrollTop : 0;
        total = Math.max(1, Math.ceil(scrollHeight / Math.max(1, height)));
        current = Math.min(total, Math.floor(scrollTop / Math.max(1, height)) + 1);
        if (scrollTop > 0 && scrollTop >= scrollHeight - height - 2) current = total;
        label = String(current);
        if (elements.pageUnit) elements.pageUnit.textContent = total === 1 ? ' screen' : ' screens';
    } else if (paper) {
        const axis = readingAxis(paper);
        const contentTotal = Math.max(1, Math.ceil(axis.max / axis.step) + 1);
        total = contentTotal;
        current = axis.position >= axis.max - 2 ? contentTotal : columnFromScroll(axis.position, axis.step, contentTotal);
        if (current > contentTotal) current = contentTotal;
        label = String(current);
        if (elements.pageUnit) elements.pageUnit.textContent = total === 1 ? ' column' : ' columns';
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

function pagedFrame(paper, mode) {
    const axis = readingAxis(paper);
    return { step: axis.step, maxStart: axis.max };
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
    const axis = readingAxis(paper);
    const rect = block.getBoundingClientRect(), host = readingViewportRect(paper);
    const position = axis.position + (axis.reversed ? host.right - rect.right : rect.left - host.left);
    setReadingOffset(paper, Math.max(0, Math.round(position / axis.step)) * axis.step);
}

function removeFlowBreak(root) {
    root.querySelectorAll('.flow-start').forEach(node => node.classList.remove('flow-start'));
}
