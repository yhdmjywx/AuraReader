import type { Book } from '../domain/book.js';
import type { BookRecord, BookRevision, MigrationStatus, NoteRecord, Revision, StorageRoutes, StoredAnnotation } from '../../shared/storage.js';
import { StorageClientError } from './storageError.js';
// The browser remains asynchronous; SQLite is owned exclusively by Node.js.
let base = '/api/storage';
let transport: typeof fetch = (...args) => fetch(...args);
let token: string | null = null;
let source: string | null = null;
let ready: Promise<MigrationStatus> | null = null;
const bookVersions = new Map<string, BookRevision & { deleted: boolean }>();
const noteVersions = new Map<string, Revision & { bookId: string; deleted: boolean }>();
const queues = new Map<string, Promise<unknown>>();
export const operationId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export function configureStorage({ baseUrl = '/api/storage', fetch: fetcher = (...args) => fetch(...args), sourceId = null }: { baseUrl?: string; fetch?: typeof fetch; sourceId?: string | null } = {}) {
    base = baseUrl; transport = fetcher; token = null; source = sourceId; ready = null;
    bookVersions.clear(); noteVersions.clear(); queues.clear();
}
function sourceId(): string {
    if (source) return source;
    try {
        source = localStorage.getItem('aura_sqlite_source');
        if (!source) { source = operationId(); localStorage.setItem('aura_sqlite_source', source); }
    } catch (_) { throw new Error('无法读取迁移标识，请恢复浏览器本地存储权限；旧数据未清除'); }
    return source!;
}
async function session() {
    const response = await transport(base + '/session', { signal: globalThis.AbortSignal?.timeout?.(15000) });
    if (!response.ok) throw new Error('本地数据库服务不可用');
    token = (await response.json()).token;
}
export async function storageRequest<R extends keyof StorageRoutes>(route: R, body: StorageRoutes[R]['request'], retried = false): Promise<StorageRoutes[R]['response']> {
    if (!token) await session();
    let response;
    try {
        response = await transport(base + '/' + route, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Aura-Token': token!, 'X-Aura-Source': sourceId() },
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
        const error = new StorageClientError(result.error || '数据库请求失败');
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
    const { records } = await storageRequest('books', undefined);
    records.forEach(row => { if ((bookVersions.get(row.id)?.revision || 0) <= row.revision) bookVersions.set(row.id, row); });
    return records;
}
export async function readNotes(bookIds: string[] = []) {
    await initializeStorage();
    const { records } = await storageRequest('notes/query', { bookIds });
    records.forEach(row => { if ((noteVersions.get(row.id)?.revision || 0) <= row.revision) noteVersions.set(row.id, row); });
    return records;
}
export function enqueue<T>(bookId: string, task: () => T | PromiseLike<T>): Promise<T> {
    const previous = queues.get(bookId) || Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    queues.set(bookId, next);
    next.finally(() => { if (queues.get(bookId) === next) queues.delete(bookId); }).catch(() => {});
    return next;
}
export async function drainStorage() { await Promise.all([...queues.values()]); }
export async function bookVersion(id: string): Promise<BookRevision> {
    if (!bookVersions.has(id)) await readBooks();
    return bookVersions.get(id) || { revision: 0 };
}
export async function noteVersion(id: string, bookId: string): Promise<Revision> {
    if (!noteVersions.has(id)) await readNotes([bookId]);
    return noteVersions.get(id) || { revision: 0 };
}
export function acceptBook(id: string, result: BookRevision, deleted = false) {
    const prior = bookVersions.get(id) || {};
    bookVersions.set(id, { ...prior, ...result, deleted });
    if (deleted) for (const [key, row] of noteVersions) if (row.bookId === id) noteVersions.delete(key);
}
export function acceptNote(id: string, bookId: string, result: Revision, deleted = false) { noteVersions.set(id, { ...result, bookId, deleted }); }
export async function restoreRecords(books: Book[], notes: StoredAnnotation[], opId = operationId()) {
    await initializeStorage(); await drainStorage();
    const result = await storageRequest('restore', { opId, books, notes });
    await readBooks(); await readNotes();
    return result;
}
