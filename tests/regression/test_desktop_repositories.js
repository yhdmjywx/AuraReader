const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { createDesktopStorage } = require('../../src/desktop/storage.cjs');

(async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aurareader-desktop-test-'));
    const service = createDesktopStorage(path.join(directory, 'data'));
    const dom = new JSDOM('', { url: 'https://reader.test/' });
    const previous = new Map(['window', 'localStorage', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        await service.call('createLibrary');
        globalThis.window = dom.window; globalThis.localStorage = dom.window.localStorage;
        globalThis.fetch = () => { throw new Error('Desktop must never use HTTP'); };
        let lose = false; let failures = false; let statusFailure = true;
        const sent = [];
        const storage = {};
        for (const action of ['status', 'createLibrary', 'listBooks', 'saveBook', 'deleteBook', 'queryNotes', 'saveNote', 'deleteNote', 'restore', 'backup']) {
            storage[action] = async body => {
                sent.push({ action, body: structuredClone(body) });
                if (action === 'status' && statusFailure) {
                    statusFailure = false;
                    return { ok: false, error: { message: 'temporary startup error', status: 503 } };
                }
                if (action === 'saveNote' && failures) return { ok: false, error: { message: 'write denied', status: 503, details: { preserved: true } } };
                let value;
                try { value = await service.call(action, body); }
                catch (error) { return { ok: false, error: { message: error.message, status: error.status || 500, details: error.details } }; }
                if (action === 'saveNote' && lose) { lose = false; throw new Error('response lost after commit'); }
                return { ok: true, value };
            };
        }
        dom.window.auraDesktop = { storage };
        const books = await import('../../dist/client/infrastructure/bookRepository.js');
        const notes = await import('../../dist/client/infrastructure/annotationRepository.js');
        const client = await import('../../dist/client/infrastructure/storageClient.js');
        const { AnnotationController } = await import('../../dist/client/features/annotations/annotationController.js');
        await assert.rejects(client.initializeStorage(), { status: 503 });
        await books.saveBookToDB({ id: 'repo-desktop', pages: ['<p>完整正文😀</p>'], extra: { retained: true } });
        const note = { id: 'note-desktop', bookId: 'repo-desktop', quote: '正文😀', comment: '一\n二😀\n', extra: [1, null] };
        lose = true;
        await notes.saveNoteToDB(note);
        const attempts = sent.filter(row => row.action === 'saveNote');
        assert.equal(attempts.length, 2);
        assert.deepEqual(attempts[0].body, attempts[1].body);
        assert.equal((await service.call('queryNotes', { bookIds: [note.bookId] })).records[0].revision, 1);
        assert.equal(localStorage.getItem('aura_notes_pending_' + note.bookId), null);
        failures = true;
        await assert.rejects(notes.saveNoteToDB({ ...note, comment: '未确认输入' }), error => error.status === 503 && error.details.preserved === true);
        assert.ok(localStorage.getItem('aura_notes_pending_' + note.bookId));
        failures = false;
        assert.equal((await notes.loadNotesForBook(note.bookId))[0].comment, '未确认输入');
        assert.equal(localStorage.getItem('aura_notes_pending_' + note.bookId), null);
        const controller = new AnnotationController({ callbacks: { getCurrentBookId: () => note.bookId } });
        const inline = controller.createNote({ quote: '完整正文', page: 1 });
        for (let index = 0; index < 30; index++) controller.updateInlineNote(inline.id, `快速输入${index}\n😀\n`);
        await controller.finishInlineEdit(); await controller.assertInlineWritesSaved(); await client.drainStorage();
        assert.equal((await service.call('queryNotes', { bookIds: [note.bookId] })).records.find(row => row.id === inline.id).value.comment, '快速输入29\n😀\n');
        failures = true;
        const failed = controller.createNote({ quote: '失败恢复' });
        controller.updateInlineNote(failed.id, '不可丢失');
        await controller.finishInlineEdit();
        await assert.rejects(controller.assertInlineWritesSaved(), /保存失败/);
        assert.ok(localStorage.getItem('aura_notes_pending_' + note.bookId));
        failures = false;
        await notes.loadNotesForBook(note.bookId);
        await controller.assertInlineWritesSaved();
        await notes.deleteNoteFromDB(note.id, note.bookId);
        assert.ok(!(await notes.loadNotesForBook(note.bookId)).some(row => row.id === note.id));
        const durableStorage = globalThis.localStorage;
        globalThis.localStorage = { getItem: key => durableStorage.getItem(key), setItem: () => { throw new Error('storage denied'); } };
        const unbuffered = new AnnotationController({ callbacks: { getCurrentBookId: () => note.bookId } });
        failures = true;
        const unsafe = unbuffered.createNote({ quote: '无恢复权限' });
        unbuffered.updateInlineNote(unsafe.id, '仅在内存中，不可退出');
        await unbuffered.finishInlineEdit();
        await assert.rejects(unbuffered.assertInlineWritesSaved(), /保存失败/);
        globalThis.localStorage = durableStorage;
        console.log('PASS: desktop repositories without fetch, lost-response exact replay, error details, recovery buffers, fast inline inputs and failed-close save guard');
    } finally {
        service.close(); dom.window.close();
        for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
        const target = path.resolve(directory);
        if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('aurareader-desktop-test-')) throw new Error('Unsafe cleanup');
        await fs.rm(target, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
