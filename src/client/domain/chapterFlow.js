/* ==========================================================================
   Chapter flow - EPUB chapter strip math (domain, no DOM)
   A chapter is one spine document. Screen columns are cuts of that document.
   Demo books and TXT do not use this model.
   ========================================================================== */

const SENTENCE_END = /[。！？!?]/;

export function isChapterFlowBook(book) {
    if (!book) return false;
    if (book.readerFlow === 'chapter') return true;
    if (String(book.format || '').toUpperCase() !== 'EPUB') return false;
    const map = book.hrefToPageMap;
    return !!(map && typeof map === 'object' && Object.keys(map).length > 0);
}

export function sentenceStartOffset(text, index) {
    const source = String(text || '');
    if (!source) return 0;
    const at = Math.max(0, Math.min(source.length, Number(index) || 0));
    let start = 0;
    for (let i = at - 1; i >= 0; i--) {
        if (SENTENCE_END.test(source[i])) {
            start = i + 1;
            break;
        }
    }
    while (start < source.length && /\s/.test(source[start])) start++;
    return start;
}

export function sentenceSlice(text, index) {
    const source = String(text || '');
    const start = sentenceStartOffset(source, index);
    let end = source.length;
    for (let i = start; i < source.length; i++) {
        if (SENTENCE_END.test(source[i])) {
            end = i + 1;
            break;
        }
    }
    return source.slice(start, end).trim();
}

export function columnMetrics(viewWidth, mode) {
    const width = Math.max(1, Math.floor(Number(viewWidth) || 1));
    const columns = mode === 'double' ? 2 : 1;
    let gap = 0;
    if (columns === 2) {
        gap = Math.max(24, Math.floor(width / 24));
        if (gap % 2) gap -= 1;
        if (gap >= width) gap = 0;
    }
    const colWidth = Math.max(1, Math.floor((width - gap) / columns));
    const screenWidth = columns * colWidth + gap;
    return {
        columns,
        gap,
        colWidth,
        stride: colWidth + (columns === 2 ? gap : 0),
        screenWidth
    };
}

export function countColumns(scrollWidth, stride) {
    const step = Number(stride) || 1;
    const width = Math.max(0, Number(scrollWidth) || 0);
    return Math.max(1, Math.round(width / step));
}

export function columnFromScroll(scrollLeft, stride, total) {
    const step = Number(stride) || 1;
    const index = Math.round((Number(scrollLeft) || 0) / step) + 1;
    const max = Math.max(1, Number(total) || 1);
    return Math.max(1, Math.min(max, index));
}

export function screenStartForColumn(columnIndex, columnsPerScreen, screenWidth) {
    const per = Math.max(1, columnsPerScreen || 1);
    const screenIndex = Math.floor((Math.max(1, columnIndex) - 1) / per);
    return screenIndex * (Number(screenWidth) || 0);
}
