// Targeted layout checks in Chromium; JSDOM cannot measure columns or carets.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');

const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.argv[2] || path.join(root, '.commandcode/note-interaction'));
const watchdog = setTimeout(() => app.exit(1), 45000);
(async () => {
    app.setPath('userData', path.join(output, 'note-profile'));
    await app.whenReady();
    await fs.mkdir(output, { recursive: true });
    const css = pathToFileURL(path.join(root, 'src/client/styles.css')).href;
    const fixture = path.join(output, 'note-interaction-fixture.html');
    await fs.writeFile(fixture, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${css}">
        <style>body{display:block}#reader-viewport{height:600px;width:1192px;overflow:auto}
        #paper{width:1192px;font:18px/1.8 Georgia,serif}#container{width:1192px;height:600px}
        #list{position:absolute;top:40px;right:0;width:230px}#list .note-card{font:14px/1.8 Arial,sans-serif}
        .note-comment-text{font:inherit;white-space:pre-wrap}.note-card-actions{display:none}
        #paper{max-width:none;padding:28px 0 32px}
        </style><div id="reader-viewport"><div id="container"><article class="book-paper" id="paper"></article></div></div><div id="list"></div>`);
    const window = new BrowserWindow({ show: false, width: 1560, height: 850,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    await window.loadFile(fixture);
    const modules = pathToFileURL(path.join(root, 'dist/client/')).href;
    const result = await window.webContents.executeJavaScript(`(async () => {
        const { ReaderController } = await import(${JSON.stringify(modules)} + 'features/reader/readerController.js');
        const { AnnotationController } = await import(${JSON.stringify(modules)} + 'features/annotations/annotationController.js');
        const byId = id => document.getElementById(id);
        const elements = { bookPaper: byId('paper'), paperContainer: byId('container'), notesList: byId('list') };
        let mode = 'double';
        const reader = new ReaderController({ layoutController: {
            getEffectiveReaderMode: () => mode, updateLayoutClasses() {}
        } });
        reader.elements = elements;
        const pages = [Array.from({length: 80}, (_, i) => '<p id="p' + i + '">第' + i + '段。选中文字之后创建笔记，应保持相同的换行、字距和阅读位置。English words for wrapping and typography verification.</p>').join('')];
        const annotations = new AnnotationController({ callbacks: {
            getCurrentBookId: () => 'layout',
            getVisibleAnnotationIds: () => new Set(annotations.getRenderingNotes().map(note => note.id)),
            onNotesChanged: notes => reader.refreshAnnotations(notes)
        } });
        annotations.initUI(elements);
        const check = (value, message) => { if (!value) throw new Error(message); };
        const geometry = () => {
            const boxes = [], range = document.createRange();
            const walker = document.createTreeWalker(elements.bookPaper, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) for (let i = 0; i < node.length; i++) {
                range.setStart(node, i); range.setEnd(node, i + 1);
                const r = range.getBoundingClientRect(); boxes.push([r.x, r.y, r.width, r.height]);
            }
            return boxes;
        };
        const checks = [];
        for (mode of ['scroll', 'single', 'double']) {
            reader.setBook('layout', { format:'EPUB', readerFlow:'chapter', pages });
            reader.renderPage(1);
            if (mode === 'scroll') byId('reader-viewport').scrollTop = 780;
            else elements.bookPaper.scrollLeft = mode === 'double' ? 1264 : 1192;
            reader.flowAnchorText = '';
            const source = byId('p20');
            const before = JSON.stringify(geometry());
            const position = [elements.bookPaper.scrollLeft, byId('reader-viewport').scrollTop];
            const note = annotations.createNote({ quote:'选中文字之后创建笔记' });
            check(source === byId('p20'), mode + ': body was remounted');
            // Compare every character: underlining must not change wrapping.
            const afterGeometry = geometry(), beforeGeometry = JSON.parse(before);
            check(afterGeometry.length === beforeGeometry.length, 'Source text changed');
            const changed = afterGeometry.findIndex((box, index) => box.some((value, axis) => Math.abs(value - beforeGeometry[index][axis]) > 0.1));
            check(changed === -1, mode + ': text layout changed at character ' + changed + ': ' + JSON.stringify(beforeGeometry[changed]) + ' -> ' + JSON.stringify(afterGeometry[changed]));
            check(JSON.stringify([elements.bookPaper.scrollLeft, byId('reader-viewport').scrollTop]) === JSON.stringify(position), mode + ': reading position changed');
            await annotations.finishInlineEdit(); // Empty draft: no storage required.
            const saved = { ...note, comment:'English note 中文笔记\\nSecond line' };
            annotations.notes = [saved]; annotations.renderNotesUI();
            byId('card-' + saved.id).click();
            const editor = elements.notesList.querySelector('.note-editor');
            check(document.activeElement === editor, 'Existing note did not focus');
            check(JSON.stringify([elements.bookPaper.scrollLeft, byId('reader-viewport').scrollTop]) === JSON.stringify(position), mode + ': click jumped to chapter start');
            editor.setSelectionRange(3, 3); editor.dispatchEvent(new Event('select'));
            const caret = elements.notesList.querySelector('.note-block-caret');
            check(!caret.hidden && editor.classList.contains('has-block-caret'), 'Block caret not shown');
            const probe = document.createElement('span'); probe.style.font = getComputedStyle(editor).font; probe.textContent = '0'; document.body.appendChild(probe);
            check(Math.abs(caret.getBoundingClientRect().width - probe.getBoundingClientRect().width) < 0.1, 'Caret must be one English character wide');
            probe.remove();
            const firstTop = parseFloat(caret.style.top);
            editor.setSelectionRange(editor.value.length, editor.value.length); editor.dispatchEvent(new Event('select'));
            check(parseFloat(caret.style.top) > firstTop, 'Caret did not follow newline');
            editor.setSelectionRange(0, 4); editor.dispatchEvent(new Event('select'));
            check(caret.hidden, 'Caret should hide for a text selection');
            editor.setSelectionRange(4, 4); editor.dispatchEvent(new Event('select'));
            editor.dispatchEvent(new CompositionEvent('compositionstart'));
            check(caret.hidden, 'Caret should yield during IME composition');
            editor.dispatchEvent(new CompositionEvent('compositionend'));
            check(!caret.hidden, 'Caret should return after IME composition');
            await annotations.finishInlineEdit(); annotations.setNotesForBook([]); annotations.renderNotesUI();
            checks.push(mode + ': stable line boxes, exact scroll, click to edit, 1ch caret, newline, selection and IME');
        }
        return checks;
    })()`, true);
    assert.equal(result.length, 3);
    await fs.writeFile(path.join(output, 'note-interaction-results.json'), JSON.stringify({ passed: true, checks: result }, null, 2));
    console.log(result.join('\n'));
    window.destroy(); clearTimeout(watchdog); app.exit(0);
})().catch(error => { console.error(error); clearTimeout(watchdog); app.exit(1); });
