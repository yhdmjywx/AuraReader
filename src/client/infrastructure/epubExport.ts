import type { Book } from '../domain/book.js';
import { bytesToBase64, publicationResourceUrl, resolveEpubUrl } from './epubPaths.js';

/** Expand only requested export images. Reading/import keeps binary resources shared. */
export async function withExportImages(book: Book, pages?: Set<number>): Promise<Book> {
    if (!book.epub) return book;
    const resources = new Map<string, Promise<string>>();
    const output = [...book.pages];
    const parser = new DOMParser();
    for (const source of book.epub.documents) {
        if (pages && !pages.has(source.page)) continue;
        const document = parser.parseFromString(book.pages[source.page - 1]!, 'text/html');
        for (const image of document.querySelectorAll('img, svg image')) {
            for (const attribute of ['src', 'href', 'xlink:href']) {
                const raw = image.getAttribute(attribute);
                if (!raw || raw.startsWith('data:') || raw.startsWith('#')) continue;
                const target = resolveEpubUrl(raw, source.path);
                if (!target) continue;
                const url = publicationResourceUrl(book.id, target.path);
                if (!resources.has(url)) resources.set(url, (async () => {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Could not export EPUB image: ${target.path}`);
                    const type = response.headers.get('Content-Type')?.split(';')[0] || 'application/octet-stream';
                    const bytes = new Uint8Array(await response.arrayBuffer());
                    return `data:${type};base64,${bytesToBase64(bytes)}`;
                })());
                image.setAttribute(attribute, await resources.get(url)! + (target.fragment ? '#' + encodeURIComponent(target.fragment) : ''));
            }
        }
        output[source.page - 1] = document.body.innerHTML;
    }
    return { ...book, pages: output };
}
