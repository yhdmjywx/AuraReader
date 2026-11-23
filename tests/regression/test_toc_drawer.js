const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<button id="btn-toc" aria-expanded="false">目录</button><nav id="toc-drawer" hidden><ul id="toc-list"></ul></nav><button id="outside">正文</button>', { url: 'http://localhost/' });
    const keys = ['window', 'document', 'localStorage'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        const { ReaderController } = await import('../../dist/client/features/reader/readerController.js');
        const byId = id => document.getElementById(id);
        const elements = { btnToc: byId('btn-toc'), tocDrawer: byId('toc-drawer'), tocList: byId('toc-list') };
        const reader = new ReaderController();
        let contentHeight = 200;
        Object.defineProperties(elements.tocList, {
            clientHeight: { value: 300 },
            scrollHeight: { get: () => contentHeight }
        });
        reader.initUI(elements);
        reader.setBook('toc', { pages: ['第一章', '第二章'], toc: [{ title: '第一章', page: 1 }, { title: '第二章', page: 2 }] });
        elements.btnToc.click(); assert.equal(elements.tocDrawer.classList.contains('open'), true);
        assert.equal(elements.btnToc.getAttribute('aria-expanded'), 'true');
        assert.equal(elements.tocDrawer.hidden, false);
        assert.equal(elements.tocDrawer.hasAttribute('data-can-scroll-down'), false, '短目录没有渐变提示');
        contentHeight = 500;
        const scrollTo = top => {
            elements.tocList.scrollTop = top;
            elements.tocList.dispatchEvent(new dom.window.Event('scroll'));
        };
        scrollTo(80);
        assert.equal(elements.tocDrawer.hasAttribute('data-can-scroll-down'), true, '下方有章节时显示渐变提示');
        scrollTo(199.5);
        assert.equal(elements.tocDrawer.hasAttribute('data-can-scroll-down'), false, '滚到底后隐藏渐变，容许亚像素取整');
        scrollTo(0);
        assert.equal(elements.tocDrawer.hasAttribute('data-can-scroll-down'), true, '向上滚动后恢复渐变');
        const chapter = elements.tocList.lastElementChild.querySelector('button');
        chapter.focus(); chapter.click();
        assert.equal(reader.getCurrentPage(), 2, '实际章节导航改变阅读位置');
        assert.equal(elements.tocDrawer.hidden, true);
        assert.equal(elements.tocDrawer.hasAttribute('data-can-scroll-down'), false);
        assert.equal(document.activeElement, elements.btnToc);
        elements.btnToc.click(); chapter.focus();
        assert.equal(chapter.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })), false);
        assert.equal(elements.btnToc.getAttribute('aria-expanded'), 'false');
        assert.equal(document.activeElement, elements.btnToc);
        byId('outside').addEventListener('click', event => event.stopPropagation());
        elements.btnToc.click(); byId('outside').focus(); byId('outside').click();
        assert.equal(elements.tocDrawer.hidden, true);
        assert.equal(document.activeElement, byId('outside'));
        elements.btnToc.click(); elements.btnToc.click();
        assert.equal(elements.tocDrawer.hidden, true);
        console.log('✅ 目录开合、长短列表的滚动提示、外部点击、Escape、章节跳转与焦点恢复通过');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
