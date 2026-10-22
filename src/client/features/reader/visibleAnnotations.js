// Read the rendered fragments, not chapter numbers or bounding-box unions:
// one annotation can span multiple lines, columns, or screens.
const RECT_EPSILON = 0.01;

/** @param {(HTMLElement | null | undefined)[]} papers
 * @param {HTMLElement | null} viewport
 * @returns {Set<string>} */
export function collectVisibleAnnotationIds(papers = [], viewport = null) {
    const ids = new Set();
    if (!viewport) return ids;
    const win = viewport.ownerDocument?.defaultView;
    let view = viewport.getBoundingClientRect();
    if (win && win.innerWidth > 0 && win.innerHeight > 0) {
        view = intersectVisibleRects(view, { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight });
    }
    if (!view) return ids;

    for (const paper of papers) {
        if (!paper || paper.hidden || paper.style.display === 'none') continue;
        const clip = intersectVisibleRects(view, paper.getBoundingClientRect());
        if (!clip) continue;
        for (const token of paper.querySelectorAll('.annotation-token')) {
            if (!token.textContent.trim()) continue;
            const visible = [...token.getClientRects()].some(rect => intersectVisibleRects(clip, rect));
            if (!visible || win?.getComputedStyle(token).visibility === 'hidden') continue;
            for (const attribute of ['data-note-ids', 'data-highlight-ids']) {
                (token.getAttribute(attribute) || '').split(/\s+/).filter(Boolean).forEach(id => ids.add(id));
            }
        }
    }
    return ids;
}

export function intersectVisibleRects(a, b) {
    if (!a || !b) return null;
    const rect = {
        left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom)
    };
    // Chrome can report a fully clipped previous-column line a few millionths
    // of a CSS pixel beyond the page edge at fractional zoom/DPI. That numeric
    // sliver is not visible text. Keep the tolerance far below a real glyph.
    return rect.right - rect.left > RECT_EPSILON && rect.bottom - rect.top > RECT_EPSILON ? rect : null;
}
