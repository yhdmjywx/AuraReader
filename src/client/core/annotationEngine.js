/* ==========================================================================
   AnnotationEngine - Pure Annotation Core Algorithms
   Zero DOM dependencies. Handles highlight text matching (cross-paragraph,
   fuzzy tag tolerance), overlap deduplication, note categorization & model factory.
   ========================================================================== */

export function filterNotes(notes = [], showHighlightsInSidebar = false) {
    const list = Array.isArray(notes) ? notes : [];
    const thoughtNotes = list.filter(n => n.comment && n.comment.trim() !== '');
    const pureHighlights = list.filter(n => !n.comment || n.comment.trim() === '');
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

export function findOverlappingNote(notes = [], page = 1, quote = '') {
    if (!Array.isArray(notes) || !quote) return null;
    const cleanQuote = quote.trim();
    if (!cleanQuote) return null;

    return notes.find(n => {
        if (n.page !== page) return false;
        if (!n.quote) return false;
        const nQuote = n.quote.trim();
        return nQuote === cleanQuote || nQuote.includes(cleanQuote) || cleanQuote.includes(nQuote);
    }) || null;
}

export function applyHighlightToHtml(html, note) {
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

export function applyAllHighlightsToHtml(html, notes = []) {
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
    quote = '',
    comment = '',
    color = null,
    page = 1,
    chapter = '章节选区',
    timestamp = null,
    sectionId = '',
    offset = 0,
    location = null
} = {}) {
    const validPage = Number(page) || 1;
    const loc = location || {
        sectionId: sectionId || `chapter-${validPage}`,
        page: validPage,
        offset: Number(offset) || 0
    };
    const finalColor = color || (comment && comment.trim() !== '' ? 'green' : 'yellow');
    return {
        id: id || ('note-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
        bookId,
        quote: quote || '',
        comment: comment || '',
        color: finalColor,
        page: validPage,
        chapter: chapter || '章节选区',
        timestamp: timestamp || new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16),
        location: loc
    };
}
