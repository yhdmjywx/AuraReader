const { StorageError, digest } = require('../src/server/dataStore.js');
const { found, conflict } = require('./queries.cjs');

function versionOf(item, version) {
    if (digest(item) !== version) conflict('This item has changed. Read it again before saving.', { version: digest(item) });
}

function commands(mod, queries) {
    function goalWrite(store, name, input, update) {
        return store.editGoalLibrary({ capability: name, ...input }, ({ value: state, revision }, current) => {
            const outcome = update(state, current, revision);
            return { ...outcome, goalId: input.goalId ?? input.target?.goalId ?? outcome.id };
        });
    }
    function goal(state, id) {
        return found(state.goals.find(node => node.id === id), 'Goal');
    }
    function editable(state, id) {
        const node = goal(state, id);
        if (!mod.goalEditable(state, id)) conflict('Restore this Goal before changing its content.');
        return node;
    }
    function inputRecord(state, input) {
        editable(state, input.goalId);
        const record = found(state.inputs?.find(i => i.id === input.id && i.goalId === input.goalId), 'Goal text');
        versionOf(record, input.version);
        return record;
    }
    function activeBook(store, input) {
        const row = found(store.book(input.bookId), 'Book');
        if (row.generation !== input.generation) conflict('The book was reimported. Read its current version.', { reason: 'book_changed', generation: row.generation, bookRevision: row.revision });
        return row;
    }
    return {
        createGoal(store, input) {
            const id = 'goal-' + digest(['goal', input.opId]);
            return goalWrite(store, 'create_goal', input, state => {
                if (input.parentId) editable(state, input.parentId);
                return { id, state: mod.addGoal(state, { id, parentId: input.parentId, text: input.text, origin: null }) };
            });
        },
        editGoal(store, input) {
            return goalWrite(store, 'edit_goal', input, state => {
                versionOf(editable(state, input.goalId), input.version);
                return { state: mod.changeGoal(state, input.goalId, input.text) };
            });
        },
        operateGoal(store, input) {
            return goalWrite(store, 'operate_goal', input, (state, _store, revision) => {
                goal(state, input.goalId);
                if (revision !== input.expected) conflict('The Goal library has changed. Read the Goal again before changing its branch.', { revision });
                try { return { state: mod.operateGoal(state, input.goalId, input.action) }; }
                catch (error) { conflict(error.message); }
            });
        },
        addInput(store, input) {
            const id = 'input-' + digest(['input', input.opId]);
            return goalWrite(store, 'add_goal_input', input, state => {
                editable(state, input.goalId);
                return { id, state: mod.addGoalInput(state, { id, goalId: input.goalId, text: input.text }) };
            });
        },
        editInput(store, input) {
            return goalWrite(store, 'edit_goal_input', input, state => {
                const record = inputRecord(state, input);
                return { id: record.id, state: mod.changeGoalInput(state, input.goalId, input.id, input.text) };
            });
        },
        deleteInput(store, input) {
            return goalWrite(store, 'delete_goal_input', input, state => {
                inputRecord(state, input);
                return { id: input.id, state: mod.deleteGoalInput(state, input.goalId, input.id) };
            });
        },
        bookLink(store, input) {
            return goalWrite(store, 'set_goal_book', input, (state, current) => {
                editable(state, input.goalId);
                activeBook(current, input);
                const links = state.bookLinks || [];
                const existing = links.find(link => link.goalId === input.goalId && link.bookId === input.bookId);
                if (!!existing === input.linked) return { bookId: input.bookId, state };
                const bookLinks = input.linked ? [...links, { goalId: input.goalId, bookId: input.bookId, generation: input.generation }]
                    : links.filter(link => link !== existing);
                return { bookId: input.bookId, state: { ...state, bookLinks } };
            });
        },
        annotationLink(store, input) {
            return goalWrite(store, 'set_goal_material', input, (state, current) => {
                editable(state, input.goalId);
                activeBook(current, input);
                const record = found(current.note(input.annotationId), 'Annotation');
                if (record.bookId !== input.bookId) throw new StorageError('The annotation does not belong to this book.');
                const existing = state.links.find(link => link.goalId === input.goalId && link.annotationId === input.annotationId
                    && link.bookId === input.bookId && link.generation === input.generation);
                if (input.linked) {
                    const { goalId, bookId, generation, annotationId } = input;
                    return { annotationId, state: mod.addGoalSource(state, { goalId, bookId, generation, annotationId }) };
                }
                if (!existing || existing.order !== input.associationOrder) conflict('The material association has changed. Read the Goal again.');
                return { annotationId: input.annotationId, state: { ...state, links: state.links.filter(link => link !== existing) } };
            });
        },
        response(store, input) {
            return goalWrite(store, 'set_goal_response', input, state => {
                editable(state, input.target.goalId);
                if (!mod.responseContent(state, input.target)) conflict('The Response target has changed. Read the Goal again.');
                const next = mod.setGoalResponse(state, input.target, input.marked);
                return { target: input.target, state: next };
            });
        },
        createAnnotation(store, input, kind) {
            const id = kind + '-' + digest([kind, input.opId]);
            return store.editNote({ capability: 'create_' + kind, ...input, id, expected: 0 }, (_, bookRow) => {
                const doc = queries.source(JSON.parse(bookRow.payload), input.sourcePage);
                const { start, end, quote } = input;
                if (doc.sectionId !== input.sectionId || end <= start || end > doc.text.length
                    || queries.splitsPair(doc.text, start) || queries.splitsPair(doc.text, end) || doc.text.slice(start, end) !== quote) {
                    conflict('The quote does not match this source interval. Read or locate the passage again.',
                        { bookRevision: bookRow.revision, generation: bookRow.generation });
                }
                return mod.createAnnotationObject({ id, bookId: input.bookId, kind, quote, comment: input.comment,
                    color: input.color, page: doc.sourcePage, chapter: doc.chapter,
                    location: { page: doc.sourcePage, sectionId: doc.sectionId, offset: start, start, end } });
            });
        },
        editAnnotation(store, input) {
            if (input.comment === undefined && input.color === undefined) throw new StorageError('Supply a comment or a color.');
            return store.editNote({ capability: 'edit_annotation', ...input }, record => {
                const note = found(record, 'Annotation');
                if (note.bookId !== input.bookId) throw new StorageError('The annotation does not belong to this book.');
                if (input.comment !== undefined && mod.normalizeAnnotation(note.value).kind !== 'note') {
                    throw new StorageError('Only a note has a reader comment.');
                }
                return { ...note.value, ...(input.comment === undefined ? {} : { comment: input.comment }),
                    ...(input.color === undefined ? {} : { color: input.color }) };
            });
        },
        deleteAnnotation(store, input) {
            const { revision, goalLibrary } = store.deleteNote(input);
            return { id: input.id, bookId: input.bookId, revision, generation: input.generation, goalRevision: goalLibrary?.revision };
        },
        deleteBook(store, input) {
            const { revision, goalLibrary } = store.deleteBook(input);
            return { id: input.id, revision, goalRevision: goalLibrary?.revision };
        }
    };
}

module.exports = { commands };
