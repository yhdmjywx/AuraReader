const { StorageError, digest } = require('../src/server/dataStore.js');

function found(record, label) {
    if (!record || record.deleted) throw new StorageError(label + ' was not found.', 404);
    return record;
}

function conflict(message, details) {
    throw new StorageError(message, 409, details);
}

function cursorOffset(cursor, version) {
    if (!cursor) return 0;
    let decoded;
    try { decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch {}
    if (!Array.isArray(decoded) || !Number.isSafeInteger(decoded[1]) || decoded[1] < 0) {
        throw new StorageError('Invalid cursor.');
    }
    if (decoded[0] !== version) conflict('The data behind this cursor has changed. Start again from the first page.', { reason: 'stale_cursor' });
    return decoded[1];
}

const encodeCursor = (version, offset) => Buffer.from(JSON.stringify([version, offset])).toString('base64url');

function pageList(items, cursor, version, limit) {
    const offset = cursorOffset(cursor, version);
    const end = offset + limit;
    return { items: items.slice(offset, end), nextCursor: end < items.length ? encodeCursor(version, end) : null };
}

function createQueries(mod, document) {
    const books = store => store.bookSummaries().filter(row => !row.deleted);
    const bookSummary = row => ({ ...row.value, generation: row.generation, bookRevision: row.revision });
    const goalSummary = (state, goal) => ({ ...goal, version: digest(goal), path: mod.goalAncestors(state, goal.id).map(node => ({ id: node.id, text: node.text })),
        area: mod.goalArea(state, goal.id) });
    function annotation(row, book) {
        const note = mod.normalizeAnnotation(row.value);
        return { id: row.id, bookId: row.bookId, kind: note.kind, quote: note.quote, comment: note.comment, color: note.color,
            location: note.location, chapter: note.chapter, timestamp: note.timestamp, revision: row.revision,
            generation: book?.generation, bookTitle: book?.value.title };
    }
    let cachedBook;
    const models = new WeakMap();
    function book(store, id) {
        const version = found(store.one('SELECT id, revision, generation, deleted FROM books WHERE id=?', id), 'Book');
        if (cachedBook?.id === id && cachedBook.revision === version.revision && cachedBook.generation === version.generation) return cachedBook;
        cachedBook = found(store.book(id), 'Book');
        return cachedBook;
    }
    function structure(book) {
        const cached = models.get(book);
        if (cached) return cached;
        const model = mod.buildBookStructure(book, document);
        models.set(book, model);
        return model;
    }
    let lastSource;
    function source(book, page, model = structure(book)) {
        if (lastSource?.book === book && lastSource.document.sourcePage === page) return lastSource.document;
        if (page < 1 || page > book.pages.length) throw new StorageError('Source document was not found.', 404);
        const root = document.createElement('div');
        root.innerHTML = book.pages[page - 1] || '<p>No content on this page</p>';
        mod.preparePublicationContent(root, book, page);
        const publication = book.epub?.documents.find(item => item.page === page);
        const sourceDocument = { sourcePage: page, sectionId: publication?.sectionId || 'chapter-' + page,
            chapter: model.pageToUnit.get(page)?.title || model.documents[page - 1].title,
            path: publication?.path, text: mod.readSourceText(root) };
        lastSource = { book, document: sourceDocument };
        return sourceDocument;
    }
    function passage(record, document, start, end) {
        const { text, ...location } = document;
        return { bookId: record.id, bookTitle: record.value.title, generation: record.generation, bookRevision: record.revision,
            ...location, start, end, quote: text.slice(start, end) };
    }
    const splitsPair = (text, offset) => /[\uD800-\uDBFF]/.test(text[offset - 1] || '') && /[\uDC00-\uDFFF]/.test(text[offset] || '');

    return {
        source, splitsPair,
        search(store, { query, kind, bookId, cursor, limit }) {
            const available = books(store);
            const byId = new Map(available.map(row => [row.id, row]));
            const { value: state, revision } = store.goalLibrary();
            if (bookId) found(byId.get(bookId), 'Book');
            const notes = kind === 'all' || kind === 'annotation' ? store.notes(bookId ? [bookId] : []).filter(row => !row.deleted) : [];
            const term = query.toLocaleLowerCase();
            const matches = (...fields) => fields.some(field => String(field ?? '').toLocaleLowerCase().includes(term));
            const items = [];
            if (kind === 'all' || kind === 'book') for (const row of available) {
                if ((!bookId || row.id === bookId) && matches(row.value.title, row.id)) items.push({ kind: 'book', book: bookSummary(row) });
            }
            if (kind === 'all' || kind === 'goal') for (const goal of state.goals) {
                if (matches(goal.text, goal.id)) items.push({ kind: 'goal', goal: goalSummary(state, goal) });
            }
            for (const row of notes) {
                const note = annotation(row, byId.get(row.bookId));
                if (matches(note.quote, note.comment, note.id)) items.push({ kind: 'annotation', annotation: note });
            }
            const version = digest(['library', query, kind, bookId ?? null, revision, available.map(r => [r.id, r.revision]), notes.map(r => [r.id, r.revision])]);
            return pageList(items, cursor, version, limit);
        },
        goal(store, { goalId, cursor, limit }) {
            const { value: state, revision } = store.goalLibrary();
            const goal = found(state.goals.find(node => node.id === goalId), 'Goal');
            const available = books(store);
            const byId = new Map(available.map(row => [row.id, row]));
            const revisions = [];
            const items = mod.goalContent(state, goalId).map(item => {
                if (item.kind === 'input') return { kind: item.kind, ...item.input, version: digest(item.input) };
                const link = item.link;
                const row = store.note(link.annotationId);
                const sourceBook = byId.get(link.bookId);
                revisions.push([link.annotationId, row?.revision ?? null, sourceBook?.revision ?? null]);
                return { kind: item.kind, link, annotation: row && !row.deleted ? annotation(row, sourceBook) : null };
            });
            const linkedBooks = (state.bookLinks || []).filter(link => link.goalId === goalId)
                .map(link => ({ ...link, book: bookSummary(byId.get(link.bookId)) }));
            const version = digest(['goal', goalId, revision, revisions, linkedBooks.map(b => [b.bookId, b.book.bookRevision])]);
            const children = mod.goalChildren(state, goalId).map(child => goalSummary(state, child));
            const combined = [...children.map(child => ({ kind: 'child', goal: child })), ...linkedBooks.map(link => ({ kind: 'book', ...link })), ...items];
            const page = pageList(combined, cursor, version, limit);
            return { goal: goalSummary(state, goal), revision,
                children: page.items.filter(item => item.kind === 'child').map(item => item.goal),
                books: page.items.filter(item => item.kind === 'book').map(({ kind, ...item }) => item),
                content: page.items.filter(item => item.kind !== 'child' && item.kind !== 'book'), nextCursor: page.nextCursor };
        },
        contents(store, { bookId, cursor, limit }) {
            const row = book(store, bookId);
            const model = structure(row.value);
            const units = model.units.map(unit => ({ ...unit, documents: unit.sourcePages.map(page => ({
                sourcePage: page, sectionId: row.value.epub?.documents.find(doc => doc.page === page)?.sectionId || 'chapter-' + page,
                path: row.value.epub?.documents.find(doc => doc.page === page)?.path,
                title: model.documents[page - 1].title
            })) }));
            const toc = model.nodes.map(({ children, parent, ...node }) => ({ ...node, parentId: parent?.id ?? null }));
            const page = pageList([...units.map(unit => ({ unit })), ...toc.map(entry => ({ entry }))], cursor,
                digest(['contents', bookId, row.generation, row.revision]), limit);
            return { bookId, title: row.value.title, generation: row.generation, bookRevision: row.revision,
                units: page.items.flatMap(item => item.unit ? [item.unit] : []),
                toc: page.items.flatMap(item => item.entry ? [item.entry] : []), nextCursor: page.nextCursor };
        },
        read(store, { bookId, sourcePage, cursor, offset, limit }) {
            const row = book(store, bookId);
            const doc = source(row.value, sourcePage);
            const version = digest(['passage', bookId, row.generation, row.revision, sourcePage, doc.sectionId]);
            const start = cursor ? cursorOffset(cursor, version) : offset;
            if (start > doc.text.length || splitsPair(doc.text, start)) throw new StorageError('The passage start is outside a UTF-16 character boundary.');
            let end = Math.min(start + limit, doc.text.length);
            if (splitsPair(doc.text, end)) end++;
            return { ...passage(row, doc, start, end), length: doc.text.length,
                nextCursor: end < doc.text.length ? encodeCursor(version, end) : null };
        },
        find(store, { bookId, quote, sourcePage, cursor, limit }) {
            const row = book(store, bookId);
            const model = structure(row.value);
            const first = sourcePage ?? 1;
            const last = sourcePage ?? row.value.pages.length;
            const version = digest(['quote', bookId, row.generation, row.revision, sourcePage ?? null, quote]);
            const offset = cursorOffset(cursor, version);
            const items = [];
            let skipped = 0;
            for (let page = first; page <= last; page++) {
                const doc = source(row.value, page, model);
                for (let start = doc.text.indexOf(quote); start >= 0; start = doc.text.indexOf(quote, start + 1)) {
                    const end = start + quote.length;
                    if (splitsPair(doc.text, start) || splitsPair(doc.text, end)) continue;
                    if (skipped++ < offset) continue;
                    if (items.length === limit) return { items, nextCursor: encodeCursor(version, offset + limit) };
                    const left = Math.max(0, start - 120);
                    const right = Math.min(doc.text.length, end + 120);
                    items.push({ ...passage(row, doc, start, end), before: doc.text.slice(left - Number(splitsPair(doc.text, left)), start),
                        after: doc.text.slice(end, right + Number(splitsPair(doc.text, right))) });
                }
            }
            return { items, nextCursor: null };
        }
    };
}

module.exports = { createQueries, found, conflict };
