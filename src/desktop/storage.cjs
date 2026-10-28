const fs = require('node:fs');
const path = require('node:path');
const { createDataStore, StorageError, bookRecord, noteRecord, goalRecord, goalBackupRecord, validateLibrary } = require('../server/dataStore.js');
const { createMigration } = require('../server/migration.js');
const { backupDatabase } = require('../server/storageMaintenance.js');

const MAX_JSON_BYTES = 256 * 1024 * 1024;
const DESKTOP_SOURCE = 'aurareader-desktop-v1';

/** @param {unknown} value */
function identifier(value) {
    if (typeof value !== 'string' || !value || value.length > 4096) throw new StorageError('无效标识');
    return value;
}
/** @param {Record<string, unknown>} row */
function writeVersion(row) {
    if (typeof row.expected !== 'number' || !Number.isSafeInteger(row.expected) || row.expected < 0) throw new StorageError('缺少有效保存版本');
    return { opId: identifier(row.opId), expected: row.expected };
}

/** @param {unknown} value @param {WeakSet<object>} [ancestors] */
function jsonValue(value, ancestors = new WeakSet()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (value && typeof value === 'object' && (Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
        if (ancestors.has(value)) throw new StorageError('请求包含循环引用，无法无损保存');
        ancestors.add(value);
        try {
            if (Array.isArray(value)) {
                if (Object.keys(value).length !== value.length) throw new StorageError('请求包含稀疏数组或数组附加字段');
                for (let index = 0; index < value.length; index++) {
                    if (!Object.hasOwn(value, index)) throw new StorageError('请求包含稀疏数组');
                    jsonValue(value[index], ancestors);
                }
            } else for (const item of Object.values(value)) jsonValue(item, ancestors);
        } finally { ancestors.delete(value); }
        return;
    }
    throw new StorageError('请求只能包含无损 JSON 数据');
}

/** @param {unknown} input @param {string[]} keys @param {number} [limit] */
function command(input, keys, limit = MAX_JSON_BYTES) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StorageError('无效请求对象');
    const row = /** @type {Record<string, unknown>} */ (input);
    if (Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key))) throw new StorageError('请求字段不匹配');
    try {
        jsonValue(row);
        if (Buffer.byteLength(JSON.stringify(row), 'utf8') > limit) throw new StorageError('数据超过单次 256MB 上限', 413);
    } catch (error) {
        if (error instanceof RangeError) throw new StorageError('JSON 数据嵌套过深，原数据未修改');
        throw error;
    }
    if ('opId' in row && (typeof row.opId !== 'string' || !row.opId || row.opId.length > 4096)) throw new StorageError('无效操作 ID');
    if ('expected' in row && (!Number.isSafeInteger(row.expected) || /** @type {number} */ (row.expected) < 0)) throw new StorageError('缺少有效保存版本');
    if ('generation' in row && (typeof row.generation !== 'string' || !row.generation || row.generation.length > 4096)) throw new StorageError('无效书籍代次');
    return row;
}

/** @param {string} directory */
function createDesktopStorage(directory) {
    /** @type {ReturnType<typeof createDataStore> | null} */
    let store = null;
    /** @type {Promise<{initialized: boolean}> | null} */
    let creating = null;
    /** @type {Set<Promise<unknown>>} */
    const active = new Set();
    let closed = false;
    function openExisting() {
        if (closed) throw new StorageError('书库已关闭', 503);
        if (store) return store;
        const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
        if (!files.length) return null;
        // Never call createDataStore on an unknown directory or a missing library.
        if (!files.includes('storage-installed.json')) throw new StorageError('发现未识别的数据目录，请保留原文件并通过迁移或恢复处理', 409);
        store = createDataStore(directory); // Retains missing/empty DB and schema-version guards.
        return store;
    }
    function status() {
        const current = openExisting();
        if (!current) return { initialized: false };
        if (createMigration(current).status(DESKTOP_SOURCE).completed) return { initialized: true };
        if (current.all('SELECT 1 FROM books LIMIT 1').length || current.all('SELECT 1 FROM operations LIMIT 1').length
            || current.all('SELECT 1 FROM migrations LIMIT 1').length) {
            throw new StorageError('此目录不是当前桌面书库，请保留原文件；不支持旧数据库', 409);
        }
        return { initialized: false }; // Interrupted empty initialization may be resumed explicitly.
    }
    function readyStore() {
        if (!status().initialized || !store) throw new StorageError('请先明确创建独立桌面书库；原浏览器数据尚未迁移', 423);
        return store;
    }
    async function initialize() {
        if (status().initialized) return { initialized: true };
        if (creating) return creating;
        creating = (async () => {
            if (closed) throw new StorageError('书库已关闭', 503);
            store = store || createDataStore(directory);
            const migration = createMigration(store);
            const snapshot = migration.snapshot(DESKTOP_SOURCE, {
                origin: 'aurareader://app', indexedDB: { books: [], notes: [] }, caches: {}, pending: {},
                builtins: { books: [], notes: [] }
            });
            migration.commit(DESKTOP_SOURCE, snapshot.snapshotId);
            return { initialized: true };
        })();
        try { return await creating; } finally { creating = null; }
    }
    return {
        /** @param {string} action @param {unknown} [body] */
        async call(action, body) {
            // This dispatcher is main-process-only; no renderer-controlled action channel is registered.
            const operation = (async () => {
                if (['status', 'createLibrary', 'listBooks', 'backup', 'queryGoalLibrary'].includes(action) && body !== undefined) throw new StorageError('请求不接受参数');
                if (action === 'status') return status();
                if (action === 'createLibrary') return initialize();
                const current = readyStore();
                switch (action) {
                    case 'listBooks': return { records: current.books() };
                    case 'saveBook': {
                        const c = command(body, ['opId', 'expected', 'book']);
                        return current.saveBook({ ...writeVersion(c), book: bookRecord(c.book) });
                    }
                    case 'deleteBook': {
                        const c = command(body, ['opId', 'expected', 'id']);
                        return current.deleteBook({ ...writeVersion(c), id: identifier(c.id) });
                    }
                    case 'queryGoals': {
                        const c = command(body, ['bookIds']);
                        if (!Array.isArray(c.bookIds)) throw new StorageError('无效书籍列表');
                        return { records: current.goals(c.bookIds.map(identifier)) };
                    }
                    case 'queryGoalLibrary': return current.goalLibrary();
                    case 'saveGoalLibrary': {
                        const c = command(body, ['opId', 'expected', 'state']);
                        return current.saveGoalLibrary({ ...writeVersion(c), state: validateLibrary(c.state) });
                    }
                    case 'saveGoals': {
                        const c = command(body, ['opId', 'expected', 'generation', 'state']);
                        return current.saveGoals({ ...writeVersion(c), generation: identifier(c.generation), state: goalRecord(c.state) });
                    }
                    case 'queryNotes': {
                        const query = command(body, ['bookIds']);
                        if (!Array.isArray(query.bookIds)) throw new StorageError('无效书籍列表');
                        return { records: current.notes(query.bookIds.map(identifier)) };
                    }
                    case 'saveNote': {
                        const c = command(body, ['opId', 'expected', 'generation', 'note']);
                        return current.saveNote({ ...writeVersion(c), generation: identifier(c.generation), note: noteRecord(c.note) });
                    }
                    case 'deleteNote': {
                        const c = command(body, ['opId', 'expected', 'generation', 'id', 'bookId']);
                        return current.deleteNote({ ...writeVersion(c), generation: identifier(c.generation), id: identifier(c.id), bookId: identifier(c.bookId) });
                    }
                    case 'restore': {
                        const withGoals = !!body && Object.hasOwn(body, 'goalStates');
                        const withGraph = !!body && Object.hasOwn(body, 'goalGraph');
                        const c = command(body, ['opId', 'books', 'notes', ...(withGoals ? ['goalStates'] : []), ...(withGraph ? ['goalGraph'] : [])]);
                        if (!Array.isArray(c.books) || !Array.isArray(c.notes)) throw new StorageError('备份必须包含书籍和标注数组');
                        if (withGoals && !Array.isArray(c.goalStates)) throw new StorageError('无效 Goal 备份');
                        return current.restore({ opId: identifier(c.opId), books: c.books.map(bookRecord), notes: c.notes.map(noteRecord), ...(withGoals ? { goalStates: /** @type {unknown[]} */ (c.goalStates).map(goalBackupRecord) } : {}), ...(withGraph ? { goalGraph: /** @type {import('../client/domain/goal.js').GoalGraphBackup} */ (c.goalGraph) } : {}) });
                    }
                    case 'backup': {
                        const result = await backupDatabase(directory);
                        return { name: path.basename(result.filename), integrity: result.integrity, books: result.books, notes: result.notes };
                    }
                    default: throw new StorageError('未知存储能力', 404);
                }
            })();
            active.add(operation);
            try { return await operation; } finally { active.delete(operation); }
        },
        async settle() { await Promise.all([...active]); },
        close() { closed = true; store?.close(); store = null; }
    };
}

module.exports = { createDesktopStorage, command, MAX_JSON_BYTES };
