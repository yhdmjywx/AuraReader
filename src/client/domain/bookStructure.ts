import type { TocEntry } from './book.js';
export interface TocNode extends TocEntry {
    id: string;
    page: number;
    level: number;
    children: TocNode[];
    parent: TocNode | null;
}
export type DocumentKind = 'content' | 'frontmatter' | 'appendix' | 'volume-content' | 'resource' | 'chapter';
export interface SourceDocument {
    page: number; title: string; kind: DocumentKind;
    entries: TocNode[]; divider: TocNode | undefined; hasText: boolean;
}
export interface ReadingUnitPosition { page: number; prefixPages: number[]; sourcePages: number[] }
export interface ReadingUnit extends ReadingUnitPosition { id: string; title: string; kind: DocumentKind }
export interface BookStructure {
    roots: TocNode[];
    nodes: TocNode[];
    documents: SourceDocument[];
    units: ReadingUnit[];
    pageToUnit: Map<number, ReadingUnit>;
    counts: { chapters: number; frontmatter: number; appendix: number; volumeContent: number; resources: number; content: number };
}
