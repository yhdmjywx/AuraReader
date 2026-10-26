import type { BookGoalState, GoalBackupState, GoalLibraryState, GoalGraphBackup } from '../client/domain/goal.js';
import type { Book } from '../client/domain/book.js';
import type { AnnotationInput } from '../client/domain/annotation.js';

// Wire records deliberately preserve legacy fields; the annotation domain
// normalizes them for use by the UI. Deleted records have no payload.
export type StoredAnnotation = AnnotationInput & { id: string; bookId: string };
export type StoredRecord<T> = { id: string; revision: number } & (
    { deleted: false; value: T } | { deleted: true; value: null }
);
export type BookRecord = StoredRecord<Book> & { generation: string };
export type NoteRecord = StoredRecord<StoredAnnotation> & { bookId: string };
export type GoalStateRecord = StoredRecord<BookGoalState> & { bookId: string };
export interface SaveGoalsCommand { opId: string; expected: number; generation: string; state: BookGoalState }
export interface NoteDeleteRevision extends Revision { goalState?: GoalStateRecord; goalLibrary?: GoalLibraryRecord }
export type GoalLibraryRecord = StoredRecord<GoalLibraryState>;
export interface SaveGoalLibraryCommand { opId: string; expected: number; state: GoalLibraryState }
export interface Revision { revision: number }
export interface BookRevision extends Revision { generation?: string; goalLibrary?: GoalLibraryRecord }
export interface SaveNoteCommand {
    opId: string; expected: number; generation: string; note: StoredAnnotation;
}
export interface DeleteNoteCommand {
    opId: string; expected: number; generation: string; id: string; bookId: string;
}
export interface SaveBookCommand { opId: string; expected: number; book: Book }
export interface DeleteBookCommand { opId: string; expected: number; id: string }
export interface RestoreCommand { opId: string; books: Book[]; notes: StoredAnnotation[]; goalStates?: GoalBackupState[]; goalGraph?: GoalGraphBackup }
export interface MigrationManifest {
    cleanup?: { caches?: Record<string, string>; pending?: Record<string, string> };
    [field: string]: unknown;
}
export interface MigrationStatus { completed: boolean; snapshotId?: string; manifest?: MigrationManifest }
export interface StorageRoutes {
    books: { request: undefined; response: { records: BookRecord[] } };
    'books/save': { request: SaveBookCommand; response: BookRevision };
    'books/delete': { request: DeleteBookCommand; response: Revision };
    'notes/query': { request: { bookIds: string[] }; response: { records: NoteRecord[] } };
    'notes/save': { request: SaveNoteCommand; response: Revision };
    'notes/delete': { request: DeleteNoteCommand; response: NoteDeleteRevision };
    'goals/query': { request: { bookIds: string[] }; response: { records: GoalStateRecord[] } };
    'goals/save': { request: SaveGoalsCommand; response: Revision };
    'goals/library': { request: undefined; response: GoalLibraryRecord };
    'goals/library/save': { request: SaveGoalLibraryCommand; response: Revision };
    restore: { request: RestoreCommand; response: { books: number; notes: number } };
    'migration/status': { request: undefined; response: MigrationStatus };
    'migration/snapshot': { request: Record<string, unknown>; response: { snapshotId: string } };
    'migration/commit': { request: { snapshotId: string }; response: MigrationStatus };
}
