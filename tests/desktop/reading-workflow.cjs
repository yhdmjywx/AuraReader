// One end-to-end check of the shipped React workflow, using an isolated SQLite library.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
const { app, BrowserWindow } = require('electron');
const { startDesktop } = require('../../src/desktop/main.cjs');

BrowserWindow.prototype.show = function () {};
const errors = [];
const noteText = 'A React note\n中文输入保持光标\n';
app.on('web-contents-created', (_event, contents) => {
    contents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
});
const watchdog = setTimeout(() => { console.error('React workflow timed out', errors); app.exit(1); }, 60000);

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
        const geometry = await run(`Object.fromEntries(['reading-workspace', 'goal-sidebar', 'workspace-container', 'reader-panel', 'reader-viewport', 'book-paper', 'appearance-panel', 'workspace-settings-panel', 'goal-home', 'goal-page'].map(id => {
            const element = document.getElementById(id), rect = element?.getBoundingClientRect();
            return [id, rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
        }))`);
        await fs.writeFile(path.join(output, name + '-geometry.json'), JSON.stringify(geometry, null, 2));
    };
    await waitFor(`document.documentElement.dataset.desktopReady === 'setup'`);
    await capture('library-setup');
    await run(`document.getElementById('desktop-create-library').click()`);
    await waitFor(`document.documentElement.dataset.reactWorkbench === 'true'`);
    assert.equal((await run(`auraDesktop.wiki.read({id:'invalid-wiki',kind:'article',site:'en.evil.test',title:'Test'})`)).ok, false);
    assert.equal((await run(`auraDesktop.wiki.openExternal('file:///C:/Windows')`)).ok, false);
    assert.equal((await run(`auraDesktop.wiki.cancel('unknown-request')`)).ok, true);
    const files = await fs.readdir(path.resolve('dist/renderer/assets'));
    const mainUrl = 'aurareader://app/assets/' + files.find(file => /^main-.*\.js$/.test(file));
    await capture('home-welcome');
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
    await capture('home-library');
    await run(`document.querySelector('#home-goal-folders .home-goal-folder').click()`);
    await waitFor(`document.getElementById('home-add-book')`);
    await run(`document.getElementById('home-add-book').click()`);
    await waitFor(`document.querySelector('.ui-dialog[data-open] .ui-book-picker li')`);
    await run(`(() => { const row = [...document.querySelectorAll('.ui-book-picker li')].find(row => row.textContent.includes('workflow A')); row.querySelector('button').click(); })()`);
    await waitFor(`!document.querySelector('.ui-dialog[data-open]') && document.querySelector('#home-books .goal-home-book')`);
    await run(`document.querySelector('#home-books .goal-home-book').click()`);
    await waitFor(`document.documentElement.dataset.appSurface === 'reader' && document.getElementById('book-paper').textContent.includes('Alpha evidence') && document.querySelector('#goal-panel .goal-title')`);
    assert.equal(await run(`document.documentElement.lang`), 'en');
    assert.equal(await run(`document.getElementById('book-paper').lang`), 'en', 'reader keeps the source book language independently of UI copy');
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
    assert.equal(await run(`document.getElementById('btn-goal-sidebar').closest('.reader-toolbar') === null && document.getElementById('btn-goal-sidebar').getBoundingClientRect().right <= document.getElementById('goal-sidebar').getBoundingClientRect().right`), true, 'sidebar control belongs to the left Goal area');
    assert.equal(await run(`document.getElementById('react-reading-book').textContent.includes('Autosave')`), false, 'automatic saving has no persistent label');
    await run(`document.getElementById('btn-goal-sidebar').click()`);
    await waitFor(`document.getElementById('goal-sidebar').hidden`);
    await capture('reader-sidebar-closed');
    await run(`document.getElementById('btn-goal-sidebar').click()`);
    await waitFor(`!document.getElementById('goal-sidebar').hidden`);
    await capture('reader-workspace');
    assert.equal(await run(`(() => {
        const pagination = document.querySelector('.reader-pagination').getBoundingClientRect();
        const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
        const viewport = document.getElementById('reader-viewport').getBoundingClientRect();
        const title = document.getElementById('btn-toc').getBoundingClientRect();
        const actions = document.querySelector('.reader-toolbar .header-actions').getBoundingClientRect();
        return document.querySelectorAll('.reader-pagination').length === 1 && document.querySelector('.reader-toolbar > .reader-pagination')
            && Math.abs(toolbar.height - 52) < 1 && pagination.top >= toolbar.top && pagination.bottom <= toolbar.bottom
            && Math.abs(viewport.top - toolbar.bottom) < 1 && title.right <= pagination.left + 1 && pagination.right <= actions.left + 1;
    })()`), true, 'one pagination control shares the existing 52px toolbar with no extra row');
    await run(`document.getElementById('btn-next-page').click()`);
    await waitFor(`Number(document.getElementById('current-page').textContent) > 1`);
    await run(`document.getElementById('btn-prev-page').click()`);
    await waitFor(`document.getElementById('current-page').textContent === '1' && document.getElementById('btn-prev-page').disabled`);
    assert.equal(await run(`document.getElementById('current-book-title').title === document.getElementById('current-book-title').textContent`), true, 'the original full book title remains available on hover');
    // Measure layout with short, long, mixed-language and unbroken titles, then restore the source title.
    await run(`window.originalTitle = document.getElementById('current-book-title').textContent`);
    for (const title of ['Short', 'A very long English book title that must be truncated', '中文书名 Mixed English 标题与数字1234567890', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']) {
        await run(`document.getElementById('current-book-title').textContent = ${JSON.stringify(title)}`);
        assert.equal(await run(`(() => {
            const title = document.getElementById('current-book-title'), style = getComputedStyle(title);
            return style.textOverflow === 'ellipsis' && style.whiteSpace === 'nowrap' && title.getBoundingClientRect().width <= parseFloat(style.maxWidth) + 1
                && (title.textContent === 'Short' ? title.scrollWidth <= title.clientWidth + 1 : title.scrollWidth > title.clientWidth);
        })()`), true, 'book title preserves short text and truncates overflowing text: ' + title);
    }
    await capture('reader-long-title');
    const originalBounds = window.getBounds();
    window.setSize(800, 600);
    await run(`new Promise(resolve => setTimeout(resolve, 350))`);
    assert.equal(await run(`(() => {
        const title = document.getElementById('btn-toc').getBoundingClientRect(), actions = document.querySelector('.reader-toolbar .header-actions').getBoundingClientRect();
        const pagination = document.querySelector('.reader-pagination').getBoundingClientRect();
        return title.right <= pagination.left + 1 && pagination.right <= actions.left + 1 && pagination.left >= 0 && pagination.right <= innerWidth + 1
            && ['btn-prev-page', 'btn-next-page'].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= pagination.left && r.right <= pagination.right; });
    })()`), true, 'title and pagination remain usable at the minimum supported desktop size');
    await capture('reader-minimum-window');
    window.setBounds(originalBounds);
    await run(`document.getElementById('current-book-title').textContent = window.originalTitle; delete window.originalTitle; new Promise(resolve => setTimeout(resolve, 350))`);
    assert.equal(await run(`['btn-goal-sidebar', 'goal-home-nav', 'goal-up', 'goal-new', 'goal-expand', 'btn-shelf', 'btn-appearance', 'btn-export-menu'].every(id => {
        const control = document.getElementById(id), rect = control.getBoundingClientRect();
        return Math.abs(rect.width - 40) < 1 && Math.abs(rect.height - 40) < 1 && !!control.querySelector('svg');
    })`), true, 'workbench icon actions share 40px SVG button targets');
    const goalTitleBounds = await run(`(() => {
        const panel = document.getElementById('goal-panel');
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; };
        return { title: rect(panel.querySelector('.goal-title')), edit: rect(panel.querySelector('.goal-edit')), more: rect(panel.querySelector('.goal-title-row [aria-haspopup="menu"]')) };
    })()`);
    await run(`document.querySelector('#goal-panel .goal-edit').click()`);
    await waitFor(`document.querySelector('#goal-panel textarea')`);
    const goalEditBounds = await run(`(() => {
        const panel = document.getElementById('goal-panel'), editor = panel.querySelector('textarea');
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; };
        return { title: rect(editor.closest('.goal-editor')), edit: rect(panel.querySelector('.goal-edit')), more: rect(panel.querySelector('.goal-title-row [aria-haspopup="menu"]')),
            outline: getComputedStyle(editor).outlineStyle, border: getComputedStyle(editor).borderTopWidth };
    })()`);
    for (const part of ['title', 'edit', 'more']) for (const coordinate of ['x', 'y', 'width'])
        assert.ok(Math.abs(goalTitleBounds[part][coordinate] - goalEditBounds[part][coordinate]) < 1, 'Goal editing preserves ' + part + ' ' + coordinate);
    assert.deepEqual([goalEditBounds.outline, goalEditBounds.border], ['none', '0px']);
    await capture('goal-editing-inline');
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
    await run(`document.querySelector('#react-selection-actions [aria-label="Add note"]').click()`);
    await waitFor(`document.activeElement?.classList.contains('note-editor')`);
    await run(`(() => {
        const editor = document.querySelector('#react-notes textarea');
        editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        editor.value = ${JSON.stringify(noteText.slice(0, -1))};
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true }));
    })()`);
    assert.equal(await run(`!!document.querySelector('#react-notes textarea')`), true, 'IME Enter does not finish editing');
    await run(`(() => {
        const editor = document.querySelector('#react-notes textarea');
        editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        editor.setSelectionRange(editor.value.length, editor.value.length);
    })()`);
    assert.equal(await run(`document.querySelector('#react-notes textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }))`), true, 'Shift+Enter allows native newline input');
    await window.webContents.insertText('\n');
    await waitFor(`document.querySelector('#react-notes textarea')?.value === ${JSON.stringify(noteText)}`);
    const noteAppearance = await run(`(() => {
        const editor = document.querySelector('#react-notes textarea'), style = getComputedStyle(editor);
        const caret = document.querySelector('#react-notes .note-block-caret');
        caret.style.animation = 'none'; editor.dispatchEvent(new Event('select'));
        const probe = document.createElement('span'); probe.style.font = getComputedStyle(caret).font; probe.style.position = 'fixed'; probe.style.width = 'max-content'; probe.textContent = '0'; document.body.append(probe);
        const halfWidth = probe.getBoundingClientRect().width / 2; probe.remove();
        return { border: style.borderTopWidth, outline: style.outlineStyle, shadow: style.boxShadow,
            caretWidth: caret.getBoundingClientRect().width, halfWidth, color: getComputedStyle(caret).backgroundColor, opacity: getComputedStyle(caret).opacity };
    })()`);
    assert.deepEqual([noteAppearance.border, noteAppearance.outline, noteAppearance.shadow], ['0px', 'none', 'none'], 'inline note editing has no input-box chrome');
    await capture('note-editing');
    assert.ok(Math.abs(noteAppearance.caretWidth - noteAppearance.halfWidth) < .15, 'caret is half a character wide: ' + JSON.stringify(noteAppearance));
    assert.deepEqual([noteAppearance.color, noteAppearance.opacity], ['rgb(220, 38, 38)', '1'], 'caret is saturated and opaque');
    await run(`document.querySelector('#react-notes textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
    await waitFor(`!document.querySelector('#react-notes textarea') && document.querySelector('#react-notes [aria-label="Add to goal"]:not(:disabled)')`);
    assert.equal(await run(`document.querySelector('#react-notes [aria-label="Back to source"]') === null`), true, 'note actions omit the source-location button');
    await capture('note-actions');
    await run(`document.querySelector('#react-notes [aria-label="Add to goal"]').click()`);
    await waitFor(`document.querySelector('#goal-panel .goal-item-text')?.textContent.includes('A React note') && document.querySelector('#react-notes [aria-label="Added to goal"]')`);
    assert.equal(await run(`document.querySelector('#goal-panel .goal-material-quote')?.textContent`), 'Alpha evidence 0', 'linked note displays the actual selected source text');
    assert.equal(await run(`document.querySelector('#goal-panel .goal-material-comment')?.textContent`), noteText);
    assert.equal(await run(`(() => {
        const quote = document.querySelector('#goal-panel .goal-material-quote').getBoundingClientRect();
        const comment = document.querySelector('#goal-panel .goal-material-comment').getBoundingClientRect();
        return comment.top >= quote.bottom + 5 && Math.abs(comment.left - quote.left) < 1;
    })()`), true, 'source and comment stack vertically instead of sharing a button flex row');
    await run(`(async () => {
        const a = await import(${JSON.stringify(mainUrl)}), parent = a.goals.selected;
        await a.goals.createGoal('Explore the evidence', parent); a.goals.selectGoal(parent);
    })()`);
    await waitFor(`document.querySelector('#goal-panel .goal-child-edit')`);
    await run(`document.querySelector('#goal-panel .goal-child-edit').click()`);
    await waitFor(`document.activeElement === document.querySelector('#goal-panel .goal-row textarea')`);
    assert.equal(await run(`document.querySelector('#goal-panel .goal-title').textContent`), 'Connect evidence across books', 'child editing keeps the parent visible');
    await capture('goal-child-editing');
    await run(`(() => {
        const editor = document.querySelector('#goal-panel .goal-row textarea');
        editor.value = 'Explore the evidence together'; editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    })()`);
    await waitFor(`document.querySelector('#goal-panel .goal-child')?.textContent === 'Explore the evidence together'`);
    assert.equal(await run(`document.querySelector('#goal-panel .goal-items-toggle')===null && !!document.querySelector('#goal-panel .goal-content-region')`), true, 'unified content uses passive region icons without a disclosure');
    await run(`document.getElementById('goal-add-text').click()`);
    await waitFor(`document.activeElement?.getAttribute('aria-label') === 'New goal text'`);
    await run(`(() => {
        const input = document.querySelector('.goal-input-editor textarea');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'My understanding\\nIndependent goal text');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true }));
    })()`);
    assert.equal(await run(`!!document.querySelector('.goal-input-editor textarea')`), true, 'IME does not prematurely finish');
    await run(`document.querySelector('.goal-input-editor textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))`);
    await waitFor(`document.querySelector('.goal-input-text')?.textContent.includes('Independent goal text')`);
    await run(`(async () => { const a = await import(${JSON.stringify(mainUrl)}); await a.goals.assertWritesSaved(); })()`);
    assert.equal(await run(`document.querySelector('.goal-items').firstElementChild.className`), 'goal-user-input', 'new owned text precedes linked material');
    const ownedInput = await run(`(async () => { const record = (await auraDesktop.storage.queryGoalLibrary()).value; return record.value.inputs[0]; })()`);
    assert.equal(ownedInput.text, 'My understanding\nIndependent goal text');
    await run(`document.querySelector('.goal-input-actions [aria-label="Edit text"]').click()`);
    await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Edit goal text'`);
    await run(`(() => {
        const input = document.querySelector('.goal-input-editor textarea');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()`);
    await waitFor(`document.querySelector('.goal-input-text')?.textContent === 'My understanding\\nIndependent goal text'`);
    assert.equal(await run(`document.querySelectorAll('.goal-item').length`), 1, 'owned editing preserves material rows');
    await capture('goal-user-input');
    assert.equal(await run(`(() => {
        const icon = document.querySelector('#goal-panel .goal-material-icon');
        return icon.getBoundingClientRect().left >= icon.closest('.goal-item').getBoundingClientRect().left;
    })()`), true, 'material icon stays inside its row instead of crossing the hierarchy guide');
    await capture('goal-content-after');
    assert.equal(await run(`document.querySelector('#goal-panel .goal-child-edit').getBoundingClientRect().width`), 28, 'row actions use compact targets');
    await run(`document.querySelector('#goal-panel .goal-child').focus()`);
    assert.equal(await run(`getComputedStyle(document.querySelector('#goal-panel .goal-child-edit')).opacity`), '1', 'keyboard focus reveals row actions');
    await capture('goal-row-actions-visible');
    await run(`document.activeElement.blur()`);
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
    await waitFor(`document.querySelector('#shelf-list [aria-label="Search library"]')`);
    await capture('shelf');
    await run(`(() => {
        const input = document.querySelector('#shelf-list input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'workflow B');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(`document.querySelectorAll('#shelf-list .shelf-entry').length === 1 && document.querySelector('#shelf-list .shelf-book-title').textContent.includes('workflow B')`);
    await run(`document.getElementById('btn-close-shelf').click(); document.getElementById('btn-appearance').click()`);
    await waitFor(`document.activeElement?.id === 'font-family-select'`);
    assert.equal(await run(`document.getElementById('btn-appearance').textContent.trim()`), '', 'reading settings trigger stays icon-only');
    assert.equal(await run(`document.getElementById('btn-appearance').getAttribute('aria-label')`), 'Reading settings', 'icon-only settings retains its accessible name');
    await capture('reader-settings');
    await run(`document.getElementById('btn-font-inc').click()`);
    await waitFor(`document.getElementById('font-size-label').textContent === '19px'`);
    await run(`document.getElementById('btn-font-dec').click()`);
    await waitFor(`document.getElementById('font-size-label').textContent === '18px'`);
    await run(`(() => { const input = document.getElementById('indent-select'); input.value = '3em'; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(`document.getElementById('book-paper').style.getPropertyValue('--book-text-indent') === '3em'`);
    await run(`(() => { const input = document.getElementById('indent-select'); input.value = '2em'; input.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('[data-paper="sepia"]').click(); })()`);
    await waitFor(`document.getElementById('reader-panel').classList.contains('paper-sepia')`);
    await run(`document.querySelector('[data-paper="white"]').click(); document.getElementById('btn-mode-scroll').click()`);
    await waitFor(`document.getElementById('workspace-container').classList.contains('layout-scroll') && document.getElementById('btn-mode-scroll').getAttribute('aria-pressed') === 'true'`);
    await run(`document.getElementById('btn-mode-single').click(); document.getElementById('font-family-select').click()`);
    await waitFor(`!document.getElementById('font-menu').hidden && document.getElementById('btn-mode-single').getAttribute('aria-pressed') === 'true'`);
    await capture('reader-font-menu');
    await run(`document.querySelector('[data-font-choice="sarasa"]').click()`);
    await waitFor(`document.getElementById('font-choice-label').textContent === 'Sarasa Gothic SC' && document.getElementById('font-menu').hidden`);
    await run(`document.getElementById('font-family-select').click(); document.querySelector('[data-font-choice="auto"]').click()`);
    await waitFor(`document.getElementById('font-choice-label').textContent === 'Auto' && document.getElementById('font-menu').hidden`);
    await run(`document.getElementById('btn-export-menu').click()`);
    await waitFor(`document.getElementById('export-panel').classList.contains('open') && !document.getElementById('appearance-panel').classList.contains('open')`);
    await run(`document.getElementById('btn-export-chapters').click(); document.getElementById('btn-select-chapters').click()`);
    await waitFor(`document.querySelectorAll('#chapter-export-list input').length > 0`);
    await run(`document.querySelector('#chapter-export-list input').click()`);
    await waitFor(`document.getElementById('btn-confirm-chapter-export').disabled === false`);
    await capture('chapter-export');
    await run(`document.getElementById('btn-workspace-settings').click()`);
    await waitFor(`document.getElementById('workspace-settings-panel').getClientRects().length > 0 && !document.getElementById('export-panel').classList.contains('open')`);
    await capture('workspace-settings');
    await run(`document.getElementById('btn-export-full-backup').click()`);
    await waitFor(`document.querySelector('#backup-select-modal[data-open] input.chk-backup-book')`);
    await capture('backup-selection');
    await run(`document.getElementById('btn-deselect-all-backup').click()`);
    assert.equal(await run(`document.querySelectorAll('#backup-select-modal input.chk-backup-book:checked').length`), 0);
    await run(`document.getElementById('btn-cancel-backup-modal').click()`);
    await waitFor(`!document.querySelector('#backup-select-modal[data-open]')`);
    await run(`document.getElementById('goal-expand').click()`);
    await waitFor(`document.documentElement.dataset.appSurface === 'goal' && document.querySelector('#goal-page-content #goal-panel .goal-title')`);
    assert.equal(await run(`(() => {
        const quote = document.querySelector('#goal-page .goal-material-quote').getBoundingClientRect();
        return document.querySelector('#goal-page .goal-material-comment').getBoundingClientRect().top >= quote.bottom + 5;
    })()`), true, 'the shared full Goal workspace also stacks source before comment');
    await capture('goal-workspace');
    await run(`document.querySelector('#goal-panel .goal-edit').click()`);
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
    await waitFor(`document.querySelector('.ui-dialog[data-open]')?.textContent.includes('Delete goal')`);
    await capture('goal-delete');
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    await waitFor(`!document.querySelector('.ui-dialog[data-open]')`);
    await run(`(async () => { const a = await import(${JSON.stringify(mainUrl)}); await a.goals.assertWritesSaved(); await a.annotations.assertInlineWritesSaved(); })()`);
    window.webContents.reload();
    await waitFor(`document.documentElement.dataset.reactWorkbench === 'true' && document.documentElement.dataset.appSurface === 'home'`);
    await waitFor(`document.querySelector('#home-goal-folders [data-goal-id]')?.textContent.includes('A shared React workbench')`);
    await run(`document.querySelector('#home-goal-folders .home-goal-folder').click()`);
    await waitFor(`document.querySelector('#home-books .goal-home-book')`);
    assert.equal(await run(`document.querySelector('#home-material-list .goal-material-quote')?.textContent`), 'Alpha evidence 0', 'Home retains linked source text after reloading');
    await capture('home-linked-materials');
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
    assert.equal(await run(`document.querySelector('.goal-input-text')?.textContent`), 'My understanding\nIndependent goal text', 'owned goal text survives desktop IPC saving and reload');
    await run(`(async () => {
        const a = await import(${JSON.stringify(mainUrl)});
        a.appShell.showToast('Saved', { anchor: document.querySelector('#goal-panel .goal-edit') });
    })()`);
    await capture('reader-success-feedback');
    await run(`(async () => {
        const a = await import(${JSON.stringify(mainUrl)});
        a.appShell.showToast('Save incomplete — feedback preview', { kind: 'error', anchor: document.querySelector('#goal-panel .goal-edit') });
        await new Promise(resolve => setTimeout(resolve, 2800));
    })()`);
    assert.equal(await run(`document.getElementById('toast-msg').matches('.show[data-kind="error"][role="alert"]')`), true, 'error feedback remains visible beyond the success timeout');
    await capture('reader-error-feedback');
    await run(`document.querySelector('#toast-msg [aria-label="Dismiss error"]').click()`);
    assert.equal(await run(`document.getElementById('toast-msg').classList.contains('show')`), false);
    assert.deepEqual(errors, []);
    clearTimeout(watchdog);
    console.log('PASS: React Home → Goal/book picker → EPUB/IME note → SQLite/Goal link → cross-book source → shelf/search → preferences/export/backup → full Goal edit → keyboard menu/dialog → reload/persisted data');
    app.exit(0);
})().catch(error => { console.error(error, errors); app.exit(1); });
