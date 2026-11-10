const assert = require('node:assert/strict');
const { ui, click, input, waitFor } = require('../helpers/react-workbench.cjs');
(async () => {
    const book = { id: 'book', title: 'Source book', pages: ['<p>Evidence</p>'] };
    const notes = ['highlight', 'note'].map(kind => ({ id: kind, bookId: book.id, kind, quote: 'Evidence', comment: kind === 'note' ? 'My comment' : '', page: 1 }));
    const c = await require('../helpers/goal-workbench.cjs').goalWorkbench([book], notes);
    const { responseTargetKey } = await import('../../dist/client/domain/goalContentEngine.js');
    const { pendingLibrary, goalGraphsForBooks } = await import('../../dist/client/infrastructure/goalLibraryRepository.js');
    const { storageRequest, readGoalLibrary, restoreRecords } = await import('../../dist/client/infrastructure/storageClient.js');
    const { goals } = c;
    const key = (node, value) => ui(() => node.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value })));
    const inputRow = () => document.querySelector('.goal-user-input');
    const materialRow = id => document.querySelector(`[data-annotation-id="${id}"]`).closest('.goal-response-item');
    const toggle = async row => {
        await click(row.querySelector('[aria-label="Response"]'));
        assert.ok(document.querySelector('[role="menuitemcheckbox"]'));
        await click('[role="menuitemcheckbox"]');
        await waitFor(() => !document.querySelector('.goal-response-menu'));
    };
    const sourceTarget = link => ({ kind: 'annotation', goalId: link.goalId, bookId: link.bookId, generation: link.generation, annotationId: link.annotationId, associationOrder: link.order });
    try {
        await ui(async () => { await goals.createRoot('First goal', 'a'); await goals.linkAnnotation('highlight'); await goals.linkAnnotation('note'); });
        await click('#goal-add-text'); await input('textarea', 'My response\n第二行'); await key(document.querySelector('textarea'), 'Escape');
        await ui(() => goals.assertWritesSaved());
        const owned = goals.state.inputs[0], target = { kind: 'input', goalId: 'a', id: owned.id };
        const order = document.querySelector('.goal-items').textContent;
        await click(inputRow().querySelector('[aria-label="Response"]'));
        assert.equal(goals.state.inputs[0].response, undefined, 'opening the menu does not mark');
        assert.equal(document.querySelector('[role="menuitemcheckbox"]').getAttribute('aria-checked'), 'false');
        await key(document.querySelector('[role="menuitemcheckbox"]'), 'Escape');
        await waitFor(() => !document.querySelector('.goal-response-menu'));
        assert.equal(document.activeElement.getAttribute('aria-label'), 'Response');
        await toggle(inputRow());
        assert.ok(inputRow().parentElement.hasAttribute('data-response'));
        assert.match(document.querySelector('.goal-response-feedback').textContent, /Saving/);
        await ui(() => goals.assertWritesSaved());
        assert.equal(document.querySelector('.goal-response-feedback'), null);
        assert.equal(goals.state.inputs[0].order, owned.order);
        assert.equal(goals.state.inputs[0].updatedAt, owned.updatedAt);
        assert.equal(document.querySelector('.goal-items').textContent.replace('Response', ''), order);
        await toggle(materialRow('highlight')); await toggle(materialRow('note'));
        await ui(() => goals.assertWritesSaved());
        assert.ok(goals.state.links.every(l => l.response));
        assert.match(materialRow('note').textContent, /My comment/);
        const panel = c.elements.goalPanel; await ui(() => goals.openPage());
        assert.equal(document.querySelector('#goal-page-content #goal-panel'), panel);
        assert.equal(document.querySelectorAll('[data-response]').length, 3);
        await click(inputRow().querySelector('[aria-label="Edit text"]'));
        const editor = document.querySelector('textarea'); editor.setSelectionRange(2, 2);
        assert.equal(inputRow().querySelector('[aria-label="Response"]'), null, 'editing hides actions');
        await ui(() => goals.refreshAnnotations());
        assert.equal(document.querySelector('textarea'), editor); assert.equal(editor.selectionStart, 2);
        await key(editor, 'Escape'); await ui(() => goals.assertWritesSaved());

        // Both coalesced choices and an old, delayed ACK must preserve the latest choice.
        const originalFetch = global.fetch;
        c.storage.configureClient((...args) => global.fetch(...args)); await readGoalLibrary();
        let release, arrived;
        const received = new Promise(resolve => { arrived = resolve; });
        global.fetch = async (url, options) => {
            const response = await originalFetch(url, options);
            if (String(url).endsWith('/goals/library/save') && !release) await new Promise(resolve => { release = resolve; arrived(); });
            return response;
        };
        try {
            await ui(() => goals.setResponse(target, false));
            let flushing; await ui(() => { flushing = goals.flush(); }); await received;
            await ui(() => goals.setResponse(target, true));
            const latestIntent = pendingLibrary().at(-1).responseIntents.find(i => responseTargetKey(i.target) === responseTargetKey(target)).id;
            await ui(async () => { release(); await flushing; }); await ui(() => goals.assertWritesSaved());
            assert.ok(latestIntent); assert.ok((await storageRequest('goals/library')).value.inputs[0].response);
            assert.equal(document.querySelector('.goal-response-feedback'), null);
        } finally { global.fetch = originalFetch; }

        let offline = true;
        global.fetch = async (url, options) => {
            if (offline && String(url).endsWith('/goals/library/save')) throw new Error('Response test offline');
            return originalFetch(url, options);
        };
        try {
            await ui(() => goals.setResponse(target, false)); await ui(() => assert.rejects(goals.flush()));
            assert.match(document.querySelector('.goal-response-feedback').textContent, /Couldn’t save Response/);
            assert.equal(goals.state.inputs[0].response, undefined, 'failure retains desired cancellation');
            await click('[aria-label="Dismiss Response save error"]');
            assert.match(document.querySelector('.goal-response-feedback').textContent, /Not saved/);
            assert.ok(pendingLibrary().length);
            await ui(() => goals.setResponse(target, true)); await ui(() => assert.rejects(goals.flush()));
            const { GoalController } = await import('../../dist/client/features/goals/goalController.js');
            const recovered = new GoalController(goals.callbacks);
            await ui(() => recovered.initialize());
            assert.ok(recovered.state.inputs[0].response, 'restart reads the latest durable desired state');
            assert.equal(recovered.disabled, true, 'unconfirmed recovery remains protected');
            offline = false;
            await ui(() => recovered.retryResponse(target));
            await ui(() => goals.assertWritesSaved());
            assert.ok((await storageRequest('goals/library')).value.inputs[0].response);
            assert.equal(document.querySelector('.goal-response-feedback'), null);
        } finally { global.fetch = originalFetch; }

        const graph = (await goalGraphsForBooks([book.id])).get(book.id);
        const original = structuredClone(goals.state.links.find(l => l.annotationId === 'note'));
        await ui(() => goals.createRoot('Second goal', 'b'));
        await ui(() => goals.selectGoal('a'));
        await click(inputRow().querySelector('[aria-label="Response"]'));
        await ui(() => goals.selectGoal('b')); await ui(() => goals.selectGoal('a'));
        assert.equal(document.querySelector('.goal-response-menu'), null, 'returning to a goal does not reopen its invalidated menu');
        await ui(() => goals.selectGoal('b'));
        await ui(async () => { goals.navigation.show('reader'); goals.visible = true; await goals.linkAnnotation('note'); });
        assert.equal(goals.state.links.find(l => l.goalId === 'b').response, undefined, 'same source has independent membership');
        await ui(() => goals.selectGoal('a'));
        await click(materialRow('note').querySelector('[aria-label="Unlink"]')); await ui(() => goals.assertWritesSaved());
        await ui(() => goals.linkAnnotation('note'));
        const newLink = goals.state.links.find(l => l.goalId === 'a' && l.annotationId === 'note');
        assert.equal(newLink.response, undefined, 'fresh association requires a new decision');
        assert.notEqual(newLink.order, original.order);
        await ui(() => goals.setResponse(sourceTarget(original), true));
        assert.equal(goals.state.links.find(l => l === newLink).response, undefined, 'stale menu cannot mark the new association');
        await ui(() => restoreRecords([book], notes, require('node:crypto').randomUUID(), undefined, graph));
        const restored = (await storageRequest('goals/library')).value.links.find(l => l.goalId === 'a' && l.annotationId === 'note');
        assert.deepEqual(restored.response, original.response, 'restoring the original association retains its saved Response');
        assert.ok((await storageRequest('notes/query', { bookIds: [book.id] })).records.some(n => n.id === 'note'), 'unlinked annotation is retained');
        await ui(() => goals.operate('a', 'archive')); await ui(() => goals.operate('a', 'unarchive'));
        assert.ok(goals.state.links.find(l => l.goalId === 'a' && l.annotationId === 'note').response);
        await ui(() => new Promise(resolve => setTimeout(resolve, 2700)));
        console.log('PASS: Response controls, whole-note label, editing preservation, shared workspace, delayed ACK, offline retry/dismiss, per-Goal scope, new association and original backup restoration');
    } finally { await c.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
