import type { DeleteNoteCommand, SaveNoteCommand, StoredAnnotation } from '../../shared/storage.js';
export type NoteCommand = SaveNoteCommand | DeleteNoteCommand;
export type NoteWriteInput = { id: string; bookId: string } & (
    { operation: 'save'; note: StoredAnnotation } | { operation: 'delete' }
);
export type PendingNoteWrite = NoteWriteInput & {
    version: string; durable?: boolean; command?: NoteCommand;
    prerequisites?: { version: string; operation: 'save' | 'delete'; command: NoteCommand }[];
};
// A small durable journal distinguishes uncommitted edits from ordinary caches.
// Entries are removed only after SQLite acknowledges the matching operation.
const PREFIX = 'aura_notes_pending_';

export function pendingNoteWrites(bookId: string): PendingNoteWrite[] {
    try {
        const entries: unknown = JSON.parse(localStorage.getItem(PREFIX + bookId) || '[]');
        if (!Array.isArray(entries)) return [];
        return entries.filter((entry: unknown): entry is PendingNoteWrite => {
            if (!entry || typeof entry !== 'object') return false;
            const row = entry as Record<string, unknown>;
            if (row.bookId !== bookId || typeof row.id !== 'string' || typeof row.version !== 'string') return false;
            if (row.operation === 'delete') return true;
            if (row.operation !== 'save' || !row.note || typeof row.note !== 'object') return false;
            const note = row.note as Record<string, unknown>;
            return note.id === row.id && note.bookId === bookId;
        });
    } catch (_) { return []; }
}

function storePending(bookId: string, entries: PendingNoteWrite[]) {
    if (!bookId) return false;
    try {
        const key = PREFIX + bookId;
        if (entries.length) localStorage.setItem(key, JSON.stringify(entries));
        else if (typeof localStorage.removeItem === 'function') localStorage.removeItem(key);
        else localStorage.setItem(key, '[]');
        return true;
    } catch (_) { return false; }
}

export function recordNoteWrite(input: NoteWriteInput): PendingNoteWrite {
    const { id, bookId } = input;
    const entry: PendingNoteWrite = {
        ...input,
        version: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    };
    if (input.operation === 'save' && entry.operation === 'save') entry.note = JSON.parse(JSON.stringify(input.note));
    const current = pendingNoteWrites(bookId);
    const previous = current.find(item => item.id === id);
    entry.prerequisites = [...(previous?.prerequisites || [])];
    if (previous?.command) entry.prerequisites.push({ version: previous.version, operation: previous.operation, command: previous.command });
    const entries = current.filter(item => item.id !== id);
    return { ...entry, durable: storePending(bookId, [...entries, entry]) };
}

export function attachNoteCommand(entry: PendingNoteWrite, command: NoteCommand): PendingNoteWrite {
    const entries = pendingNoteWrites(entry.bookId);
    const current = entries.find(item => item.id === entry.id);
    if (!current) return { ...entry, command, durable: false };
    if (current.version === entry.version) current.command = command;
    else if (!(current.prerequisites || []).some(item => item.version === entry.version)) {
        current.prerequisites = [...(current.prerequisites || []), { version: entry.version, operation: entry.operation, command }];
    }
    return { ...entry, command, durable: storePending(entry.bookId, entries) };
}

export function acknowledgeNoteWrite(entry: Pick<PendingNoteWrite, 'bookId' | 'id' | 'version'>) {
    const entries = pendingNoteWrites(entry.bookId);
    const remaining = entries.filter(item => item.id !== entry.id || item.version !== entry.version);
    remaining.forEach(item => { item.prerequisites = (item.prerequisites || []).filter(prior => prior.version !== entry.version); });
    storePending(entry.bookId, remaining);
}

export function pendingNoteBookIds() {
    const ids: string[] = [];
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length));
        }
    } catch (_) { /* SQLite can still work when the recovery buffer is unavailable. */ }
    return ids;
}

export function clearStoredBookNotes(bookId: string) {
    try {
        localStorage.removeItem('aura_notes_' + bookId);
        localStorage.removeItem(PREFIX + bookId);
    } catch (_) { /* Database deletion does not depend on cache availability. */ }
}
