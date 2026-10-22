export type AnnotationKind = 'note' | 'highlight';
export interface TextRange { start: number; end: number }
export interface AnnotationLocation {
    sectionId: string;
    page: number;
    offset: number;
    start?: number;
    end?: number;
    [field: string]: unknown;
}
/** Raw legacy/storage input, before normalization. */
export interface AnnotationInput {
    id?: string;
    bookId?: string;
    kind?: string | null;
    quote?: unknown;
    comment?: unknown;
    color?: string | null;
    page?: number | string;
    chapter?: string | null;
    timestamp?: string;
    sectionId?: string;
    offset?: number;
    location?: Partial<AnnotationLocation> | null;
    [field: string]: unknown;
}
export interface Annotation {
    id: string;
    bookId: string;
    kind: AnnotationKind;
    quote: string;
    comment: string;
    color: string;
    page: number;
    chapter: string;
    timestamp: string;
    location: AnnotationLocation;
    [field: string]: unknown;
}
export interface AnnotationRange extends TextRange { id: string; kind: AnnotationKind }
export interface AnnotationSegment extends TextRange { highlightIds: string[]; noteIds: string[] }
export interface CreateAnnotation {
    id?: string | null;
    bookId?: string;
    kind?: AnnotationKind | null;
    quote?: string;
    comment?: string;
    color?: string | null;
    page?: number;
    chapter?: string | null;
    timestamp?: string | null;
    sectionId?: string;
    offset?: number;
    location?: Partial<AnnotationLocation> | null;
}
