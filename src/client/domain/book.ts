/** Persisted source documents. `page` is a 1-based source-document number,
 * never a screen column. Unknown fields survive imports and backups. */
export interface TocEntry {
    title: string;
    page?: number;
    level?: number;
    anchor?: string;
    href?: string;
    hasChildren?: boolean;
    [field: string]: unknown;
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
export interface SpreadPages {
    leftPage: number;
    rightPage: number | null;
    isDouble: true;
    label: string;
}
export type ReaderMode = 'single' | 'double' | 'scroll';
