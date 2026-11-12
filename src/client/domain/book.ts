/** Persisted source documents. `page` is a 1-based source-document number,
 * never a screen column. Unknown fields survive imports and backups. */
export interface TocEntry {
    title: string;
    page?: number;
    level?: number;
    anchor?: string;
    href?: string;
    hasChildren?: boolean;
    navigable?: boolean;
    [field: string]: unknown;
}
export interface EpubPackage {
    version: 1;
    archive: string;
    packagePath: string;
    identifier: string;
    manifest: { id: string; href: string; path: string; mediaType: string; properties: string[]; fallback: string; attributes?: Record<string, string> }[];
    spine: { idref: string; linear: string; properties: string[]; attributes?: Record<string, string> }[];
    documents: EpubDocument[];
    attributes?: Record<string, string>;
    spineAttributes?: Record<string, string>;
    metadata?: { name: string; namespace: string; value: string; attributes: Record<string, string> }[];
    rendition?: { layout: string; spread: string; orientation: string; flow: string };
    encryption?: { path: string; algorithm: string }[];
    diagnostics?: string[];
    textModel: 'legacy-body-v1';
}
export interface EpubDocument {
    page: number; path: string; spineIndex: number; sectionId: string; language: string; direction: string;
    linear?: boolean; idref?: string; renderedIdref?: string;
    layout?: string; spread?: string; orientation?: string; pageSpread?: string;
    viewport?: { width: number; height: number };
    attributes?: { html: Record<string, string>; body: Record<string, string> };
    styles?: { href?: string; text?: string; media?: string }[];
}
export interface BookSummary {
    id: string; title: string; format?: string; language?: string; updatedAt?: string; pageCount: number;
}
export interface Book {
    id: string;
    title: string;
    pages: string[];
    toc?: TocEntry[];
    format?: string;
    language?: string;
    languages?: string[];
    readerFlow?: 'chapter';
    hrefToPageMap?: Record<string, number>;
    epub?: EpubPackage;
    updatedAt?: string;
    [field: string]: unknown;
}
export interface ReadingLocation {
    bookId: string;
    page: number;
    totalPages: number;
    chapter: string;
    anchor: string;
    sectionId: string;
    offset: number;
}
export type ReaderMode = 'single' | 'scroll';
