const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const JSZip = require('jszip');
const { app, BrowserWindow } = require('electron');
const { startDesktop } = require('../../src/desktop/main.cjs');
const { createDesktopStorage } = require('../../src/desktop/storage.cjs');
const { connect } = require('../connector/client.cjs');

BrowserWindow.prototype.show = BrowserWindow.prototype.showInactive;
const deadline = setTimeout(() => { console.error('Connector desktop test timed out'); app.exit(1); }, 65000);
let client;

(async () => {
    const profile = path.join(path.resolve(process.argv[2]), 'Connector desktop profile');
    const seed = createDesktopStorage(path.join(profile, 'data'));
    try { await seed.call('createLibrary'); } finally { seed.close(); }

    client = await connect(profile);
    const write = async (name, args) => call(name, { ...args, opId: randomUUID() });
    const call = async (name, args) => {
        const result = await client.callTool({ name, arguments: args });
        assert.ok(!result.isError, name + ': ' + JSON.stringify(result));
        return result.structuredContent;
    };
    const { goalId } = await write('create_goal', { text: 'Connector reading goal' });
    const { goalId: otherGoal } = await write('create_goal', { text: 'Another goal' });
    const filename = path.join(profile, 'Connector source.txt');
    await fs.writeFile(filename, 'Passage for a connector note.\n' + 'Preserve the reading location.\n'.repeat(100));
    const imported = await write('import_book', { path: filename });
    const reference = (await call('find_quote', { bookId: imported.id, quote: 'Passage for a connector note.' })).items[0];
    const { bookId, generation, bookRevision, sourcePage, sectionId, start, end, quote } = reference;
    const note = await write('create_note', { bookId, generation, bookRevision, sourcePage, sectionId, start, end, quote, comment: 'Original note' });

    const window = await startDesktop({ profileDirectory: profile, dialogs: {
        open: async () => ({ canceled: false, filePaths: [profile] }),
        save: async () => ({ canceled: false, filePath: path.join(profile, 'desktop-chapter.md') })
    } });
    window.webContents.setBackgroundThrottling(false);
    const run = source => window.webContents.executeJavaScript(source, true);
    const waitFor = expression => run(`(async () => {
        const end = Date.now() + 10000;
        while (!(${expression})) {
            if (Date.now() >= end) throw Error(${JSON.stringify(expression)});
            await new Promise(resolve => setTimeout(resolve, 25));
        }
    })()`);
    await waitFor("document.documentElement.dataset.reactWorkbench === 'true'");
    const files = await fs.readdir(path.resolve('dist/renderer/assets'));
    const mainUrl = 'aurareader://app/assets/' + files.find(name => /^main-.*\.js$/.test(name));
    await run(`(async () => { globalThis.connectorTest = await import(${JSON.stringify(mainUrl)}); })()`);
    const fixture = new JSZip();
    fixture.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>');
    fixture.file('book.opf', '<package><metadata/><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>');
    fixture.file('a.xhtml', '<html><body><h1>First chapter</h1><p>Text &amp; <em>emoji 😀</em>.</p></body></html>');
    fixture.file('b.xhtml', '<html><body><h1>Second chapter</h1><p>End.</p></body></html>');
    const epubBytes = await fixture.generateAsync({ type: 'nodebuffer' });
    for (const [name, bytes] of [['Parity.txt', Buffer.from('Text & emoji 😀.\nEnd.')], ['Parity.epub', epubBytes]]) {
        const file = path.join(profile, name);
        await fs.writeFile(file, bytes);
        const { id } = await write('import_book', { path: file });
        const before = (await call('get_book_contents', { bookId: id })).units;
        const rendered = await run(`(async () => {
            const app = connectorTest;
            const imported = await app.coordinator.importBook(new File([Uint8Array.from(atob(${JSON.stringify(bytes.toString('base64'))}), c => c.charCodeAt(0))], ${JSON.stringify(name)}));
            if (imported !== ${JSON.stringify(id)}) throw new Error('Desktop could not import the parity fixture');
            return { units: app.reader.bookStructure.units, text: app.elements.bookPaper.textContent };
        })()`);
        assert.deepEqual(rendered.units, before.map(({ documents, ...unit }) => unit));
        assert.equal(rendered.text, (await call('read_passage', { bookId: id, sourcePage: 1 })).quote);
        if (name.endsWith('.epub')) {
            const zipFile = path.join(profile, 'connector-parity.zip');
            await write('export_chapters', { bookId: id, path: zipFile });
            await run(`connectorTest.backup.exportChapters(connectorTest.reader.getCurrentBook(), [])`);
            const exported = await JSZip.loadAsync(await fs.readFile(zipFile));
            for (const [filename, entry] of Object.entries(exported.files)) {
                const stripTimestamp = text => text.replace(/^- Exported: .*$/m, '');
                const desktop = await fs.readFile(path.join(profile, 'Parity_chapters', filename), 'utf8');
                assert.equal(stripTimestamp(await entry.async('string')), stripTimestamp(desktop));
            }
        }
    }
    await run(`(async () => {
        const a = connectorTest;
        await a.coordinator.openBook(${JSON.stringify(bookId)}, undefined, { goalId: ${JSON.stringify(goalId)} });
    })()`);
    await waitFor("document.querySelector('#goal-panel .goal-title')?.textContent.includes('Connector reading goal')");
    const editorState = await run(`(() => {
        const a = connectorTest;
        const frame = document.querySelector('iframe.reader-document');
        const paper = frame.contentDocument.getElementById('book-paper');
        const viewport = document.getElementById('reader-viewport');
        viewport.scrollTop = 80;
        globalThis.connectorPaper = paper;
        return { page: document.getElementById('current-page').textContent, top: viewport.scrollTop };
    })()`);

    await run(`(() => {
        const reader = connectorTest.reader;
        const refresh = reader.refreshAnnotations;
        reader.refreshAnnotations = function (...args) {
            reader.refreshAnnotations = refresh;
            const doc = connectorPaper.ownerDocument;
            const range = doc.createRange();
            range.selectNodeContents(connectorPaper.querySelector('[data-note-ids]'));
            const selection = doc.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            const before = selection.toString();
            refresh.apply(this, args);
            globalThis.connectorSelection = [before, selection.toString()];
        };
    })()`);
    await write('create_highlight', { bookId, generation, bookRevision, sourcePage, sectionId, start, end, quote });
    await waitFor("globalThis.connectorSelection");
    assert.deepEqual(await run("connectorSelection"), [quote, quote]);

    const input = await write('add_goal_input', { goalId, text: 'Connector added this live' });
    await waitFor("document.querySelector('#goal-panel .goal-input-text')?.textContent === 'Connector added this live'");
    assert.deepEqual(await run(`({
        page: document.getElementById('current-page').textContent, top: document.getElementById('reader-viewport').scrollTop
    })`), editorState);
    assert.equal(await run("connectorPaper === document.querySelector('iframe.reader-document').contentDocument.getElementById('book-paper')"), true);

    await run(`connectorTest.goals.beginInput(${JSON.stringify(input.id)})`);
    await waitFor("document.querySelector('#goal-panel textarea')");
    await run(`(() => {
        globalThis.connectorGoalEditor = document.querySelector('#goal-panel textarea');
        connectorGoalEditor.value = 'Reader typed here';
    })()`);
    await write('add_goal_input', { goalId: otherGoal, text: 'An unrelated external change' });
    await waitFor("connectorTest.goals.state.inputs.some(input => input.text === 'An unrelated external change')");
    assert.equal(await run("document.querySelector('#goal-panel textarea') === connectorGoalEditor && connectorGoalEditor.value === 'Reader typed here'"), true);
    await run(`(async () => {
        connectorGoalEditor.dispatchEvent(new Event('input', { bubbles: true }));
        await connectorTest.goals.finishInlineEdit();
    })()`);
    assert.equal((await call('get_goal_context', { goalId })).content.find(item => item.id === input.id).text, 'Reader typed here');

    await run(`connectorTest.annotations.beginInlineEdit(connectorTest.annotations.getNotes().find(note => note.id === ${JSON.stringify(note.id)}))`);
    await waitFor("document.querySelector('.note-editor')");
    await run(`(() => {
        globalThis.connectorNoteEditor = document.querySelector('.note-editor');
        connectorNoteEditor.value = 'Reader draft from old revision';
    })()`);
    await write('edit_annotation', { bookId, generation, id: note.id, expected: note.revision, comment: 'Assistant committed first' });
    await waitFor("connectorTest.annotations.getNotes().some(note => note.comment === 'Assistant committed first')");
    assert.equal(await run("document.querySelector('.note-editor') === connectorNoteEditor && connectorNoteEditor.value === 'Reader draft from old revision'"), true);
    await run(`(async () => {
        connectorNoteEditor.dispatchEvent(new Event('input', { bubbles: true }));
        await connectorTest.annotations.finishInlineEdit();
    })()`);
    await waitFor("connectorTest.annotations.saveState === 'error'");
    assert.match(await run(`localStorage.getItem('aura_notes_pending_' + ${JSON.stringify(bookId)})`), /Reader draft from old revision/);
    assert.equal((await call('search_library', { kind: 'annotation' })).items.find(item => item.annotation.id === note.id).annotation.comment, 'Assistant committed first');
    await run("auraDesktop.lifecycle.requestClose()");
    await waitFor("document.body.textContent.includes('Some notes could not be saved')");
    assert.equal(window.isDestroyed(), false);
    await client.close(); client = null;
    console.log('PASS: packaged Connector with Electron, live Goal update, unchanged page/scroll/editor, reverse write, note conflict recovery and close protection');
    clearTimeout(deadline);
    app.exit(0); // This isolated test deliberately leaves a conflicted draft.
})().catch(async error => {
    console.error(error);
    await client?.close();
    clearTimeout(deadline);
    app.exit(1);
});
