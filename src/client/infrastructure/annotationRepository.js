/* ==========================================================================
   AnnotationRepository - Annotation Data Persistence (Infrastructure Layer)
   Zero UI dependencies. Manages IndexedDB "notes" store & LocalStorage backups.
   Guarantees strict isolation by bookId: no cross-book notes leakage.
   ========================================================================== */

import { getDB, getSeedNotes } from './bookRepository.js';
import { normalizeAnnotation } from '../domain/annotationEngine.js';
import { pendingNoteWrites, pendingNoteBookIds, recordNoteWrite, acknowledgeNoteWrite } from './annotationRecovery.js';

function normalizeList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => normalizeAnnotation(item)).filter(Boolean);
}

export function saveNoteToDB(noteObj, { syncLocal = true } = {}) {
    if (!noteObj || !noteObj.id) return Promise.resolve();
    const entry = recordNoteWrite({ id: noteObj.id, bookId: noteObj.bookId, operation: 'save', note: noteObj });
    if (syncLocal) syncNoteToLocalStorage(noteObj);
    return commitNoteWrite(entry);
}

export function deleteNoteFromDB(noteId, bookId = null, { syncLocal = true } = {}) {
    if (!noteId) return Promise.resolve();
    const entry = recordNoteWrite({ id: noteId, bookId, operation: 'delete' });

    if (bookId && syncLocal) {
        removeNoteFromLocalStorage(bookId, noteId);
    }

    return commitNoteWrite(entry);
}

function commitNoteWrite(entry) {
    const db = getDB();
    if (!db) {
        // With neither storage available, do not claim the input is safe.
        if (entry.durable === false) {
            const error = new Error('笔记存储暂时不可用');
            error.recoveryAvailable = false;
            return Promise.reject(error);
        }
        return Promise.resolve(); // Keep the journal for a later retry.
    }
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["notes"], "readwrite");
        const store = tx.objectStore("notes");
        if (entry.operation === 'delete') store.delete(entry.id);
        else store.put(entry.note);
        tx.oncomplete = () => { acknowledgeNoteWrite(entry); resolve(); };
        tx.onerror = event => reject(tx.error || event);
        tx.onabort = event => reject(tx.error || event);
    }).catch(cause => {
        const error = new Error('笔记数据库写入失败', { cause });
        error.recoveryAvailable = entry.durable !== false;
        throw error;
    });
}

export function loadNotesFromDB(bookId) {
    if (!bookId) return Promise.resolve([]);
    const db = getDB();
    if (!db) return Promise.resolve([]);

    return new Promise((resolve, reject) => {
        const tx = db.transaction(["notes"], "readonly");
        const index = tx.objectStore("notes").index("bookId");
        const req = index.getAll(bookId);
        req.onsuccess = () => resolve(normalizeList(req.result || []));
        req.onerror = (e) => reject(e);
        tx.onabort = (e) => reject(e);
    });
}

export async function getNotesForBooks(bookIds = []) {
    const db = getDB();
    let all = [];
    if (db) {
        try {
            all = await new Promise((resolve, reject) => {
                const tx = db.transaction(["notes"], "readonly");
                const req = tx.objectStore("notes").getAll();
                req.onsuccess = () => resolve(normalizeList(req.result || []));
                req.onerror = reject;
                tx.onabort = reject;
            });
        } catch (error) { console.warn('读取备份标注失败，尝试本机缓存', error); }
    }
    const ids = bookIds?.length ? [...new Set(bookIds)]
        : [...new Set([...all.map(note => note.bookId), ...pendingNoteBookIds()])];
    const books = await Promise.all(ids.map(id => recoverBookNotes(id, all.filter(note => note.bookId === id))));
    return books.flat();
}

export function persistNotesToLocalStorage(bookId, notes) {
    if (!bookId || !Array.isArray(notes) || typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem('aura_notes_' + bookId, JSON.stringify(notes));
    } catch (e) {
        console.warn("保存笔记至 LocalStorage 失败:", e);
    }
}

export function loadNotesFromLocalStorage(bookId) {
    if (!bookId || typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem('aura_notes_' + bookId);
        if (!raw) return null;
        const notes = JSON.parse(raw);
        return Array.isArray(notes) ? normalizeList(notes) : null;
    } catch (e) {
        return null;
    }
}

export async function loadNotesForBook(bookId) {
    if (!bookId) return [];
    let dbNotes = [];
    try {
        dbNotes = await loadNotesFromDB(bookId);
    } catch (e) {
        console.warn("读取 IndexedDB 笔记异常:", e);
    }

    return recoverBookNotes(bookId, dbNotes);
}

async function recoverBookNotes(bookId, dbNotes) {
    const localNotes = loadNotesFromLocalStorage(bookId);
    const base = dbNotes.length ? dbNotes : localNotes
        ?? (bookId === 'crisis-era' ? normalizeList(getSeedNotes()) : []);
    const pending = pendingNoteWrites(bookId);
    const recovered = overlayPending(base, pending);
    if (getDB() && pending.length) {
        // A failed retry leaves its durable entry intact. Do not require a
        // working database to reopen the latest user input or export a backup.
        await Promise.all(pending.map(async entry => {
            if (!pendingNoteWrites(bookId).some(item => item.id === entry.id && item.version === entry.version)) return;
            try { await commitNoteWrite(entry); }
            catch (error) { console.warn('补写笔记数据库失败，继续使用恢复内容', error); }
        }));
    }
    const latest = overlayPending(recovered, pendingNoteWrites(bookId));
    if (pending.length) persistNotesToLocalStorage(bookId, latest);
    return latest;
}

function overlayPending(notes, pending) {
    const byId = new Map(notes.map(note => [note.id, note]));
    for (const entry of pending) {
        if (entry.operation === 'delete') byId.delete(entry.id);
        else byId.set(entry.id, normalizeAnnotation(entry.note));
    }
    return [...byId.values()];
}

function syncNoteToLocalStorage(noteObj) {
    if (!noteObj || !noteObj.bookId) return;
    const existing = loadNotesFromLocalStorage(noteObj.bookId) || [];
    const idx = existing.findIndex(n => n.id === noteObj.id);
    if (idx !== -1) {
        existing[idx] = noteObj;
    } else {
        existing.unshift(noteObj);
    }
    persistNotesToLocalStorage(noteObj.bookId, existing);
}

function removeNoteFromLocalStorage(bookId, noteId) {
    const existing = loadNotesFromLocalStorage(bookId) || [];
    const filtered = existing.filter(n => n.id !== noteId);
    persistNotesToLocalStorage(bookId, filtered);
}
