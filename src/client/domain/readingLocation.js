/* ==========================================================================
   ReadingLocation - Pure Reading Position & Navigation Model (Domain Layer)
   Zero DOM dependencies. Handles page boundary clamping, spread pagination,
   chapter matching & internal link resolution.
   ========================================================================== */

export function createReadingLocation({
    bookId = '',
    page = 1,
    totalPages = 1,
    chapter = '',
    anchor = '',
    sectionId = '',
    offset = 0
} = {}) {
    const validPage = clampPage(page, totalPages);
    return {
        bookId,
        page: validPage,
        totalPages: Math.max(1, totalPages),
        chapter: chapter || '章节选区',
        anchor: anchor || '',
        sectionId: sectionId || `chapter-${validPage}`,
        offset: Number(offset) || 0
    };
}

export function clampPage(page, totalPages) {
    const total = Math.max(1, totalPages || 1);
    return Math.max(1, Math.min(Number(page) || 1, total));
}

export function calcSpreadPages(currentPage, totalPages) {
    const total = Math.max(1, totalPages || 1);
    const validCurrent = clampPage(currentPage, total);
    const leftPage = (validCurrent % 2 === 1) ? validCurrent : Math.max(1, validCurrent - 1);
    const rightPage = leftPage + 1;
    const hasRight = rightPage <= total;

    return {
        leftPage,
        rightPage: hasRight ? rightPage : null,
        isDouble: true,
        label: hasRight ? `${leftPage}-${rightPage}` : `${leftPage}`
    };
}

export function resolveTargetPage(href, hrefToPageMap = {}, currentPage = 1) {
    if (!href) return currentPage;
    const [srcPath] = href.split('#');
    const cleanPath = srcPath.replace(/^\/+/, '');
    if (!cleanPath) return currentPage;

    if (hrefToPageMap[cleanPath] !== undefined) return hrefToPageMap[cleanPath];
    const filename = cleanPath.split('/').pop();
    if (hrefToPageMap[filename] !== undefined) return hrefToPageMap[filename];

    return currentPage;
}

export function findChapterForPage(toc = [], page = 1) {
    if (!toc || !Array.isArray(toc) || toc.length === 0) return '当前章节';
    const sorted = [...toc].sort((a, b) => (a.page || 1) - (b.page || 1));
    const matched = [...sorted].reverse().find(t => (t.page || 1) <= page);
    return matched ? matched.title : sorted[0].title;
}
