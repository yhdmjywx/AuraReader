import { normalizeAnnotation } from '../domain/annotationEngine.js';
import { pendingNoteWrites, pendingNoteBookIds, recordNoteWrite, acknowledgeNoteWrite, attachNoteCommand } from './annotationRecovery.js';
import { initializeStorage, readNotes, enqueue, bookVersion, noteVersion, acceptNote, storageRequest } from './storageClient.js';

const normalize = notes => notes.map(normalizeAnnotation).filter(Boolean);
const commands = new Map();
export function saveNoteToDB(note) {
    if (!note?.id) return Promise.resolve();
    return submit(recordNoteWrite({ id: note.id, bookId: note.bookId, operation: 'save', note }));
}
export function deleteNoteFromDB(id, bookId) {
    if (!id) return Promise.resolve();
    return submit(recordNoteWrite({ id, bookId, operation: 'delete' }));
}
function submit(entry, retry = false) {
    return enqueue(entry.bookId, async () => {
        try {
            await initializeStorage();
            const latest = pendingNoteWrites(entry.bookId).find(item => item.id === entry.id);
            if (retry && latest?.version !== entry.version) return;
            for (const prior of latest?.prerequisites || entry.prerequisites || []) {
                if (prior.version === entry.version) continue;
                const result = await storageRequest(prior.operation === 'save' ? 'notes/save' : 'notes/delete', prior.command);
                acceptNote(entry.id, entry.bookId, result, prior.operation === 'delete');
                acknowledgeNoteWrite({ ...entry, version: prior.version });
                commands.delete(prior.version);
            }
            let command = entry.command || commands.get(entry.version);
            if (!command) {
                const book = await bookVersion(entry.bookId);
                const note = await noteVersion(entry.id, entry.bookId);
                command = { opId: entry.version, expected: note.revision, generation: book.generation };
                if (entry.operation === 'save') command.note = entry.note;
                else Object.assign(command, { id: entry.id, bookId: entry.bookId });
                commands.set(entry.version, command);
            }
            entry = attachNoteCommand(entry, command);
            const result = await storageRequest(entry.operation === 'save' ? 'notes/save' : 'notes/delete', command);
            acceptNote(entry.id, entry.bookId, result, entry.operation === 'delete');
            acknowledgeNoteWrite(entry); commands.delete(entry.version);
        } catch (cause) {
            const error = new Error(cause.message || '笔记保存失败', { cause });
            error.status = cause.status; error.recoveryAvailable = entry.durable !== false;
            throw error;
        }
    });
}
export async function loadNotesFromDB(bookId) {
    if (!bookId) return [];
    return normalize((await readNotes([bookId])).filter(row => !row.deleted).map(row => row.value));
}
export async function loadNotesForBook(bookId) {
    if (!bookId) return [];
    let notes = await loadNotesFromDB(bookId);
    const pending = pendingNoteWrites(bookId);
    for (const entry of pending) {
        try { await submit(entry, true); }
        catch (error) { console.warn('笔记补写失败，保留本机恢复内容', error); }
    }
    if (pending.length) notes = await loadNotesFromDB(bookId);
    return overlay(notes, pendingNoteWrites(bookId));
}
function overlay(notes, pending) {
    const byId = new Map(notes.map(note => [note.id, note]));
    for (const entry of pending) {
        if (entry.operation === 'delete') byId.delete(entry.id);
        else byId.set(entry.id, normalizeAnnotation(entry.note));
    }
    return [...byId.values()];
}
export async function getNotesForBooks(bookIds = []) {
    if (bookIds?.length) return (await Promise.all([...new Set(bookIds)].map(loadNotesForBook))).flat();
    const all = (await readNotes()).filter(row => !row.deleted).map(row => row.value);
    const ids = [...new Set([...all.map(n => n.bookId), ...pendingNoteBookIds()])];
    return (await Promise.all(ids.map(loadNotesForBook))).flat();
}
