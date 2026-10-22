export interface BookChanged { currentBookId: string; previousBookId: string }
/* ==========================================================================
   Session - Minimal Shared Application Context
   Authority owner of: currentBook.
   Provides change notification subscription.
   Strictly does NOT store reader position, notes, selections, layout, or modal state.
   ========================================================================== */

export class Session {
    currentBookId: string;
    listeners: Set<(event: BookChanged) => void>;
    constructor(initialBookId = 'crisis-era') {
        this.currentBookId = initialBookId;
        this.listeners = new Set();
    }

    getCurrentBookId() {
        return this.currentBookId;
    }

    setCurrentBookId(bookId: string) {
        if (!bookId || this.currentBookId === bookId) return;
        const prev = this.currentBookId;
        this.currentBookId = bookId;
        this.notify({ currentBookId: bookId, previousBookId: prev });
    }

    subscribe(listener: (event: BookChanged) => void) {
        if (typeof listener !== 'function') return () => {};
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify(event: BookChanged) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (err) {
                console.error("Session subscriber error:", err);
            }
        }
    }
}

export const session = new Session('crisis-era');
