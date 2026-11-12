import type { AppElements } from '../../app/elements.js';

/** Parent controls and publication content have distinct document trees. */
export function mountReaderDocument(elements: AppElements, onResourcesReady: () => void) {
    const host = elements.bookPaper!;
    const appDocument = host.ownerDocument;
    const frame = appDocument.createElement('iframe');
    frame.title = 'Book content';
    frame.className = 'reader-document';
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('scrolling', 'no');
    host.className = 'reader-document-host';
    host.id = 'book-paper-host';
    host.replaceChildren(frame);
    const document = frame.contentDocument!;
    document.open();
    document.write(`<!doctype html><html><head><meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
        </head><body id="book-paper" class="book-paper"></body></html>`);
    document.close();
    document.body.style.cssText = 'display:block;position:static;margin:0;padding:0;width:100%;height:auto;min-height:0;overflow:hidden;background:transparent';
    document.documentElement.style.cssText = 'margin:0;padding:0;overflow:hidden;background:transparent';
    for (const stylesheet of appDocument.querySelectorAll('link[rel="stylesheet"], style')) {
        const clone = document.createElement('style');
        clone.textContent = stylesheet.tagName === 'LINK'
            ? `@import url("${(stylesheet as HTMLLinkElement).href}") layer(aura);`
            : `@layer aura { ${stylesheet.textContent || ''} }`;
        document.head.append(clone);
    }
    const reset = document.createElement('style');
    reset.textContent = `@layer aura {
        body.book-paper { display:block; position:static; }
        body.book-paper:not(.fixed-layout) img { max-width:100%; height:auto; object-fit:contain; }
    }`;
    document.head.append(reset);
    const paper = document.getElementById('book-paper')!;
    elements.bookPaper = paper;
    const syncTheme = () => {
        document.documentElement.dataset.hostClasses = `${appDocument.body.className} ${elements.workspaceContainer?.className || ''} ${elements.readerPanel?.className || ''}`;
        document.documentElement.className = `${document.documentElement.dataset.hostClasses} ${document.documentElement.dataset.authorClass || ''}`;
        const computed = appDocument.defaultView!.getComputedStyle(elements.readerPanel || host);
        for (const property of computed) {
            if (property.startsWith('--')) document.documentElement.style.setProperty(property, computed.getPropertyValue(property));
        }
    };
    const observer = new appDocument.defaultView!.MutationObserver(syncTheme);
    for (const target of [appDocument.body, elements.workspaceContainer, elements.readerPanel]) {
        if (target) observer.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });
    }
    // Scroll-mode height follows late images and font changes within the reader.
    const sizeObserver = appDocument.defaultView?.ResizeObserver ? new appDocument.defaultView.ResizeObserver(() => syncReaderDocumentSize(elements)) : null;
    sizeObserver?.observe(paper);
    document.fonts?.addEventListener('loadingdone', onResourcesReady);
    syncTheme();
    return () => {
        observer.disconnect(); sizeObserver?.disconnect();
        document.fonts?.removeEventListener('loadingdone', onResourcesReady);
        frame.remove();
        host.className = 'book-paper'; host.id = 'book-paper';
        elements.bookPaper = host;
    };
}

export function syncReaderDocumentSize(elements: AppElements) {
    const paper = elements.bookPaper;
    const frame = paper?.ownerDocument.defaultView?.frameElement as HTMLIFrameElement | null;
    if (!frame || !paper) return;
    if (paper.dataset.layout === 'pre-paginated') return;
    const paged = paper.classList.contains('chapter-flow') && (paper.classList.contains('mode-single') || paper.dataset.axis === 'vertical');
    const height = paged ? (elements.paperContainer?.clientHeight || 1) : Math.ceil(paper.getBoundingClientRect().height);
    frame.style.height = `${Math.max(1, height)}px`;
    (frame.parentElement as HTMLElement).style.height = paged ? '100%' : 'auto';
}

/** Project reader-local rectangles into the surrounding UI's coordinate space. */
export function readerRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>, document: Document) {
    let { left, top, right, bottom } = rect;
    let frame = document.defaultView?.frameElement as HTMLElement | null;
    while (frame) {
        const bounds = frame.getBoundingClientRect();
        const scaleX = frame.offsetWidth ? bounds.width / frame.offsetWidth : 1;
        const scaleY = frame.offsetHeight ? bounds.height / frame.offsetHeight : 1;
        left = bounds.left + (frame.clientLeft + left) * scaleX;
        right = bounds.left + (frame.clientLeft + right) * scaleX;
        top = bounds.top + (frame.clientTop + top) * scaleY;
        bottom = bounds.top + (frame.clientTop + bottom) * scaleY;
        frame = frame.ownerDocument.defaultView?.frameElement as HTMLElement | null;
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}
