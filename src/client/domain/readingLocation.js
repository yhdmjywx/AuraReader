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
    const sorted = [...toc].sort((a, b) => {
        const pageDiff = (a.page || 1) - (b.page || 1);
        if (pageDiff !== 0) return pageDiff;
        return (Number(a.level) || 0) - (Number(b.level) || 0);
    });
    const matched = [...sorted].reverse().find(t => (t.page || 1) <= page);
    return matched ? matched.title : sorted[0].title;
}

const VOLUME_TITLE_RE = /^(?:第\s*[0-9０-９一二三四五六七八九十百千万零两]+\s*[卷部篇集册]|卷\s*之?\s*[0-9０-９一二三四五六七八九十百千万零两]+|(?:volume|part|book)\s+[0-9ivxlcdm]+)/i;
const STANDALONE_TITLE_RE = /^(?:作者原序|原序|自序|代序|序言|序|前言|引言|楔子|后记|跋|附录|译后记|译者序|译序|出版说明|版权信息|目录|简介|内容简介|献辞|致谢)$/;

export function ensureTocHierarchy(items) {
    const list = Array.isArray(items)
        ? items.map(item => ({ ...item, level: Math.max(0, Number(item.level) || 0) }))
        : [];
    if (!list.length) return list;

    const hasExplicitDepth = list.some(item => item.level > 0);
    const hasVolume = list.some(item => VOLUME_TITLE_RE.test(String(item.title || '').trim()));
    if (!hasExplicitDepth && hasVolume) {
        let insideVolume = false;
        for (const item of list) {
            const title = String(item.title || '').trim();
            if (VOLUME_TITLE_RE.test(title)) {
                insideVolume = true;
                item.level = 0;
            } else if (STANDALONE_TITLE_RE.test(title)) {
                insideVolume = false;
                item.level = 0;
            } else if (insideVolume) {
                item.level = 1;
            }
        }
    }

    for (let i = 0; i < list.length; i++) {
        const next = list[i + 1];
        list[i].hasChildren = !!(next && (Number(next.level) || 0) > (Number(list[i].level) || 0));
    }
    return list;
}
