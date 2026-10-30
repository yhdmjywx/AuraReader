const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { StorageError, canonical, digest, bookRecord, noteRecord } = require('./dataStore');

function createMigration(store) {
    const root = path.join(store.root, 'migration-snapshots');
    function folder(source, snapshotId) {
        if (typeof source !== 'string' || !source || source.length > 200) throw new StorageError("Invalid migration source.");
        if (!/^[a-f0-9]{64}$/.test(snapshotId)) throw new StorageError("Invalid snapshot ID.");
        return path.join(root, digest(source), snapshotId);
    }
    function write(file, value) {
        const bytes = JSON.stringify(value, null, 2);
        if (fs.existsSync(file)) {
            if (canonical(JSON.parse(fs.readFileSync(file, 'utf8'))) !== canonical(value)) throw new StorageError("Snapshot content does not match.", 409);
            return;
        }
        const tmp = file + '.' + randomUUID() + '.tmp';
        const fd = fs.openSync(tmp, 'wx');
        try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        fs.renameSync(tmp, file);
    }
    function status(source) {
        const row = store.one('SELECT * FROM migrations WHERE source_id=?', source);
        return row ? { completed: true, snapshotId: row.snapshot_id, manifest: JSON.parse(row.manifest) } : { completed: false };
    }
    function snapshot(source, input) {
        if (!input || typeof input !== 'object' || !input.indexedDB || !input.caches || !input.pending || !input.builtins) throw new StorageError("The migration snapshot is missing original data.");
        const snapshotId = digest(input); const dir = folder(source, snapshotId);
        fs.mkdirSync(dir, { recursive: true });
        // Independently recoverable originals are written before any merging.
        for (const key of ['indexedDB', 'caches', 'pending', 'builtins']) write(path.join(dir, key + '.json'), input[key]);
        write(path.join(dir, 'source.json'), { source, snapshotId, origin: input.origin || '', format: 1 });
        return { snapshotId };
    }
    // Explicit local maintenance decisions only; the HTTP API cannot supply
    // recoveries. Each approval is tied to one immutable snapshot record.
    function commit(source, snapshotId, { cacheRecoveries = [] } = {}) {
        const prior = status(source);
        if (prior.completed) {
            if (prior.snapshotId !== snapshotId) throw new StorageError("This source has already been migrated. Do not overwrite it again.", 409);
            return prior;
        }
        const dir = folder(source, snapshotId);
        let input;
        try {
            const meta = JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8'));
            input = { origin: meta.origin };
            for (const key of ['indexedDB', 'caches', 'pending', 'builtins']) input[key] = JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'));
        } catch (_) { throw new StorageError("The original snapshot was not fully saved. Upload it again to continue.", 409); }
        if (digest(input) !== snapshotId) throw new StorageError("Snapshot validation failed.", 409);
        const conflicts = []; const ignoredCaches = [];
        const fail = (message, record) => conflicts.push({ message, record });
        const books = new Map(); const notes = new Map(); const deletes = new Map();
        const rawNotes = new Map();
        function add(map, item, validate, label) {
            try { validate(item); } catch (error) { fail(label + ': ' + error.message, item); return; }
            if (map.has(item.id) && canonical(map.get(item.id)) !== canonical(item)) fail(label + ": same ID with different content", item);
            else map.set(item.id, item);
        }
        if (!Array.isArray(input.indexedDB.books) || !Array.isArray(input.indexedDB.notes)) fail("The original IndexedDB list is damaged.");
        else {
            input.indexedDB.books.forEach(b => add(books, b, bookRecord, "Books"));
            input.indexedDB.notes.forEach(n => add(rawNotes, n, noteRecord, "Annotation"));
        }
        const builtins = input.builtins.books;
        const seed = input.builtins.notes;
        const hasExistingLibrary = !!store.one('SELECT 1 AS present FROM migrations LIMIT 1');
        const hasLegacyBook = id => books.has(id) || [...rawNotes.values()].some(n => n.bookId === id)
            || Object.hasOwn(input.caches, id) || Object.hasOwn(input.pending, id);
        if (!Array.isArray(builtins) || !Array.isArray(seed)) fail("Sample data is damaged.");
        else builtins.forEach(book => {
            // A fresh browser joining this PC's existing library must not
            // re-import factory seed notes over the user's edited examples.
            if (hasExistingLibrary && !hasLegacyBook(book.id)) return;
            if (!books.has(book.id)) add(books, book, bookRecord, "Sample book");
        });
        const recovered = new Map();
        if (!Array.isArray(cacheRecoveries)) throw new StorageError("Cache recovery decisions must be a list.");
        for (const decision of cacheRecoveries) {
            const { cacheBookId, targetBookId, id, recordHash } = decision || {};
            try {
                if (typeof cacheBookId !== 'string' || typeof targetBookId !== 'string' || typeof id !== 'string'
                    || recovered.has(id) || cacheBookId === targetBookId || !books.has(targetBookId)) throw new Error("The recovery decision contains an invalid book or annotation ID.");
                const raw = input.caches[cacheBookId];
                const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const matches = Array.isArray(cached) ? cached.filter(n => n?.id === id) : [];
                if (matches.length !== 1 || matches[0].bookId !== targetBookId || digest(matches[0]) !== recordHash) throw new Error("The recovery record does not match the user-confirmed snapshot.");
                noteRecord(matches[0]);
                if (rawNotes.has(id)) throw new Error("The recovery record already has a copy in IndexedDB. Review it again.");
                for (const [key, raw] of Object.entries(input.caches)) {
                    if (key === cacheBookId) continue;
                    const other = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (!Array.isArray(other) || other.some(n => n?.id === id)) throw new Error("The recovery record has a copy in another cache, or the cache is invalid.");
                }
                for (const raw of Object.values(input.pending)) {
                    const pending = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (!Array.isArray(pending) || pending.some(entry => entry?.id === id)) throw new Error("The recovery record involves unfinished writes or deletes. Review it again.");
                }
                recovered.set(id, { cacheBookId, note: matches[0] });
            } catch (error) { fail("Invalid cache recovery decision: " + error.message, decision); }
        }
        const ids = new Set([...books.keys(), ...[...rawNotes.values()].map(n => n.bookId), ...Object.keys(input.caches), ...Object.keys(input.pending)]);
        function parse(raw, label, bookId) {
            if (raw == null) return null;
            try {
                const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (!Array.isArray(value)) throw new Error();
                return value;
            } catch (_) { fail(`${label} is corrupted`, bookId); return []; }
        }
        for (const bookId of ids) {
            const dbNotes = [...rawNotes.values()].filter(n => n.bookId === bookId);
            const cached = parse(Object.hasOwn(input.caches, bookId) ? input.caches[bookId] : null, "Annotation cache", bookId)
                ?.filter(n => recovered.get(n?.id)?.cacheBookId !== bookId) ?? null;
            const pending = parse(Object.hasOwn(input.pending, bookId) ? input.pending[bookId] : null, "Pending record", bookId) || [];
            const pendingIds = new Set(pending.map(e => e?.id));
            if (cached) {
                const seen = new Map();
                for (const n of cached) {
                    add(seen, n, noteRecord, "Cached annotation");
                    if (n?.bookId !== bookId) fail("The cached annotation belongs to another book.", n);
                    if (dbNotes.length && !rawNotes.has(n?.id) && !pendingIds.has(n?.id)) fail("The age of a cache-only annotation cannot be determined.", n);
                    else if (dbNotes.length && canonical(rawNotes.get(n?.id) || null) !== canonical(n)) ignoredCaches.push(n?.id);
                }
            }
            const base = dbNotes.length ? dbNotes : cached ?? (Array.isArray(seed) ? seed.filter(n => n.bookId === bookId) : []);
            for (const n of base) add(notes, n, noteRecord, "Valid annotation");
            const seenPending = new Set();
            for (const entry of pending) {
                if (!entry || typeof entry.id !== 'string' || entry.bookId !== bookId || typeof entry.version !== 'string'
                    || !['save', 'delete'].includes(entry.operation) || seenPending.has(entry.id)) { fail("Invalid or duplicate pending operation.", entry); continue; }
                seenPending.add(entry.id);
                if (entry.operation === 'delete') {
                    if (rawNotes.has(entry.id) && rawNotes.get(entry.id).bookId !== bookId) fail("The pending delete ID belongs to another book.", entry);
                    notes.delete(entry.id); deletes.set(entry.id, bookId);
                }
                else {
                    try {
                        noteRecord(entry.note);
                        if (entry.note.id !== entry.id || entry.note.bookId !== bookId) throw new Error("The pending annotation link does not match.");
                        const existing = notes.get(entry.id);
                        if (existing && existing.bookId !== bookId) throw new Error("The annotation ID belongs to another book.");
                        notes.set(entry.id, entry.note);
                    } catch (error) { fail(error.message, entry); }
                }
            }
        }
        for (const { note } of recovered.values()) {
            if (notes.has(note.id) || deletes.has(note.id)) fail("The recovery record conflicts with a valid annotation or deletion record.", note.id);
            else notes.set(note.id, note);
        }
        for (const n of notes.values()) if (!books.has(n.bookId)) fail("No associated book was found for the annotation.", n);
        for (const [id] of deletes) if (notes.has(id)) fail("An annotation appears in both valid data and deletion records.", id);
        for (const [id, bookId] of deletes) if (!books.has(bookId)) fail("No associated book was found for the pending annotation deletion.", { id, bookId });
        function rejectConflicts() {
            if (conflicts.length) {
                // Overwrite only this diagnostic, never the original snapshots.
                fs.writeFileSync(path.join(dir, 'conflicts.json'), JSON.stringify(conflicts, null, 2));
                throw new StorageError("Migration found conflicts. The library was not switched. Original data and snapshots are preserved.", 409, conflicts);
            }
        }
        rejectConflicts();
        if (cacheRecoveries.length) write(path.join(dir, 'resolution.json'), { format: 1, source, snapshotId, cacheRecoveries });
        const values = { books: [...books.values()].sort((a, b) => a.id.localeCompare(b.id)), notes: [...notes.values()].sort((a, b) => a.id.localeCompare(b.id)), deleted: [...deletes].sort() };
        const cleanup = Object.fromEntries(['caches', 'pending'].map(key => [key, Object.fromEntries(Object.entries(input[key]).map(([id, raw]) => [id, digest(raw)]))]));
        const manifest = { books: books.size, notes: notes.size, deleted: deletes.size, hash: digest(values), ignoredCaches, snapshotId, cleanup };
        if (cacheRecoveries.length) manifest.cacheRecoveries = cacheRecoveries;
        return store.transaction(() => {
            for (const b of books.values()) {
                const existing = store.one('SELECT * FROM books WHERE id=?', b.id);
                if (existing && (existing.deleted || canonical(JSON.parse(existing.payload)) !== canonical(b))) fail("SQLite already contains a different book with the same ID.", b.id);
            }
            for (const n of notes.values()) {
                const existing = store.one('SELECT * FROM annotations WHERE id=?', n.id);
                if (existing && (existing.deleted || canonical(JSON.parse(existing.payload)) !== canonical(n))) fail("SQLite already contains a different annotation with the same ID.", n.id);
            }
            for (const [id, bookId] of deletes) {
                const existing = store.one('SELECT * FROM annotations WHERE id=?', id);
                if (existing && (!existing.deleted || existing.book_id !== bookId)) fail("The pending deletion conflicts with existing SQLite data.", id);
            }
            rejectConflicts();
            for (const b of books.values()) store.run('INSERT OR IGNORE INTO books VALUES(?,?,1,?,0)', b.id, JSON.stringify(b), randomUUID());
            for (const n of notes.values()) store.run('INSERT OR IGNORE INTO annotations VALUES(?,?,?,1,0)', n.id, n.bookId, JSON.stringify(n));
            for (const [id, bookId] of deletes) store.run('INSERT OR IGNORE INTO annotations VALUES(?,?,NULL,1,1)', id, bookId);
            // Read back every complete object, not just counts.
            const actual = {
                books: values.books.map(b => JSON.parse(store.one('SELECT payload FROM books WHERE id=?', b.id).payload)),
                notes: values.notes.map(n => JSON.parse(store.one('SELECT payload FROM annotations WHERE id=?', n.id).payload)),
                deleted: values.deleted.map(([id, bookId]) => {
                    const row = store.one('SELECT * FROM annotations WHERE id=?', id);
                    if (!row || !row.deleted || row.book_id !== bookId) throw new StorageError("Migration deletion validation failed.", 500);
                    return [id, row.book_id];
                })
            };
            if (digest(actual) !== manifest.hash) throw new StorageError("Migration content validation failed.", 500);
            store.check();
            store.run('INSERT INTO migrations VALUES(?,?,?)', source, snapshotId, JSON.stringify(manifest));
            return { completed: true, snapshotId, manifest };
        });
    }
    return { snapshot, commit, status };
}
module.exports = { createMigration };
