import { clearBookGoals } from './goalRecovery.js';
import { forgetGoals } from './storageClient.js';
import type { Book, BookSummary } from '../domain/book.js';
import { clearStoredBookNotes } from './annotationRecovery.js';
import { initializeStorage, readBooks, readBook, readBookSummaries, enqueue, bookVersion, storageRequest, operationId, acceptBook } from './storageClient.js';
export { demoBooks, seedNotes, getSeedNotes } from './demoData.js';

export function initDB() { return initializeStorage(); }
export function saveBookToDB(book: Book) {
    if (!book?.id) return Promise.resolve();
    const snapshot = JSON.parse(JSON.stringify(book));
    return enqueue(book.id, async () => {
        await initializeStorage();
        const current = await bookVersion(book.id);
        const result = await storageRequest('books/save', { opId: operationId(), book: snapshot, expected: current.revision });
        acceptBook(book.id, result); return result;
    });
}
export async function loadBookFromDB(bookId: string): Promise<Book | null> {
    if (!bookId) return null;
    const row = await readBook(bookId);
    return row && !row.deleted ? row.value : null;
}
export async function getBookSummariesFromDB(): Promise<BookSummary[]> { return (await readBookSummaries()).flatMap(row => row.deleted ? [] : [row.value]); }
export async function getAllBooksFromDB(): Promise<Book[]> { return (await readBooks()).flatMap(row => row.deleted ? [] : [row.value]); }
export function deleteBookFromDB(bookId: string) {
    if (!bookId) return Promise.resolve();
    return enqueue(bookId, async () => {
        await initializeStorage();
        const current = await bookVersion(bookId);
        const result = await storageRequest('books/delete', { opId: operationId(), id: bookId, expected: current.revision });
        acceptBook(bookId, result, true); clearStoredBookNotes(bookId); clearBookGoals(bookId); forgetGoals(bookId); return result;
    });
}
