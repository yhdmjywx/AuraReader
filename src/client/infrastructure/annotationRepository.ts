import type { Annotation, AnnotationInput } from '../domain/annotation.js';
import type { StoredAnnotation, NoteRecord } from '../../shared/storage.js';
import type { NoteCommand, PendingNoteWrite, NoteEditBaseline } from './annotationRecovery.js';
import { StorageClientError, errorMessage } from './storageError.js';
import { normalizeAnnotation } from '../domain/annotationEngine.js';
import { pendingNoteWrites, pendingNoteBookIds, advanceNoteBaseline, recordNoteWrite, acknowledgeNoteWrite, attachNoteCommand } from './annotationRecovery.js';
import { initializeStorage, readNotes, enqueue, bookVersion, noteVersion, acceptNote, storageRequest } from './storageClient.js';

const commands = new Map<string, NoteCommand>();
const displayedBaselines = new WeakMap<AnnotationInput, { expected: number; generation: string }>();
export const displayedNoteBaseline = (note: AnnotationInput) => displayedBaselines.get(note);
export function displayedNote(record: NoteRecord, generation?: string) {
    const note = record.deleted ? null : normalizeAnnotation(record.value);
    if (note && generation) displayedBaselines.set(note, { expected: record.revision, generation });
    return note;
}
export function saveNoteToDB(note: StoredAnnotation, baseline?: NoteEditBaseline) {
    if (!note?.id) return Promise.resolve();
    return submit(recordNoteWrite({ id: note.id, bookId: note.bookId, operation: 'save', note }, baseline), false, baseline);
}
export function deleteNoteFromDB(id: string, bookId: string, baseline?: NoteEditBaseline) {
    if (!id) return Promise.resolve();
    return submit(recordNoteWrite({ id, bookId, operation: 'delete' }, baseline), false, baseline);
}
function submit(entry: PendingNoteWrite, retry = false, editing?: NoteEditBaseline) {
    return enqueue(entry.bookId, async () => {
        try {
            await initializeStorage();
            const latest = pendingNoteWrites(entry.bookId).find(item => item.id === entry.id);
            if (retry && latest?.version !== entry.version) return;
            const baseline = editing || (retry ? latest?.baseline : entry.baseline);
            for (const prior of latest?.prerequisites || entry.prerequisites || []) {
                if (prior.version === entry.version) continue;
                const result = await sendNoteCommand(prior.command);
                acceptNote(entry.id, entry.bookId, result, prior.operation === 'delete');
                const acknowledged = { command: prior.command, chain: prior.chain, revision: result.revision };
                advanceNoteBaseline(baseline, acknowledged);
                acknowledgeNoteWrite({ ...entry, version: prior.version }, acknowledged);
                commands.delete(prior.version);
            }
            let command = entry.command || commands.get(entry.version);
            if (!command) {
                const version = baseline ? { opId: entry.version, expected: baseline.expected, generation: baseline.generation }
                    : await latestNoteVersion(entry);
                command = entry.operation === 'save' ? { ...version, note: entry.note }
                    : { ...version, id: entry.id, bookId: entry.bookId };
                commands.set(entry.version, command);
            }
            entry = attachNoteCommand(entry, command);
            const result = await sendNoteCommand(command);
            acceptNote(entry.id, entry.bookId, result, entry.operation === 'delete');
            const acknowledged = { command, chain: entry.baseline?.chain, revision: result.revision };
            advanceNoteBaseline(baseline, acknowledged);
            acknowledgeNoteWrite(entry, acknowledged); commands.delete(entry.version);
        } catch (cause) {
            const error = new StorageClientError(errorMessage(cause, "Could not save note"), { cause });
            error.status = cause instanceof StorageClientError ? cause.status : undefined; error.recoveryAvailable = entry.durable !== false;
            error.details = cause instanceof StorageClientError ? cause.details : undefined;
            throw error;
        }
    });
}
async function latestNoteVersion(entry: PendingNoteWrite) {
    const book = await bookVersion(entry.bookId);
    const note = await noteVersion(entry.id, entry.bookId);
    if (!book.generation) throw new Error('The book was deleted or does not exist.');
    return { opId: entry.version, expected: note.revision, generation: book.generation };
}
export async function loadNotesFromDB(bookId: string): Promise<Annotation[]> {
    if (!bookId) return [];
    const { generation } = await bookVersion(bookId);
    return (await readNotes([bookId])).map(row => displayedNote(row, generation)).filter((note): note is Annotation => note !== null);
}
export async function loadNotesForBook(bookId: string): Promise<Annotation[]> {
    if (!bookId) return [];
    let notes = await loadNotesFromDB(bookId);
    const pending = pendingNoteWrites(bookId);
    for (const entry of pending) {
        try { await submit(entry, true); }
        catch (error) { console.warn("Could not recover note writes. Local recovery content is preserved.", error); }
    }
    if (pending.length) notes = await loadNotesFromDB(bookId);
    return overlay(notes, pendingNoteWrites(bookId));
}
function overlay(notes: Annotation[], pending: PendingNoteWrite[]): Annotation[] {
    const byId = new Map(notes.map(note => [note.id, note]));
    for (const entry of pending) {
        if (entry.operation === 'delete') byId.delete(entry.id);
        else {
            const note = normalizeAnnotation(entry.note);
            if (note) {
                const version = entry.baseline || (entry.command && { expected: entry.command.expected, generation: entry.command.generation });
                if (version) displayedBaselines.set(note, version);
                byId.set(entry.id, note);
            }
        }
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
