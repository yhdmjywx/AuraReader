const { validateGoalState } = require('./goalValidation');
const { createGoalLibrary, validateLibrary, convertLegacy } = require('./goalLibrary');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

class StorageError extends Error {
    constructor(message, status = 400, details) { super(message); this.status = status; this.details = details; }
}
function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
}
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
function id(value, name = 'id') {
    if (typeof value !== 'string' || !value || value.length > 4096) throw new StorageError(`Invalid ${name}`);
    return value;
}
function bookRecord(book) {
    if (!book || typeof book !== 'object' || Array.isArray(book)) throw new StorageError("Invalid book.");
    id(book.id);
    if (!Array.isArray(book.pages) || !book.pages.every(p => typeof p === 'string')) throw new StorageError("The book is missing complete chapter HTML.");
    return book;
}
function noteRecord(note) {
    if (!note || typeof note !== 'object' || Array.isArray(note)) throw new StorageError("Invalid annotation.");
    id(note.id); id(note.bookId, 'bookId');
    if (note.kind != null && !['note', 'highlight'].includes(note.kind)) throw new StorageError("Invalid annotation type.");
    if (note.quote != null && typeof note.quote !== 'string') throw new StorageError("Invalid quote.");
    if (note.comment != null && typeof note.comment !== 'string') throw new StorageError("Invalid note text.");
    return note;
}

function goalRecord(value) {
    return validateGoalState(value, () => true, message => { throw new StorageError(message, 409); });
}
function goalBackupRecord(value) {
    if (!value || typeof value !== 'object') throw new StorageError("Invalid goal backup.");
    if (!Array.isArray(value.goals)) throw new StorageError("Invalid goal backup.");
    // A partial import can reference a parent already in the destination.
    // Validate node fields here; validate the merged tree inside the transaction.
    goalRecord({ ...value, goals: value.goals.map(goal => ({ ...goal, parentId: null })), links: value.links === undefined ? [] : value.links });
    for (const goal of value.goals) if (goal.parentId !== null) id(goal.parentId, 'parentId');
    return value;
}
const SCHEMA_VERSION = 5;
function createDataStore(directory, { attachOnly = false, applicationId } = {}) {
    const root = path.resolve(directory);
    if (!attachOnly) fs.mkdirSync(root, { recursive: true });
    const filename = path.join(root, 'aurareader.sqlite');
    const installed = path.join(root, 'storage-installed.json');
    if (fs.existsSync(installed) && (!fs.existsSync(filename) || fs.statSync(filename).size === 0)) {
        throw new StorageError("The SQLite file is missing or empty. Preserve the data directory and restore a verified backup. An empty library will not be created automatically.", 500);
    }
    if (attachOnly) {
        const marker = JSON.parse(fs.readFileSync(installed, 'utf8'));
        if (marker?.format !== 1 || marker.database !== path.basename(filename)) throw new StorageError('Invalid library marker.', 409);
        const probe = new DatabaseSync(filename, { readOnly: true, timeout: 5000 });
        try { assertCompatibleDesktop(probe, applicationId); } finally { probe.close(); }
    }
    const db = new DatabaseSync(filename, { timeout: 5000 });
    try {
        if (attachOnly) assertCompatibleDesktop(db, applicationId);
        else if (db.prepare('PRAGMA user_version').get().user_version > SCHEMA_VERSION) {
            throw new StorageError("The database version is newer than this application. Downgrade overwrite is not allowed.", 409);
        }
        db.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL');
        if (!attachOnly) db.exec(`PRAGMA journal_mode=WAL;
        BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY, payload TEXT, revision INTEGER NOT NULL, generation TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS annotations(id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id), payload TEXT, revision INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS annotations_book ON annotations(book_id);
        CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, hash TEXT NOT NULL, result TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS goal_states(book_id TEXT PRIMARY KEY REFERENCES books(id), payload TEXT, revision INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
        COMMIT;`);
    }
    catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); throw error; }
    if (!attachOnly && !fs.existsSync(installed)) fs.writeFileSync(installed, JSON.stringify({ format: 1, database: 'aurareader.sqlite' }), { flag: 'wx' });
    const one = (sql, ...args) => db.prepare(sql).get(...args);
    const all = (sql, ...args) => db.prepare(sql).all(...args);
    const run = (sql, ...args) => db.prepare(sql).run(...args);
    function transaction(fn, readOnly = false) {
        db.exec(readOnly ? 'BEGIN' : 'BEGIN IMMEDIATE');
        try { const result = fn(); db.exec('COMMIT'); return result; }
        catch (error) {
            // SQLITE_FULL and some I/O errors already roll back the transaction.
            // Preserve that original failure instead of replacing it with a
            // second "no transaction is active" error.
            if (db.isTransaction) db.exec('ROLLBACK');
            throw error;
        }
    }
    function mutate(command, apply) {
        id(command.opId, 'opId');
        const hash = digest(command);
        return transaction(() => {
            const prior = savedResult(command.opId, hash);
            if (prior !== null) return prior;
            const result = apply();
            run('INSERT INTO operations VALUES(?,?,?)', command.opId, hash, JSON.stringify(result));
            return result;
        });
    }
    function savedResult(opId, hash) {
        const prior = one('SELECT hash, result FROM operations WHERE id=?', opId);
        if (!prior) return null;
        if (prior.hash !== hash) throw new StorageError('The operation ID was reused for different content.', 409, { reason: 'operation_id_reused' });
        return JSON.parse(prior.result);
    }
    function expected(row, revision) {
        if (!Number.isSafeInteger(revision) || revision < 0) throw new StorageError("A valid save version is required.");
        if ((row?.revision || 0) !== revision) throw new StorageError("Data was modified by another operation. Reload before continuing.", 409);
    }
    function activeBook(bookId, generation) {
        const row = one('SELECT * FROM books WHERE id=?', id(bookId, 'bookId'));
        if (!row || row.deleted || row.generation !== generation) throw new StorageError("The book was deleted or reimported.", 409, { reason: 'book_changed', generation: row?.generation, bookRevision: row?.revision });
        return row;
    }
    function putBook(book, revision) {
        bookRecord(book);
        const row = one('SELECT * FROM books WHERE id=?', book.id);
        expected(row, revision);
        const generation = row && !row.deleted ? row.generation : randomUUID();
        run(`INSERT INTO books VALUES(?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, revision=excluded.revision, generation=excluded.generation, deleted=0`, book.id, JSON.stringify(book), revision + 1, generation);
        return { revision: revision + 1, generation };
    }
    function putNote(note, revision, generation) {
        noteRecord(note); activeBook(note.bookId, generation);
        const row = one('SELECT * FROM annotations WHERE id=?', note.id);
        if (row && row.book_id !== note.bookId) throw new StorageError("An annotation cannot change its book.", 409);
        expected(row, revision);
        run(`INSERT INTO annotations VALUES(?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, revision=excluded.revision, deleted=0`, note.id, note.bookId, JSON.stringify(note), revision + 1);
        return { revision: revision + 1 };
    }
    function goalRow(bookId) {
        const row = one('SELECT * FROM goal_states WHERE book_id=?', bookId);
        return row ? { id: bookId, bookId, revision: row.revision, deleted: !!row.deleted, value: row.deleted ? null : JSON.parse(row.payload) } : null;
    }
    function validateGoals(state) {
        return validateGoalState(state, (id, bookId) => {
            const row = one('SELECT book_id, deleted FROM annotations WHERE id=?', id);
            return !!row && !row.deleted && row.book_id === bookId;
        }, message => { throw new StorageError(message, 409); });
    }
    function putGoals(state, revision, generation, restoring = false) {
        activeBook(state?.bookId, generation); validateGoals(state);
        const row = one('SELECT * FROM goal_states WHERE book_id=?', state.bookId); expected(row, revision);
        if (!restoring) library.legacy(state, row && !row.deleted ? JSON.parse(row.payload) : null, generation);
        run('INSERT INTO goal_states VALUES(?,?,?,0) ON CONFLICT(book_id) DO UPDATE SET payload=excluded.payload, revision=excluded.revision, deleted=0',
            state.bookId, JSON.stringify(state), revision + 1);
        return { revision: revision + 1 };
    }
    function pruneGoalLinks(bookId, annotationId) {
        const record = goalRow(bookId);
        if (!record || record.deleted) return undefined;
        const links = record.value.links.filter(link => link.annotationId !== annotationId);
        if (links.length === record.value.links.length) return undefined;
        record.value.links = links; record.revision++;
        run('UPDATE goal_states SET payload=?, revision=? WHERE book_id=?', JSON.stringify(record.value), record.revision, bookId);
        return record;
    }
    const summaryCache = new Map();
    const store = {
        filename, root, db, transaction, one, all, run,
        snapshot(fn) { return transaction(() => fn(store), true); },
        versions() {
            return {
                books: all('SELECT id, revision, generation, deleted FROM books'),
                notes: all('SELECT id, book_id AS bookId, revision, deleted FROM annotations'),
                goalRevision: one('SELECT revision FROM goal_library WHERE id=1').revision
            };
        },
        editGoalLibrary(command, update) {
            return mutate(command, () => {
                const current = library.read();
                const { state, ...result } = update(current, store);
                const record = state === current.value ? current : library.write(state);
                return { ...result, revision: record.revision };
            });
        },
        editNote(command, update) {
            return mutate(command, () => {
                const book = activeBook(command.bookId, command.generation);
                if (command.bookRevision !== undefined && book.revision !== command.bookRevision) {
                    throw new StorageError('The book has changed. Read the passage again.', 409,
                        { reason: 'book_changed', generation: book.generation, bookRevision: book.revision });
                }
                const record = store.note(command.id);
                expected(record, command.expected);
                return { id: command.id, bookId: command.bookId, generation: command.generation,
                    ...putNote(update(record, book), command.expected, command.generation) };
            });
        },
        importBook(command, prepare) {
            return mutate(command, () => {
                const previous = store.book(command.id);
                const book = prepare(previous?.value);
                return { id: book.id, ...putBook(book, previous?.revision || 0) };
            });
        },
        recordFile(command, result) { return mutate(command, () => result); },
        replay(command) { return savedResult(id(command.opId, 'opId'), digest(command)); },
        note(noteId) {
            const r = one('SELECT * FROM annotations WHERE id=?', id(noteId));
            return r ? { id: r.id, bookId: r.book_id, revision: r.revision, deleted: !!r.deleted, value: r.deleted ? null : JSON.parse(r.payload) } : null;
        },
        books() { return all('SELECT * FROM books ORDER BY id').map(r => ({ id: r.id, revision: r.revision, generation: r.generation, deleted: !!r.deleted, value: r.deleted ? null : JSON.parse(r.payload) })); },
        book(bookId) {
            const row = one('SELECT * FROM books WHERE id=?', id(bookId, 'bookId'));
            return row ? { id: row.id, revision: row.revision, generation: row.generation, deleted: !!row.deleted, value: row.deleted ? null : JSON.parse(row.payload) } : null;
        },
        bookSummaries() {
            return all('SELECT id, revision, generation, deleted FROM books ORDER BY id').map(row => {
                const cached = summaryCache.get(row.id);
                if (cached?.revision === row.revision) return cached;
                const value = row.deleted ? null : one(`SELECT id, json_extract(payload,'$.title') AS title,
                    json_extract(payload,'$.format') AS format, json_extract(payload,'$.language') AS language,
                    json_extract(payload,'$.updatedAt') AS updatedAt, json_array_length(payload,'$.pages') AS pageCount
                    FROM books WHERE id=?`, row.id);
                const result = { ...row, deleted: !!row.deleted, value };
                summaryCache.set(row.id, result); return result;
            });
        },
        notes(bookIds = []) {
            if (!Array.isArray(bookIds)) throw new StorageError("Invalid book list.");
            bookIds.forEach(b => id(b));
            const rows = bookIds.length ? all(`SELECT * FROM annotations WHERE book_id IN (${bookIds.map(() => '?').join(',')}) ORDER BY id`, ...bookIds) : all('SELECT * FROM annotations ORDER BY id');
            return rows.map(r => ({ id: r.id, bookId: r.book_id, revision: r.revision, deleted: !!r.deleted, value: r.deleted ? null : JSON.parse(r.payload) }));
        },
        goals(bookIds = []) {
            if (!Array.isArray(bookIds)) throw new StorageError("Invalid book list.");
            bookIds.forEach(b => id(b));
            const ids = bookIds.length ? bookIds : all('SELECT book_id FROM goal_states').map(row => row.book_id);
            return ids.map(goalRow).filter(Boolean);
        },
        saveGoals(c) { return mutate(c, () => putGoals(c.state, c.expected, c.generation)); },
        goalLibrary() { return library.read(); },
        saveGoalLibrary(c) { return mutate(c, () => {
            expected(library.read(), c.expected); library.write(c.state); return { revision: library.read().revision };
        }); },
        saveBook(c) { return mutate(c, () => putBook(c.book, c.expected)); },
        saveNote(c) { return mutate(c, () => putNote(c.note, c.expected, c.generation)); },
        deleteNote(c) {
            return mutate(c, () => {
                activeBook(c.bookId, c.generation); id(c.id);
                const row = one('SELECT * FROM annotations WHERE id=?', c.id); expected(row, c.expected);
                if (row && row.book_id !== c.bookId) throw new StorageError("The annotation does not belong to this book.", 409);
                run(`INSERT INTO annotations VALUES(?,?,NULL,?,1) ON CONFLICT(id) DO UPDATE SET payload=NULL, revision=excluded.revision, deleted=1`, c.id, c.bookId, c.expected + 1);
                const goalState = pruneGoalLinks(c.bookId, c.id);
                const goalLibrary = library.prune(c.bookId, c.id);
                return { revision: c.expected + 1, ...(goalState ? { goalState } : {}), ...(goalLibrary ? { goalLibrary } : {}) };
            });
        },
        deleteBook(c) {
            return mutate(c, () => {
                id(c.id); const row = one('SELECT * FROM books WHERE id=?', c.id); expected(row, c.expected);
                if (c.generation !== undefined) activeBook(c.id, c.generation);
                if (!row) {
                    run('INSERT INTO books VALUES(?,NULL,1,?,1)', c.id, randomUUID());
                    return { revision: 1 };
                }
                if (row.deleted) return { revision: row.revision };
                const goalLibrary = library.prune(c.id);
                run('UPDATE goal_states SET payload=NULL, deleted=1, revision=revision+1 WHERE book_id=?', c.id);
                run('UPDATE annotations SET payload=NULL, deleted=1, revision=revision+1 WHERE book_id=?', c.id);
                run('UPDATE books SET payload=NULL, deleted=1, revision=revision+1 WHERE id=?', c.id);
                return { revision: row.revision + 1, ...(goalLibrary ? { goalLibrary } : {}) };
            });
        },
        restore(c) {
            return mutate(c, () => {
                if (!Array.isArray(c.books) || !Array.isArray(c.notes)) throw new StorageError("The backup must contain book and annotation arrays.");
                const bookIds = new Set(); const noteIds = new Set();
                for (const book of c.books) {
                    bookRecord(book); if (bookIds.has(book.id)) throw new StorageError("The backup contains duplicate book IDs.", 409); bookIds.add(book.id);
                    const row = one('SELECT * FROM books WHERE id=?', book.id);
                    putBook(book, row?.revision || 0);
                }
                for (const note of c.notes) {
                    noteRecord(note); if (noteIds.has(note.id)) throw new StorageError("The backup contains duplicate annotation IDs.", 409); noteIds.add(note.id);
                    const book = one('SELECT * FROM books WHERE id=?', note.bookId);
                    if (!book || book.deleted) throw new StorageError("A backup annotation has no associated book.", 409);
                    const row = one('SELECT * FROM annotations WHERE id=?', note.id);
                    putNote(note, row?.revision || 0, book.generation);
                }
                if (c.goalStates !== undefined) {
                    if (!Array.isArray(c.goalStates)) throw new StorageError("Invalid goal backup.");
                    const seen = new Set();
                    for (const incoming of c.goalStates) {
                        if (!incoming || !bookIds.has(incoming.bookId) || seen.has(incoming.bookId) || !Array.isArray(incoming.goals)
                            || (incoming.links !== undefined && !Array.isArray(incoming.links))) throw new StorageError("Invalid or duplicate goal backup.");
                        seen.add(incoming.bookId);
                        const current = goalRow(incoming.bookId);
                        const state = current && !current.deleted ? current.value : { bookId: incoming.bookId, goals: [], links: [] };
                        const ids = new Set();
                        for (const goal of incoming.goals) {
                            if (!goal || ids.has(goal.id)) throw new StorageError("Duplicate goal node.", 409);
                            ids.add(goal.id);
                        }
                        state.goals = state.goals.filter(goal => !ids.has(goal.id)).concat(incoming.goals);
                        if (incoming.links !== undefined) {
                            if (incoming.links.some(link => !ids.has(link?.goalId))) throw new StorageError("The backup link does not belong to a backup node.", 409);
                            state.links = state.links.filter(link => !ids.has(link.goalId)).concat(incoming.links);
                        }
                        const book = one('SELECT * FROM books WHERE id=?', incoming.bookId);
                        putGoals(state, current?.revision || 0, book.generation, true);
                        if (c.goalGraph === undefined) {
                            const graph = convertLegacy({ bookId: incoming.bookId, goals: incoming.goals, links: incoming.links || [] }, book.generation);
                            if (incoming.links === undefined) delete graph.links;
                            library.restore(graph, bookIds);
                        }
                    }
                }
                if (c.goalGraph !== undefined) library.restore(c.goalGraph, bookIds);
                return { books: c.books.length, notes: c.notes.length };
            });
        },
        check() {
            const integrity = all('PRAGMA integrity_check'); const foreignKeys = all('PRAGMA foreign_key_check');
            if (integrity.some(r => r.integrity_check !== 'ok') || foreignKeys.length) throw new StorageError("Database integrity check failed.", 500);
            for (const record of store.goals()) if (!record.deleted) {
                const book = one('SELECT deleted FROM books WHERE id=?', record.bookId);
                if (!book || book.deleted) throw new StorageError("The goal has no valid book.", 409);
                validateGoals(record.value);
            }
            library.validate(library.read().value);
            return { integrity: 'ok', foreignKeys: 0 };
        },
        close() { db.close(); }
    };
    const library = createGoalLibrary(store, message => { throw new StorageError(message, 409); }, canonical);
    try { if (!attachOnly) transaction(() => library.initialize()); }
    catch (error) { db.close(); throw error; }
    return store;
}
function assertCompatibleDesktop(db, applicationId) {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    const identity = db.prepare('PRAGMA application_id').get().application_id;
    const legacy = identity === 0 && db.prepare("SELECT 1 FROM sqlite_schema WHERE name='migrations' AND type='table'").get()
        && db.prepare("SELECT 1 FROM migrations WHERE source_id='aurareader-desktop-v1'").get();
    if (version !== SCHEMA_VERSION || (identity !== applicationId && !legacy)) {
        throw new StorageError('Open an initialized desktop library with a compatible AuraReader version.', 409);
    }
}

module.exports = { createDataStore, StorageError, canonical, digest, bookRecord, noteRecord, goalRecord, goalBackupRecord, validateLibrary };
