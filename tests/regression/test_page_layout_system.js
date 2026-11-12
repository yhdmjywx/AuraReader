const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
(async () => {
    const dom = new JSDOM('<main class="immersive-notes"></main><button id="single"></button><button id="scroll"></button>', { url: 'http://localhost/' });
    global.window = dom.window; global.document = dom.window.document; global.localStorage = dom.window.localStorage;
    try {
        const { LayoutController } = await import('../../dist/client/features/layout/layoutController.js');
        const { ReaderEngine } = await import('../../dist/client/domain/readerEngine.js');
        localStorage.setItem('aura_layout_mode', 'double');
        const layout = new LayoutController();
        assert.equal(layout.getLayoutMode(), 'single');
        assert.equal(localStorage.getItem('aura_layout_mode'), 'single', 'legacy double preference migrates');
        let width = 1920;
        const elements = { workspaceContainer: document.querySelector('main'), btnModeSingle: document.getElementById('single'), btnModeScroll: document.getElementById('scroll') };
        Object.defineProperty(elements.workspaceContainer, 'clientWidth', { get: () => width });
        layout.initUI(elements);
        elements.btnModeScroll.click(); assert.equal(layout.getLayoutMode(), 'scroll');
        assert.equal(elements.btnModeScroll.getAttribute('aria-pressed'), 'true');
        for (width of [800, 1440, 1920]) {
            layout.updateLayoutClasses();
            assert.equal(layout.getLayoutMode(), 'scroll', 'resize only changes geometry');
            assert.equal(elements.workspaceContainer.dataset.notesPlacement, 'right');
            assert.ok(elements.workspaceContainer._marginGeometry.readingWidth <= 560);
        }
        elements.btnModeSingle.click(); assert.equal(layout.getLayoutMode(), 'single');
        assert.equal(new LayoutController().getLayoutMode(), 'single');
        const { AppShell } = await import('../../dist/client/app/appShell.js');
        new AppShell().init(elements);
        const key = new window.KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true });
        document.body.dispatchEvent(key); assert.equal(key.defaultPrevented, false, 'removed double shortcut is unbound');
        const engine = new ReaderEngine(); engine.setBook('pages', { pages: ['1','2','3'] });
        assert.equal(engine.nextPage().page, 2); assert.equal(engine.nextPage().page, 3); assert.equal(engine.nextPage().page, 3);
        assert.equal(engine.prevPage().page, 2); assert.equal(engine.prevPage().page, 1); assert.equal(engine.prevPage().page, 1);
        console.log('Layout: preference migration, single/scroll controls, resize geometry, removed shortcut and page boundaries passed.');
    } finally { dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
