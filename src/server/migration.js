const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { StorageError, canonical, digest, bookRecord, noteRecord } = require('./dataStore');

function createMigration(store) {
    const root = path.join(store.root, 'migration-snapshots');
    function folder(source, snapshotId) {
        if (typeof source !== 'string' || !source || source.length > 200) throw new StorageError('无效迁移来源');
        if (!/^[a-f0-9]{64}$/.test(snapshotId)) throw new StorageError('无效快照 ID');
        return path.join(root, digest(source), snapshotId);
    }
    function write(file, value) {
        const bytes = JSON.stringify(value, null, 2);
        if (fs.existsSync(file)) {
            if (canonical(JSON.parse(fs.readFileSync(file, 'utf8'))) !== canonical(value)) throw new StorageError('快照内容不一致', 409);
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
        if (!input || typeof input !== 'object' || !input.indexedDB || !input.caches || !input.pending || !input.builtins) throw new StorageError('迁移快照缺少原始数据');
        const snapshotId = digest(input); const dir = folder(source, snapshotId);
        fs.mkdirSync(dir, { recursive: true });
        // Independently recoverable originals are written before any merging.
        for (const key of ['indexedDB', 'caches', 'pending', 'builtins']) write(path.join(dir, key + '.json'), input[key]);
        write(path.join(dir, 'source.json'), { source, snapshotId, origin: input.origin || '', format: 1 });
        return { snapshotId };
    }
    function commit(source, snapshotId) {
        const prior = status(source);
        if (prior.completed) {
            if (prior.snapshotId !== snapshotId) throw new StorageError('该来源已经迁移，请勿重复覆盖', 409);
            return prior;
        }
        const dir = folder(source, snapshotId);
        let input;
        try {
            const meta = JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8'));
            input = { origin: meta.origin };
            for (const key of ['indexedDB', 'caches', 'pending', 'builtins']) input[key] = JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'));
        } catch (_) { throw new StorageError('原始快照未完整保存，可重新上传后继续', 409); }
        if (digest(input) !== snapshotId) throw new StorageError('快照校验失败', 409);
        const conflicts = []; const ignoredCaches = [];
        const fail = (message, record) => conflicts.push({ message, record });
        const books = new Map(); const notes = new Map(); const deletes = new Map();
        const rawNotes = new Map();
        function add(map, item, validate, label) {
            try { validate(item); } catch (error) { fail(label + ': ' + error.message, item); return; }
            if (map.has(item.id) && canonical(map.get(item.id)) !== canonical(item)) fail(label + ': 同 ID 不同内容', item);
            else map.set(item.id, item);
        }
        if (!Array.isArray(input.indexedDB.books) || !Array.isArray(input.indexedDB.notes)) fail('IndexedDB 原始列表损坏');
        else {
            input.indexedDB.books.forEach(b => add(books, b, bookRecord, '书籍'));
            input.indexedDB.notes.forEach(n => add(rawNotes, n, noteRecord, '标注'));
        }
        const builtins = input.builtins.books;
        const seed = input.builtins.notes;
        if (!Array.isArray(builtins) || !Array.isArray(seed)) fail('示例数据损坏');
        else builtins.forEach(book => { if (!books.has(book.id)) add(books, book, bookRecord, '示例书'); });
        const ids = new Set([...books.keys(), ...rawNotes.values().map(n => n.bookId), ...Object.keys(input.caches), ...Object.keys(input.pending)]);
        function parse(raw, label, bookId) {
            if (raw == null) return null;
            try {
                const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (!Array.isArray(value)) throw new Error();
                return value;
            } catch (_) { fail(label + '损坏', bookId); return []; }
        }
        for (const bookId of ids) {
            const dbNotes = [...rawNotes.values()].filter(n => n.bookId === bookId);
            const cached = parse(input.caches[bookId], '标注缓存', bookId);
            const pending = parse(input.pending[bookId], '待写记录', bookId) || [];
            const pendingIds = new Set(pending.map(e => e?.id));
            if (cached) {
                const seen = new Map();
                for (const n of cached) {
                    add(seen, n, noteRecord, '缓存标注');
                    if (n?.bookId !== bookId) fail('缓存标注属于其他书籍', n);
                    if (dbNotes.length && !rawNotes.has(n?.id) && !pendingIds.has(n?.id)) fail('仅缓存存在的标注无法确定新旧', n);
                    else if (dbNotes.length && canonical(rawNotes.get(n?.id) || null) !== canonical(n)) ignoredCaches.push(n?.id);
                }
            }
            const base = dbNotes.length ? dbNotes : cached ?? (Array.isArray(seed) ? seed.filter(n => n.bookId === bookId) : []);
            for (const n of base) add(notes, n, noteRecord, '有效标注');
            const seenPending = new Set();
            for (const entry of pending) {
                if (!entry || typeof entry.id !== 'string' || entry.bookId !== bookId || typeof entry.version !== 'string'
                    || !['save', 'delete'].includes(entry.operation) || seenPending.has(entry.id)) { fail('待写操作无效或重复', entry); continue; }
                seenPending.add(entry.id);
                if (entry.operation === 'delete') { notes.delete(entry.id); deletes.set(entry.id, bookId); }
                else {
                    try {
                        noteRecord(entry.note);
                        if (entry.note.id !== entry.id || entry.note.bookId !== bookId) throw new Error('待写标注关联不一致');
                        const existing = notes.get(entry.id);
                        if (existing && existing.bookId !== bookId) throw new Error('标注 ID 属于另一书籍');
                        notes.set(entry.id, entry.note);
                    } catch (error) { fail(error.message, entry); }
                }
            }
        }
        for (const n of notes.values()) if (!books.has(n.bookId)) fail('标注找不到关联书籍', n);
        for (const [id, bookId] of deletes) if (!books.has(bookId)) fail('待删除标注找不到关联书籍', { id, bookId });
        function rejectConflicts() {
            if (conflicts.length) {
                // Overwrite only this diagnostic, never the original snapshots.
                fs.writeFileSync(path.join(dir, 'conflicts.json'), JSON.stringify(conflicts, null, 2));
                throw new StorageError('迁移发现冲突，未切换书库；原始数据和快照均已保留', 409, conflicts);
            }
        }
        rejectConflicts();
        const values = { books: [...books.values()].sort((a, b) => a.id.localeCompare(b.id)), notes: [...notes.values()].sort((a, b) => a.id.localeCompare(b.id)), deleted: [...deletes].sort() };
        const manifest = { books: books.size, notes: notes.size, deleted: deletes.size, hash: digest(values), ignoredCaches, snapshotId };
        return store.transaction(() => {
            for (const b of books.values()) {
                const existing = store.one('SELECT * FROM books WHERE id=?', b.id);
                if (existing && (existing.deleted || canonical(JSON.parse(existing.payload)) !== canonical(b))) fail('SQLite 已有同 ID 不同书籍', b.id);
            }
            for (const n of notes.values()) {
                const existing = store.one('SELECT * FROM annotations WHERE id=?', n.id);
                if (existing && (existing.deleted || canonical(JSON.parse(existing.payload)) !== canonical(n))) fail('SQLite 已有同 ID 不同标注', n.id);
            }
            for (const [id, bookId] of deletes) {
                const existing = store.one('SELECT * FROM annotations WHERE id=?', id);
                if (existing && (!existing.deleted || existing.book_id !== bookId)) fail('待删除操作与 SQLite 已有数据冲突', id);
            }
            rejectConflicts();
            for (const b of books.values()) store.run('INSERT OR IGNORE INTO books VALUES(?,?,1,?,0)', b.id, JSON.stringify(b), randomUUID());
            for (const n of notes.values()) store.run('INSERT OR IGNORE INTO annotations VALUES(?,?,?,1,0)', n.id, n.bookId, JSON.stringify(n));
            for (const [id, bookId] of deletes) store.run('INSERT OR IGNORE INTO annotations VALUES(?,?,NULL,1,1)', id, bookId);
            // Read back every complete object, not just counts.
            const actual = {
                books: values.books.map(b => JSON.parse(store.one('SELECT payload FROM books WHERE id=?', b.id).payload)),
                notes: values.notes.map(n => JSON.parse(store.one('SELECT payload FROM annotations WHERE id=?', n.id).payload)), deleted: values.deleted
            };
            if (digest(actual) !== manifest.hash) throw new StorageError('迁移内容验证失败', 500);
            store.check();
            store.run('INSERT INTO migrations VALUES(?,?,?)', source, snapshotId, JSON.stringify(manifest));
            return { completed: true, snapshotId, manifest };
        });
    }
    return { snapshot, commit, status };
}
module.exports = { createMigration };
