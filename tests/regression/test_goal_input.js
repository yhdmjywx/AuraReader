const assert = require('node:assert/strict');
const { ui, click, input } = require('../helpers/react-workbench.cjs');
(async () => {
    const c = await require('../helpers/goal-workbench.cjs').goalWorkbench([]);
    const { inputDrafts, pendingLibrary, goalGraphsForBooks, storeInputDraft } = await import('../../dist/client/infrastructure/goalLibraryRepository.js');
    const { storageRequest, bookVersion, readBooks, readGoalLibrary, restoreRecords } = await import('../../dist/client/infrastructure/storageClient.js');
    const { GoalController } = await import('../../dist/client/features/goals/goalController.js');
    const { randomUUID } = require('node:crypto');
    const { goals } = c;
    const key = (node, options) => ui(() => node.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options })));
    try {
        assert.equal(document.getElementById('goal-add-text'), null, 'root navigation has no content owner');
        await ui(() => goals.createRoot('A goal without books', 'owner'));
        assert.ok(document.getElementById('goal-add-text'));
        assert.equal(document.querySelector('.goal-items-toggle'), null);
        assert.equal(document.querySelector('.goal-children-region button'), null);
        await click('#goal-add-text');
        const editor = document.querySelector('.goal-input-editor textarea');
        await input(editor, '自己的理解\nA second line');
        editor.setSelectionRange(2, 2);
        await ui(() => goals.refreshAnnotations());
        assert.equal(document.querySelector('.goal-input-editor textarea'), editor);
        assert.equal(editor.selectionStart, 2);
        await key(editor, { key: 'Enter', ctrlKey: true, isComposing: true });
        assert.equal(goals.edit.mode, 'input-new');
        await key(editor, { key: 'Enter' });
        assert.ok(goals.edit, 'plain Enter does not finish multiline input');
        const firstId = goals.edit.draft.id;
        await key(editor, { key: 'Enter', ctrlKey: true });
        await ui(() => goals.assertWritesSaved());
        assert.equal(inputDrafts().length, 0, 'matching ACK clears the recoverable draft');
        assert.equal(goals.state.inputs[0].text, '自己的理解\nA second line');
        await click('#goal-add-text'); await input('.goal-input-editor textarea', 'Second record');
        // A direct Add click must finish the old draft and open exactly one new draft.
        await click('#goal-add-text');
        assert.equal(goals.state.inputs.length, 2);
        assert.equal(document.querySelectorAll('textarea').length, 1);
        await key(document.querySelector('textarea'), { key: 'Escape' });
        await ui(() => goals.assertWritesSaved());
        assert.equal(goals.state.inputs.length, 2, 'empty new draft is discarded');
        const firstRow = () => document.querySelector(`[data-input-id="${firstId}"]`);
        const order = goals.state.inputs[0].order;
        await click(firstRow().querySelector('[aria-label="Edit text"]'));
        await input('textarea', 'Updated\n中文');
        await ui(() => goals.flush());
        await input('textarea', '');
        await key(document.querySelector('textarea'), { key: 'Escape' });
        await ui(() => goals.assertWritesSaved());
        assert.equal(goals.state.inputs[0].text, 'Updated\n中文');
        assert.equal(goals.state.inputs[0].order, order);
        assert.notEqual(document.querySelector('.goal-user-input').dataset.inputId, firstId, 'editing does not move the record');

        const originalFetch = global.fetch;
        c.storage.configureClient((...args) => global.fetch(...args)); await readGoalLibrary();
        let failSaves = true;
        global.fetch = async (url, options) => {
            if (failSaves && String(url).endsWith('/goals/library/save')) throw new Error('test offline');
            return originalFetch(url, options);
        };
        try {
            await click(firstRow().querySelector('[aria-label="Edit text"]')); await input('textarea', 'Retained after failed save');
            await ui(async () => { await assert.rejects(goals.finishInlineEdit()); });
            assert.ok(document.querySelector('.goal-input-error'));
            assert.ok(pendingLibrary().length);
            await click('[aria-label="Dismiss save error"]');
            assert.equal(document.querySelector('.goal-input-error'), null);
            assert.ok(goals.saveError); assert.ok(pendingLibrary().length);
            await ui(() => assert.rejects(goals.assertWritesSaved()));
            failSaves = false;
            await click('.goal-input-retry');
            await ui(() => goals.assertWritesSaved());
            assert.equal(goals.saveError, undefined);
            assert.equal(pendingLibrary().length, 0);
            assert.equal(inputDrafts().length, 0);
        } finally { global.fetch = originalFetch; }

        // A delayed ACK cannot remove a draft or pending snapshot typed after it.
        let release, arrived;
        const received = new Promise(resolve => { arrived = resolve; });
        global.fetch = async (url, options) => {
            if (String(url).endsWith('/goals/library/save') && !release) {
                const response = await originalFetch(url, options);
                await new Promise(resolve => { release = resolve; arrived(); }); return response;
            }
            return originalFetch(url, options);
        };
        try {
            await click(firstRow().querySelector('[aria-label="Edit text"]')); await input('textarea', 'Snapshot one');
            let flushing; await ui(() => { flushing = goals.flush(); }); await received;
            await input('textarea', 'Snapshot two');
            assert.equal(inputDrafts()[0].text, 'Snapshot two'); await ui(async () => { release(); await flushing; });
            await ui(() => goals.assertWritesSaved());
            assert.equal((await storageRequest('goals/library')).value.inputs.find(i => i.id === firstId).text, 'Snapshot two');
        } finally { global.fetch = originalFetch; }

        await ui(() => goals.operate('owner', 'archive'));
        assert.equal(goals.state.inputs.length, 2);
        await ui(() => goals.operate('owner', 'unarchive')); await ui(() => goals.selectGoal('owner'));
        await ui(() => goals.operate('owner', 'delete')); await ui(() => goals.operate('owner', 'restore'));
        assert.equal(goals.state.inputs.length, 2);
        await ui(() => goals.selectGoal('owner'));

        const book = { id: 'linked-book', title: 'Source', pages: ['<p>Quote</p>'] };
        await storageRequest('books/save', { opId: randomUUID(), expected: 0, book }); await readBooks();
        const generation = (await bookVersion(book.id)).generation;
        await ui(() => goals.addBook('owner', book.id, generation));
        const graph = (await goalGraphsForBooks([book.id])).get(book.id);
        assert.equal(Object.hasOwn(graph, 'inputs'), false, 'per-book graph excludes owned text');
        const savedInputs = structuredClone(goals.state.inputs);
        await ui(() => restoreRecords([book], [], randomUUID(), undefined, graph));
        assert.deepEqual((await storageRequest('goals/library')).value.inputs, savedInputs, 'book restore preserves destination-owned text');

        await click(firstRow().querySelector('[aria-label="Delete text"]')); await ui(() => goals.assertWritesSaved());
        assert.equal(firstRow(), null);
        assert.equal(goals.state.inputs.length, 1);
        storeInputDraft({ id: 'recovered', goalId: 'owner', text: 'Recovered independent text' });
        const recovered = new GoalController(goals.callbacks);
        await ui(() => recovered.initialize()); assert.equal(recovered.edit.mode, 'input-new');
        assert.equal(recovered.edit.draft.goalId, 'owner');
        await ui(() => recovered.assertWritesSaved());
        assert.equal(inputDrafts().length, 0);
        assert.ok((await storageRequest('goals/library')).value.inputs.some(i => i.id === 'recovered'));
        // Existing lifecycle notices expire after 2.6s; settle them before disposing the DOM.
        await ui(() => new Promise(resolve => setTimeout(resolve, 2700)));
        console.log('PASS: book-free inline input, IME/caret, click continuation, empty protection, failure/retry/dismiss, delayed ACK, lifecycle, per-book exclusion and draft recovery');
    } finally {
        try { await c.close(); } catch (error) { await c.storage.close(); c.dom.window.close(); throw error; }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
