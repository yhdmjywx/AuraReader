const assert = require('node:assert/strict');
const { ui, click, input, waitFor } = require('../helpers/react-workbench.cjs');
(async () => {
    const books = ['a','z'].map(id => ({ id, title: 'Book ' + id.toUpperCase(), pages: ['<p>Source</p>'] }));
    const note = { id: 'n', bookId: 'z', kind: 'note', quote: 'Source\nAnother paragraph', comment: 'My thought', page: 1 };
    const c = await require('../helpers/goal-workbench.cjs').goalWorkbench(books, [note]);
    try {
        const { GoalHome } = await import('../../dist/client/features/goals/goalHome.js');
        const { goals } = c;
        const opens = []; c.bookId = '';
        c.home = new GoalHome(document.getElementById('goal-home'), { goals,
            coordinator: { openBook: async (id, _data, options) => { opens.push({ id, ...options }); c.bookId = id; goals.navigation.show('reader'); return { status: 'opened' }; } },
            currentBookId: () => c.bookId, finishAnnotations: async () => {}, beforeOpen() {} });
        await ui(() => c.home.open());
        assert.equal(document.querySelector('#home-welcome'), null, 'existing books can be used without creating a Goal');
        assert.ok(document.querySelector('[aria-label="Read: Book A"]'));
        await click('#home-new-goal'); await input('#home-goal-draft', 'My question\n我的意图');
        assert.equal(JSON.parse(localStorage.getItem('aura_goal_home_draft')).text, 'My question\n我的意图');
        await ui(() => document.getElementById('home-goal-form').requestSubmit());
        await waitFor(() => !c.home.busy);
        assert.equal(localStorage.getItem('aura_goal_home_draft'), null);
        assert.equal(goals.selected, null, 'creating on Home preserves the reading selection');
        const root = goals.state.goals[0].id;
        await click('#home-goal-folders .home-goal-folder');
        assert.equal(c.home.chosen, root);
        await click('#home-add-book');
        assert.ok(document.querySelector('.ui-dialog[data-open] .ui-book-picker'));
        const row = [...document.querySelectorAll('.ui-book-picker li')].find(node => node.textContent.includes('Book Z'));
        await click(row.querySelector('button'));
        await waitFor(() => !c.home.busy);
        assert.ok(goals.state.bookLinks.some(link => link.goalId === root && link.bookId === 'z'));
        assert.equal(c.bookId, '', 'adding a book does not start reading');
        await click('#home-new-goal'); await input('#home-goal-draft', 'A child');
        await ui(() => document.getElementById('home-goal-form').requestSubmit());
        await waitFor(() => !c.home.busy);
        await click('#home-goal-folders .home-goal-folder');
        assert.equal(document.querySelectorAll('#home-books .home-book-card').length, 0, 'children do not copy parent books');
        await click('#home-up'); await click('#home-books .goal-home-book');
        assert.deepEqual(opens[0], { id: 'z', goalId: root });
        await waitFor(() => !c.home.busy);
        await ui(async () => { goals.selectGoal(root); await goals.linkAnnotation(note.id); await c.home.open(); c.home.navigate(root); });
        await waitFor(() => document.querySelector('#home-material-list .goal-material-quote'));
        assert.equal(document.querySelector('#home-material-list .goal-material-quote').textContent, note.quote, 'Home linked notes include source text');
        assert.equal(document.querySelector('#home-material-list .goal-material-comment').textContent, note.comment);
        console.log('PASS: React Home navigation, draft save, hierarchy, book dialog and explicit reading intent');
    } finally { await c.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
