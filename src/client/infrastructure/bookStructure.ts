import type { Book } from '../domain/book.js';
import type { BookStructure, DocumentKind, ReadingUnit, ReadingUnitPosition, SourceDocument, TocNode } from '../domain/bookStructure.js';
import { ensureTocHierarchy, isVolumeTitle } from '../domain/readingLocation.js';

const compact = (text: unknown) => String(text || '').replace(/\s+/g, '');
const frontMatter = /^(?:作者原序|原序|自序|代序|序言|序|前言|引言|楔子|译者序|译序|出版说明|版权信息|献辞|致谢)$/;
const appendix = /^(?:附录|后记|跋|译后记|注释|参考文献|索引)/;

// A disposable projection, never a replacement for book.pages or note.page.
// Source documents keep their original text/offset space. Reading and export
// share the same grouping; a TOC node need not be a separate document/unit.
export function buildBookStructure(book: Book | null | undefined): BookStructure {
    const pages = Array.isArray(book?.pages) ? book.pages : [];
    const toc = ensureTocHierarchy(book?.toc);
    const roots: TocNode[] = [], stack: TocNode[] = [];
    const nodes: TocNode[] = toc.map((entry, index) => {
        while (stack.length && stack.at(-1)!.level >= entry.level) stack.pop();
        const node: TocNode = { ...entry, id: `toc-${index}`, page: Number(entry.page) || 0, children: [], parent: stack.at(-1) || null };
        (node.parent ? node.parent.children : roots).push(node);
        stack.push(node);
        return node;
    });
    const documents: SourceDocument[] = pages.map((html, index) => {
        const page = index + 1;
        const root = typeof document === 'undefined' ? null : document.createElement('div');
        if (root) root.innerHTML = html;
        const entries = nodes.filter(node => node.page === page);
        const heading = root?.querySelector('h1, h2, h3, h4, h5, h6');
        const legacy = toc[index]?.page == null ? toc[index] : null;
        const title = entries[0]?.title || legacy?.title || heading?.textContent?.trim() || `内容 ${page}`;
        const media = root?.querySelector('img, svg, math, video, audio, table, iframe, object, canvas, hr');
        // Hierarchy and an exact, content-only title are required in addition
        // to the name. Never remove a preface, illustration or ambiguous node.
        const divider = entries.find(node => isVolumeTitle(node.title) && node.children.length
            && root && !media && compact(root.textContent) === compact(node.title)
            && root.querySelectorAll('h1, h2, h3, h4, h5, h6').length === 1
            && compact(heading?.textContent) === compact(node.title));
        let kind: DocumentKind = 'content';
        if (frontMatter.test(title)) kind = 'frontmatter';
        else if (appendix.test(title)) kind = 'appendix';
        else if (entries.some(node => isVolumeTitle(node.title) && node.children.length)) kind = 'volume-content';
        else if (root?.querySelector('nav') || /^(?:目录|目录 Contents|Landmarks|封面|版权)/i.test(title)
            || (root && !root.textContent?.trim())) kind = 'resource';
        else if (entries.length === 1 && !entries[0].children.length) kind = 'chapter';
        return { page, title, kind, entries, divider, hasText: !!root?.textContent?.trim() };
    });
    const units: ReadingUnit[] = [], pageToUnit = new Map<number, ReadingUnit>();
    for (let index = 0; index < documents.length; index++) {
        const first = documents[index];
        const prefixes = [];
        let body = first, cursor = index;
        while (body.divider) {
            const child = body.divider.children[0];
            const next = documents[cursor + 1];
            if (!next || child.page !== next.page || !next.hasText) break;
            // Distinct siblings at the same source position are ambiguous.
            if (body.entries.length !== 1) break;
            prefixes.push(body.page);
            body = next;
            cursor++;
        }
        // A chain must end at real content, not another unresolvable divider.
        if (body.divider) { prefixes.length = 0; body = first; cursor = index; }
        const sourcePages = [...prefixes, body.page];
        const unit = { id: `source-${first.page}`, page: body.page, title: body.title,
            kind: body.kind, prefixPages: prefixes, sourcePages };
        units.push(unit);
        sourcePages.forEach(page => pageToUnit.set(page, unit));
        index = cursor;
    }
    const counts = { chapters: 0, frontmatter: 0, appendix: 0, volumeContent: 0, resources: 0, content: 0 };
    const keys: Record<DocumentKind, keyof BookStructure['counts']> = { chapter: 'chapters', frontmatter: 'frontmatter', appendix: 'appendix', 'volume-content': 'volumeContent', resource: 'resources', content: 'content' };
    units.forEach(unit => counts[keys[unit.kind]]++);
    return { roots, nodes, documents, units, pageToUnit, counts };
}

export function readingUnitForPage(structure: BookStructure | null | undefined, requestedPage: number): ReadingUnitPosition {
    const page = Number(requestedPage);
    return structure?.pageToUnit.get(page) || { page, prefixPages: [], sourcePages: [page] };
}

export function structureSummary(structure: BookStructure) {
    const { counts } = structure;
    const parts = [];
    if (counts.chapters) parts.push(`${counts.chapters} 章节`);
    if (counts.frontmatter) parts.push(`${counts.frontmatter} 前置内容`);
    if (counts.appendix) parts.push(`${counts.appendix} 附录`);
    if (counts.volumeContent) parts.push(`${counts.volumeContent} 卷前内容`);
    if (counts.resources) parts.push(`${counts.resources} 其他内容`);
    if (counts.content) parts.push(`${counts.content} 内容单元`);
    return parts.join(' · ') || '0 内容单元';
}
