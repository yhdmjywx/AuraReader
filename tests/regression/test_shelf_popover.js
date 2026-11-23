const assert = require('node:assert/strict');
const { createWorkbench, ui, click, input, waitFor } = require('../helpers/react-workbench.cjs');
(async () => {
    const dom = createWorkbench();
    const title = '长书名😀 <img src=x onerror=alert(1)>';
    const storage = await require('../helpers/sqlite').clientStorage([{ id:'shelf-book', title, format:'EPUB', pages:['First','Second'] }]);
    try {
        const { ShelfController } = await import('../../dist/client/features/shelf/shelfController.js');
        const { AppShell } = await import('../../dist/client/app/appShell.js');
        const repository = await import('../../dist/client/infrastructure/bookRepository.js');
        const elements = {};
        for (const [key,id] of Object.entries({ btnShelf:'btn-shelf', shelfPanel:'shelf-panel', shelfList:'shelf-list', shelfBookCount:'shelf-book-count', btnImportBook:'btn-import-book', fileInput:'file-input', btnAppearance:'btn-appearance', appearancePanel:'appearance-panel', btnExportMenu:'btn-export-menu', exportPanel:'export-panel' })) elements[key] = document.getElementById(id);
        let opened, deleted = false, deletion, imported;
        const shell = new AppShell();
        const shelf = new ShelfController({ callbacks: {
            onOpen: () => { shell.closeAppearance(); shell.closeExportPanel(); },
            onOpenBook: id => { opened = id; },
            onDeleteBook: id => deletion = repository.deleteBookFromDB(id).then(() => { deleted = true; })
        } });
        shelf.initUI(elements); shell.init(elements, {
            onOpenPanel: () => shelf.closeShelf(),
            onImportFile: file => { imported = file; }
        });
        document.documentElement.dataset.appSurface = 'reader';
        await ui(() => shelf.openShelf()); await ui(() => shelf.refreshShelf());
        assert.equal(elements.shelfPanel.classList.contains('open'), true);
        assert.equal(elements.shelfPanel.querySelector('.shelf-header, #btn-switch-demo, #btn-close-shelf'), null);
        assert.equal(elements.shelfList.nextElementSibling.contains(elements.btnImportBook), true);
        assert.equal(elements.shelfPanel.getAttribute('aria-label'), 'Local library');
        assert.equal(elements.btnImportBook.textContent, '');
        assert.equal(elements.btnImportBook.getAttribute('aria-label'), 'Import book');
        assert.ok(elements.btnImportBook.querySelector('svg'));
        Object.defineProperties(elements.shelfList, {
            clientHeight: { value: 200 },
            scrollHeight: { value: 400 }
        });
        elements.shelfList.dispatchEvent(new dom.window.Event('scroll'));
        assert.equal(elements.shelfPanel.hasAttribute('data-can-scroll-down'), true);
        elements.shelfList.scrollTop = 200;
        elements.shelfList.dispatchEvent(new dom.window.Event('scroll'));
        assert.equal(elements.shelfPanel.hasAttribute('data-can-scroll-down'), false);
        let choseFile = false;
        elements.fileInput.addEventListener('click', () => { choseFile = true; }, { once: true });
        await click(elements.btnImportBook);
        assert.equal(choseFile, true, 'the icon opens the existing file input');
        const file = new dom.window.File(['Chapter'], 'shelf-import.txt', { type: 'text/plain' });
        Object.defineProperty(elements.fileInput, 'files', { value: [file] });
        await ui(() => elements.fileInput.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
        assert.equal(imported, file);
        assert.equal(elements.shelfPanel.classList.contains('open'), false);
        await ui(() => shelf.openShelf()); await ui(() => shelf.refreshShelf());
        await input('#shelf-list input', '长书名');
        assert.equal(document.querySelectorAll('.shelf-entry').length, 1);
        assert.equal(document.querySelector('.shelf-book-title').textContent, title);
        assert.equal(document.querySelector('.shelf-entry img'), null, 'book titles remain text');
        await click('.shelf-book-open');
        assert.equal(opened, 'shelf-book');
        assert.equal(elements.shelfPanel.classList.contains('open'), false);
        await ui(() => shelf.openShelf()); await ui(() => shelf.refreshShelf());
        await click('.shelf-book-delete');
        assert.ok(document.querySelector('.ui-dialog[data-open]'));
        await click('.ui-dialog[data-open] .ui-dialog-actions button');
        assert.ok(await repository.loadBookFromDB('shelf-book'), 'cancel retains the book');
        await click('.shelf-book-delete'); await click('.ui-dialog[data-open] .ui-button-danger');
        await ui(() => deletion); await waitFor(() => deleted);
        assert.equal(await repository.loadBookFromDB('shelf-book'), null);
        await ui(() => shelf.openShelf()); await ui(() => shelf.refreshShelf());
        await ui(() => document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true })));
        assert.equal(elements.shelfPanel.classList.contains('open'), false);
        assert.equal(document.activeElement, elements.btnShelf);
        await click('#btn-appearance'); await click('#btn-shelf');
        assert.equal(elements.appearancePanel.classList.contains('open'), false);
        await click('#btn-workspace-settings');
        await click('#btn-export-menu');
        assert.equal(elements.shelfPanel.classList.contains('open'), false);
        await ui(() => require('../../dist/client/components/ui/renderSurface.js').renderSurface(elements.shelfList, null));
        console.log('PASS: React shelf footer import, scroll hint, search/text rendering, open/delete/cancel, Escape/focus and exclusive panels');
    } finally { await storage.close(); dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
