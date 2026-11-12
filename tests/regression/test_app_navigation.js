const assert = require('node:assert/strict');
const { createWorkbench, ui, click } = require('../helpers/react-workbench.cjs');
(async () => {
    const dom = createWorkbench();
    window.__AURA_BOOTSTRAPPED__ = true;
    Object.defineProperty(document.getElementById('reading-workspace'), 'clientWidth', { value: 1440 });
    const storage = await require('../helpers/sqlite').clientStorage([
        { id: 'nav-a', title: 'Navigation A', pages: ['<p>First</p>', '<p>Second</p>'] },
        { id: 'nav-b', title: 'Navigation B', pages: ['<p>Another source</p>'] }
    ]);
    const a = await import('../../dist/client/main.js');
    try {
        await ui(() => a.startApp());
        assert.equal(a.navigation.surface, 'home');
        assert.equal(a.session.getCurrentBookId(), '', 'startup does not select a book');
        assert.equal(a.reader.getCurrentBook(), null);
        assert.equal(document.querySelector('#home-continue'), null);
        assert.equal(document.querySelector('#home-status').textContent, '');
        let goal, other;
        await ui(async () => {
            goal = await a.goals.createRoot('Reading purpose');
            other = await a.goals.createRoot('Another purpose');
            await a.coordinator.openBook('nav-a', undefined, { goalId: goal });
            a.reader.goToPage(2, 0, []);
            await a.home.open(); a.home.navigate(other);
        });
        assert.equal(a.goals.selected, goal, 'browsing Home keeps the reading intent');
        await click('#home-continue');
        await ui(() => a.home.prepareClose());
        assert.equal(a.navigation.surface, 'reader');
        assert.equal(a.reader.getCurrentPage(), 2);
        await ui(() => a.goals.openPage());
        assert.equal(a.navigation.surface, 'goal');
        await ui(() => a.goals.returnToReader());
        assert.equal(a.navigation.surface, 'reader');
        assert.equal(a.reader.getCurrentPage(), 2);
        await ui(() => a.home.open());
        await ui(async () => assert.equal((await a.coordinator.openBook('missing-book')).status, 'failed'));
        assert.equal(a.navigation.surface, 'home');
        assert.equal(a.session.getCurrentBookId(), 'nav-a');
        await ui(() => a.coordinator.openBook('nav-b', undefined, { goalId: null }));
        await ui(() => a.coordinator.deleteBook('nav-b'));
        assert.equal(a.navigation.surface, 'home');
        assert.equal(a.session.getCurrentBookId(), '');
        assert.equal(document.querySelector('#home-continue'), null);
        console.log('PASS: React bootstrap, explicit book selection, Home/resume/Goal navigation, source position and deletion');
    } finally {
        await ui(() => {
            a.readerRuntime.destroy();
            for (const host of [a.elements.goalPanel, document.getElementById('goal-home'), a.elements.shelfList, document.getElementById('font-current-custom'), ...document.querySelectorAll('[data-react-goal-overlays]')]) {
                if (host) require('../../dist/client/components/ui/renderSurface.js').renderSurface(host, null);
            }
        });
        await storage.drain(); await storage.close(); dom.window.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
