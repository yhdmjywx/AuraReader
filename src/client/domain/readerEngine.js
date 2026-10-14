/* ==========================================================================
   ReaderEngine - Pure Reading Core State Machine (Domain Layer)
   Zero DOM dependencies. Manages book structure, page turning,
   content retrieval & reading location state.
   ========================================================================== */

import { createReadingLocation, clampPage, calcSpreadPages, findChapterForPage, ensureTocHierarchy } from './readingLocation.js';

export class ReaderEngine {
    constructor() {
        this.currentBookId = null;
        this.bookData = null;
        this.location = createReadingLocation();
    }

    setBook(bookId, bookData) {
        this.currentBookId = bookId;
        this.bookData = bookData || null;

        const pages = (this.bookData && Array.isArray(this.bookData.pages)) ? this.bookData.pages : [];
        const totalPages = Math.max(1, pages.length);
        const toc = ensureTocHierarchy(this.bookData && this.bookData.toc);
        const chapter = toc.length ? findChapterForPage(toc, 1) : '正文';

        this.location = createReadingLocation({
            bookId,
            page: 1,
            totalPages,
            chapter
        });

        return this.location;
    }

    hasBook() {
        return !!(this.bookData && this.bookData.pages);
    }

    getCurrentBook() {
        return this.bookData;
    }

    getLocation() {
        return { ...this.location };
    }

    getTotalPages() {
        return this.location.totalPages;
    }

    getCurrentPage() {
        return this.location.page;
    }

    goToPage(pageNum, offset = 0) {
        if (!this.hasBook()) return this.location;

        const total = this.location.totalPages;
        const validPage = clampPage(pageNum, total);
        const chapter = findChapterForPage(ensureTocHierarchy(this.bookData.toc), validPage);

        this.location.page = validPage;
        this.location.chapter = chapter;
        this.location.sectionId = `chapter-${validPage}`;
        this.location.offset = Number(offset) || 0;

        return { ...this.location };
    }

    nextPage(isDouble = false) {
        if (!this.hasBook()) return this.location;

        const total = this.location.totalPages;
        if (!isDouble) {
            if (this.location.page < total) {
                return this.goToPage(this.location.page + 1);
            }
        } else {
            const currentLeft = (this.location.page % 2 === 1) ? this.location.page : this.location.page - 1;
            const nextLeft = currentLeft + 2;
            if (nextLeft <= total) {
                return this.goToPage(nextLeft);
            }
        }
        return { ...this.location };
    }

    prevPage(isDouble = false) {
        if (!this.hasBook()) return this.location;

        if (!isDouble) {
            if (this.location.page > 1) {
                return this.goToPage(this.location.page - 1);
            }
        } else {
            const currentLeft = (this.location.page % 2 === 1) ? this.location.page : this.location.page - 1;
            const prevLeft = Math.max(1, currentLeft - 2);
            if (prevLeft !== currentLeft) {
                return this.goToPage(prevLeft);
            }
        }
        return { ...this.location };
    }

    getPageContent(pageNum) {
        if (!this.hasBook()) return '<p>页面暂无内容</p>';
        const total = this.location.totalPages;
        const validPage = clampPage(pageNum, total);
        return this.bookData.pages[validPage - 1] || '<p>页面暂无内容</p>';
    }

    getSpreadPages(page = this.location.page) {
        return calcSpreadPages(page, this.location.totalPages);
    }
}

export const readerEngine = new ReaderEngine();
