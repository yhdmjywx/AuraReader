/* ==========================================================================
   Session - Minimal Shared Application Context
   Authority owner of: currentBook.
   Provides change notification subscription.
   Strictly does NOT store reader position, notes, selections, layout, or modal state.
   ========================================================================== */

export class Session {
    constructor(initialBookId = 'crisis-era') {
        this.currentBookId = initialBookId;
        this.listeners = new Set();
    }

    getCurrentBookId() {
        return this.currentBookId;
    }

    setCurrentBookId(bookId) {
        if (!bookId || this.currentBookId === bookId) return;
        const prev = this.currentBookId;
        this.currentBookId = bookId;
        this.notify({ currentBookId: bookId, previousBookId: prev });
    }

    subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify(event) {
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
