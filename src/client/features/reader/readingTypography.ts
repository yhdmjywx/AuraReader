/** Reversible, reader-local overrides. Stored publication markup is never changed. */
const protectedContent = 'h1,h2,h3,h4,h5,h6,pre,code,kbd,samp,math,svg,ruby,rt,rp,table,[role="math"]';
const textBlocks = 'p,li,blockquote,dd,dt,div';
type SavedLineHeight = { value: string; priority: string };
const originalHeight = 'data-aura-line-height';
let nextOverride = 0;
// Pagination may clone a paragraph around an anchor. A small DOM marker lets
// those disposable clones recover the same author value on the next reflow.
const overrides = new WeakMap<HTMLElement, { source: string | undefined; styles: Map<string, SavedLineHeight> }>();

function directText(element: HTMLElement) {
    return [...element.childNodes].some(node => node.nodeType === 3 && !!node.textContent?.trim());
}
function ordinaryBlocks(paper: HTMLElement) {
    const blocks = [...paper.querySelectorAll<HTMLElement>(textBlocks)].filter(element =>
        !element.closest(protectedContent) && !!element.textContent?.trim()
        && (element.localName !== 'div' || directText(element)));
    if (directText(paper)) blocks.unshift(paper);
    return blocks;
}

export function readLineSpacing(paper: HTMLElement) {
    const blocks = ordinaryBlocks(paper);
    const sample = blocks.find(element => (element.textContent?.trim().length || 0) > 30) || blocks[0] || paper;
    const style = paper.ownerDocument.defaultView!.getComputedStyle(sample);
    const height = parseFloat(style.lineHeight), size = parseFloat(style.fontSize);
    const ratio = style.lineHeight.endsWith('px') ? height / size : height;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1.85;
}

/** Temporarily restore author values before sampling metrics, including after font changes. */
export function applyLineSpacing(paper: HTMLElement, value: number | null) {
    const prior = overrides.get(paper);
    for (const node of [paper, ...paper.querySelectorAll<HTMLElement>(`[${originalHeight}]`)]) {
        const key = node.getAttribute(originalHeight);
        const style = prior?.source === paper.dataset.sourceKey && key ? prior?.styles.get(key) : undefined;
        if (style?.value) node.style.setProperty('line-height', style.value, style.priority);
        else if (style) node.style.removeProperty('line-height');
        node.removeAttribute(originalHeight);
    }
    overrides.delete(paper);
    paper.style.removeProperty('--aura-reading-line-height');
    if (value === null || paper.dataset.layout === 'pre-paginated') return;

    const blocks = ordinaryBlocks(paper), targets = new Set(blocks);
    const sample = blocks.find(element => (element.textContent?.trim().length || 0) > 30) || blocks[0] || paper;
    const size = parseFloat(paper.ownerDocument.defaultView!.getComputedStyle(sample).fontSize);
    const guards = [...paper.querySelectorAll<HTMLElement>(protectedContent)].filter(element => {
        // Protect only subtrees that inherit from an overridden ordinary block.
        if (element.parentElement?.closest(protectedContent)) return false;
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (targets.has(parent)) return true;
            if (parent === paper) break;
        }
        return false;
    }).map(element => ({ element, lineHeight: paper.ownerDocument.defaultView!.getComputedStyle(element).lineHeight }));
    const styles = new Map<string, SavedLineHeight>();
    const set = (node: HTMLElement, lineHeight: string) => {
        const key = String(++nextOverride);
        styles.set(key, { value: node.style.getPropertyValue('line-height'), priority: node.style.getPropertyPriority('line-height') });
        node.setAttribute(originalHeight, key);
        node.style.setProperty('line-height', lineHeight, 'important');
    };
    for (const block of blocks) set(block, String(value));
    for (const guard of guards) if (guard.lineHeight) set(guard.element, guard.lineHeight);
    // Vertical page steps must use the adjusted body-column spacing, while the
    // publication root's own line-height and protected content stay untouched.
    if (Number.isFinite(size) && size > 0) paper.style.setProperty('--aura-reading-line-height', `${size * value}px`);
    overrides.set(paper, { source: paper.dataset.sourceKey, styles });
}
