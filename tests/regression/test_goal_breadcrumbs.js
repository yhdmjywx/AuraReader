const assert = require('node:assert/strict');
const { ui, click, input } = require('../helpers/react-workbench.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hover = node => ui(async () => {
    node.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
    await delay(180);
});
const leave = node => ui(() => node.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })));

(async () => {
    const c = await require('../helpers/goal-workbench.cjs').goalWorkbench();
    try {
        const { goals } = c;
        await ui(async () => {
            await goals.createGoal('Friendship', null, 'friendship');
            await goals.createGoal('Reading freely', null, 'reading');
            await goals.createGoal('Trust', 'friendship', 'trust');
            await goals.createGoal('Listening', 'friendship', 'listening');
            await goals.createGoal('Completed sibling', 'friendship', 'done');
            await goals.operate('done', 'complete');
            await goals.createGoal('Patience', 'trust', 'patience');
            goals.selectGoal('trust');
        });
        assert.equal(document.querySelector('.goal-breadcrumbs').textContent, 'GoalsFriendshipTrust');
        assert.equal(document.querySelector('#goal-up'), null);
        await click('.goal-edit');
        const editor = document.querySelector('#goal-panel textarea');
        await input(editor, 'Trust revised');
        editor.focus(); editor.setSelectionRange(3, 3);
        await hover(document.querySelector('[data-goal-crumb="trust"]'));
        assert.deepEqual([...document.querySelectorAll('[data-goal-option]')].map(n => n.dataset.goalOption), ['trust', 'listening'], 'hover shows ongoing siblings, excluding children and completed Goals');
        assert.equal(goals.selected, 'trust');
        assert.equal(document.activeElement, editor, 'hover does not steal editor focus');
        assert.equal(editor.selectionStart, 3);
        assert.ok(goals.edit, 'hover leaves the edit session open');
        await leave(document.querySelector('[data-goal-crumb="trust"]'));
        await hover(document.querySelector('.goal-breadcrumb-positioner'));
        await ui(() => delay(280));
        assert.ok(document.querySelector('[data-goal-option="listening"]'), 'moving from the crumb into the popup keeps it available');
        await hover(document.querySelector('[data-goal-crumb="friendship"]'));
        assert.deepEqual([...document.querySelectorAll('[data-goal-option]')].map(n => n.dataset.goalOption), ['friendship', 'reading'], 'another crumb switches the shared list to its own level');
        assert.equal(document.querySelectorAll('.goal-breadcrumb-picker').length, 1);
        await leave(document.querySelector('.goal-breadcrumb-positioner'));
        await ui(() => delay(280));
        assert.equal(document.querySelector('[data-goal-option]'), null, 'leaving the path and popup closes the list');
        await hover(document.querySelector('[data-goal-crumb="trust"]'));
        await click('[data-goal-option="listening"]');
        assert.equal(goals.selected, 'listening');
        assert.equal(document.querySelector('.goal-title').textContent, 'Listening');
        assert.equal(document.querySelector('.goal-breadcrumbs').textContent, 'GoalsFriendshipListening');
        assert.equal(document.querySelector('[data-goal-option]'), null);
        assert.equal(goals.state.goals.find(g => g.id === 'trust').text, 'Trust revised', 'navigation finishes and saves the prior edit');
        await click('[data-goal-crumb="friendship"]');
        assert.equal(goals.selected, 'friendship', 'ancestor text enters directly');
        await click('[data-goal-crumb="friendship"]');
        assert.equal(goals.edit, null, 'current path text never starts editing');
        await click('#goal-home-nav');
        assert.equal(goals.allGoals, true);
        await hover(document.querySelector('#goal-home-nav'));
        assert.equal(document.querySelector('[data-goal-option]'), null, 'Goals has no special hover tree');

        await ui(() => goals.selectGoal('trust'));
        await click('.goal-edit'); await input('#goal-panel textarea', 'Unsaved revision');
        const flush = goals.flush;
        goals.flush = async () => { throw new Error('Simulated save failure'); };
        await click('[data-goal-crumb="friendship"]');
        assert.equal(goals.selected, 'trust', 'failed saves preserve the previous selection');
        assert.equal(document.querySelector('#goal-panel textarea').value, 'Unsaved revision');
        assert.equal(localStorage.getItem('aura_selected_goal'), 'trust');
        goals.flush = flush;
        await ui(() => goals.flush());
        await ui(() => goals.navigateGoal('friendship'));
        assert.equal(goals.selected, 'friendship', 'navigation can be retried after saving recovers');
        const { loadGoalLibrary } = await import('../../dist/client/infrastructure/goalLibraryRepository.js');
        assert.equal((await loadGoalLibrary()).state.goals.find(g => g.id === 'trust').text, 'Unsaved revision');
        console.log('PASS: Goal breadcrumb sibling hover, pointer retention, editor focus, direct navigation and save-failure recovery');
    } finally { await c.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
