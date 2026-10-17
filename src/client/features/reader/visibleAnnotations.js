// Read the rendered fragments, not chapter numbers or bounding-box unions:
// one annotation can span multiple lines, columns, or screens.
export function collectVisibleAnnotationIds(papers = [], viewport = null) {
    const ids = new Set();
    if (!viewport) return ids;
    const win = viewport.ownerDocument?.defaultView;
    let view = viewport.getBoundingClientRect();
    if (win && win.innerWidth > 0 && win.innerHeight > 0) {
        view = intersect(view, { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight });
    }
    if (!view) return ids;

    for (const paper of papers) {
        if (!paper || paper.hidden || paper.style.display === 'none') continue;
        const clip = intersect(view, paper.getBoundingClientRect());
        if (!clip) continue;
        for (const token of paper.querySelectorAll('.annotation-token')) {
            if (!token.textContent.trim()) continue;
            const visible = [...token.getClientRects()].some(rect => intersect(clip, rect));
            if (!visible || win?.getComputedStyle(token).visibility === 'hidden') continue;
            for (const attribute of ['data-note-ids', 'data-highlight-ids']) {
                (token.getAttribute(attribute) || '').split(/\s+/).filter(Boolean).forEach(id => ids.add(id));
            }
        }
    }
    return ids;
}

function intersect(a, b) {
    if (!a || !b) return null;
    const rect = {
        left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom)
    };
    return rect.right > rect.left && rect.bottom > rect.top ? rect : null;
}
