import type { GoalStateRecord, SaveGoalsCommand, NoteDeleteRevision } from './storage.js';
import type { GoalLibraryRecord, SaveGoalLibraryCommand } from './storage.js';
import type { BookRecord, BookRevision, DeleteBookCommand, DeleteNoteCommand, NoteRecord, RestoreCommand, Revision, SaveBookCommand, SaveNoteCommand } from './storage.js';

export type DesktopResult<T> = { ok: true; value: T } | { ok: false; error: { message: string; status: number; details?: unknown } };
export interface DesktopLibraryStatus { initialized: boolean }
export type PickedFile = { canceled: true } | { canceled: false; file: { name: string; bytes: Uint8Array } };
export type SaveOutcome = { status: 'saved' | 'canceled'; name?: string; kind?: 'file' | 'folder' };
export interface DesktopFont {
    id: string; type: 'ttf' | 'otf' | 'woff2'; name: string; family: string;
    weight: string; size: number; filename: string; url: string;
}
export interface DesktopStorage {
    status(): Promise<DesktopResult<DesktopLibraryStatus>>;
    createLibrary(): Promise<DesktopResult<DesktopLibraryStatus>>;
    listBooks(): Promise<DesktopResult<{ records: BookRecord[] }>>;
    saveBook(command: SaveBookCommand): Promise<DesktopResult<BookRevision>>;
    deleteBook(command: DeleteBookCommand): Promise<DesktopResult<Revision>>;
    queryNotes(query: { bookIds: string[] }): Promise<DesktopResult<{ records: NoteRecord[] }>>;
    queryGoals(query: { bookIds: string[] }): Promise<DesktopResult<{ records: GoalStateRecord[] }>>;
    saveGoals(command: SaveGoalsCommand): Promise<DesktopResult<Revision>>;
    queryGoalLibrary(): Promise<DesktopResult<GoalLibraryRecord>>;
    saveGoalLibrary(command: SaveGoalLibraryCommand): Promise<DesktopResult<Revision>>;
    saveNote(command: SaveNoteCommand): Promise<DesktopResult<Revision>>;
    deleteNote(command: DeleteNoteCommand): Promise<DesktopResult<NoteDeleteRevision>>;
    restore(command: RestoreCommand): Promise<DesktopResult<{ books: number; notes: number }>>;
    backup(): Promise<DesktopResult<{ name: string; integrity: string; books: number; notes: number }>>;
}
export interface DesktopBridge {
    readonly stage: 4;
    readonly platform: string;
    readonly versions: { readonly electron: string; readonly node: string };
    readonly storage: DesktopStorage;
    readonly files: {
        chooseBook(): Promise<DesktopResult<PickedFile>>;
        chooseBackup(): Promise<DesktopResult<PickedFile>>;
        saveExport(input: { filename: string; bytes: Uint8Array }): Promise<DesktopResult<SaveOutcome>>;
        saveExportFolder(input: { folderName: string; files: { filename: string; bytes: Uint8Array }[] }): Promise<DesktopResult<SaveOutcome>>;
    };
    readonly fonts: {
        list(): Promise<DesktopResult<{ fonts: DesktopFont[] }>>;
        system(): Promise<DesktopResult<{ supported: boolean; fonts: string[] }>>;
        importFont(): Promise<DesktopResult<{ canceled: true } | { canceled: false; font: DesktopFont }>>;
    };
    readonly window: { toggleFullscreen(): Promise<DesktopResult<{ fullscreen: boolean }>> };
    readonly lifecycle: {
        requestClose(): Promise<DesktopResult<{ requested: boolean }>>;
        onPrepareClose(callback: (requestId: string) => void): () => void;
        onCloseCancelled(callback: (message: string) => void): () => void;
        completeClose(requestId: string, result: { ok: boolean; message?: string }): Promise<DesktopResult<{ accepted: boolean }>>;
    };
}
