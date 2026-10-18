// One-time read-only import bridge. No normal application operation uses IDB.
import { storageRequest } from './storageClient.js';
import { demoBooks, getSeedNotes } from './demoData.js';

function cacheSnapshot() {
    const caches = {}; const pending = {};
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
    if (value && Object.getPrototypeOf(value) === Object.prototype) { Object.values(value).forEach(jsonSafe); return; }
    throw new Error('旧数据含有无法无损转为 JSON 的字段，迁移已停止；IndexedDB 原始数据仍保留');
}
export async function migrateLegacyStorage() {
    const status = await storageRequest('migration/status');
    if (status.completed) return status;
    const capture = async () => ({
        origin: typeof location === 'undefined' ? '' : location.origin,
        indexedDB: await readLegacyDatabase(), ...cacheSnapshot(),
        builtins: { books: Object.entries(demoBooks).map(([id, b]) => ({ id, ...b })), notes: getSeedNotes() }
    });
    const perform = async () => {
        const snapshot = await capture(); jsonSafe(snapshot);
        const archived = await storageRequest('migration/snapshot', snapshot);
        if (JSON.stringify(snapshot) !== JSON.stringify(await capture())) throw new Error('旧书库在迁移中发生变化，请关闭其他标签页后重试；原始快照已保留');
        const result = await storageRequest('migration/commit', archived);
        try {
            for (const [bookId, raw] of Object.entries(snapshot.caches)) if (localStorage.getItem('aura_notes_' + bookId) === raw) localStorage.removeItem('aura_notes_' + bookId);
            for (const [bookId, raw] of Object.entries(snapshot.pending)) if (localStorage.getItem('aura_notes_pending_' + bookId) === raw) localStorage.removeItem('aura_notes_pending_' + bookId);
        } catch (_) { /* SQLite and original snapshots already contain these records. */ }
        return result;
    };
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('aurareader-sqlite-migration', perform);
    return perform();
}
