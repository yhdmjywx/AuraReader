// The browser remains asynchronous; SQLite is owned exclusively by Node.js.
let base = '/api/storage';
let transport = (...args) => fetch(...args);
let token = null;
let source = null;
let ready = null;
const bookVersions = new Map();
const noteVersions = new Map();
const queues = new Map();
export const operationId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export function configureStorage({ baseUrl = '/api/storage', fetch: fetcher = (...args) => fetch(...args), sourceId = null } = {}) {
    base = baseUrl; transport = fetcher; token = null; source = sourceId; ready = null;
    bookVersions.clear(); noteVersions.clear(); queues.clear();
}
function sourceId() {
    if (source) return source;
    try {
        source = localStorage.getItem('aura_sqlite_source');
        if (!source) { source = operationId(); localStorage.setItem('aura_sqlite_source', source); }
    } catch (_) { throw new Error('无法读取迁移标识，请恢复浏览器本地存储权限；旧数据未清除'); }
    return source;
}
async function session() {
    const response = await transport(base + '/session', { signal: globalThis.AbortSignal?.timeout?.(15000) });
    if (!response.ok) throw new Error('本地数据库服务不可用');
    token = (await response.json()).token;
}
export async function storageRequest(route, body, retried = false) {
    if (!token) await session();
    let response;
    try {
        response = await transport(base + '/' + route, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Aura-Token': token, 'X-Aura-Source': sourceId() },
            signal: globalThis.AbortSignal?.timeout?.(15000),
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    } catch (error) {
        if (!retried) return storageRequest(route, body, true);
        throw error;
    }
    if (response.status === 403 && !retried) { token = null; return storageRequest(route, body, true); }
    let result;
    try { result = await response.json(); }
    catch (error) {
        if (!retried) return storageRequest(route, body, true);
        throw error;
    }
    if (!response.ok) {
        const error = new Error(result.error || '数据库请求失败');
        error.status = response.status; error.details = result.details;
        throw error;
    }
    return result;
}
export function initializeStorage() {
    if (!ready) ready = import('./legacyMigration.js').then(module => module.migrateLegacyStorage());
    return ready;
}
export async function readBooks() {
    await initializeStorage();
    const { records } = await storageRequest('books');
    records.forEach(row => { if ((bookVersions.get(row.id)?.revision || 0) <= row.revision) bookVersions.set(row.id, row); });
    return records;
}
export async function readNotes(bookIds = []) {
    await initializeStorage();
    const { records } = await storageRequest('notes/query', { bookIds });
    records.forEach(row => { if ((noteVersions.get(row.id)?.revision || 0) <= row.revision) noteVersions.set(row.id, row); });
    return records;
}
export function enqueue(bookId, task) {
    const previous = queues.get(bookId) || Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    queues.set(bookId, next);
    next.finally(() => { if (queues.get(bookId) === next) queues.delete(bookId); }).catch(() => {});
    return next;
}
export async function drainStorage() { await Promise.all([...queues.values()]); }
export async function bookVersion(id) {
    if (!bookVersions.has(id)) await readBooks();
    return bookVersions.get(id) || { revision: 0 };
}
export async function noteVersion(id, bookId) {
    if (!noteVersions.has(id)) await readNotes([bookId]);
    return noteVersions.get(id) || { revision: 0 };
}
export function acceptBook(id, result, deleted = false) {
    const prior = bookVersions.get(id) || {};
    bookVersions.set(id, { ...prior, ...result, deleted });
    if (deleted) for (const [key, row] of noteVersions) if (row.bookId === id) noteVersions.delete(key);
}
export function acceptNote(id, bookId, result, deleted = false) { noteVersions.set(id, { ...result, bookId, deleted }); }
export async function restoreRecords(books, notes, opId = operationId()) {
    await initializeStorage(); await drainStorage();
    const result = await storageRequest('restore', { opId, books, notes });
    await readBooks(); await readNotes();
    return result;
}
