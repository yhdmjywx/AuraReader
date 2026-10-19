const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM(fs.readFileSync('src/client/index.html', 'utf8'), { url: 'http://localhost/' });
    const keys = ['window', 'document', 'localStorage', 'confirm'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let storage;
    try {
        keys.slice(0, 3).forEach(key => globalThis[key] = dom.window[key]);
        const longTitle = '很长的书名😀'.repeat(30) + '<img src=x onerror=alert(1)>';
        const book = { id: 'shelf-book', title: longTitle, format: 'EPUB', pages: ['第一章', '第二章'] };
        storage = await require('../helpers/sqlite').clientStorage([book]);
        const { renderShelf } = await import('../../src/client/features/shelf/shelfUI.js');
        const { ShelfController } = await import('../../src/client/features/shelf/shelfController.js');
        const { AppShell } = await import('../../src/client/app/appShell.js');
        const repo = await import('../../src/client/infrastructure/bookRepository.js');
        const byId = id => document.getElementById(id);
        const elements = Object.fromEntries(Object.entries({
            btnShelf: 'btn-shelf', shelfPanel: 'shelf-panel', shelfList: 'shelf-list', shelfBookCount: 'shelf-book-count',
            btnCloseShelf: 'btn-close-shelf', btnImportBook: 'btn-import-book', fileInput: 'file-input', btnSwitchDemo: 'btn-switch-demo',
            btnAppearance: 'btn-appearance', appearancePanel: 'appearance-panel', btnExportMenu: 'btn-export-menu', exportPanel: 'export-panel'
        }).map(([key, id]) => [key, byId(id)]));
        assert.equal(byId('shelf-overlay'), null);
        assert.ok(elements.shelfPanel.classList.contains('appearance-panel'), '直接复用外观面板容器');
        renderShelf({ elements });
        assert.ok(elements.shelfList.querySelector('.shelf-empty'));
        assert.equal(elements.shelfBookCount.hidden, true);
        let opened, deletion, confirmed = false, imports = 0, demos = 0, pageTurns = 0;
        globalThis.confirm = () => confirmed;
        const shell = new AppShell();
        const shelf = new ShelfController({ callbacks: {
            onOpen: () => { shell.closeAppearance(); shell.closeExportPanel(); },
            onOpenBook: id => opened = id,
            onDeleteBook: id => { deletion = repo.deleteBookFromDB(id); return deletion; }
        } });
        shelf.initUI(elements);
        shell.init(elements, { onOpenPanel: () => shelf.closeShelf(), onSwitchDemo: () => demos++, onImportFile: () => imports++, onNextPage: () => pageTurns++ });
        const isOpen = () => elements.shelfPanel.classList.contains('open');
        elements.btnShelf.click(); await shelf.refreshShelf();
        assert.ok(isOpen());
        assert.equal(elements.btnShelf.getAttribute('aria-expanded'), 'true');
        assert.equal(elements.shelfPanel.getAttribute('aria-hidden'), 'false');
        assert.equal(elements.shelfPanel.style.right, '', '统一由外观面板 CSS 定位，不再向书库图标偏移');
        assert.equal(elements.shelfList.querySelectorAll('.shelf-entry').length, 3);
        const openButton = [...elements.shelfList.querySelectorAll('.shelf-book-open')].find(button => button.title === longTitle);
        assert.equal(openButton.querySelector('.shelf-book-title').textContent, longTitle);
        assert.equal(openButton.querySelector('.shelf-book-meta').textContent, 'EPUB · 2 章节');
        assert.equal(openButton.querySelector('img'), null, '书名作为文本渲染');
        elements.shelfPanel.querySelector('h2').click(); assert.ok(isOpen());
        document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        assert.equal(pageTurns, 0, '操作书库期间不翻动背后的正文');
        elements.btnShelf.click(); assert.equal(isOpen(), false);
        elements.btnShelf.click();
        document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(isOpen(), false); assert.equal(document.activeElement, elements.btnShelf);
        elements.btnShelf.click(); document.body.click(); assert.equal(isOpen(), false);
        elements.btnShelf.click(); elements.btnCloseShelf.click(); assert.equal(isOpen(), false);
        elements.btnAppearance.click(); elements.btnShelf.click();
        assert.equal(elements.appearancePanel.classList.contains('open'), false);
        elements.btnExportMenu.click(); assert.equal(isOpen(), false);
        elements.btnShelf.click(); assert.equal(elements.exportPanel.classList.contains('open'), false);
        elements.btnAppearance.click(); assert.equal(isOpen(), false);
        elements.btnShelf.click(); await shelf.refreshShelf();
        [...elements.shelfList.querySelectorAll('.shelf-book-open')].find(button => button.title === longTitle).click();
        assert.equal(opened, book.id); assert.equal(isOpen(), false);
        elements.btnShelf.click(); await shelf.refreshShelf();
        const removeButton = () => [...elements.shelfList.querySelectorAll('.shelf-entry')].find(row => row.querySelector('.shelf-book-open').title === longTitle).querySelector('.shelf-book-delete');
        opened = null; removeButton().click();
        assert.ok(await repo.loadBookFromDB(book.id), '取消确认后仍存在');
        assert.equal(opened, null); assert.ok(isOpen(), '删除不是打开入口');
        confirmed = true; removeButton().click(); await deletion; await shelf.refreshShelf();
        assert.equal(await repo.loadBookFromDB(book.id), null);
        assert.equal(opened, null); assert.ok(isOpen());
        elements.btnSwitchDemo.click(); assert.equal(demos, 1); assert.equal(isOpen(), false);
        let chooserClicks = 0;
        elements.fileInput.addEventListener('click', () => chooserClicks++);
        elements.btnShelf.click(); elements.btnImportBook.click(); assert.equal(chooserClicks, 1);
        Object.defineProperty(elements.fileInput, 'files', { value: [new window.File(['正文'], 'book.txt')] });
        elements.fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert.equal(imports, 1); assert.equal(isOpen(), false);
        const many = Array.from({ length: 100 }, (_, i) => ({ ...book, id: 'many-' + i }));
        renderShelf({ elements, books: many });
        assert.equal(elements.shelfList.children.length, 100);
        assert.equal(elements.shelfBookCount.textContent, '100');
        assert.equal(elements.shelfList.querySelectorAll('.shelf-book-open').length, 100);
        window.dispatchEvent(new window.Event('resize'));
        assert.equal(elements.shelfPanel.style.right, '', '窗口变化也不引入单独的书库横向定位');
        renderShelf({ elements, books: [] });
        assert.equal(elements.shelfBookCount.hidden, true);
        console.log('✅ 书库 Popover：真实查询/删除、列表打开、空书库/长标题/100 本、外部关闭/Esc/焦点、互斥、导入和示例入口通过');
    } finally {
        await storage?.close(); dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
