import type { Book, ReaderMode } from './book.js';
export interface ColumnMetrics { columns: number; gap: number; colWidth: number; stride: number; screenWidth: number }
/* ==========================================================================
   Chapter flow - EPUB chapter strip math (domain, no DOM)
   A chapter is one spine document. Screen columns are cuts of that document.
   Demo books and TXT do not use this model.
   ========================================================================== */

const SENTENCE_END = /[。！？!?]/;

export function isChapterFlowBook(book: Book | null | undefined): boolean {
    if (!book) return false;
    if (book.readerFlow === 'chapter') return true;
    if (String(book.format || '').toUpperCase() !== 'EPUB') return false;
    const map = book.hrefToPageMap;
    return !!(map && typeof map === 'object' && Object.keys(map).length > 0);
}

export function sentenceStartOffset(text: string, index: number) {
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

export function sentenceSlice(text: string, index: number) {
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

export function columnMetrics(viewWidth: number, mode: ReaderMode): ColumnMetrics {
    const width = Math.max(1, Math.floor(Number(viewWidth) || 1));
    return { columns: 1, gap: 0, colWidth: width, stride: width, screenWidth: width };
}

export function countColumns(scrollWidth: number, stride: number) {
    const step = Number(stride) || 1;
    const width = Math.max(0, Number(scrollWidth) || 0);
    return Math.max(1, Math.round(width / step));
}

export function columnFromScroll(scrollLeft: number, stride: number, total: number) {
    const step = Number(stride) || 1;
    const index = Math.round((Number(scrollLeft) || 0) / step) + 1;
    const max = Math.max(1, Number(total) || 1);
    return Math.max(1, Math.min(max, index));
}

export function screenStep(metrics: ColumnMetrics) {
    const stride = Math.max(1, Number(metrics && metrics.stride) || 1);
    return stride;
}

export function screenStartForColumn(columnIndex: number, metrics: ColumnMetrics) {
    const screenIndex = Math.max(1, Number(columnIndex) || 1) - 1;
    return screenIndex * screenStep(metrics);
}
