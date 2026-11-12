const assert = require('node:assert/strict');
const { createWorkbench, ui, click } = require('../helpers/react-workbench.cjs');
(async () => {
    const dom = createWorkbench();
    try {
        const { AppShell } = await import('../../dist/client/app/appShell.js');
        const elements = {};
        for (const [key,id] of Object.entries({ btnExportMenu:'btn-export-menu', exportPanel:'export-panel', exportBookTitle:'export-book-title', currentBookTitle:'current-book-title', btnAppearance:'btn-appearance', appearancePanel:'appearance-panel' })) elements[key] = document.getElementById(id);
        const shell = new AppShell(); shell.init(elements);
        document.documentElement.dataset.appSurface = 'reader';
        elements.currentBookTitle.textContent = '当前书籍';
        await click('#btn-export-menu');
        assert.equal(elements.exportPanel.classList.contains('open'), true);
        assert.equal(elements.exportBookTitle.textContent, '当前书籍');
        await click('#btn-appearance');
        assert.equal(elements.exportPanel.classList.contains('open'), false);
        await click('#btn-export-menu');
        assert.equal(elements.appearancePanel.classList.contains('open'), false);
        await ui(() => document.body.click());
        assert.equal(elements.exportPanel.classList.contains('open'), false);
        await click('#btn-export-menu'); document.getElementById('btn-export-markdown').focus();
        await ui(() => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true })));
        assert.equal(elements.exportPanel.classList.contains('open'), false);
        assert.equal(document.activeElement, elements.btnExportMenu);
        for (const id of ['btn-export-markdown','btn-export-chapters','btn-export-current-chapter','btn-export-all-chapters','btn-select-chapters']) {
            assert.equal(document.querySelectorAll('#' + id).length, 1);
            assert.ok(elements.exportPanel.contains(document.getElementById(id)));
        }
        for (const id of ['btn-export-full-backup', 'btn-import-full-backup', 'backup-file-input', 'btn-theme-toggle']) {
            assert.equal(document.querySelectorAll('#' + id).length, 1);
            assert.ok(document.getElementById('workspace-settings-panel').contains(document.getElementById(id)));
        }
        assert.equal(document.getElementById('btn-fullscreen'), null);
        console.log('PASS: React export hosts, exclusive panels, current title, outside close and keyboard focus return');
    } finally { dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
