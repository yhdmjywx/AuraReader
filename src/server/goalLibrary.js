const { createHash } = require('node:crypto');
const { validateGoalState } = require('./goalValidation');
const legacyGoalId = (bookId, id) => 'legacy-' + createHash('sha256').update(JSON.stringify([bookId, id])).digest('hex');
function upgradeContent(state, previous = state) {
    let sequence = Math.max(previous.contentSequence || 0, state.contentSequence || 0);
    const links = state.links.map((link, index) => {
        if (link.order !== undefined) { sequence = Math.max(sequence, link.order); return link; }
        const prior = previous.links.find(l => l.goalId === link.goalId && l.annotationId === link.annotationId && l.bookId === link.bookId);
        const order = prior?.order ?? (previous.formatVersion === 2 ? ++sequence : state.links.length - index);
        sequence = Math.max(sequence, order);
        return { ...link, order, ...(prior?.response ? { response: prior.response } : {}) };
    });
    return { ...state, formatVersion: 2, contentSequence: sequence, links, inputs: state.inputs ?? previous.inputs ?? [] };
}
function validateLibrary(state, sourceExists = () => true, fail = message => { throw new Error(message); }, bookExists = () => true) {
    if (!state || !Array.isArray(state.goals) || !Array.isArray(state.links)) return fail("Invalid goal library.");
    // Reuse the existing tree/field/cycle validation without inventing a book owner.
    const normalized = state.goals.map(goal => ({ ...goal, origin: goal?.origin ? { ...goal.origin, sourcePage: goal.origin.sourcePage === null ? 1 : goal.origin.sourcePage } : null }));
    validateGoalState({ bookId: 'goal-library', goals: normalized, links: [] }, () => true, fail);
    for (const goal of state.goals) if (goal.origin && (typeof goal.origin.bookId !== 'string' || !goal.origin.bookId
        || (goal.origin.sourcePage !== null && (!Number.isSafeInteger(goal.origin.sourcePage) || goal.origin.sourcePage < 1)))) return fail("Invalid goal source.");
    const ids = new Set(state.goals.map(g => g.id)), pairs = new Set();
    for (const link of state.links) {
        if (!link || !ids.has(link.goalId) || typeof link.annotationId !== 'string' || !link.annotationId
            || typeof link.bookId !== 'string' || !link.bookId || typeof link.generation !== 'string' || !link.generation
            || !sourceExists(link)) return fail("The goal link source is invalid or has changed.");
        const pair = JSON.stringify([link.goalId, link.annotationId, link.bookId]);
        if (pairs.has(pair)) return fail("Duplicate goal link."); pairs.add(pair);
    }
    if (state.bookLinks !== undefined) {
        if (!Array.isArray(state.bookLinks)) return fail("Invalid goal book link.");
        const pairs = new Set();
        for (const link of state.bookLinks) {
            if (!link || !ids.has(link.goalId) || typeof link.bookId !== 'string' || !link.bookId || link.bookId.length > 4096
                || typeof link.generation !== 'string' || !link.generation || !bookExists(link)) return fail("The goal book was deleted or changed.");
            const pair = JSON.stringify([link.goalId, link.bookId]);
            if (pairs.has(pair)) return fail("Duplicate goal book link."); pairs.add(pair);
        }
    }
    if (state.formatVersion !== undefined && state.formatVersion !== 2) return fail('Unsupported goal content version.');
    const validSequence = n => Number.isSafeInteger(n) && n > 0;
    if (state.contentSequence !== undefined && (!Number.isSafeInteger(state.contentSequence) || state.contentSequence < 0)) return fail('Invalid goal content sequence.');
    const metadata = item => {
        if (item.order !== undefined && (!validSequence(item.order) || item.order > state.contentSequence)) return false;
        return item.response === undefined || (item.response && validSequence(item.response.sequence)
            && item.response.sequence <= state.contentSequence && typeof item.response.markedAt === 'string' && Number.isFinite(Date.parse(item.response.markedAt)));
    };
    if (state.links.some(l => !metadata(l))) return fail('Invalid goal content order or response.');
    if (state.inputs !== undefined) {
        if (!Array.isArray(state.inputs)) return fail('Invalid goal text records.');
        const inputIds = new Set();
        for (const input of state.inputs) {
            if (!input || typeof input.id !== 'string' || !input.id || input.id.length > 4096 || inputIds.has(input.id)
                || !ids.has(input.goalId) || typeof input.text !== 'string' || !input.text.trim()
                || !validSequence(input.order) || !metadata(input)
                || ![input.createdAt, input.updatedAt].every(t => typeof t === 'string' && Number.isFinite(Date.parse(t)))) return fail('Invalid goal text record.');
            inputIds.add(input.id);
        }
    }
    return state;
}
function convertLegacy(state, generation) {
    return { goals: state.goals.map(g => ({ ...g, id: legacyGoalId(state.bookId, g.id), parentId: g.parentId === null ? null : legacyGoalId(state.bookId, g.parentId),
        origin: { ...(g.origin || { sourcePage: null, sectionId: '', chapter: '' }), bookId: state.bookId } })),
        links: state.links.map(l => ({ ...l, goalId: legacyGoalId(state.bookId, l.goalId), bookId: state.bookId, generation })) };
}
function createGoalLibrary(store, fail, canonical) {
    const { one, all, run } = store;
    const validate = state => validateLibrary(state, link => {
        const book = one('SELECT generation,deleted FROM books WHERE id=?', link.bookId);
        const note = one('SELECT book_id,deleted FROM annotations WHERE id=?', link.annotationId);
        return book && !book.deleted && book.generation === link.generation && note && !note.deleted && note.book_id === link.bookId;
    }, fail, link => {
        const book = one('SELECT generation,deleted FROM books WHERE id=?', link.bookId);
        return book && !book.deleted && book.generation === link.generation;
    });
    const read = () => { const row = one('SELECT * FROM goal_library WHERE id=1'); return { id: 'reader-goals', revision: row.revision, deleted: false, value: JSON.parse(row.payload) }; };
    const write = state => {
        // Old frozen commands keep their original hash and must not erase new relations.
        if (state.bookLinks === undefined) state = { ...state, bookLinks: read().value.bookLinks || [] };
        const previous = read().value;
        // Do not rewrite frozen commands or allow old snapshots to erase owned text.
        validate(state); state = upgradeContent(state, previous); validate(state);
        const active = (library, id) => {
            const nodes = new Map(library.goals.map(g => [g.id, g]));
            let goal = nodes.get(id);
            if (!goal) return false;
            while (goal) { if (goal.archivedAt || goal.deletedAt) return false; goal = nodes.get(goal.parentId); }
            return true;
        };
        for (const input of state.inputs) {
            const prior = previous.inputs?.find(i => i.id === input.id);
            if (prior && prior.goalId !== input.goalId) fail('Goal text cannot be moved to another goal.');
            if ((!prior || canonical(prior) !== canonical(input)) && !active(state, input.goalId)) fail('Restore the goal before editing its text.');
        }
        for (const input of previous.inputs || []) if (!state.inputs.some(i => i.id === input.id)
            && state.goals.some(g => g.id === input.goalId) && !active(state, input.goalId)) fail('Restore the goal before deleting its text.');
        const revision = read().revision + 1; run('UPDATE goal_library SET payload=?,revision=? WHERE id=1', JSON.stringify(state), revision); return read();
    };
    function legacy(state, previous, generation, restoring = false) {
        const incoming = convertLegacy(state, generation), before = convertLegacy(previous || { bookId: state.bookId, goals: [], links: [] }, generation), current = read().value;
        const ids = new Set([...before.goals, ...incoming.goals].map(g => g.id));
        if (!restoring) for (const goal of before.goals) {
            const live = current.goals.find(g => g.id === goal.id);
            if (live && canonical(live) !== canonical(goal)) fail("Pending legacy goal content conflicts with the modified global goal.");
        }
        if (!restoring) for (const goal of incoming.goals) {
            const live = current.goals.find(g => g.id === goal.id);
            if (!before.goals.some(g => g.id === goal.id) && live && canonical(live) !== canonical(goal)) fail("The legacy goal ID has already been updated in the global library.");
        }
        current.goals = current.goals.filter(g => !ids.has(g.id)).concat(incoming.goals);
        if (!restoring) {
            const beforeIds = new Set(before.goals.map(g => g.id));
            const scoped = current.links.filter(l => beforeIds.has(l.goalId) && l.bookId === state.bookId);
            const sourceIdentity = links => links.map(({ goalId, annotationId, bookId, generation }) => ({ goalId, annotationId, bookId, generation }));
            if (canonical(sourceIdentity(scoped)) !== canonical(sourceIdentity(before.links))) fail("The legacy goal link conflicts with the global library.");
        }
        current.links = current.links.filter(l => !ids.has(l.goalId) || l.bookId !== state.bookId).concat(incoming.links);
        return write(current);
    }
    function prune(bookId, annotationId) {
        const record = read(), links = record.value.links.filter(l => l.bookId !== bookId || (annotationId && l.annotationId !== annotationId));
        const bookLinks = (record.value.bookLinks || []).filter(l => annotationId || l.bookId !== bookId);
        if (links.length === record.value.links.length && bookLinks.length === (record.value.bookLinks || []).length) return undefined;
        return write({ ...record.value, links, bookLinks });
    }
    function restore(graph, bookIds) {
        if (!graph || !Array.isArray(graph.goals) || (graph.links !== undefined && !Array.isArray(graph.links))
            || (graph.bookLinks !== undefined && !Array.isArray(graph.bookLinks))) fail("Invalid goal graph backup.");
        const current = read().value, ids = new Set(graph.goals.map(g => g?.id));
        if (ids.size !== graph.goals.length) fail("Duplicate goal node.");
        current.goals = current.goals.filter(g => !ids.has(g.id)).concat(graph.goals);
        if (graph.links !== undefined) {
            if (graph.links.some(l => !l || !ids.has(l.goalId) || !bookIds.has(l.bookId))) fail("The backup goal link is outside this file scope.");
            current.links = current.links.filter(l => !ids.has(l.goalId) || !bookIds.has(l.bookId)).concat(graph.links.map(l => ({ ...l, generation: one('SELECT generation FROM books WHERE id=?', l.bookId)?.generation })));
        }
        if (graph.bookLinks !== undefined) {
            if (graph.bookLinks.some(l => !l || !ids.has(l.goalId) || !bookIds.has(l.bookId))) fail("The backup book link is outside this file scope.");
            current.bookLinks = (current.bookLinks || []).filter(l => !ids.has(l.goalId) || !bookIds.has(l.bookId))
                .concat(graph.bookLinks.map(l => ({ ...l, generation: one('SELECT generation FROM books WHERE id=?', l.bookId)?.generation })));
        }
        // A foreign backup may carry larger ordering metadata, but never owned text.
        current.contentSequence = Math.max(current.contentSequence || 0, ...current.links.map(l => Math.max(l.order || 0, l.response?.sequence || 0)));
        return write(current);
    }
    function initialize() {
        run('CREATE TABLE IF NOT EXISTS goal_library(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,revision INTEGER NOT NULL)');
        if (!one('SELECT 1 FROM goal_library WHERE id=1')) {
            const state = { goals: [], links: [] };
            for (const row of all('SELECT * FROM goal_states WHERE deleted=0')) {
                const book = one('SELECT generation,deleted FROM books WHERE id=?', row.book_id);
                if (!book || book.deleted) fail("The legacy goal has no valid book.");
                const previous = JSON.parse(row.payload);
                if (previous.bookId !== row.book_id) fail("The legacy goal book source does not match.");
                validateGoalState(previous, annotationId => {
                    const note = one('SELECT book_id,deleted FROM annotations WHERE id=?', annotationId);
                    return note && !note.deleted && note.book_id === row.book_id;
                }, fail);
                const converted = convertLegacy(previous, book.generation);
                state.goals.push(...converted.goals); state.links.push(...converted.links);
            }
            validate(state); run('INSERT INTO goal_library VALUES(1,?,0)', JSON.stringify(state));
        } else validate(read().value);
        const state = upgradeContent(read().value);
        validate(state); run('UPDATE goal_library SET payload=? WHERE id=1', JSON.stringify(state));
        run('PRAGMA user_version=5');
    }
    return { initialize, read, write, validate, legacy, prune, restore };
}
module.exports = { legacyGoalId, convertLegacy, validateLibrary, createGoalLibrary };
