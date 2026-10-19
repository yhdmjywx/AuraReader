import { ensureTocHierarchy, isVolumeTitle } from '../../domain/readingLocation.js';

// Presentation only: keep the original spine documents and annotation pages.
// A title-only volume divider can introduce its immediately following chapter.
export function resolveVolumeTitleFlow(book, requestedPage) {
    const page = Number(requestedPage);
    const separate = { page, titlePage: null };
    if (!book?.pages || typeof document === 'undefined') return separate;
    const toc = ensureTocHierarchy(book.toc);
    for (let i = 0; i < toc.length - 1; i++) {
        const volume = toc[i], chapter = toc[i + 1];
        const titlePage = Number(volume.page), bodyPage = titlePage + 1;
        if (page !== titlePage && page !== bodyPage) continue;
        if (!isVolumeTitle(volume.title) || !volume.hasChildren
            || Number(chapter.page) !== bodyPage || !book.pages[bodyPage - 1]) continue;
        const root = document.createElement('div');
        root.innerHTML = book.pages[titlePage - 1] || '';
        if (root.querySelector('img, svg, math, video, audio, table, iframe, object, canvas, hr')) continue;
        const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const compact = text => String(text || '').replace(/\s+/g, '');
        if (headings.length !== 1 || compact(root.textContent) !== compact(volume.title)
            || compact(headings[0].textContent) !== compact(volume.title)) continue;
        // Avoid chaining two dividers or suppressing an empty/illustration page.
        const body = document.createElement('div');
        body.innerHTML = book.pages[bodyPage - 1];
        if (!body.textContent.trim() || isVolumeTitle(chapter.title)) continue;
        return { page: bodyPage, titlePage };
    }
    return separate;
}
