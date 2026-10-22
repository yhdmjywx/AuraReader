const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { setTimeout: delay } = require('node:timers/promises');

(async () => {
    const dom = new JSDOM('<main id="reader"><article id="left">左页原文</article><article id="right">右页原文</article><div id="selection-tooltip"><button id="add">记笔记</button></div></main><button id="outside">空白</button>');
    const keys = ['window', 'document', 'NodeFilter'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        keys.forEach(key => globalThis[key] = dom.window[key]);
        const { SelectionController } = await import('../../dist/client/features/annotations/selectionController.js');
        const byId = id => document.getElementById(id);
        const elements = { readerPanel: byId('reader'), bookPaper: byId('left'), bookPaperRight: byId('right'), selectionTooltip: byId('selection-tooltip'), btnAddNote: byId('add') };
        const created = [];
        const controller = new SelectionController({ callbacks: {
            getReadingContext: () => ({ currentPage: 1, currentLeftPage: 1, currentRightPage: 2 }),
            onCreateNote: data => { assert.equal(window.getSelection().rangeCount, 0); created.push(data); }
        } });
        controller.initUI(elements);
        for (const [paper, event, expectedPage] of [[elements.bookPaper, 'mouseup', 1], [elements.bookPaperRight, 'touchend', 2]]) {
            const range = document.createRange(); range.selectNodeContents(paper);
            range.getBoundingClientRect = () => ({ left: 60, top: 90, width: 120, height: 24 });
            window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
            paper.dispatchEvent(new window.Event(event, { bubbles: true }));
            await delay(45);
            assert.equal(elements.selectionTooltip.style.display, 'flex', '松开选区后菜单显示');
            paper.click();
            assert.equal(elements.selectionTooltip.style.display, 'flex', '随后的 click 冒泡不能误关菜单');
            assert.equal(controller.pendingSelection.page, expectedPage);
            elements.btnAddNote.click();
            assert.equal(created.length, expectedPage, '每次点击只创建一次');
            assert.equal(created.at(-1).quote, paper.textContent);
            assert.equal(created.at(-1).page, expectedPage);
            assert.equal(elements.selectionTooltip.style.display, 'none');
            assert.equal(controller.pendingSelection, null);
        }
        elements.btnAddNote.click(); assert.equal(created.length, 2);
        elements.selectionTooltip.style.display = 'flex'; byId('outside').click();
        assert.equal(elements.selectionTooltip.style.display, 'none', '无选区的外部点击关闭菜单');
        console.log('✅ 实际左右页 mouseup/touchend、click 冒泡、单次创建和外部关闭通过');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
