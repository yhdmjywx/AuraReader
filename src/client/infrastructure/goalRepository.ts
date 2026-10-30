import type { BookGoalState } from '../domain/goal.js';
import { emptyGoals } from '../domain/goalEngine.js';
import { acceptGoals, bookVersion, cachedGoals, enqueue, initializeStorage, readGoals, storageRequest } from './storageClient.js';
import { pendingGoals, readGoalDraft, attachGoalCommand, acknowledgeGoals, stageGoals } from './goalRecovery.js';

export function prepareGoalWrite(state: BookGoalState, generation: string) {
    return stageGoals(state, generation, cachedGoals(state.bookId)?.revision || 0);
}
export function flushGoals(bookId: string): Promise<void> {
    return enqueue(bookId, async () => {
        await initializeStorage();
        for (;;) {
            const entry = pendingGoals(bookId)[0];
            if (!entry) return;
            const command = entry.command || {
                opId: entry.version, expected: entry.baseRevision, generation: entry.generation, state: entry.state
            };
            if (!entry.command) attachGoalCommand(bookId, entry.version, command);
            const result = await storageRequest('goals/save', command);
            acceptGoals({ id: bookId, bookId, revision: result.revision, deleted: false, value: command.state });
            acknowledgeGoals(bookId, entry.version, result.revision, command.state);
        }
    });
}
export async function loadGoalsForBook(bookId: string) {
    let record = (await readGoals([bookId]))[0];
    const book = await bookVersion(bookId);
    if (!book.generation) throw new Error("The goal has no valid book.");
    let error: unknown;
    if (pendingGoals(bookId).length) {
        try { await flushGoals(bookId); record = (await readGoals([bookId]))[0]; }
        catch (cause) { error = cause; }
    }
    const pending = pendingGoals(bookId);
    const draft = readGoalDraft(bookId);
    if (draft && draft.generation !== book.generation) throw new Error("The goal draft belongs to an older book generation. Preserve recovery content.");
    return { draft, pending: pending.length > 0,
        state: pending.at(-1)?.state || (record && !record.deleted ? record.value : emptyGoals(bookId)),
        generation: book.generation, error
    };
}
export async function getGoalsForBooks(bookIds: string[]): Promise<BookGoalState[]> {
    const states: BookGoalState[] = [];
    for (const bookId of bookIds) {
        const loaded = await loadGoalsForBook(bookId);
        if (loaded.error) throw loaded.error;
        if (loaded.draft) throw new Error("This book has an unsubmitted goal draft. Open the book and finish editing first.");
        states.push(loaded.state);
    }
    return states;
}
