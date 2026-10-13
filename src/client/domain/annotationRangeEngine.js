/* ==========================================================================
   AnnotationRangeEngine - Pure text-range merging for annotation tokens.
   No DOM. Callers supply the page's visible text and half-open offsets.
   ========================================================================== */

export function compactWithMap(text) {
    const source = String(text || '');
    let compact = '';
    const map = [];
    for (let i = 0; i < source.length; i++) {
        if (/\s/.test(source[i])) continue;
        map.push(i);
        compact += source[i];
    }
    return { compact, map };
}

export function findQuoteRange(text, quote) {
    const source = String(text || '');
    const target = String(quote || '');
    if (!source || !target.trim()) return null;

    const direct = source.indexOf(target);
    if (direct !== -1) {
        return { start: direct, end: direct + target.length };
    }

    const compactedSource = compactWithMap(source);
    const compactedQuote = compactWithMap(target).compact;
    if (!compactedQuote) return null;

    const at = compactedSource.compact.indexOf(compactedQuote);
    if (at === -1) return null;

    const start = compactedSource.map[at];
    const end = compactedSource.map[at + compactedQuote.length - 1] + 1;
    if (start == null || end == null || end <= start) return null;
    return { start, end };
}

export function resolveAnnotationRange(text, annotation) {
    if (!annotation) return null;
    const source = String(text || '');
    const location = annotation.location || {};
    const start = Number(location.start);
    const end = Number(location.end);

    if (Number.isFinite(start) && Number.isFinite(end) && end > start && start >= 0 && end <= source.length) {
        if (locationMatchesQuote(source.slice(start, end), annotation.quote)) {
            return { start, end };
        }
    }

    if (!annotation.quote) return null;
    return findQuoteRange(source, annotation.quote);
}

function locationMatchesQuote(slice, quote) {
    const compactQuote = compactWithMap(quote).compact;
    if (!compactQuote) return true;
    const compactSlice = compactWithMap(slice).compact;
    return compactSlice === compactQuote || compactSlice.includes(compactQuote);
}

export function buildSegments(ranges = []) {
    const valid = (Array.isArray(ranges) ? ranges : []).filter(range => {
        return Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start && range.id;
    });
    if (valid.length === 0) return [];

    const points = new Set();
    valid.forEach(range => {
        points.add(range.start);
        points.add(range.end);
    });

    const sorted = Array.from(points).sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i < sorted.length - 1; i++) {
        const start = sorted[i];
        const end = sorted[i + 1];
        const covering = valid.filter(range => range.start <= start && range.end >= end);
        if (covering.length === 0) continue;

        const highlightIds = uniqueIds(covering.filter(range => range.kind === 'highlight'));
        const noteIds = uniqueIds(covering.filter(range => range.kind === 'note'));
        if (highlightIds.length === 0 && noteIds.length === 0) continue;

        const previous = segments[segments.length - 1];
        if (previous && previous.end === start && sameIdList(previous.highlightIds, highlightIds) && sameIdList(previous.noteIds, noteIds)) {
            previous.end = end;
            continue;
        }

        segments.push({ start, end, highlightIds, noteIds });
    }

    return segments;
}

export function annotationContextKey(highlightIds = [], noteIds = []) {
    return [...highlightIds, ...noteIds].join('|');
}

export function primaryKindFor(highlightIds = [], noteIds = []) {
    if (noteIds.length > 0) return 'note';
    if (highlightIds.length > 0) return 'highlight';
    return null;
}

function uniqueIds(ranges) {
    const seen = new Set();
    const ids = [];
    ranges.forEach(range => {
        if (!range.id || seen.has(range.id)) return;
        seen.add(range.id);
        ids.push(range.id);
    });
    return ids;
}

function sameIdList(left, right) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) return false;
    }
    return true;
}
