const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM(fs.readFileSync('src/client/index.html', 'utf8'), { url: 'http://localhost', pretendToBeVisual: true });
    Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
        HTMLElement: dom.window.HTMLElement, NodeFilter: dom.window.NodeFilter, FileReader: dom.window.FileReader,
        requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window) });
    window.__AURA_BOOTSTRAPPED__ = true;
    const store = await require('../helpers/sqlite').clientStorage([
        { id: 'nav-a', title: 'Navigation A', pages: ['<p>First</p>', '<p>Second</p>'] },
        { id: 'nav-b', title: 'Navigation B', pages: ['<p>Another source</p>'] }
    ]);
    try {
        const a = await import('../../dist/client/main.js');
        const tick = () => new Promise(resolve => setTimeout(resolve, 40));
        const finish = async () => { while (a.home.busy) await tick(); await tick(); };
        const booksBefore = store.read('books');
        await a.startApp(); await tick();
        assert.equal(a.navigation.surface, 'home');
        assert.equal(a.session.getCurrentBookId(), '', 'existing books including demos never select a startup book');
        assert.equal(a.reader.getCurrentBook(), null);
        assert.equal(document.getElementById('home-continue').hidden, true);
        assert.deepEqual(store.read('books'), booksBefore);
        assert.equal(document.activeElement.id, 'home-goal-title');
        assert.equal(document.getElementById('home-status').textContent, '', 'initialization does not leave an unavailable warning on a healthy Home');

        const root = await a.goals.createRoot('Read with my intention');
        const other = await a.goals.createRoot('Another intention');
        assert.equal((await a.coordinator.openBook('nav-a', undefined, { goalId: root })).status, 'opened');
        a.reader.goToPage(2, 0, []);
        await a.home.open(); a.home.navigate(other);
        assert.equal(a.goals.selected, root, 'browsing does not select a reading Goal');
        const keyboard = new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
        document.body.dispatchEvent(keyboard);
        assert.equal(keyboard.defaultPrevented, false, 'Home does not consume reading shortcuts');
        assert.equal(a.reader.getCurrentPage(), 2);
        document.getElementById('home-continue').click(); await finish();
        assert.equal(a.navigation.surface, 'reader'); assert.equal(a.reader.getCurrentPage(), 2); assert.equal(a.goals.selected, root);
        await a.goals.openPage(); assert.equal(a.navigation.surface, 'goal');
        await a.goals.returnToReader(); assert.equal(a.navigation.surface, 'reader'); assert.equal(a.reader.getCurrentPage(), 2);

        await a.home.open();
        const failed = await a.coordinator.openBook('missing-navigation-book', undefined, { goalId: null });
        assert.equal(failed.status, 'failed'); assert.equal(a.navigation.surface, 'home'); assert.equal(a.goals.selected, root);
        assert.equal(a.session.getCurrentBookId(), 'nav-a');
        const storage = await import('../../dist/client/infrastructure/storageClient.js');
        await a.coordinator.jumpToGoalSource({ bookId: 'nav-b', annotationId: 'missing-source', generation: (await storage.bookVersion('nav-b')).generation, goalId: root });
        assert.equal(a.navigation.surface, 'home', 'a missing cross-book annotation cannot navigate away');
        assert.equal(a.session.getCurrentBookId(), 'nav-a'); assert.equal(a.goals.selected, root);

        let enter, release;
        const entered = new Promise(resolve => { enter = resolve; });
        const gate = new Promise(resolve => { release = resolve; });
        store.configureClient(async (url, options) => {
            if (url.endsWith('/notes/query') && JSON.parse(options.body).bookIds.includes('nav-b')) { enter(); await gate; }
            return fetch(url, options);
        });
        const opening = a.coordinator.openBook('nav-b', undefined, { goalId: other });
        await entered; await a.home.open(); release();
        assert.equal((await opening).status, 'superseded');
        assert.equal(a.navigation.surface, 'home'); assert.equal(a.session.getCurrentBookId(), 'nav-a'); assert.equal(a.goals.selected, root);
        store.configureClient();

        let releaseText, enterNewer, releaseNewer;
        const text = new Promise(resolve => { releaseText = resolve; });
        const newerEntered = new Promise(resolve => { enterNewer = resolve; });
        const newerGate = new Promise(resolve => { releaseNewer = resolve; });
        store.configureClient(async (url, options) => {
            if (url.endsWith('/notes/query') && JSON.parse(options.body).bookIds.includes('nav-b')) { enterNewer(); await newerGate; }
            return fetch(url, options);
        });
        const importing = a.coordinator.importBook({ name: 'late-import.txt', text: () => text });
        const newerOpening = a.coordinator.openBook('nav-b', undefined, { goalId: other });
        await newerEntered; releaseText('Late imported text'); await importing; releaseNewer();
        assert.equal((await newerOpening).status, 'opened', 'a superseded import cannot invalidate a newer pending book request');
        assert.equal(a.session.getCurrentBookId(), 'nav-b'); assert.equal(a.goals.selected, other);
        store.configureClient(); await a.coordinator.openBook('nav-a', undefined, { goalId: root });

        const originalAssert = a.annotations.assertInlineWritesSaved.bind(a.annotations);
        a.navigation.show('reader');
        a.annotations.assertInlineWritesSaved = async () => { throw new Error('navigation save failure'); };
        await assert.rejects(a.home.open(), /navigation save failure/);
        assert.equal(a.navigation.surface, 'reader', 'failed saves keep the original surface');
        a.annotations.assertInlineWritesSaved = originalAssert;

        await a.home.open();
        document.getElementById('home-new-goal').click();
        const draft = document.getElementById('home-goal-draft'); draft.value = 'Unsubmitted Home draft'; draft.dispatchEvent(new window.Event('input'));
        const goalCount = a.goals.state.goals.length;
        await a.home.open();
        assert.equal(a.goals.state.goals.length, goalCount, 'navigation never submits the Home draft');
        assert.ok(localStorage.getItem('aura_goal_home_draft'));
        document.getElementById('home-cancel-goal').click();

        await a.coordinator.openBook('nav-b', undefined, { goalId: null });
        assert.equal(a.goals.selected, null);
        await a.coordinator.deleteBook('nav-a'); assert.equal(a.navigation.surface, 'reader', 'deleting another book keeps reading');
        await a.coordinator.deleteBook('nav-b');
        assert.equal(a.navigation.surface, 'home'); assert.equal(a.session.getCurrentBookId(), ''); assert.equal(a.reader.getCurrentBook(), null);
        assert.equal(document.getElementById('home-continue').hidden, true);
        await a.coordinator.openBook('crisis-era'); await a.coordinator.deleteBook('crisis-era');
        assert.equal(store.read('books', 'crisis-era'), undefined, 'deleting the current demo does not reinstall it');
        assert.equal(a.navigation.surface, 'home');

        const book = { id: 'restore-navigation', title: 'Restored book', pages: ['<p>Restored</p>'] };
        const backup = book => new window.File([JSON.stringify({ version: '1.0', books: [book], notes: [] })], 'navigation.aurabackup');
        await a.backup.importFullBackup(backup(book));
        assert.ok(store.read('books', book.id)); assert.equal(a.navigation.surface, 'home'); assert.equal(a.session.getCurrentBookId(), '');
        await a.coordinator.openBook(book.id);
        await a.backup.importFullBackup(backup({ ...book, title: 'Replacement' }));
        assert.equal(a.navigation.surface, 'home'); assert.equal(a.reader.getCurrentBook(), null, 'restored current books cannot resume stale content');
        assert.equal(document.getElementById('home-continue').hidden, true);
        assert.match(document.getElementById('toast-msg').textContent, /恢复 1 本图书/);
        console.log('App navigation: real bootstrap, explicit selection, same-session position, save guards, stale requests, drafts, deletion and restore passed.');
    } finally { await store.drain(); await store.close(); dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
