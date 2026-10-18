// A small durable journal distinguishes uncommitted edits from ordinary caches.
// Entries are removed only when the matching IndexedDB transaction completes.
const PREFIX = 'aura_notes_pending_';

export function pendingNoteWrites(bookId) {
    try {
        const entries = JSON.parse(localStorage.getItem(PREFIX + bookId) || '[]');
        if (!Array.isArray(entries)) return [];
        return entries.filter(entry => entry && entry.bookId === bookId && typeof entry.id === 'string'
            && typeof entry.version === 'string' && (entry.operation === 'delete'
                || (entry.operation === 'save' && entry.note?.id === entry.id && entry.note.bookId === bookId)));
    } catch (_) { return []; }
}

function storePending(bookId, entries) {
    if (!bookId) return false;
    try {
        const key = PREFIX + bookId;
        if (entries.length) localStorage.setItem(key, JSON.stringify(entries));
        else if (typeof localStorage.removeItem === 'function') localStorage.removeItem(key);
        else localStorage.setItem(key, '[]');
        return true;
    } catch (_) { return false; }
}

export function recordNoteWrite({ id, bookId, operation, note }) {
    const entry = {
        id, bookId, operation,
        version: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    };
    if (note) entry.note = JSON.parse(JSON.stringify(note));
    const entries = pendingNoteWrites(bookId).filter(item => item.id !== id);
    return { ...entry, durable: storePending(bookId, [...entries, entry]) };
}

export function acknowledgeNoteWrite(entry) {
    const entries = pendingNoteWrites(entry.bookId);
    if (!entries.some(item => item.id === entry.id && item.version === entry.version)) return;
    storePending(entry.bookId, entries.filter(item => item.id !== entry.id));
}

export function pendingNoteBookIds() {
    const ids = [];
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length));
        }
    } catch (_) { /* Storage may be unavailable. IndexedDB can still work. */ }
    return ids;
}

export function clearStoredBookNotes(bookId) {
    try {
        localStorage.removeItem('aura_notes_' + bookId);
        localStorage.removeItem(PREFIX + bookId);
    } catch (_) { /* Database deletion does not depend on cache availability. */ }
}
