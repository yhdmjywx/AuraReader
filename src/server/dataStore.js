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
    if (typeof value !== 'string' || !value || value.length > 4096) throw new StorageError(`无效的 ${name}`);
    return value;
}
function bookRecord(book) {
    if (!book || typeof book !== 'object' || Array.isArray(book)) throw new StorageError('无效书籍');
    id(book.id);
    if (!Array.isArray(book.pages) || !book.pages.every(p => typeof p === 'string')) throw new StorageError('书籍缺少完整章节 HTML');
    return book;
}
function noteRecord(note) {
    if (!note || typeof note !== 'object' || Array.isArray(note)) throw new StorageError('无效标注');
    id(note.id); id(note.bookId, 'bookId');
    if (note.kind != null && !['note', 'highlight'].includes(note.kind)) throw new StorageError('无效标注类型');
    if (note.quote != null && typeof note.quote !== 'string') throw new StorageError('无效引用');
    if (note.comment != null && typeof note.comment !== 'string') throw new StorageError('无效笔记正文');
    return note;
}

function createDataStore(directory) {
    const root = path.resolve(directory);
    fs.mkdirSync(root, { recursive: true });
    const filename = path.join(root, 'aurareader.sqlite');
    const db = new DatabaseSync(filename, { timeout: 5000 });
    db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY, payload TEXT, revision INTEGER NOT NULL, generation TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS annotations(id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id), payload TEXT, revision INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS annotations_book ON annotations(book_id);
        CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, hash TEXT NOT NULL, result TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS migrations(source_id TEXT PRIMARY KEY, snapshot_id TEXT NOT NULL, manifest TEXT NOT NULL);
        PRAGMA user_version=1;`);
    const one = (sql, ...args) => db.prepare(sql).get(...args);
    const all = (sql, ...args) => db.prepare(sql).all(...args);
    const run = (sql, ...args) => db.prepare(sql).run(...args);
    function transaction(fn) {
        db.exec('BEGIN IMMEDIATE');
        try { const result = fn(); db.exec('COMMIT'); return result; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    function mutate(command, apply) {
        id(command.opId, 'opId');
        const hash = digest(command);
        return transaction(() => {
            const prior = one('SELECT * FROM operations WHERE id=?', command.opId);
            if (prior) {
                if (prior.hash !== hash) throw new StorageError('操作 ID 被用于不同内容', 409);
                return JSON.parse(prior.result);
            }
            const result = apply();
            run('INSERT INTO operations VALUES(?,?,?)', command.opId, hash, JSON.stringify(result));
            return result;
        });
    }
    function expected(row, revision) {
        if (!Number.isSafeInteger(revision) || revision < 0) throw new StorageError('缺少有效保存版本');
        if ((row?.revision || 0) !== revision) throw new StorageError('数据已被其他操作修改，请重新载入后处理', 409);
    }
    function activeBook(bookId, generation) {
        const row = one('SELECT * FROM books WHERE id=?', id(bookId, 'bookId'));
        if (!row || row.deleted || row.generation !== generation) throw new StorageError('书籍已删除或已被重新导入', 409);
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
        if (row && row.book_id !== note.bookId) throw new StorageError('标注不能改变所属书籍', 409);
        expected(row, revision);
        run(`INSERT INTO annotations VALUES(?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, revision=excluded.revision, deleted=0`, note.id, note.bookId, JSON.stringify(note), revision + 1);
        return { revision: revision + 1 };
    }
    const store = {
        filename, root, db, transaction, one, all, run,
        books() { return all('SELECT * FROM books ORDER BY id').map(r => ({ id: r.id, revision: r.revision, generation: r.generation, deleted: !!r.deleted, value: r.deleted ? null : JSON.parse(r.payload) })); },
        notes(bookIds = []) {
            if (!Array.isArray(bookIds)) throw new StorageError('无效的书籍列表');
            bookIds.forEach(b => id(b));
            const rows = bookIds.length ? all(`SELECT * FROM annotations WHERE book_id IN (${bookIds.map(() => '?').join(',')}) ORDER BY id`, ...bookIds) : all('SELECT * FROM annotations ORDER BY id');
            return rows.map(r => ({ id: r.id, bookId: r.book_id, revision: r.revision, deleted: !!r.deleted, value: r.deleted ? null : JSON.parse(r.payload) }));
        },
        saveBook(c) { return mutate(c, () => putBook(c.book, c.expected)); },
        saveNote(c) { return mutate(c, () => putNote(c.note, c.expected, c.generation)); },
        deleteNote(c) {
            return mutate(c, () => {
                activeBook(c.bookId, c.generation); id(c.id);
                const row = one('SELECT * FROM annotations WHERE id=?', c.id); expected(row, c.expected);
                if (row && row.book_id !== c.bookId) throw new StorageError('标注不属于这本书', 409);
                run(`INSERT INTO annotations VALUES(?,?,NULL,?,1) ON CONFLICT(id) DO UPDATE SET payload=NULL, revision=excluded.revision, deleted=1`, c.id, c.bookId, c.expected + 1);
                return { revision: c.expected + 1 };
            });
        },
        deleteBook(c) {
            return mutate(c, () => {
                id(c.id); const row = one('SELECT * FROM books WHERE id=?', c.id); expected(row, c.expected);
                if (!row || row.deleted) return { revision: row?.revision || 0 };
                run('UPDATE annotations SET payload=NULL, deleted=1, revision=revision+1 WHERE book_id=?', c.id);
                run('UPDATE books SET payload=NULL, deleted=1, revision=revision+1 WHERE id=?', c.id);
                return { revision: row.revision + 1 };
            });
        },
        restore(c) {
            return mutate(c, () => {
                if (!Array.isArray(c.books) || !Array.isArray(c.notes)) throw new StorageError('备份必须包含书籍和标注数组');
                const bookIds = new Set(); const noteIds = new Set();
                for (const book of c.books) {
                    bookRecord(book); if (bookIds.has(book.id)) throw new StorageError('备份包含重复书籍 ID', 409); bookIds.add(book.id);
                    const row = one('SELECT * FROM books WHERE id=?', book.id);
                    putBook(book, row?.revision || 0);
                }
                for (const note of c.notes) {
                    noteRecord(note); if (noteIds.has(note.id)) throw new StorageError('备份包含重复标注 ID', 409); noteIds.add(note.id);
                    const book = one('SELECT * FROM books WHERE id=?', note.bookId);
                    if (!book || book.deleted) throw new StorageError('备份标注缺少关联书籍', 409);
                    const row = one('SELECT * FROM annotations WHERE id=?', note.id);
                    putNote(note, row?.revision || 0, book.generation);
                }
                return { books: c.books.length, notes: c.notes.length };
            });
        },
        check() {
            const integrity = all('PRAGMA integrity_check'); const foreignKeys = all('PRAGMA foreign_key_check');
            if (integrity.some(r => r.integrity_check !== 'ok') || foreignKeys.length) throw new StorageError('数据库完整性检查失败', 500);
            return { integrity: 'ok', foreignKeys: 0 };
        },
        close() { db.close(); }
    };
    return store;
}
module.exports = { createDataStore, StorageError, canonical, digest, bookRecord, noteRecord };
