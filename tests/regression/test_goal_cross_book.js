const assert = require('node:assert/strict');
const { ui, click } = require('../helpers/react-workbench.cjs');
(async () => {
    const books = ['a', 'b'].map(id => ({ id, title: 'Book ' + id, pages: ['<p>Source ' + id + '</p>'] }));
    const notes = books.map(book => ({ id: 'n-' + book.id, bookId: book.id, kind: 'note', quote: 'Source', comment: 'Thought from ' + book.id, page: 1 }));
    const c = await require('../helpers/goal-workbench.cjs').goalWorkbench(books, notes);
    try {
        const { goals, elements } = c;
        let root, child;
        await ui(async () => {
            root = await goals.createRoot('Shared question'); child = await goals.createGoal('Evidence', root);
            await goals.linkAnnotation('n-a');
            c.bookId = 'b'; await goals.bookChanged(); await goals.linkAnnotation('n-b');
        });
        assert.equal(goals.selected, child);
        assert.equal(document.querySelectorAll('.goal-item').length, 2);
        assert.match(document.querySelector('.goal-items').textContent, /Thought from b.*Thought from a.*Book a/, 'newly linked material appears first');
        await click('[data-annotation-id="n-a"]');
        assert.equal(c.jumps[0].bookId, 'a', 'cross-book navigation carries its source');
        const panel = elements.goalPanel;
        await ui(() => goals.openPage());
        assert.equal(document.querySelector('#goal-page-content #goal-panel'), panel);
        assert.equal(document.querySelectorAll('.goal-item').length, 2);
        c.mode = 'scroll'; await ui(() => goals.updateReadingContext());
        assert.equal(panel.hidden, false, 'the independent Goal page works in scrolling mode');
        const { goalGraphsForBooks } = await import('../../dist/client/infrastructure/goalLibraryRepository.js');
        const graphs = await goalGraphsForBooks(['a','b']);
        for (const book of books) {
            const graph = graphs.get(book.id);
            assert.ok(graph.goals.some(goal => goal.id === root));
            assert.equal(graph.links.length, 1); assert.equal(graph.links[0].bookId, book.id);
        }
        console.log('PASS: React cross-book materials, source navigation, shared full-page Goal and per-book backup graphs');
    } finally { await c.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
