const { createHash } = require('node:crypto');
const { validateGoalState } = require('./goalValidation');
const legacyGoalId = (bookId, id) => 'legacy-' + createHash('sha256').update(JSON.stringify([bookId, id])).digest('hex');
function validateLibrary(state, sourceExists = () => true, fail = message => { throw new Error(message); }, bookExists = () => true) {
    if (!state || !Array.isArray(state.goals) || !Array.isArray(state.links)) return fail('无效 Goal 库');
    // Reuse the existing tree/field/cycle validation without inventing a book owner.
    const normalized = state.goals.map(goal => ({ ...goal, origin: goal?.origin ? { ...goal.origin, sourcePage: goal.origin.sourcePage === null ? 1 : goal.origin.sourcePage } : null }));
    validateGoalState({ bookId: 'goal-library', goals: normalized, links: [] }, () => true, fail);
    for (const goal of state.goals) if (goal.origin && (typeof goal.origin.bookId !== 'string' || !goal.origin.bookId
        || (goal.origin.sourcePage !== null && (!Number.isSafeInteger(goal.origin.sourcePage) || goal.origin.sourcePage < 1)))) return fail('无效 Goal 来源');
    const ids = new Set(state.goals.map(g => g.id)), pairs = new Set();
    for (const link of state.links) {
        if (!link || !ids.has(link.goalId) || typeof link.annotationId !== 'string' || !link.annotationId
            || typeof link.bookId !== 'string' || !link.bookId || typeof link.generation !== 'string' || !link.generation
            || !sourceExists(link)) return fail('Goal 关联来源无效或已变化');
        const pair = JSON.stringify([link.goalId, link.annotationId, link.bookId]);
        if (pairs.has(pair)) return fail('重复 Goal 关联'); pairs.add(pair);
    }
    if (state.bookLinks !== undefined) {
        if (!Array.isArray(state.bookLinks)) return fail('无效 Goal 书籍关联');
        const pairs = new Set();
        for (const link of state.bookLinks) {
            if (!link || !ids.has(link.goalId) || typeof link.bookId !== 'string' || !link.bookId || link.bookId.length > 4096
                || typeof link.generation !== 'string' || !link.generation || !bookExists(link)) return fail('Goal 书籍已删除或变化');
            const pair = JSON.stringify([link.goalId, link.bookId]);
            if (pairs.has(pair)) return fail('重复 Goal 书籍关联'); pairs.add(pair);
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
        validate(state); const revision = read().revision + 1; run('UPDATE goal_library SET payload=?,revision=? WHERE id=1', JSON.stringify(state), revision); return read();
    };
    function legacy(state, previous, generation, restoring = false) {
        const incoming = convertLegacy(state, generation), before = convertLegacy(previous || { bookId: state.bookId, goals: [], links: [] }, generation), current = read().value;
        const ids = new Set([...before.goals, ...incoming.goals].map(g => g.id));
        if (!restoring) for (const goal of before.goals) {
            const live = current.goals.find(g => g.id === goal.id);
            if (live && canonical(live) !== canonical(goal)) fail('旧 Goal 待写内容与已修改的全局 Goal 冲突');
        }
        if (!restoring) for (const goal of incoming.goals) {
            const live = current.goals.find(g => g.id === goal.id);
            if (!before.goals.some(g => g.id === goal.id) && live && canonical(live) !== canonical(goal)) fail('旧 Goal ID 已在全局库中更新');
        }
        current.goals = current.goals.filter(g => !ids.has(g.id)).concat(incoming.goals);
        if (!restoring) {
            const beforeIds = new Set(before.goals.map(g => g.id));
            const scoped = current.links.filter(l => beforeIds.has(l.goalId) && l.bookId === state.bookId);
            if (canonical(scoped) !== canonical(before.links)) fail('旧 Goal 关联与全局库冲突');
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
            || (graph.bookLinks !== undefined && !Array.isArray(graph.bookLinks))) fail('无效 Goal 图备份');
        const current = read().value, ids = new Set(graph.goals.map(g => g?.id));
        if (ids.size !== graph.goals.length) fail('重复 Goal 节点');
        current.goals = current.goals.filter(g => !ids.has(g.id)).concat(graph.goals);
        if (graph.links !== undefined) {
            if (graph.links.some(l => !l || !ids.has(l.goalId) || !bookIds.has(l.bookId))) fail('备份 Goal 关联超出本文件范围');
            current.links = current.links.filter(l => !ids.has(l.goalId) || !bookIds.has(l.bookId)).concat(graph.links.map(l => ({ ...l, generation: one('SELECT generation FROM books WHERE id=?', l.bookId)?.generation })));
        }
        if (graph.bookLinks !== undefined) {
            if (graph.bookLinks.some(l => !l || !ids.has(l.goalId) || !bookIds.has(l.bookId))) fail('备份书籍关联超出本文件范围');
            current.bookLinks = (current.bookLinks || []).filter(l => !ids.has(l.goalId) || !bookIds.has(l.bookId))
                .concat(graph.bookLinks.map(l => ({ ...l, generation: one('SELECT generation FROM books WHERE id=?', l.bookId)?.generation })));
        }
        return write(current);
    }
    function initialize() {
        run('CREATE TABLE IF NOT EXISTS goal_library(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,revision INTEGER NOT NULL)');
        if (!one('SELECT 1 FROM goal_library WHERE id=1')) {
            const state = { goals: [], links: [] };
            for (const row of all('SELECT * FROM goal_states WHERE deleted=0')) {
                const book = one('SELECT generation,deleted FROM books WHERE id=?', row.book_id);
                if (!book || book.deleted) fail('旧 Goal 缺少有效书籍');
                const previous = JSON.parse(row.payload);
                if (previous.bookId !== row.book_id) fail('旧 Goal 书籍来源不一致');
                validateGoalState(previous, annotationId => {
                    const note = one('SELECT book_id,deleted FROM annotations WHERE id=?', annotationId);
                    return note && !note.deleted && note.book_id === row.book_id;
                }, fail);
                const converted = convertLegacy(previous, book.generation);
                state.goals.push(...converted.goals); state.links.push(...converted.links);
            }
            validate(state); run('INSERT INTO goal_library VALUES(1,?,0)', JSON.stringify(state));
        } else validate(read().value);
        run('PRAGMA user_version=4');
    }
    return { initialize, read, write, validate, legacy, prune, restore };
}
module.exports = { legacyGoalId, convertLegacy, validateLibrary, createGoalLibrary };
