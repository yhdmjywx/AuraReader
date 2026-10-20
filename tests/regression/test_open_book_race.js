const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

(async () => {
    const { configureStorage } = await import('../../src/client/infrastructure/storageClient.js');
    const { AppCoordinator } = await import('../../src/client/app/appCoordinator.js');
    const { Session } = await import('../../src/client/app/session.js');
    const { AppShell } = await import('../../src/client/app/appShell.js');
    const { ReaderController } = await import('../../src/client/features/reader/readerController.js');
    const { AnnotationController } = await import('../../src/client/features/annotations/annotationController.js');

    function harness() {
        const gates = { books: [], notes: [] };
        const requests = [];
        const response = (value, status = 200) => ({ ok: status === 200, status, json: async () => value });
        const books = ['old', 'A', 'B'].map(id => ({
            id, revision: 1, generation: id,
            value: { id, title: id, pages: [`<p>${id}</p>`], toc: [] }
        }));
        configureStorage({ sourceId: 'open-book-race-test', fetch: async (url, options = {}) => {
            if (url.endsWith('/session')) return response({ token: 'test' });
            if (url.endsWith('/migration/status')) return response({ completed: true });
            const kind = url.endsWith('/books') ? 'books' : 'notes';
            assert.ok(url.endsWith('/books') || url.endsWith('/notes/query'), `Unexpected request: ${url}`);
            const bookId = kind === 'notes' ? JSON.parse(options.body).bookIds[0] : null;
            requests.push({ kind, bookId });
            const index = gates[kind].findIndex(gate => kind === 'books' || gate.bookId === bookId);
            let result;
            if (index !== -1) {
                const gate = gates[kind].splice(index, 1)[0];
                gate.started.resolve();
                result = await gate.result.promise;
            }
            if (result?.error) return response({ error: result.error }, 500);
            return response({ records: kind === 'books' ? books : [{
                id: `note-${bookId}`, bookId, revision: 1,
                value: { id: `note-${bookId}`, bookId, kind: 'note', page: 1, quote: bookId, comment: result?.comment || bookId }
            }] });
        } });
        const hold = (kind, bookId) => {
            const gate = { bookId, started: deferred(), result: deferred() };
            gates[kind].push(gate);
            return gate;
        };
        const session = new Session('old');
        const annotations = new AnnotationController({ callbacks: { getCurrentBookId: () => session.getCurrentBookId() } });
        annotations.setNotesForBook([{ id: 'note-old', bookId: 'old', quote: 'old', comment: 'old' }]);
        const renders = [];
        const reader = new ReaderController({ callbacks: {
            beforeNavigate: () => { annotations.finishInlineEdit(); return annotations.getNotes(); },
            onPageRendered: () => renders.push(snapshot())
        } });
        reader.setBook('old', books[0].value);
        const snapshot = () => ({
            book: session.getCurrentBookId(), reader: reader.getCurrentBook().id,
            notes: annotations.getNotes().map(note => note.bookId)
        });
        const notifications = [];
        session.subscribe(() => notifications.push(snapshot()));
        const dom = new JSDOM('<main id="reader"></main><aside id="notes"></aside><button id="shelf">Shelf</button>');
        const shell = new AppShell();
        shell.elements = {
            readerPanel: dom.window.document.getElementById('reader'),
            notesPanel: dom.window.document.getElementById('notes')
        };
        const toasts = [];
        shell.showToast = message => toasts.push(message);
        const coordinator = new AppCoordinator({ session, readerController: reader, annotationController: annotations, appShell: shell });
        const locked = () => {
            assert.equal(shell.elements.readerPanel.inert, true);
            assert.equal(shell.elements.notesPanel.inert, true);
            assert.notEqual(dom.window.document.getElementById('shelf').inert, true, 'Shelf stays available');
        };
        const unlocked = () => {
            assert.equal(shell.elements.readerPanel.inert, false);
            assert.equal(shell.elements.notesPanel.getAttribute('aria-busy'), 'false');
        };
        return { coordinator, annotations, snapshot, notifications, renders, toasts, hold, requests, locked, unlocked, close: () => dom.window.close() };
    }

    // B opens while A's annotations are still in flight.
    const lateNotes = harness();
    try {
        const a = lateNotes.hold('notes', 'A');
        const openingA = lateNotes.coordinator.openBook('A');
        await a.started.promise;
        assert.deepEqual(lateNotes.snapshot(), { book: 'old', reader: 'old', notes: ['old'] }, 'Reads must not change the current book');
        lateNotes.locked();
        await lateNotes.coordinator.openBook('B');
        lateNotes.unlocked();
        const expected = { book: 'B', reader: 'B', notes: ['B'] };
        assert.deepEqual(lateNotes.snapshot(), expected);
        a.result.resolve(); await openingA;
        assert.deepEqual(lateNotes.snapshot(), expected, 'Late A notes must not replace B');
        assert.deepEqual(lateNotes.notifications, [expected], 'Session observers see matching data');
        assert.deepEqual(lateNotes.renders, [expected], 'Only the winning book renders');
        assert.equal(lateNotes.toasts.length, 1, 'No success toast from the stale request');
    } finally { lateNotes.close(); }

    // A's book response itself arrives after B has already opened.
    const lateBook = harness();
    try {
        const a = lateBook.hold('books');
        const openingA = lateBook.coordinator.openBook('A');
        await a.started.promise;
        await lateBook.coordinator.openBook('B');
        a.result.resolve(); await openingA;
        assert.deepEqual(lateBook.snapshot(), { book: 'B', reader: 'B', notes: ['B'] });
        assert.ok(!lateBook.requests.some(request => request.kind === 'notes' && request.bookId === 'A'), 'Discard a stale book before reading its notes');
    } finally { lateBook.close(); }

    // An older completion cannot unlock editing while the latest read is pending.
    const pending = harness();
    try {
        const a = pending.hold('notes', 'A'), b = pending.hold('notes', 'B');
        const openingA = pending.coordinator.openBook('A'); await a.started.promise;
        const openingB = pending.coordinator.openBook('B'); await b.started.promise;
        a.result.resolve({ error: 'stale failure' }); await openingA;
        pending.locked();
        assert.equal(pending.toasts.length, 0, 'Stale failures stay silent');
        assert.deepEqual(pending.snapshot(), { book: 'old', reader: 'old', notes: ['old'] });
        b.result.resolve(); await openingB;
        pending.unlocked();
    } finally { pending.close(); }

    // A current failure leaves all three modules on the previous book.
    const failure = harness();
    const originalError = console.error;
    try {
        const b = failure.hold('notes', 'B');
        const openingB = failure.coordinator.openBook('B'); await b.started.promise;
        console.error = () => {};
        b.result.resolve({ error: 'notes unavailable' }); await openingB;
        assert.deepEqual(failure.snapshot(), { book: 'old', reader: 'old', notes: ['old'] });
        assert.equal(failure.renders.length, 0);
        assert.deepEqual(failure.toasts, ['notes unavailable']);
        failure.unlocked();
    } finally { console.error = originalError; failure.close(); }

    // Two requests for the same book still need distinct request identities.
    const sameBook = harness();
    try {
        const first = sameBook.hold('notes', 'A');
        const openingFirst = sameBook.coordinator.openBook('A'); await first.started.promise;
        const second = sameBook.hold('notes', 'A');
        const openingSecond = sameBook.coordinator.openBook('A'); await second.started.promise;
        second.result.resolve({ comment: 'new snapshot' }); await openingSecond;
        first.result.resolve({ comment: 'old snapshot' }); await openingFirst;
        assert.equal(sameBook.annotations.getNotes()[0].comment, 'new snapshot');
        assert.equal(sameBook.renders.length, 1);
    } finally { sameBook.close(); }

    const app = await import('../../src/client/app.js');
    const originalOpen = app.appCoordinator.openBook;
    try {
        let forwarded;
        app.appCoordinator.openBook = async bookId => { forwarded = bookId; };
        await app.loadBook('compatibility-book');
        assert.equal(forwarded, 'compatibility-book', 'The legacy entry uses the same coordinator');
    } finally { app.appCoordinator.openBook = originalOpen; }

    console.log('✅ 切书竞争：晚到正文／笔记、同书重复请求、统一提交、失败保留旧书、加载互锁与兼容入口通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
