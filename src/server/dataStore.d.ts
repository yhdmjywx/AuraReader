import type { BookGoalState, GoalBackupState } from '../client/domain/goal.js';
import type { GoalStateRecord, SaveGoalsCommand, NoteDeleteRevision } from '../shared/storage.js';
import type { GoalLibraryRecord, SaveGoalLibraryCommand } from '../shared/storage.js';
import type { GoalLibraryState } from '../client/domain/goal.js';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { Book } from '../client/domain/book.js';
import type { BookRecord, BookRevision, DeleteBookCommand, DeleteNoteCommand, NoteRecord, RestoreCommand, Revision, SaveBookCommand, SaveNoteCommand, StoredAnnotation } from '../shared/storage.js';
import type { BookSummaryRecord } from '../shared/storage.js';

export class StorageError extends Error {
    constructor(message: string, status?: number, details?: unknown);
    status: number;
    details?: unknown;
}
export interface DataStore {
    filename: string;
    root: string;
    db: DatabaseSync;
    transaction<T>(fn: () => T): T;
    one(sql: string, ...args: SQLInputValue[]): Record<string, unknown> | undefined;
    all(sql: string, ...args: SQLInputValue[]): Record<string, unknown>[];
    run(sql: string, ...args: SQLInputValue[]): unknown;
    snapshot<T>(fn: (store: DataStore) => T): T;
    versions(): { books: { id: string; revision: number; generation: string; deleted: number }[];
        notes: { id: string; bookId: string; revision: number; deleted: number }[]; goalRevision: number };
    note(id: string): NoteRecord | null;
    books(): BookRecord[];
    book(bookId: string): BookRecord | null;
    bookSummaries(): BookSummaryRecord[];
    notes(bookIds?: string[]): NoteRecord[];
    goals(bookIds?: string[]): GoalStateRecord[];
    saveGoals(command: SaveGoalsCommand): Revision;
    goalLibrary(): GoalLibraryRecord;
    saveGoalLibrary(command: SaveGoalLibraryCommand): Revision;
    saveBook(command: SaveBookCommand): BookRevision;
    saveNote(command: SaveNoteCommand): Revision;
    deleteBook(command: DeleteBookCommand): Revision;
    deleteNote(command: DeleteNoteCommand): NoteDeleteRevision;
    restore(command: RestoreCommand): { books: number; notes: number };
    check(): { integrity: string; foreignKeys: number };
    close(): void;
}
export function createDataStore(directory: string, options?: { attachOnly?: boolean; applicationId?: number }): DataStore;
export function canonical(value: unknown): string;
export function digest(value: unknown): string;
export function bookRecord(value: unknown): Book;
export function noteRecord(value: unknown): StoredAnnotation;

export function goalRecord(value: unknown): BookGoalState;
export function goalBackupRecord(value: unknown): GoalBackupState;
export function validateLibrary(value: unknown): GoalLibraryState;
