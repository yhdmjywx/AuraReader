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
    const run = source => window.webContents.executeJavaScript(source, true);
    const waitFor = expression => run(`(async () => {
        const end = Date.now() + 15000;
        while (!(${expression})) { if (Date.now() > end) throw new Error(${JSON.stringify(expression)}); await new Promise(resolve => setTimeout(resolve, 20)); }
    })()`);
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
    await waitFor(`document.querySelector('[aria-label="阅读书籍"]')?.options.length === 3`);
    await run(`(() => {
        const select = document.querySelector('[aria-label="阅读书籍"]');
        select.value = [...select.options].find(option => option.text.includes('workflow A')).value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(`document.getElementById('book-paper').textContent.includes('Alpha evidence')`);
    await run(`(() => {
        const input = document.querySelector('#react-reading-goals input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Connect evidence across books');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await run(`document.querySelector('#react-reading-goals form').requestSubmit()`);
    await waitFor(`document.querySelector('#react-reading-goals h2')?.textContent === 'Connect evidence across books'`);
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
    await waitFor(`document.querySelector('#react-reading-goals .goal-item-text')?.textContent.includes('A React note') && document.querySelector('#react-notes [aria-label="Added to goal"]')`);
    const saved = await run(`(async () => {
        const a = await import(${JSON.stringify(mainUrl)}); await a.annotations.assertInlineWritesSaved(); await a.goals.assertWritesSaved();
        const notes = (await auraDesktop.storage.queryNotes({ bookIds: [a.session.getCurrentBookId()] })).value.records;
        const library = (await auraDesktop.storage.queryGoalLibrary()).value;
        return { notes: notes.map(record => record.value), links: library.value.links, bookId: a.session.getCurrentBookId() };
    })()`);
    assert.equal(saved.notes[0].comment, noteText);
    assert.equal(saved.links.length, 1);
    assert.equal(saved.links[0].annotationId, saved.notes[0].id);
    await run(`(() => {
        const select = document.querySelector('[aria-label="阅读书籍"]');
        select.value = [...select.options].find(option => option.text.includes('workflow B')).value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(`document.getElementById('book-paper').textContent.includes('Second book')`);
    await run(`document.querySelector('#react-reading-goals .goal-item-text').click()`);
    await waitFor(`document.getElementById('book-paper').textContent.includes('Alpha evidence') && document.querySelector('.annotation-token.is-active')`);
    assert.deepEqual(errors, []);
    clearTimeout(watchdog);
    console.log('PASS: React book selection → EPUB selection → IME note → SQLite save → Goal link → cross-book return to source');
    app.exit(0);
})().catch(error => { console.error(error, errors); app.exit(1); });
