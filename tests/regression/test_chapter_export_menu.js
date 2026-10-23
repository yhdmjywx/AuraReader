const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM(fs.readFileSync('src/client/index.html', 'utf8'), { url: 'https://reader.test' });
    const originals = new Map(['document', 'window', 'NodeFilter'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        for (const key of originals.keys()) globalThis[key] = dom.window[key];
        const { BackupController } = await import('../../dist/client/features/backup/backupController.js');
        const { AppShell } = await import('../../dist/client/app/appShell.js');
        const elements = Object.fromEntries([
            'btn-export-menu', 'export-panel', 'btn-export-chapters', 'chapter-export-entry', 'chapter-export-options',
            'chapter-export-custom', 'chapter-export-list', 'btn-collapse-chapter-export', 'btn-export-current-chapter',
            'btn-export-all-chapters', 'btn-select-chapters', 'btn-cancel-chapter-export', 'btn-confirm-chapter-export'
        ].map(id => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));
        let book = { id: 'selection', title: '<书名>', pages: ['<h1>第一卷</h1>', '<h2>章节一</h2><p>共享正文😀</p>', '<h2>章节二</h2><p>独立正文</p>', '<h2>章节三</h2><p>未选正文</p>'],
            toc: [{ title: '第一卷', page: 1, level: 0 }, { title: '章节一', page: 2, level: 1 }, { title: '<子节>', page: 2, level: 2 }, { title: '章节二', page: 3, level: 1 }, { title: '章节三', page: 4, level: 1 }] };
        let page = 2;
        const notes = [{ id: 'note', bookId: 'selection', kind: 'note', page: 3, quote: '独立正文', comment: '本章笔记' }];
        const messages = [], singles = [], folders = [];
        let finish;
        window.auraDesktop = { files: {
            saveExport: async input => { singles.push(input); return { ok: true, value: { status: 'saved' } }; },
            saveExportFolder: input => { folders.push(input); return new Promise(resolve => { finish = resolve; }); }
        } };
        let nextPage = 0;
        const shell = new AppShell({ onNextPage: () => nextPage++ }); shell.init(elements);
        const controller = new BackupController({ callbacks: { getCurrentBook: () => book, getCurrentPage: () => page,
            getCurrentNotes: () => notes, showToast: message => messages.push(message), closeExportPanel: () => shell.closeExportPanel() } });
        controller.initUI(elements);
        const menu = controller.chapterExportMenu;
        const open = () => { elements.btnExportMenu.click(); elements.btnExportChapters.click(); };
        open();
        assert.ok(elements.exportPanel.classList.contains('open'));
        assert.equal(elements.chapterExportOptions.hidden, false);
        assert.equal(elements.btnExportChapters.hidden, true);
        assert.equal(elements.chapterExportCustom.hidden, true);
        assert.equal(document.querySelector('[aria-modal="true"]'), null);
        elements.btnExportCurrentChapter.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        assert.equal(nextPage, 0);
        await menu.run('current');
        assert.equal(singles.length, 1);
        assert.match(singles[0].filename, /\.md$/);
        const first = Buffer.from(singles[0].bytes).toString();
        assert.ok(first.includes('第一卷') && first.includes('共享正文😀') && !first.includes('独立正文'));
        assert.ok(!elements.exportPanel.classList.contains('open'));
        assert.equal(document.activeElement, elements.btnExportMenu);
        open(); page = 3;
        await menu.run('current');
        const second = Buffer.from(singles[1].bytes).toString();
        assert.ok(second.includes('独立正文') && second.includes('本章笔记') && !second.includes('共享正文'), '当前章节按点击时位置确定');
        open(); elements.btnSelectChapters.click();
        assert.equal(elements.chapterExportList.querySelectorAll('input').length, 3, '卷标题和同篇锚点沿用共享内容单元');
        assert.equal(elements.btnConfirmChapterExport.disabled, true);
        const checkboxes = elements.chapterExportList.querySelectorAll('input');
        for (const checkbox of [checkboxes[0], checkboxes[1]]) { checkbox.checked = true; checkbox.dispatchEvent(new window.Event('change', { bubbles: true })); }
        const pending = menu.run('custom');
        await menu.run('custom');
        assert.equal(folders.length, 1);
        assert.equal(elements.btnConfirmChapterExport.disabled, true);
        assert.equal(elements.btnExportAllChapters.disabled, true);
        assert.match(folders[0].folderName, /章节导出$/);
        assert.equal(folders[0].files.length, 3);
        const index = folders[0].files.find(file => file.filename === '00_目录概览.md');
        const indexText = Buffer.from(index.bytes).toString();
        assert.ok(indexText.includes('所选章节') && !indexText.includes('[章节三]'));
        for (const match of indexText.matchAll(/\]\(\.\/([^\n)]+)\)/g)) assert.ok(folders[0].files.some(file => file.filename === decodeURIComponent(match[1])));
        finish({ ok: true, value: { status: 'canceled' } }); await pending;
        assert.equal(messages.at(-1), '已取消保存');
        assert.ok(elements.exportPanel.classList.contains('open'));
        assert.equal(elements.chapterExportList.querySelectorAll('input:checked').length, 2);
        window.auraDesktop.files.saveExportFolder = async () => ({ ok: false, error: { message: 'disk full', status: 500 } });
        await menu.run('custom');
        assert.match(messages.at(-1), /章节导出失败.*disk full/);
        assert.ok(elements.exportPanel.classList.contains('open'));
        window.auraDesktop.files.saveExportFolder = async () => ({ ok: true, value: { status: 'saved', kind: 'folder', name: '书名_章节导出 (2)' } });
        await menu.run('custom');
        assert.match(messages.at(-1), /已保存章节文件夹.*\(2\)/);
        assert.ok(!elements.exportPanel.classList.contains('open'));
        open(); elements.btnSelectChapters.click();
        assert.equal(elements.chapterExportList.querySelectorAll('input:checked').length, 0);
        book = { ...book, id: 'other', title: '另一本' };
        await menu.run('custom');
        assert.match(messages.at(-1), /书籍已切换/);
        elements.btnSelectChapters.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(elements.chapterExportCustom.hidden, true);
        elements.btnSelectChapters.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(elements.chapterExportOptions.hidden, true);
        elements.btnExportChapters.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.ok(!elements.exportPanel.classList.contains('open'));
        open(); await menu.run('all');
        assert.match(messages.at(-1), /已保存章节文件夹/);
        console.log('PASS: inline chapter export, live current position, grouped chapters, actual Markdown/folder payloads, no overlay, empty selection, duplicate prevention, cancel/error/retry, book switch, keyboard');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
