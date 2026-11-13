export function readingViewport(paper) {
    return paper.tagName === 'BODY' ? paper.ownerDocument.documentElement : paper;
}
export function readingViewportRect(paper) {
    if (paper.tagName !== 'BODY') return paper.getBoundingClientRect();
    const root = paper.ownerDocument.documentElement;
    return { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight, width: root.clientWidth, height: root.clientHeight };
}
/** Browser scrollLeft is negative for right-to-left block progression. */
export function readingAxis(paper) {
    const scroller = readingViewport(paper);
    const style = paper.ownerDocument.defaultView.getComputedStyle(paper);
    const vertical = /^(vertical|sideways)/.test(style.writingMode);
    const reversed = vertical ? /-rl$/.test(style.writingMode) : style.direction === 'rtl';
    const lineHeight = parseFloat(paper.style.getPropertyValue('--aura-reading-line-height')) || parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.85 || 30;
    const scrollStyle = scroller.ownerDocument.defaultView.getComputedStyle(scroller);
    const step = vertical ? Math.max(lineHeight, Math.floor((scroller.clientWidth - 2 * lineHeight) / lineHeight) * lineHeight) : Math.max(1, scroller.clientWidth + (parseFloat(scrollStyle.columnGap) || 0));
    const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    return { scroller, vertical, reversed, step, max, position: Math.max(0, reversed ? -scroller.scrollLeft : scroller.scrollLeft) };
}
export function setReadingOffset(paper, offset) {
    const axis = readingAxis(paper);
    axis.scroller.scrollLeft = (axis.reversed ? -1 : 1) * Math.max(0, Math.min(axis.max, offset));
}
