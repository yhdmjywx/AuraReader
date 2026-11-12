import type { Book } from '../../domain/book.js';
import { publicationResourceUrl, resolveEpubUrl, rewriteEpubCss } from '../../infrastructure/epubPaths.js';

/** Transform a disposable rendering projection. Stored page text/offsets stay stable. */
export function preparePublicationContent(root: HTMLElement, book: Book | null, page: number) {
    root.querySelectorAll('script, iframe, object, embed, base, meta, link, style').forEach(element => element.remove());
    const source = book?.epub?.documents.find(document => document.page === page);
    for (const element of root.querySelectorAll('*')) {
        for (const attribute of [...element.attributes]) {
            if (/^on/i.test(attribute.name) || ['srcdoc', 'formaction', 'action', 'target'].includes(attribute.name)) element.removeAttribute(attribute.name);
        }
        if (!source || !book) continue;
        if (element.hasAttribute('style')) element.setAttribute('style', rewriteEpubCss(element.getAttribute('style')!, book.id, source.path));
        for (const name of ['fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-end']) {
            const value = element.getAttribute(name);
            if (value?.includes('url(')) element.setAttribute(name, rewriteEpubCss(value, book.id, source.path));
        }
        const tag = element.localName;
        if (tag === 'a') {
            const raw = element.getAttribute('href') || element.getAttribute('xlink:href');
            const resolved = raw && resolveEpubUrl(raw, source.path);
            if (resolved) element.setAttribute('href', `/${resolved.path.split('/').map(encodeURIComponent).join('/')}${resolved.query}${resolved.fragment ? '#' + encodeURIComponent(resolved.fragment) : ''}`);
            continue;
        }
        const attributes = tag === 'img' ? ['src'] : tag === 'image' || tag === 'use' ? ['href', 'xlink:href']
            : tag === 'video' ? ['src', 'poster'] : ['audio', 'source', 'track'].includes(tag) ? ['src'] : [];
        for (const attribute of attributes) {
            const raw = element.getAttribute(`data-epub-${attribute.replace(':', '-')}`) || element.getAttribute(attribute);
            if (!raw || raw.startsWith('#') || raw.startsWith('data:')) continue;
            const resolved = resolveEpubUrl(raw, source.path);
            if (!resolved) { element.removeAttribute(attribute); continue; }
            element.setAttribute(attribute, publicationResourceUrl(book.id, resolved.path) + resolved.query
                + (resolved.fragment ? '#' + encodeURIComponent(resolved.fragment) : ''));
            if (['img', 'image'].includes(tag)) {
                let item = book.epub?.manifest.find(item => item.path === resolved.path);
                const seen = new Set<string>();
                element.addEventListener('error', () => {
                    if (!item || seen.has(item.id)) return;
                    seen.add(item.id);
                    item = book.epub?.manifest.find(candidate => candidate.id === item!.fallback);
                    if (item && !seen.has(item.id)) element.setAttribute(attribute, publicationResourceUrl(book.id, item.path));
                });
            }
        }
        if (['img', 'source'].includes(tag) && element.hasAttribute('srcset')) {
            const raw = element.getAttribute('srcset')!;
            // Preserve data-URL candidate syntax. Internal candidates use the same resolver.
            if (!raw.includes('data:')) element.setAttribute('srcset', raw.split(',').map(candidate => {
                const [url, ...descriptor] = candidate.trim().split(/\s+/);
                const resolved = resolveEpubUrl(url!, source.path);
                return resolved ? [publicationResourceUrl(book.id, resolved.path), ...descriptor].join(' ') : '';
            }).filter(Boolean).join(', '));
        }
    }
}
