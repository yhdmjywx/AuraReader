// One-time read-only import bridge. No normal application operation uses IDB.
import { storageRequest } from './storageClient.js';
import { demoBooks, getSeedNotes } from './demoData.js';

function cacheSnapshot() {
    const caches = Object.create(null); const pending = Object.create(null);
    if (typeof localStorage === 'undefined') return { caches, pending };
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('aura_notes_pending_')) pending[key.slice(19)] = localStorage.getItem(key);
        else if (key?.startsWith('aura_notes_')) caches[key.slice(11)] = localStorage.getItem(key);
    }
    return { caches, pending };
}
export async function readLegacyDatabase(factory = typeof window === 'undefined' ? null : window.indexedDB) {
    if (!factory) {
        if (typeof window !== 'undefined') throw new Error('无法检查旧 IndexedDB；为避免遗漏数据，迁移已停止');
        return { books: [], notes: [] };
    }
    if (typeof factory.databases === 'function') {
        const databases = await factory.databases();
        if (!databases.some(db => db.name === 'AuraReaderDB')) return { books: [], notes: [] };
    }
    const db = await new Promise((resolve, reject) => {
        const request = factory.open('AuraReaderDB');
        let missing = false;
        request.onupgradeneeded = () => { missing = true; request.transaction.abort(); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => missing ? resolve(null) : reject(request.error || new Error('旧数据库无法读取'));
        request.onblocked = () => reject(new Error('请关闭其他 AuraReader 标签页后重新迁移'));
    });
    if (!db) return { books: [], notes: [] };
    try {
        const names = ['books', 'notes'].filter(name => db.objectStoreNames.contains(name));
        if (!names.length) return { books: [], notes: [] };
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(names, 'readonly');
            const value = { books: [], notes: [] };
            names.forEach(name => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => { value[name] = request.result; }; });
            tx.oncomplete = () => resolve(value);
            tx.onerror = tx.onabort = () => reject(tx.error || new Error('旧数据库快照读取失败'));
        });
    } finally { db.close(); }
}
function jsonSafe(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) { value.forEach(jsonSafe); return; }
    if (value && [Object.prototype, null].includes(Object.getPrototypeOf(value))) { Object.values(value).forEach(jsonSafe); return; }
    throw new Error('旧数据含有无法无损转为 JSON 的字段，迁移已停止；IndexedDB 原始数据仍保留');
}
export async function migrateLegacyStorage() {
    const status = await storageRequest('migration/status');
    if (status.completed) { await cleanupLegacyBuffers(status.manifest); return status; }
    const capture = async () => {
        const indexedDB = await readLegacyDatabase(), buffers = cacheSnapshot();
        const hasLegacyData = indexedDB.books.length || indexedDB.notes.length || Object.keys(buffers.caches).length || Object.keys(buffers.pending).length;
        return {
            origin: typeof location === 'undefined' ? '' : location.origin, indexedDB, ...buffers,
            builtins: hasLegacyData ? { books: Object.entries(demoBooks).map(([id, b]) => ({ id, ...b })), notes: getSeedNotes() } : { books: [], notes: [] }
        };
    };
    const perform = async () => {
        const snapshot = await capture(); jsonSafe(snapshot);
        const archived = await storageRequest('migration/snapshot', snapshot);
        if (JSON.stringify(snapshot) !== JSON.stringify(await capture())) throw new Error('旧书库在迁移中发生变化，请关闭其他标签页后重试；原始快照已保留');
        const result = await storageRequest('migration/commit', archived);
        await cleanupLegacyBuffers(result.manifest);
        return result;
    };
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('aurareader-sqlite-migration', perform);
    return perform();
}

async function cleanupLegacyBuffers(manifest) {
    // Restart-safe cleanup: only remove the exact bytes included in the
    // verified snapshot, never a newly entered note's pending operation.
    try {
        for (const [kind, prefix] of [['caches', 'aura_notes_'], ['pending', 'aura_notes_pending_']]) {
            for (const [bookId, hash] of Object.entries(manifest?.cleanup?.[kind] || {})) {
                const raw = localStorage.getItem(prefix + bookId);
                if (raw == null) continue;
                const bytes = new TextEncoder().encode(JSON.stringify(raw));
                const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
                if (hash === actual && localStorage.getItem(prefix + bookId) === raw) localStorage.removeItem(prefix + bookId);
            }
        }
    } catch (_) { /* No old cache is read as a SQLite primary data source. */ }
}
