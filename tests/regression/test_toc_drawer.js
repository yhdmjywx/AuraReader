const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<button id="btn-toc">目录</button><aside id="toc-drawer"><button id="btn-close-toc">关闭</button><ul id="toc-list"></ul></aside><button id="outside">正文</button>', { url: 'http://localhost/' });
    const keys = ['window', 'document', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        const { ReaderController } = await import('../../src/client/features/reader/readerController.js');
        const byId = id => document.getElementById(id);
        const elements = { btnToc: byId('btn-toc'), tocDrawer: byId('toc-drawer'), btnCloseToc: byId('btn-close-toc'), tocList: byId('toc-list') };
        const reader = new ReaderController();
        reader.initUI(elements);
        reader.setBook('toc', { pages: ['第一章', '第二章'], toc: [{ title: '第一章', page: 1 }, { title: '第二章', page: 2 }] });
        elements.btnToc.click(); assert.equal(elements.tocDrawer.classList.contains('open'), true);
        assert.equal(elements.btnToc.getAttribute('aria-expanded'), 'true');
        elements.tocList.lastElementChild.click();
        assert.equal(reader.getCurrentPage(), 2, '实际章节导航改变阅读位置');
        assert.equal(elements.tocDrawer.classList.contains('open'), false);
        elements.btnToc.click(); elements.btnCloseToc.click();
        assert.equal(elements.btnToc.getAttribute('aria-expanded'), 'false');
        elements.btnToc.click(); byId('outside').click();
        assert.equal(elements.tocDrawer.classList.contains('open'), false);
        elements.btnToc.click(); elements.btnToc.click();
        assert.equal(elements.tocDrawer.classList.contains('open'), false);
        console.log('✅ 实际目录按钮、关闭、外部点击、章节列表和跳转通过');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
