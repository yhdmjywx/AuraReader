const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { randomUUID } = require('node:crypto');
(async () => {
    const dom = new JSDOM('<body></body>', { url: 'http://localhost' });
    global.window = dom.window; global.document = dom.window.document; global.localStorage = dom.window.localStorage;
    global.FileReader = class { readAsText(file) { file.text().then(text => this.onload({ target: { result: text } }), error => this.onerror(error)); } };
    const books = ['a', 'b'].map(id => ({ id, title: id, pages: ['<p>Source</p>'] }));
    const storage = await require('../helpers/sqlite').clientStorage(books);
    try {
        const { storageRequest, bookVersion } = await import('../../dist/client/infrastructure/storageClient.js');
        const { saveNoteToDB } = await import('../../dist/client/infrastructure/annotationRepository.js');
        const { getGoalsForBooks } = await import('../../dist/client/infrastructure/goalRepository.js');
        const { exportSelectiveBackup } = await import('../../dist/client/infrastructure/exporters.js');
        const { BackupController } = await import('../../dist/client/features/backup/backupController.js');
        const now = new Date().toISOString();
        const notes = books.map(book => ({ id: 'n-' + book.id, bookId: book.id, kind: 'note', quote: 'Source', comment: 'My words', page: 1 }));
        for (const note of notes) await saveNoteToDB(note);
        const states = books.map(book => ({ bookId: book.id, goals: [{ id: 'g', parentId: null, text: 'My purpose ' + book.id, origin: null, createdAt: now, updatedAt: now }], links: [{ goalId: 'g', annotationId: 'n-' + book.id }] }));
        for (const state of states) await storageRequest('goals/save', { opId: randomUUID(), expected: 0, generation: (await bookVersion(state.bookId)).generation, state });
        const files = [];
        window.auraDesktop = { files: { saveExport: async file => { files.push(JSON.parse(Buffer.from(file.bytes).toString())); return { ok: true, value: { status: 'saved' } }; } } };
        await exportSelectiveBackup({ selectedBooks: books, notes, goalStates: await getGoalsForBooks(['a', 'b']) });
        assert.equal(files.length, 2);
        files.forEach((file, index) => { assert.equal(file.version, '1.1'); assert.deepEqual(file.goalStates, [states[index]]); assert.equal(file.notes[0].bookId, books[index].id); });
        const controller = new BackupController({ callbacks: { showToast: text => { if (text.includes('失败')) throw new Error(text); } } });
        await storageRequest('goals/save', { opId: randomUUID(), expected: 1, generation: (await bookVersion('a')).generation, state: { ...states[0], goals: [{ ...states[0].goals[0], text: 'Changed' }] } });
        await controller.importFullBackup(new Blob([JSON.stringify(files[0])]));
        assert.deepEqual((await storageRequest('goals/query', { bookIds: ['a'] })).records[0].value, states[0]);
        files.length = 0;
        await exportSelectiveBackup({ selectedBooks: [books[0]], notes: [], goalStates: [states[0]], includeNotes: false });
        assert.equal(Object.hasOwn(files[0].goalStates[0], 'links'), false); assert.deepEqual(files[0].notes, []);
        await controller.importFullBackup(new Blob([JSON.stringify(files[0])]));
        assert.deepEqual((await storageRequest('goals/query', { bookIds: ['a'] })).records[0].value.links, states[0].links);
        await controller.importFullBackup(new Blob([JSON.stringify({ version: '1.0', type: 'aurareader_full_backup', books: [books[0]], notes: [] })]));
        assert.deepEqual((await storageRequest('goals/query', { bookIds: ['a'] })).records[0].value, states[0]);
        console.log('Goal backup: actual HTTP, per-book 1.1 export/import, full relationships, annotation-excluded omission and old backup preservation passed.');
    } finally { await storage.close(); dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
