const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const { ReadingToolsDisclosure } = await import('../../dist/client/features/workbench/readingToolsDisclosure.js');
    const { window } = new JSDOM(`
        <div id="reading-tools">
            <div id="reader-tool-group">
                <button id="btn-toc">Contents</button>
                <nav class="reader-tool-panel" hidden></nav>
            </div>
            <button id="btn-reading-tools" inert>Reading tools</button>
        </div>
        <button id="outside">Outside</button>`);
    const { document } = window;
    const root = document.getElementById('reading-tools');
    const group = document.getElementById('reader-tool-group');
    const trigger = document.getElementById('btn-reading-tools');
    const contents = document.getElementById('btn-toc');
    const outside = document.getElementById('outside');
    const panel = root.querySelector('nav');
    const collapsed = () => root.hasAttribute('data-collapsed');

    let now = 0;
    let sequence = 0;
    const scheduled = new Map();
    window.performance.now = () => now;
    window.setTimeout = (callback, delay) => {
        scheduled.set(++sequence, { callback, at: now + delay });
        return sequence;
    };
    window.clearTimeout = id => scheduled.delete(id);
    function advance(delay) {
        const end = now + delay;
        while (scheduled.size) {
            const [id, timer] = [...scheduled].sort((a, b) => a[1].at - b[1].at)[0];
            if (timer.at > end) break;
            now = timer.at;
            scheduled.delete(id);
            timer.callback();
        }
        now = end;
    }
    const pointer = type => root.dispatchEvent(new window.Event(type));
    const escape = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    const settle = () => new Promise(resolve => queueMicrotask(resolve));

    try {
        const tools = new ReadingToolsDisclosure(root);
        tools.setBook('paged');
        advance(15_000);
        assert.equal(collapsed(), false, 'an open book requires actual reading activity');
        tools.pageTurned();
        advance(9_500);
        tools.pageTurned();
        advance(9_999);
        assert.equal(collapsed(), false, 'subsequent page turns reset the grace period');
        panel.classList.add('open');
        await settle();
        advance(2_000);
        assert.equal(collapsed(), false, 'an open popup holds the group after the deadline');
        panel.classList.remove('open');
        await settle();
        advance(220);
        assert.equal(collapsed(), true);
        assert.equal(group.hasAttribute('inert'), true);
        assert.equal(trigger.tabIndex, 0);

        pointer('pointerenter');
        assert.equal(collapsed(), false, 'hover reveals the full group');
        pointer('pointerleave');
        advance(219);
        assert.equal(collapsed(), false, 'pointer can return during a short grace period');
        pointer('pointerenter');
        advance(220);
        assert.equal(collapsed(), false);
        escape();
        await settle();
        assert.equal(collapsed(), true, 'Escape dismisses a group already past its first collapse');

        trigger.focus();
        assert.equal(document.activeElement, contents, 'keyboard reveal passes focus into the group');
        advance(1_000);
        assert.equal(collapsed(), false, 'focus holds the group');
        tools.dismiss();
        assert.equal(document.activeElement, trigger, 'explicit dismissal returns keyboard focus');
        assert.equal(collapsed(), true, 'restoring focus leaves the group collapsed');
        outside.focus();

        tools.setBook('scroll');
        assert.equal(collapsed(), false, 'a new book shows all tools');
        tools.scrolled(249, 500);
        advance(12_000);
        assert.equal(collapsed(), false, 'less than half a viewport does not start the timer');
        tools.scrolled(1, 500);
        advance(9_500);
        tools.scrolled(30, 500);
        advance(9_999);
        assert.equal(collapsed(), false, 'continuous movement resets the grace period');
        advance(1);
        assert.equal(collapsed(), true);
        tools.setBook('');
        tools.setBook('unread');
        assert.equal(collapsed(), false);
        tools.setBook('paged');
        assert.equal(collapsed(), true, 'switching back preserves the book’s state');
        console.log('✅ 阅读工具生命周期、10 秒缓冲、浮层与焦点保护、按书籍恢复通过');
    } finally {
        window.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
