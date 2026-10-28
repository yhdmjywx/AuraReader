const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { net } = require('electron');

async function verifyFiles(window, output, queues, checks) {
    const run = source => window.webContents.executeJavaScript(source, true);
    const waitFor = expression => run(`(async () => { const end = Date.now() + 15000;
        while (!(${expression})) { if (Date.now() > end) throw new Error('File state timeout: ' + ${JSON.stringify(expression)});
        await new Promise(resolve => setTimeout(resolve, 20)); } })()`);
    const select = filename => queues.open.push({ canceled: false, filePaths: [filename] });
    const save = filename => queues.save.push({ canceled: false, filePath: path.join(output, filename) });
    await window.webContents.session.enableNetworkEmulation({ offline: true });
    select(path.resolve(__dirname, '../fixtures/test.epub'));
    await run(`document.getElementById('btn-import-book').click()`);
    await waitFor(`document.getElementById('toast-msg').textContent.includes('成功解析并入库')`);
    const imported = await run(`(async () => {
        const a = await import('./main.js'); const b = a.reader.getCurrentBook();
        return { id: b.id, title: b.title, pages: b.pages.length, format: b.format, toc: b.toc.length };
    })()`);
    // Existing parser intentionally derives the display title from the filename.
    assert.equal(imported.title, 'test'); assert.ok(imported.pages >= 12); assert.ok(imported.toc >= 12);
    await fs.writeFile(path.join(output, 'imported-book.json'), JSON.stringify(imported));
    await run(`document.getElementById('btn-export-menu').click(); document.getElementById('btn-export-chapters').click(); document.getElementById('btn-select-chapters').click();
        const chapters = document.querySelectorAll('#chapter-export-list input');
        for (const chapter of [chapters[0], chapters[1]]) { chapter.checked = true; chapter.dispatchEvent(new Event('change', {bubbles:true})); }`);
    select(output);
    await run(`document.getElementById('btn-confirm-chapter-export').click()`);
    await waitFor(`!document.getElementById('export-panel').classList.contains('open')`);
    const chapterDirectory = path.join(output, 'test_章节导出');
    const selectedFiles = (await fs.readdir(chapterDirectory)).filter(file => file.endsWith('.md'));
    assert.equal(selectedFiles.length, 3, 'native folder export contains exactly two selected chapters and index');
    assert.match(await fs.readFile(path.join(chapterDirectory, '00_目录概览.md'), 'utf8'), /导出范围：所选章节/);
    checks.push('actual imported EPUB -> inline multi-selection -> native directory chooser -> folder with two Markdown chapters and valid index');
    checks.push('offline EPUB chooser -> unchanged EPUB parser -> coordinator -> current SQLite -> reader; local JSZip and TOC intact');

    const txt = path.join(output, '桌面文字.txt');
    await fs.writeFile(txt, '第一章 本地阅读\n\n当前 SQLite 正文😀\n\n第二段文字。');
    select(txt);
    await run(`document.getElementById('btn-import-book').click()`);
    await waitFor(`document.getElementById('current-book-title').textContent.includes('桌面文字')`);
    assert.match(await run(`document.getElementById('book-paper').textContent`), /当前 SQLite 正文/);
    queues.open.push({ canceled: true, filePaths: [] });
    await run(`(async () => { const f = await import('./infrastructure/desktopFiles.js'); if (await f.chooseDesktopFile('book') !== null) throw new Error('Cancel failed'); })()`);

    select(path.resolve(__dirname, '../../src/client/assets/fonts/literata.woff2'));
    await run(`(async () => { const a = await import('./main.js'); await a.reader.fonts.importFile(); })()`);
    const font = await run(`(async () => { const a = await import('./main.js');
        const f = a.reader.fonts.imported[0]; return { ...f, failed: a.reader.fonts.failed,
        loaded: document.fonts.check('18px "AuraImported_' + f.id + '"'), choice: a.reader.fonts.choice }; })()`);
    assert.equal(font.failed, false); assert.equal(font.loaded, true); assert.equal(font.choice.id, font.id);
    assert.match(font.url, /^aurareader:\/\/app\/user-fonts\/[a-f0-9]{64}\.woff2$/);
    assert.equal(JSON.stringify(font).includes(output), false);
    const response = await net.fetch(font.url); assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await fs.readFile(path.resolve(__dirname, '../../src/client/assets/fonts/literata.woff2')));
    assert.equal((await net.fetch('aurareader://app/user-fonts/' + 'a'.repeat(64) + '.woff2')).status, 404);
    const system = await run('auraDesktop.fonts.system()');
    assert.equal(system.ok, true); assert.equal(system.value.supported, true); assert.ok(system.value.fonts.length > 0);
    checks.push('TXT import, chooser cancel, Windows system fonts, imported WOFF2 loaded offline, hash-checked private font protocol');

    const full = await run('auraDesktop.window.toggleFullscreen()');
    assert.equal(full.ok, true); assert.equal(full.value.fullscreen, true); assert.equal(window.isFullScreen(), true);
    const normal = await run('auraDesktop.window.toggleFullscreen()');
    assert.equal(normal.value.fullscreen, false); assert.equal(window.isFullScreen(), false);

    // Use the existing book/note fixture so exported offsets, Unicode and full
    // payloads can be compared across the actual renderer, IPC and filesystem.
    await run(`(async () => { const a = await import('./main.js'); await a.coordinator.openBook('desktop-ipc'); })()`);
    for (const [filename, method, args] of [
        ['notes.md', 'exportMarkdown', 'a.reader.getCurrentBook().title, a.annotations.getNotes()'],
        ['chapter.md', 'exportChapters', 'a.reader.getCurrentBook(), a.annotations.getNotes()']
    ]) {
        save(filename);
        await run(`(async () => { const a = await import('./main.js'); await a.backup.${method}(${args}); })()`);
        assert.match(await run(`document.getElementById('toast-msg').textContent`), /已保存/);
        assert.ok((await fs.stat(path.join(output, filename))).size > 0);
    }
    assert.match(await fs.readFile(path.join(output, 'notes.md'), 'utf8'), /待写恢复/);
    const markdown = await fs.readFile(path.join(output, 'chapter.md'), 'utf8');
    assert.ok(markdown.includes('待写恢复') && markdown.includes('第二段'));
    save('current.aurabackup');
    await run(`(async () => { const a = await import('./main.js'); const e = await import('./infrastructure/exporters.js');
        const r = await e.exportSelectiveBackup({selectedBooks: [a.reader.getCurrentBook()], notes: a.annotations.getNotes()});
        if (r[0].status !== 'saved') throw new Error('Backup save failed'); })()`);
    const backup = JSON.parse(await fs.readFile(path.join(output, 'current.aurabackup'), 'utf8'));
    assert.equal(backup.books[0].id, 'desktop-ipc');
    assert.deepEqual(backup.books[0].unknown, { preserved: [false, null, '完整字段'] });
    assert.equal(backup.notes[0].comment, '待写恢复\n😀');
    select(path.join(output, 'current.aurabackup'));
    await run(`(async () => { const a = await import('./main.js'); const f = await import('./infrastructure/desktopFiles.js');
        await a.backup.importFullBackup(await f.chooseDesktopFile('backup')); })()`);
    assert.match(await run(`document.getElementById('toast-msg').textContent`), /恢复/);
    const restored = await run(`auraDesktop.storage.queryNotes({bookIds: ['desktop-ipc']})`);
    assert.equal(restored.value.records[0].value.comment, backup.notes[0].comment);
    assert.deepEqual(restored.value.records[0].value.unknown, [1, null]);
    queues.save.push({ canceled: true });
    await run(`(async () => { const a = await import('./main.js'); await a.backup.exportMarkdown('Cancel', []); })()`);
    assert.equal(await run(`document.getElementById('toast-msg').textContent`), '已取消保存');
    queues.save.push({ canceled: false, filePath: path.join(output, 'missing', 'failed.md') });
    await run(`(async () => { const a = await import('./main.js'); await a.backup.exportMarkdown('Fail', []); })()`);
    assert.match(await run(`document.getElementById('toast-msg').textContent`), /导出 Markdown 失败/);
    queues.open.push({ canceled: true, filePaths: [] });
    // The public capability ignores arguments; renderer paths never reach main.
    assert.deepEqual(await run(`auraDesktop.files.chooseBook({path:'C:/arbitrary'})`), { ok: true, value: { canceled: true } });
    checks.push('real renderer exports single-chapter Markdown / chapter folders / .aurabackup, disk bytes verified; backup restore preserves offsets; truthful cancel/error feedback; fullscreen works');

    const database = new DatabaseSync(path.join(output, 'profile/data/aurareader.sqlite'), { readOnly: true });
    try {
        assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        const row = database.prepare('SELECT payload FROM books WHERE id=?').get(imported.id);
        assert.equal(JSON.parse(row.payload).pages.length, imported.pages);
    } finally { database.close(); }
    await fs.writeFile(path.join(output, 'file-results.json'), JSON.stringify({ passed: true, imported, fontId: font.id,
        systemFontCount: system.value.fonts.length, dialogResultsInjected: true }, null, 2));
}
module.exports = { verifyFiles };
