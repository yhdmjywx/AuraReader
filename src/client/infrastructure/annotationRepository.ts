import type { Annotation, AnnotationInput } from '../domain/annotation.js';
import type { StoredAnnotation } from '../../shared/storage.js';
import type { NoteCommand, PendingNoteWrite } from './annotationRecovery.js';
import { StorageClientError, errorMessage } from './storageError.js';
import { normalizeAnnotation } from '../domain/annotationEngine.js';
import { pendingNoteWrites, pendingNoteBookIds, recordNoteWrite, acknowledgeNoteWrite, attachNoteCommand } from './annotationRecovery.js';
import { initializeStorage, readNotes, enqueue, bookVersion, noteVersion, acceptNote, storageRequest } from './storageClient.js';

const normalize = (notes: (AnnotationInput | null)[]): Annotation[] => notes.map(normalizeAnnotation).filter((note): note is Annotation => note !== null);
const commands = new Map<string, NoteCommand>();
export function saveNoteToDB(note: StoredAnnotation) {
    if (!note?.id) return Promise.resolve();
    return submit(recordNoteWrite({ id: note.id, bookId: note.bookId, operation: 'save', note }));
}
export function deleteNoteFromDB(id: string, bookId: string) {
    if (!id) return Promise.resolve();
    return submit(recordNoteWrite({ id, bookId, operation: 'delete' }));
}
function submit(entry: PendingNoteWrite, retry = false) {
    return enqueue(entry.bookId, async () => {
        try {
            await initializeStorage();
            const latest = pendingNoteWrites(entry.bookId).find(item => item.id === entry.id);
            if (retry && latest?.version !== entry.version) return;
            for (const prior of latest?.prerequisites || entry.prerequisites || []) {
                if (prior.version === entry.version) continue;
                const result = await sendNoteCommand(prior.command);
                acceptNote(entry.id, entry.bookId, result, prior.operation === 'delete');
                acknowledgeNoteWrite({ ...entry, version: prior.version });
                commands.delete(prior.version);
            }
            let command = entry.command || commands.get(entry.version);
            if (!command) {
                const book = await bookVersion(entry.bookId);
                const note = await noteVersion(entry.id, entry.bookId);
                if (!book.generation) throw new Error('书籍已删除或不存在');
                const version = { opId: entry.version, expected: note.revision, generation: book.generation };
                command = entry.operation === 'save' ? { ...version, note: entry.note }
                    : { ...version, id: entry.id, bookId: entry.bookId };
                commands.set(entry.version, command);
            }
            entry = attachNoteCommand(entry, command);
            const result = await sendNoteCommand(command);
            acceptNote(entry.id, entry.bookId, result, entry.operation === 'delete');
            acknowledgeNoteWrite(entry); commands.delete(entry.version);
        } catch (cause) {
            const error = new StorageClientError(errorMessage(cause, '笔记保存失败'), { cause });
            error.status = cause instanceof StorageClientError ? cause.status : undefined; error.recoveryAvailable = entry.durable !== false;
            throw error;
        }
    });
}
export async function loadNotesFromDB(bookId: string): Promise<Annotation[]> {
    if (!bookId) return [];
    return normalize((await readNotes([bookId])).flatMap(row => row.deleted ? [] : [row.value]));
}
export async function loadNotesForBook(bookId: string): Promise<Annotation[]> {
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
function overlay(notes: Annotation[], pending: PendingNoteWrite[]): Annotation[] {
    const byId = new Map(notes.map(note => [note.id, note]));
    for (const entry of pending) {
        if (entry.operation === 'delete') byId.delete(entry.id);
        else { const note = normalizeAnnotation(entry.note); if (note) byId.set(entry.id, note); }
    }
    return [...byId.values()];
}
export async function getNotesForBooks(bookIds: string[] = []): Promise<Annotation[]> {
    if (bookIds?.length) return (await Promise.all([...new Set(bookIds)].map(loadNotesForBook))).flat();
    const all = (await readNotes()).filter(row => !row.deleted).map(row => row.value);
    const ids = [...new Set([...all.map(n => n.bookId), ...pendingNoteBookIds()])];
    return (await Promise.all(ids.map(loadNotesForBook))).flat();
}

function sendNoteCommand(command: NoteCommand) {
    return 'note' in command ? storageRequest('notes/save', command) : storageRequest('notes/delete', command);
}
