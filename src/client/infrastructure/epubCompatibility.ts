import type { Book } from '../domain/book.js';
import { parseEpub } from './epubParser.js';

/** Reimport attaches original resources while preserving the existing source-page coordinate system. */
export function retainEpubLocations(incoming: Book, previous: Book | null | undefined): Book {
    if (!previous || !incoming.epub) return incoming;
    const parser = new DOMParser();
    const text = (html: string) => parser.parseFromString(html, 'text/html').body.textContent || '';
    const nextText = incoming.pages.map(text);
    const used = new Set<number>();
    const oldToNew = previous.pages.map((html, index) => {
        const value = text(html);
        if (nextText[index] === value && !used.has(index)) { used.add(index); return index; }
        const matches = nextText.flatMap((candidate, candidateIndex) => candidate === value && !used.has(candidateIndex) ? [candidateIndex] : []);
        if (matches.length !== 1) throw new Error('This filename already belongs to a different book version. Import with a different filename to keep existing annotations and Goal sources.');
        used.add(matches[0]!); return matches[0]!;
    });
    if (used.size !== incoming.pages.length) throw new Error('This book has a different chapter structure. Import with a different filename to keep existing reading locations.');
    const newToOld = new Map(oldToNew.map((next, old) => [next + 1, old + 1]));
    return {
        ...previous, ...incoming, title: previous.title,
        pages: oldToNew.map(index => incoming.pages[index]!),
        toc: incoming.toc?.map(entry => entry.navigable === false ? entry : ({ ...entry, page: newToOld.get(entry.page || 1) || 1 })),
        hrefToPageMap: Object.fromEntries(Object.entries(incoming.hrefToPageMap || {}).map(([path, page]) => [path, newToOld.get(page)!])),
        epub: { ...incoming.epub, documents: incoming.epub.documents.map(document => {
            const page = newToOld.get(document.page)!;
            return { ...document, page, sectionId: `chapter-${page}` };
        }) }
    };
}

export async function upgradeEpubBook(book: Book): Promise<Book> {
    if (!book.epub?.archive || book.epub.metadata) return book;
    const bytes = Uint8Array.from(atob(book.epub.archive), character => character.charCodeAt(0));
    const incoming = await parseEpub(bytes.buffer, book.title + '.epub');
    incoming.id = book.id;
    return retainEpubLocations(incoming, book);
}
