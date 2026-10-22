const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<article><p>前文<b>第一段😀</b> &amp; 继续。</p><p><i>第二段</i>结束。</p><p>未选中</p></article>');
    const keys = ['document', 'NodeFilter'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        const { renderAnnotationTokens } = await import('../../dist/client/features/reader/annotationRenderer.js');
        const root = document.querySelector('article');
        const text = root.textContent;
        const quote = '第一段😀 & 继续。第二段结束。';
        const start = text.indexOf('第一段');
        renderAnnotationTokens(root, [{ id: 'cross', kind: 'highlight', page: 1, quote, location: { start, end: start + quote.length } }], 1);
        const tokens = [...root.querySelectorAll('[data-highlight-ids~="cross"]')];
        assert.equal(tokens.map(node => node.textContent).join(''), quote);
        assert.ok(root.querySelector('b .has-highlight'));
        assert.ok(root.querySelector('i .has-highlight'));
        assert.equal(root.querySelectorAll('p').length, 3);
        assert.equal(root.lastElementChild.querySelector('.annotation-token'), null);
        assert.equal(root.textContent, text, '标注不能改变原文和 HTML 实体');
        assert.equal(root.querySelector('.annotation-token .annotation-token'), null);
        console.log('✅ 真实 DOM 跨段高亮：粗体、斜体、实体、emoji、选区边界和非嵌套标记通过');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
