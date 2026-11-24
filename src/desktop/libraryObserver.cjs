/** @typedef {NonNullable<ReturnType<ReturnType<typeof import('./storage.cjs').createDesktopStorage>['observationStore']>>} Store */
/** @typedef {ReturnType<Store['versions']>} Versions */

/** @param {{id: string, revision: number}[]} previous @param {{id: string, revision: number}[]} next */
function changedIds(previous, next) {
    const revisions = new Map(previous.map(row => [row.id, row.revision]));
    return next.filter(row => row.revision !== revisions.get(row.id)).map(row => row.id);
}

/** @param {import('electron').BrowserWindow} window
 * @param {ReturnType<typeof import('./storage.cjs').createDesktopStorage>} storage
 * @param {string} appUrl */
function observeLibrary(window, storage, appUrl) {
    const contents = window.webContents;
    /** @type {Versions | undefined} */
    let previous;
    /** @type {unknown} */
    let signal;
    let warned = false;

    function poll() {
        const store = storage.observationStore();
        if (!store || window.isDestroyed() || contents.isDestroyed() || contents.mainFrame?.url !== appUrl) return;
        try {
            const before = store.one('PRAGMA data_version')?.data_version;
            if (previous && signal === before) return;
            const baseline = previous;
            const batch = store.snapshot(() => {
                const versions = store.versions();
                if (!baseline) return { versions, changes: null };
                const ids = new Set(changedIds(baseline.books, versions.books));
                const notes = changedIds(baseline.notes, versions.notes).flatMap(id => { const note = store.note(id); return note ? [note] : []; });
                const books = ids.size ? store.bookSummaries().filter(row => ids.has(row.id)) : [];
                const goals = baseline.goalRevision !== versions.goalRevision ? store.goalLibrary() : null;
                return { versions, changes: { books, notes, goals } };
            });
            // A commit during the snapshot must still be observed on the next
            // poll even when SQLite took the snapshot after that commit.
            const after = store.one('PRAGMA data_version')?.data_version;
            if (batch.changes && (batch.changes.notes.length || batch.changes.books.length || batch.changes.goals)) {
                contents.send('aura:storage:external-changes', batch.changes);
            }
            previous = batch.versions;
            signal = before;
            warned = false;
            if (before !== after) setImmediate(poll);
        } catch (error) {
            if (!warned) console.error('Could not observe external library changes:', error);
            warned = true;
        }
    }
    const timer = setInterval(() => { if (window.isVisible() && !window.isMinimized()) poll(); }, 200);
    window.on('focus', poll);
    window.on('show', poll);
    return { poll, close() {
        clearInterval(timer);
        window.removeListener('focus', poll);
        window.removeListener('show', poll);
    } };
}

module.exports = { observeLibrary };
