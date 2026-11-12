import type { Book, EpubDocument } from '../../domain/book.js';
import { publicationResourceUrl, resolveEpubUrl, rewriteEpubCss } from '../../infrastructure/epubPaths.js';
import { readiumStyles } from './readiumStyles.js';

export function publicationDocument(book: Book | null, page: number) {
    return book?.epub?.documents.find(document => document.page === page);
}
function addStyle(document: Document, text: string, role: string) {
    const style = document.createElement('style');
    style.dataset.publication = role;
    style.textContent = text;
    document.head.append(style);
    return style;
}
function readiumSheet(text: string) {
    const namespaces = text.match(/@namespace[^;]+;/g)?.join('\n') || '';
    return namespaces + '\n@layer readium {' + text.replace(/@namespace[^;]+;/g, '').replace(/!important/g, '') + '}';
}
export function refreshReadiumStyles(paper: HTMLElement) {
    if (paper.dataset.layout === 'pre-paginated') return;
    const document = paper.ownerDocument;
    const before = document.head.querySelector<HTMLStyleElement>('[data-publication="before"]');
    if (!before) return;
    const computed = document.defaultView!.getComputedStyle(paper);
    const variant = /vertical/.test(computed.writingMode) ? 'vertical' : computed.direction === 'rtl' ? 'rtl'
        : /^(ja|zh|ko)(-|$)/i.test(paper.lang) ? 'cjk' : 'ltr';
    if (before.dataset.variant === variant) return;
    const sheets = readiumStyles[variant];
    for (const role of ['before', 'defaults', 'after'] as const) {
        const element = document.head.querySelector<HTMLStyleElement>(`[data-publication="${role}"]`);
        if (element) { element.textContent = readiumSheet(sheets[role]); element.dataset.variant = variant; }
    }
}
/** Publisher root attributes and styles live only in the reader document. */
export function preparePublicationDocument(paper: HTMLElement, book: Book | null, page: number, onReady: () => void) {
    const document = paper.ownerDocument;
    const source = publicationDocument(book, page);
    const key = JSON.stringify([book?.id, book?.updatedAt, source?.path, page]);
    if (paper.dataset.sourceKey === key) return;
    document.head.querySelectorAll('[data-publication]').forEach(element => element.remove());
    const applyAttributes = (element: HTMLElement, values: Record<string, string> = {}) => {
        for (const name of ['lang', 'dir', 'id', 'class', 'style']) element.removeAttribute(name);
        for (const [name, value] of Object.entries(values)) {
            if (/^on/i.test(name) || ['srcdoc', 'contenteditable'].includes(name)) continue;
            element.setAttribute(name, name === 'style' && source && book ? rewriteEpubCss(value, book.id, source.path) : value);
        }
    };
    const html = document.documentElement;
    applyAttributes(html, source?.attributes?.html);
    const frame = document.defaultView?.frameElement;
    const parentView = frame?.ownerDocument.defaultView;
    if (frame && parentView) {
        const theme = parentView.getComputedStyle(frame.closest('.reader-panel') || frame);
        for (const name of theme) if (name.startsWith('--')) html.style.setProperty(name, theme.getPropertyValue(name));
    }
    html.dataset.authorClass = source?.attributes?.html.class || '';
    html.className = `${html.dataset.hostClasses || ''} ${html.dataset.authorClass}`;
    html.style.setProperty('display', 'block');
    html.style.setProperty('columns', 'auto', 'important');
    html.style.setProperty('overflow', 'hidden', 'important');
    html.style.setProperty('width', '100%', 'important');
    html.style.setProperty('height', 'auto', 'important');
    html.style.setProperty('min-height', '0', 'important');
    html.style.setProperty('max-height', 'none', 'important');
    applyAttributes(paper, source?.attributes?.body);
    paper.dataset.publisherFontFamily = paper.style.getPropertyValue('font-family');
    paper.dataset.publisherFontPriority = paper.style.getPropertyPriority('font-family');
    paper.classList.add('book-paper');
    paper.id ||= 'book-paper';
    paper.lang = source?.language || book?.language || '';
    html.lang = paper.lang;
    if (source?.direction) paper.dir = source.direction;
    html.dir = paper.dir || 'ltr';
    paper.style.setProperty('margin', '0', 'important');
    paper.style.setProperty('max-width', 'none', 'important');
    paper.style.setProperty('min-height', '0', 'important');
    paper.style.height = 'auto';
    paper.style.overflow = 'visible';
    paper.dataset.sourceKey = key;
    paper.dataset.layout = source?.layout || 'reflowable';
    paper.dataset.progression = book?.epub?.spineAttributes?.['page-progression-direction'] || source?.direction || 'ltr';
    paper.dataset.authored = source?.styles?.length || source?.attributes?.body.style || source?.attributes?.html.style ? 'true' : 'false';
    if (!source || !book) return;
    const ready = () => { if (paper.dataset.sourceKey === key) onReady(); };
    if (source.layout !== 'pre-paginated') addStyle(document, '', 'before');
    if (!source.styles?.length && source.layout !== 'pre-paginated') addStyle(document, '', 'defaults');
    for (const style of source.styles || []) {
        if (style.href) {
            const resolved = resolveEpubUrl(style.href, source.path);
            if (!resolved) continue;
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.dataset.publication = 'author';
            link.href = publicationResourceUrl(book.id, resolved.path) + resolved.query;
            if (style.media) link.media = style.media;
            link.addEventListener('load', ready, { once: true });
            document.head.append(link);
        } else {
            const element = addStyle(document, rewriteEpubCss(style.text || '', book.id, source.path), 'author');
            if (style.media) element.media = style.media;
        }
    }
    if (source.layout !== 'pre-paginated') {
        addStyle(document, '', 'after');
        refreshReadiumStyles(paper);
    }
    addStyle(document, `html { box-sizing:border-box; padding:0!important; margin:0!important; }
        @layer aura { body[data-authored="true"], body[data-authored="true"] *, body.fixed-layout, body.fixed-layout * { all:revert-layer; }
            html[data-user-paper] body.book-paper:not(.fixed-layout) { background:var(--bg-paper)!important; color:var(--bg-paper-text)!important; }
            html[data-user-paper] body.book-paper:not(.fixed-layout) :not(svg,svg *,img,video) { color:inherit!important; background-color:transparent!important; }
            body.reader-user-indent p { text-indent:var(--book-text-indent)!important; }
        }
        body.book-paper { box-sizing:border-box; max-width:none!important; }
        .book-paper::selection, .book-paper *::selection { background:var(--annotation-highlight-bg, #fde68a); }
        .annotation-token { cursor:pointer; user-select:text; }
        .annotation-token.has-highlight { background:var(--annotation-highlight-bg); border-radius:2px; }
        .annotation-token.has-note { text-decoration-line:underline; text-decoration-color:#ef4444; text-decoration-thickness:2px; text-underline-offset:3px; text-decoration-skip-ink:none; }
        .annotation-token.is-active { outline:2px solid var(--primary); outline-offset:1px; }
        body.fixed-layout { border:0; border-radius:0; box-shadow:none; padding:0!important; }
        body.fixed-layout > svg { display:block; width:100%; height:100%; }`, 'adapter');
}

/** Existing Page mode presents one fixed viewport per spine document. */
export function layoutFixedDocument(elements: import('../../app/elements.js').AppElements, source: EpubDocument) {
    const paper = elements.bookPaper!;
    const frame = paper.ownerDocument.defaultView?.frameElement as HTMLIFrameElement | null;
    const container = elements.paperContainer;
    if (!frame || !container) return null;
    const viewport = elements.readerViewport!;
    const width = source.viewport?.width || container.clientWidth || 600;
    const height = source.viewport?.height || viewport.clientHeight || 800;
    const availableWidth = container.clientWidth || viewport.clientWidth;
    const availableHeight = viewport.clientHeight - 64;
    const scale = Math.max(0.01, Math.min(availableWidth / width, availableHeight / height));
    viewport.classList.remove('chapter-scroll'); viewport.classList.add('chapter-paged');
    container.classList.add('chapter-flow');
    container.style.height = `${Math.ceil(height * scale)}px`;
    container.style.position = 'relative';
    frame.style.cssText = `display:block;border:0;width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:top left`;
    const host = frame.parentElement!;
    host.style.height = `${Math.ceil(height * scale)}px`;
    const side = source.pageSpread;
    frame.style.marginLeft = side === 'right' ? `${Math.max(0, availableWidth - width * scale)}px` : side === 'left' ? '0px' : `${Math.max(0, (availableWidth - width * scale) / 2)}px`;
    paper.classList.add('fixed-layout', 'chapter-flow', 'mode-single');
    paper.classList.remove('mode-scroll');
    paper.style.width = `${width}px`; paper.style.height = `${height}px`;
    paper.style.columnWidth = 'auto'; paper.style.columnCount = 'auto'; paper.style.overflow = 'hidden';
    paper.style.position ||= 'relative';
    return { mode: 'fixed', hostHeight: height, scale };
}
