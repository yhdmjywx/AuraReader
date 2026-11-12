const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<section><div class="reader-viewport"><div class="paper-container"><article class="book-paper"></article></div></div></section><aside>Notes</aside>',
        { url: 'http://localhost', pretendToBeVisual: true });
    const keys = ['window', 'document', 'localStorage', 'Node', 'NodeFilter'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const originalNow = Date.now;
    let runtime;
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        const { ReaderRuntime } = await import('../../dist/client/features/reader/readerRuntime.js');
        runtime = new ReaderRuntime();
        const host = document.querySelector('section');
        const viewport = document.querySelector('.reader-viewport');
        runtime.mount(host);
        let paper = runtime.reader.elements.bookPaper;
        let now = 0;
        Date.now = () => now;
        const wheel = (deltaY, options = {}, target = paper, elapsed = 300) => {
            now += elapsed;
            const event = new window.WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, ...options });
            target.dispatchEvent(event);
            return event;
        };
        assert.equal(wheel(100).defaultPrevented, false, 'empty reader leaves wheel alone');
        runtime.setBook({ id: 'wheel-book', title: 'Wheel', pages: ['<p>First</p>', '<p>Second</p>', '<p>Third</p>'] });
        runtime.setLayout({ mode: 'single' });
        assert.equal(wheel(100).defaultPrevented, true);
        assert.equal(runtime.getSnapshot().location.page, 2);
        assert.equal(paper.textContent, 'Second', 'wheel renders through existing navigation');
        assert.equal(wheel(100, {}, paper, 10).defaultPrevented, true);
        assert.equal(runtime.getSnapshot().location.page, 2, 'burst events do not skip pages');
        wheel(-100);
        assert.equal(runtime.getSnapshot().location.page, 1);
        wheel(-100);
        assert.equal(runtime.getSnapshot().location.page, 1, 'first-page boundary is preserved');
        for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { deltaX: 200 }]) {
            assert.equal(wheel(100, options).defaultPrevented, false);
        }
        assert.equal(wheel(0).defaultPrevented, false);
        const input = document.createElement('textarea');
        viewport.append(input);
        assert.equal(wheel(100, {}, input).defaultPrevented, false, 'editable descendants keep their own scrolling');
        input.remove();
        wheel(100, {}, document.querySelector('aside'));
        assert.equal(runtime.getSnapshot().location.page, 1, 'wheel outside reader does not navigate');
        runtime.setLayout({ mode: 'scroll' });
        assert.equal(wheel(100).defaultPrevented, false, 'continuous scrolling stays native');
        assert.equal(runtime.getSnapshot().location.page, 1);
        runtime.setLayout({ mode: 'single' });
        wheel(100); wheel(100); wheel(100);
        assert.equal(runtime.getSnapshot().location.page, 3, 'last-page boundary is preserved');
        runtime.destroy();
        assert.equal(wheel(-100).defaultPrevented, false, 'destroy removes wheel listener');
        assert.equal(runtime.reader.getCurrentPage(), 3);
        runtime.mount(host); runtime.mount(host);
        paper = runtime.reader.elements.bookPaper;
        wheel(-100);
        assert.equal(runtime.getSnapshot().location.page, 2, 'remount binds exactly one wheel listener');
        console.log('PASS: wheel direction, burst limiting, boundaries, reader scope, native scroll/zoom, and listener lifecycle');
    } finally {
        Date.now = originalNow;
        runtime?.destroy();
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
