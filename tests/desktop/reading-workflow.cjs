// One end-to-end check of the shipped React workflow, using an isolated SQLite library.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
const { app, BrowserWindow } = require('electron');
const { startDesktop } = require('../../src/desktop/main.cjs');

BrowserWindow.prototype.show = function () {};
const errors = [];
const noteText = 'A React note\n中文输入保持光标';
app.on('web-contents-created', (_event, contents) => {
    contents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
});
const watchdog = setTimeout(() => { console.error('React workflow timed out', errors); app.exit(1); }, 40000);

(async () => {
    const output = path.resolve(process.argv[2]);
    const window = await startDesktop({ profileDirectory: path.join(output, 'react-workflow-profile') });
    window.webContents.setBackgroundThrottling(false);
    const run = source => window.webContents.executeJavaScript(source, true);
    const waitFor = expression => run(`(async () => {
        const end = Date.now() + 15000;
        while (!(${expression})) { if (Date.now() > end) throw new Error(${JSON.stringify(expression)} + '\\nActive: ' + document.activeElement?.outerHTML); await new Promise(resolve => setTimeout(resolve, 20)); }
    })()`);
    const capture = async name => {
        await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 500))))`);
        await fs.writeFile(path.join(output, name + '.png'), (await window.webContents.capturePage()).toPNG());
    };
    await waitFor(`document.documentElement.dataset.desktopReady === 'setup'`);
    await run(`document.getElementById('desktop-create-library').click()`);
    await waitFor(`document.documentElement.dataset.reactWorkbench === 'true'`);
    const files = await fs.readdir(path.resolve('dist/renderer/assets'));
    const mainUrl = 'aurareader://app/assets/' + files.find(file => /^main-.*\.js$/.test(file));
    const zip = new JSZip();
    zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>');
    zip.file('book.opf', '<package><metadata><dc:language xmlns:dc="http://purl.org/dc/elements/1.1/">en</dc:language></metadata><manifest><item id="one" href="one.xhtml"/><item id="two" href="two.xhtml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>');
    zip.file('one.xhtml', '<html><body><h1>Source one</h1>' + Array.from({ length: 50 }, (_, i) => `<p>Alpha evidence ${i}. Reading with a purpose connects books and notes.</p>`).join('') + '</body></html>');
    zip.file('two.xhtml', '<html><body><h1>Source two</h1><p>Another chapter in the first book.</p></body></html>');
    const epub = await zip.generateAsync({ type: 'base64' });
    await run(`(async () => {
        const a = await import(${JSON.stringify(mainUrl)});
        const bytes = Uint8Array.from(atob(${JSON.stringify(epub)}), c => c.charCodeAt(0));
        await a.coordinator.importBook(new File([bytes], 'React workflow A.epub'));
        await a.coordinator.importBook(new File(['Second book for the shared Goal.'], 'React workflow B.txt'));
    })()`);
    await waitFor(`document.getElementById('shelf-book-count').textContent === '2'`);
    await run(`document.querySelector('.brand').click()`);
    await waitFor(`document.documentElement.dataset.appSurface === 'home' && document.querySelector('#home-books .home-book-title')`);
    await run(`document.getElementById('home-new-goal').click()`);
    await waitFor(`document.getElementById('home-goal-draft')`);
    await run(`(() => {
        const input = document.getElementById('home-goal-draft');
        input.value = 'Connect evidence across books';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await run(`document.getElementById('home-goal-form').requestSubmit()`);
    await waitFor(`document.querySelector('#home-goal-folders .home-goal-folder')?.textContent.includes('Connect evidence')`);
    await run(`document.querySelector('#home-goal-folders .home-goal-folder').click()`);
    await waitFor(`document.getElementById('home-add-book')`);
    await run(`document.getElementById('home-add-book').click()`);
    await waitFor(`document.querySelector('.ui-dialog[data-open] .ui-book-picker li')`);
    await run(`(() => { const row = [...document.querySelectorAll('.ui-book-picker li')].find(row => row.textContent.includes('workflow A')); row.querySelector('button').click(); })()`);
    await waitFor(`!document.querySelector('.ui-dialog[data-open]') && document.querySelector('#home-books .goal-home-book')`);
    await run(`document.querySelector('#home-books .goal-home-book').click()`);
    await waitFor(`document.documentElement.dataset.appSurface === 'reader' && document.getElementById('book-paper').textContent.includes('Alpha evidence') && document.querySelector('#goal-panel .goal-title')`);
    assert.equal(await run(`!!document.querySelector('#goal-panel select, #goal-panel .goal-collections, #react-reading-book select')`), false, 'reader omits redundant filters, collections and book picker');
    assert.equal(await run(`document.getElementById('btn-fullscreen') === null && document.getElementById('goal-expand') !== null`), true, 'EPUB fullscreen is removed and Goal expansion remains');
    assert.equal(await run(`['btn-toc', 'btn-shelf', 'btn-appearance', 'btn-export-menu'].every(id => !!document.getElementById(id).closest('.reader-toolbar'))`), true, 'book actions belong to the reading surface');
    for (const theme of ['light', 'dark']) {
        if (theme === 'dark') await run(`(async () => { const a = await import(${JSON.stringify(mainUrl)}); a.appShell.toggleAppTheme(); })()`);
        assert.equal(await run(`getComputedStyle(document.querySelector('.app-header')).backgroundColor === getComputedStyle(document.getElementById('goal-sidebar')).backgroundColor`), true, `${theme} header shares the Goal background`);
        await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 500))))`);
        await fs.writeFile(path.join(output, `reader-ui-${theme}.png`), (await window.webContents.capturePage()).toPNG());
    }
    await run(`(async () => { const a = await import(${JSON.stringify(mainUrl)}); a.appShell.toggleAppTheme(); })()`);
    await run(`document.querySelector('#goal-panel .goal-title').click()`);
    await waitFor(`document.querySelector('#goal-panel textarea')`);
    await run(`(() => {
        window.goalCaretCheck = document.querySelector('#goal-panel textarea');
        goalCaretCheck.setSelectionRange(4, 4);
        document.getElementById('goal-resizer').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    })()`);
    assert.equal(await run(`document.querySelector('#goal-panel textarea') === goalCaretCheck && goalCaretCheck.selectionStart === 4`), true, 'resizing retains the existing Goal editor and caret');
    assert.equal(await run(`getComputedStyle(document.documentElement).getPropertyValue('--goal-sidebar-space').trim() === document.getElementById('goal-sidebar').style.width`), true, 'workspace controls follow the actual Goal width');
    await run(`document.getElementById('goal-resizer').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); goalCaretCheck.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));`);
    await waitFor(`!document.querySelector('#goal-panel textarea')`);
    await run(`(() => {
        const paper = document.getElementById('book-paper'), text = paper.querySelector('p').firstChild;
        const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 16);
        getSelection().removeAllRanges(); getSelection().addRange(range);
        paper.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    })()`);
    await waitFor(`document.getElementById('selection-tooltip').style.display === 'flex'`);
    await run(`document.querySelector('#react-selection-actions [aria-label="添加笔记"]').click()`);
    await waitFor(`document.activeElement?.classList.contains('note-editor')`);
    await run(`(() => {
        const editor = document.querySelector('#react-notes textarea');
        editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        editor.value = ${JSON.stringify(noteText)};
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true }));
    })()`);
    assert.equal(await run(`!!document.querySelector('#react-notes textarea')`), true, 'IME Enter does not finish editing');
    await run(`(() => {
        const editor = document.querySelector('#react-notes textarea');
        editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    })()`);
    await waitFor(`!document.querySelector('#react-notes textarea') && document.querySelector('#react-notes [aria-label="Add to goal"]:not(:disabled)')`);
    await run(`document.querySelector('#react-notes [aria-label="Add to goal"]').click()`);
    await waitFor(`document.querySelector('#goal-panel .goal-item-text')?.textContent.includes('A React note') && document.querySelector('#react-notes [aria-label="Added to goal"]')`);
    const saved = await run(`(async () => {
        const a = await import(${JSON.stringify(mainUrl)}); await a.annotations.assertInlineWritesSaved(); await a.goals.assertWritesSaved();
        const notes = (await auraDesktop.storage.queryNotes({ bookIds: [a.session.getCurrentBookId()] })).value.records;
        const library = (await auraDesktop.storage.queryGoalLibrary()).value;
        return { notes: notes.map(record => record.value), links: library.value.links, bookId: a.session.getCurrentBookId() };
    })()`);
    assert.equal(saved.notes[0].comment, noteText);
    assert.equal(saved.links.length, 1);
    assert.equal(saved.links[0].annotationId, saved.notes[0].id);
    await run(`document.getElementById('btn-shelf').click()`);
    await waitFor(`document.querySelectorAll('#shelf-list .shelf-entry').length === 2`);
    await run(`(() => {
        const row = [...document.querySelectorAll('#shelf-list .shelf-entry')].find(row => row.textContent.includes('workflow B'));
        row.querySelector('.shelf-book-title').click();
    })()`);
    await waitFor(`document.getElementById('book-paper').textContent.includes('Second book')`);
    await run(`document.querySelector('#goal-panel .goal-item-text').click()`);
    await waitFor(`document.getElementById('book-paper').textContent.includes('Alpha evidence') && document.querySelector('.annotation-token.is-active')`);
    await run(`document.getElementById('btn-shelf').click()`);
    await waitFor(`document.querySelector('#shelf-list [aria-label="搜索书库"]')`);
    await run(`(() => {
        const input = document.querySelector('#shelf-list input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'workflow B');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(`document.querySelectorAll('#shelf-list .shelf-entry').length === 1 && document.querySelector('#shelf-list .shelf-book-title').textContent.includes('workflow B')`);
    await run(`document.getElementById('btn-close-shelf').click(); document.getElementById('btn-appearance').click()`);
    await waitFor(`document.activeElement?.id === 'font-family-select'`);
    await capture('reader-settings');
    await run(`document.getElementById('btn-font-inc').click()`);
    await waitFor(`document.getElementById('font-size-label').textContent === '19px'`);
    await run(`document.getElementById('btn-export-menu').click()`);
    await waitFor(`document.getElementById('export-panel').classList.contains('open') && !document.getElementById('appearance-panel').classList.contains('open')`);
    await run(`document.getElementById('btn-export-chapters').click(); document.getElementById('btn-select-chapters').click()`);
    await waitFor(`document.querySelectorAll('#chapter-export-list input').length > 0`);
    await run(`document.querySelector('#chapter-export-list input').click()`);
    await waitFor(`document.getElementById('btn-confirm-chapter-export').disabled === false`);
    await run(`document.getElementById('btn-workspace-settings').click()`);
    await waitFor(`document.getElementById('workspace-settings-panel').getClientRects().length > 0 && !document.getElementById('export-panel').classList.contains('open')`);
    await capture('workspace-settings');
    await run(`document.getElementById('btn-export-full-backup').click()`);
    await waitFor(`document.querySelector('#backup-select-modal[data-open] input.chk-backup-book')`);
    await run(`document.getElementById('btn-deselect-all-backup').click()`);
    assert.equal(await run(`document.querySelectorAll('#backup-select-modal input.chk-backup-book:checked').length`), 0);
    await run(`document.getElementById('btn-cancel-backup-modal').click()`);
    await waitFor(`!document.querySelector('#backup-select-modal[data-open]')`);
    await run(`document.getElementById('goal-expand').click()`);
    await waitFor(`document.documentElement.dataset.appSurface === 'goal' && document.querySelector('#goal-page-content #goal-panel .goal-title')`);
    await capture('goal-workspace');
    await run(`document.querySelector('#goal-panel .goal-title').click()`);
    await waitFor(`document.activeElement === document.querySelector('#goal-panel textarea')`);
    await run(`(() => {
        const editor = document.querySelector('#goal-panel textarea'); editor.value = 'A shared React workbench';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    })()`);
    await waitFor(`document.querySelector('#goal-panel .goal-title')?.textContent === 'A shared React workbench'`);
    await run(`document.querySelector('#goal-panel .goal-title-row [aria-haspopup="menu"]').click()`);
    await waitFor(`!!document.querySelector('[data-slot="dropdown-menu-content"]') && !!document.activeElement?.closest('[data-slot="dropdown-menu-content"]')`);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Down' });
    await waitFor(`document.activeElement?.dataset.operation === 'complete'`);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Down' });
    await waitFor(`document.activeElement?.dataset.operation === 'archive'`);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    await waitFor(`!document.querySelector('[data-slot="dropdown-menu-content"]') && document.activeElement?.getAttribute('aria-haspopup') === 'menu'`);
    await run(`document.querySelector('#goal-panel .goal-title-row [aria-haspopup="menu"]').click()`);
    await waitFor(`document.querySelector('[role="menu"] [data-operation="delete"]')`);
    await run(`document.querySelector('[data-operation="delete"]').click()`);
    await waitFor(`document.querySelector('.ui-dialog[data-open]')?.textContent.includes('删除 Goal')`);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    await waitFor(`!document.querySelector('.ui-dialog[data-open]')`);
    await run(`(async () => { const a = await import(${JSON.stringify(mainUrl)}); await a.goals.assertWritesSaved(); await a.annotations.assertInlineWritesSaved(); })()`);
    window.webContents.reload();
    await waitFor(`document.documentElement.dataset.reactWorkbench === 'true' && document.documentElement.dataset.appSurface === 'home'`);
    await waitFor(`document.querySelector('#home-goal-folders [data-goal-id]')?.textContent.includes('A shared React workbench')`);
    await run(`document.querySelector('#home-goal-folders .home-goal-folder').click()`);
    await waitFor(`document.querySelector('#home-books .goal-home-book')`);
    await run(`document.querySelector('#home-books .goal-home-book').click()`);
    await waitFor(`document.documentElement.dataset.appSurface === 'reader' && document.getElementById('book-paper').textContent.includes('Alpha evidence')`);
    await waitFor(`document.querySelector('#goal-panel .goal-item-text')?.textContent.includes('A React note')`);
    const reloaded = await run(`(async () => {
        const a = await import(${JSON.stringify(mainUrl)});
        return { comment: a.annotations.getNotes().find(note => note.id === ${JSON.stringify(saved.notes[0].id)})?.comment,
            goal: a.goals.state.goals.find(goal => goal.id === a.goals.selected)?.text };
    })()`);
    assert.equal(reloaded.comment, noteText);
    assert.equal(reloaded.goal, 'A shared React workbench');
    assert.deepEqual(errors, []);
    clearTimeout(watchdog);
    console.log('PASS: React Home → Goal/book picker → EPUB/IME note → SQLite/Goal link → cross-book source → shelf/search → preferences/export/backup → full Goal edit → keyboard menu/dialog → reload/persisted data');
    app.exit(0);
})().catch(error => { console.error(error, errors); app.exit(1); });
