import type { AppElements } from '../../app/elements.js';

/** Prefer injected refs; the document lookup supports existing partial test mounts. */
export function readerViewport(elements: AppElements | null | undefined): HTMLElement | null {
    return elements?.readerViewport
        || elements?.bookPaper?.closest<HTMLElement>('.reader-viewport')
        || elements?.bookPaper?.ownerDocument.getElementById('reader-viewport')
        || null;
}

export function readerAbortController(document: Document): AbortController {
    // EventTarget and AbortSignal must belong to the same DOM realm (also in JSDOM).
    const view = document.defaultView as (Window & typeof globalThis) | null;
    return new (view?.AbortController || AbortController)();
}
