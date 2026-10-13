/* ==========================================================================
   AnnotationRepository - Annotation Data Persistence (Infrastructure Layer)
   Zero UI dependencies. Manages IndexedDB "notes" store & LocalStorage backups.
   Guarantees strict isolation by bookId: no cross-book notes leakage.
   ========================================================================== */

import { getDB, getSeedNotes } from './bookRepository.js';
import { normalizeAnnotation } from '../domain/annotationEngine.js';

function normalizeList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => normalizeAnnotation(item)).filter(Boolean);
}

export function saveNoteToDB(noteObj) {
    if (!noteObj || !noteObj.id) return Promise.resolve();
    const db = getDB();
    if (!db) {
        syncNoteToLocalStorage(noteObj);
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const tx = db.transaction(["notes"], "readwrite");
        tx.objectStore("notes").put(noteObj);
        tx.oncomplete = () => {
            syncNoteToLocalStorage(noteObj);
            resolve();
        };
        tx.onerror = (e) => reject(e);
    });
}

export function deleteNoteFromDB(noteId, bookId = null) {
    if (!noteId) return Promise.resolve();
    const db = getDB();

    if (bookId) {
        removeNoteFromLocalStorage(bookId, noteId);
    }

    if (!db) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(["notes"], "readwrite");
        tx.objectStore("notes").delete(noteId);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
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
    });
}

export async function getNotesForBooks(bookIds = []) {
    const db = getDB();
    if (!db) {
        // Fallback to localStorage
        const allNotes = [];
        if (typeof localStorage !== 'undefined') {
            for (const bId of bookIds) {
                const raw = localStorage.getItem('aura_notes_' + bId);
                if (raw) {
                    try {
                        allNotes.push(...JSON.parse(raw));
                    } catch (e) {
                        // ignore
                    }
                } else if (bId === 'crisis-era') {
                    allNotes.push(...getSeedNotes());
                }
            }
        } else if (bookIds.includes('crisis-era')) {
            allNotes.push(...getSeedNotes());
        }
        return normalizeList(allNotes);
    }

    return new Promise((resolve, reject) => {
        const tx = db.transaction(["notes"], "readonly");
        const store = tx.objectStore("notes");
        const req = store.getAll();
        req.onsuccess = () => {
            let all = req.result || [];
            if (!bookIds || bookIds.length === 0) {
                resolve(all);
                return;
            }
            const idSet = new Set(bookIds);
            let filtered = all.filter(n => idSet.has(n.bookId));

            for (const bId of bookIds) {
                if (!filtered.some(n => n.bookId === bId)) {
                    const localNotes = loadNotesFromLocalStorage(bId);
                    if (localNotes && localNotes.length > 0) {
                        filtered.push(...localNotes);
                    } else if (bId === 'crisis-era') {
                        filtered.push(...getSeedNotes());
                    }
                }
            }

            resolve(normalizeList(filtered));
        };
        req.onerror = (e) => reject(e);
    });
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
    const raw = localStorage.getItem('aura_notes_' + bookId);
    if (!raw) return null;
    try {
        return normalizeList(JSON.parse(raw));
    } catch (e) {
        return null;
    }
}

export async function loadNotesForBook(bookId) {
    if (!bookId) return [];

    // 1. Try IndexedDB
    try {
        const dbNotes = await loadNotesFromDB(bookId);
        if (dbNotes && dbNotes.length > 0) {
            return dbNotes;
        }
    } catch (e) {
        console.warn("读取 IndexedDB 笔记异常:", e);
    }

    // 2. Try LocalStorage
    const localNotes = loadNotesFromLocalStorage(bookId);
    if (localNotes && localNotes.length > 0) {
        return localNotes;
    }

    // 3. Demo book fallback only for crisis-era
    if (bookId === 'crisis-era') {
        return normalizeList(getSeedNotes());
    }

    // 4. Clean empty list (Never leak previous book notes!)
    return [];
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
