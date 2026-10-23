import type { BookRecord, BookRevision, DeleteBookCommand, DeleteNoteCommand, NoteRecord, RestoreCommand, Revision, SaveBookCommand, SaveNoteCommand } from './storage.js';

export type DesktopResult<T> = { ok: true; value: T } | { ok: false; error: { message: string; status: number; details?: unknown } };
export interface DesktopLibraryStatus { initialized: boolean }
export interface DesktopStorage {
    status(): Promise<DesktopResult<DesktopLibraryStatus>>;
    createLibrary(): Promise<DesktopResult<DesktopLibraryStatus>>;
    listBooks(): Promise<DesktopResult<{ records: BookRecord[] }>>;
    saveBook(command: SaveBookCommand): Promise<DesktopResult<BookRevision>>;
    deleteBook(command: DeleteBookCommand): Promise<DesktopResult<Revision>>;
    queryNotes(query: { bookIds: string[] }): Promise<DesktopResult<{ records: NoteRecord[] }>>;
    saveNote(command: SaveNoteCommand): Promise<DesktopResult<Revision>>;
    deleteNote(command: DeleteNoteCommand): Promise<DesktopResult<Revision>>;
    restore(command: RestoreCommand): Promise<DesktopResult<{ books: number; notes: number }>>;
    backup(): Promise<DesktopResult<{ name: string; integrity: string; books: number; notes: number }>>;
}
export interface DesktopBridge {
    readonly stage: 3;
    readonly platform: string;
    readonly versions: { readonly electron: string; readonly node: string };
    readonly storage: DesktopStorage;
    readonly lifecycle: {
        onPrepareClose(callback: (requestId: string) => void): () => void;
        onCloseCancelled(callback: (message: string) => void): () => void;
        completeClose(requestId: string, result: { ok: boolean; message?: string }): Promise<DesktopResult<{ accepted: boolean }>>;
    };
}
