const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<main class="immersive-notes"><section id="reader"></section></main><button id="mode"></button><span id="text"></span><i id="icon"></i><button id="scroll"></button>', { url: 'http://localhost/' });
    const keys = ['window', 'document', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        const { LayoutController } = await import('../../src/client/features/layout/layoutController.js');
        const { ReaderEngine } = await import('../../src/client/domain/readerEngine.js');
        const byId = id => document.getElementById(id);
        let width = 1613;
        const elements = { workspaceContainer: document.querySelector('main'), readerPanel: byId('reader'), btnPageMode: byId('mode'), textPageMode: byId('text'), iconPageMode: byId('icon'), btnModeScroll: byId('scroll') };
        Object.defineProperty(elements.readerPanel, 'clientWidth', { get: () => width });
        Object.defineProperty(elements.workspaceContainer, 'clientWidth', { get: () => width });
        const layout = new LayoutController();
        layout.initUI(elements);
        assert.equal(layout.getEffectiveReaderMode(), 'single');
        elements.btnPageMode.click();
        assert.equal(layout.getEffectiveReaderMode(), 'double');
        assert.equal(elements.workspaceContainer.classList.contains('layout-double'), true);
        assert.equal(localStorage.getItem('aura_layout_mode'), 'double');
        assert.equal(elements.workspaceContainer.style.getPropertyValue('--reading-width'), '1192px');
        width = 1223;
        assert.equal(layout.checkResponsiveLayout(width).changed, true);
        layout.updateLayoutClasses();
        assert.equal(layout.getEffectiveReaderMode(), 'single');
        assert.equal(layout.getLayoutMode(), 'double', '降级不能覆盖偏好');
        assert.equal(elements.btnPageMode.classList.contains('auto-downgraded'), true);
        width = 1613; layout.checkResponsiveLayout(width); layout.updateLayoutClasses();
        assert.equal(layout.getEffectiveReaderMode(), 'double');
        elements.btnModeScroll.click();
        assert.equal(layout.getEffectiveReaderMode(), 'scroll');
        assert.equal(elements.workspaceContainer.classList.contains('layout-scroll'), true);
        elements.btnModeScroll.click();
        assert.equal(layout.getEffectiveReaderMode(), 'single');
        assert.equal(new LayoutController().getLayoutMode(), 'single');
        const engine = new ReaderEngine();
        engine.setBook('pages', { pages: ['1', '2', '3', '4', '5'] });
        assert.equal(engine.nextPage(false).page, 2);
        assert.equal(engine.prevPage(false).page, 1);
        assert.equal(engine.nextPage(true).page, 3);
        assert.equal(engine.nextPage(true).page, 5);
        assert.equal(engine.nextPage(true).page, 5, '奇数尾页不越界');
        assert.equal(engine.getSpreadPages().rightPage, null);
        assert.equal(engine.prevPage(true).page, 3);
        assert.equal(engine.prevPage(true).page, 1);
        assert.equal(engine.prevPage(true).page, 1);
        console.log('✅ 真实布局控制器：模式按钮、持久化、响应降级恢复、固定行宽和真实翻页边界通过');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
