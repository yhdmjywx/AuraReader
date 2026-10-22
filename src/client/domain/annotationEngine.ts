import type { AnnotationKind, Annotation, AnnotationInput, AnnotationLocation, CreateAnnotation } from './annotation.js';
/* ==========================================================================
   AnnotationEngine - Pure Annotation Core Algorithms (Domain Layer)
   Zero DOM dependencies. Owns annotation kind, migration, overlap lookup,
   and the legacy string highlighter kept for existing callers.
   Body rendering uses annotationRangeEngine + annotationRenderer instead.
   ========================================================================== */

export function isHighlight(annotation: AnnotationInput | null | undefined): boolean {
    if (!annotation || typeof annotation !== 'object') return false;
    if (annotation.kind === 'highlight') return true;
    if (annotation.kind === 'note') return false;
    return !annotation.comment || String(annotation.comment).trim() === '';
}

export function isNote(annotation: AnnotationInput | null | undefined): boolean {
    if (!annotation || typeof annotation !== 'object') return false;
    if (annotation.kind === 'note') return true;
    if (annotation.kind === 'highlight') return false;
    return !!(annotation.comment && String(annotation.comment).trim() !== '');
}

export function normalizeAnnotation(annotation: AnnotationInput | null | undefined): Annotation | null {
    if (!annotation || typeof annotation !== 'object') return null;

    const comment = annotation.comment == null ? '' : String(annotation.comment);
    const kind: AnnotationKind = annotation.kind === 'highlight' || annotation.kind === 'note'
        ? annotation.kind : comment.trim() !== '' ? 'note' : 'highlight';

    const page = Number(annotation.page) || 1;
    const color = annotation.color || (kind === 'note' ? 'green' : 'yellow');

    return {
        ...annotation,
        id: annotation.id || '',
        bookId: annotation.bookId || '',
        kind,
        quote: annotation.quote == null ? '' : String(annotation.quote),
        comment,
        color,
        page,
        chapter: annotation.chapter || '章节选区',
        timestamp: annotation.timestamp || '',
        location: normalizeLocation(annotation, page)
    };
}

function normalizeLocation(annotation: AnnotationInput, page: number): AnnotationLocation {
    const existing = annotation.location && typeof annotation.location === 'object'
        ? { ...annotation.location }
        : {};
    const location: AnnotationLocation = {
        ...existing,
        sectionId: existing.sectionId || annotation.sectionId || `chapter-${page}`,
        page: Number(existing.page) || page,
        offset: Number(existing.offset ?? annotation.offset) || 0
    };

    if (existing.start == null) delete location.start;
    else location.start = Number(existing.start);
    if (existing.end == null) delete location.end;
    else location.end = Number(existing.end);

    return location;
}

export function filterNotes(notes: AnnotationInput[] = [], showHighlightsInSidebar = false) {
    const list = (Array.isArray(notes) ? notes : []).map(normalizeAnnotation).filter((item): item is Annotation => item !== null);
    const thoughtNotes = list.filter(isNote);
    const pureHighlights = list.filter(isHighlight);
    const displayedNotes = showHighlightsInSidebar ? list : thoughtNotes;

    return {
        displayedNotes,
        thoughtNotes,
        pureHighlights,
        thoughtCount: thoughtNotes.length,
        pureCount: pureHighlights.length,
        totalCount: list.length
    };
}

export function findAnnotationsAtQuote(notes: AnnotationInput[] = [], page = 1, quote = '') {
    const cleanQuote = String(quote || '').trim();
    if (!Array.isArray(notes) || !cleanQuote) return [];
    const targetPage = Number(page) || 1;

    return notes.map(normalizeAnnotation).filter((item): item is Annotation => item !== null).filter(annotation => {
        if (Number(annotation.page) !== targetPage) return false;
        if (!annotation.quote) return false;
        const noteQuote = annotation.quote.trim();
        return noteQuote === cleanQuote || noteQuote.includes(cleanQuote) || cleanQuote.includes(noteQuote);
    });
}

export function findOverlappingNote(notes: AnnotationInput[] = [], page = 1, quote = '') {
    const matches = findAnnotationsAtQuote(notes, page, quote);
    return matches[0] || null;
}

export function groupAnnotationsByRange(notes: AnnotationInput[] = []) {
    const groups = new Map<string, Annotation[]>();

    (Array.isArray(notes) ? notes : []).map(normalizeAnnotation).filter((item): item is Annotation => item !== null).forEach(annotation => {
        const quoteKey = (annotation.quote || '').trim();
        const loc = annotation.location;
        const key = quoteKey
            ? `p${annotation.page}|q|${quoteKey}`
            : `p${annotation.page}|loc|${loc.start ?? ''}|${loc.end ?? ''}|${annotation.id}`;

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(annotation);
    });

    return Array.from(groups.values()).map(items => {
        const highlights = items.filter(isHighlight);
        const noteItems = items.filter(isNote);
        const sample = highlights[0] || noteItems[0] || items[0];
        return {
            page: sample.page,
            chapter: sample.chapter || '',
            quote: sample.quote || '',
            highlights,
            notes: noteItems
        };
    });
}

export function applyHighlightToHtml(html: string, note: Annotation): string {
    if (!html || !note || !note.quote) return html;

    const colorClass = `hl-${note.color || 'yellow'}`;
    const noteId = note.id;

    // 1. Precise full-quote match
    if (html.includes(note.quote)) {
        const marked = `<mark class="${colorClass}" data-id="${noteId}">${note.quote}</mark>`;
        return html.replace(note.quote, marked);
    }

    // 2. Cross-paragraph / multi-line split matching
    const rawSegments = note.quote.split(/[\r\n]+/).map(s => s.trim()).filter(s => s.length > 1);

    if (rawSegments.length > 0) {
        let updatedHtml = html;
        let matchFound = false;

        for (const seg of rawSegments) {
            if (updatedHtml.includes(seg)) {
                const marked = `<mark class="${colorClass}" data-id="${noteId}">${seg}</mark>`;
                updatedHtml = updatedHtml.replace(seg, marked);
                matchFound = true;
            } else {
                // 3. Sentence-level matching for segments interrupted by tags/newlines
                const subSentences = seg.split(/([。！？；;\n]+)/).map(s => s.trim()).filter(s => s.length > 3);
                for (const sub of subSentences) {
                    if (updatedHtml.includes(sub)) {
                        const markedSub = `<mark class="${colorClass}" data-id="${noteId}">${sub}</mark>`;
                        updatedHtml = updatedHtml.replace(sub, markedSub);
                        matchFound = true;
                    }
                }
            }
        }

        if (matchFound) return updatedHtml;
    }

    return html;
}

export function applyAllHighlightsToHtml(html: string, notes: Annotation[] = []) {
    if (!html || !Array.isArray(notes) || notes.length === 0) return html;

    let resultHtml = html;
    for (const note of notes) {
        resultHtml = applyHighlightToHtml(resultHtml, note);
    }
    return resultHtml;
}

export function createAnnotationObject({
    id = null,
    bookId = '',
    kind = null,
    quote = '',
    comment = '',
    color = null,
    page = 1,
    chapter = '章节选区',
    timestamp = null,
    sectionId = '',
    offset = 0,
    location = null
}: CreateAnnotation = {}): Annotation {
    const cleanComment = comment || '';
    const finalKind = (kind === 'highlight' || kind === 'note')
        ? kind
        : (cleanComment.trim() !== '' ? 'note' : 'highlight');
    const validPage = Number(page) || 1;
    const sourceLocation = location && typeof location === 'object' ? location : {};
    const loc: AnnotationLocation = {
        sectionId: sourceLocation.sectionId || sectionId || `chapter-${validPage}`,
        page: Number(sourceLocation.page) || validPage,
        offset: Number(sourceLocation.offset ?? offset) || 0
    };
    if (sourceLocation.start != null && sourceLocation.end != null) {
        loc.start = Number(sourceLocation.start);
        loc.end = Number(sourceLocation.end);
        if (!loc.offset) loc.offset = loc.start || 0;
    }

    const finalColor = color || (finalKind === 'note' ? 'green' : 'yellow');
    const prefix = finalKind === 'highlight' ? 'highlight-' : 'note-';

    return {
        id: id || (prefix + Date.now() + '-' + Math.floor(Math.random() * 1000)),
        bookId,
        kind: finalKind,
        quote: quote || '',
        comment: cleanComment,
        color: finalColor,
        page: validPage,
        chapter: chapter || '章节选区',
        timestamp: timestamp || new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16),
        location: loc
    };
}
