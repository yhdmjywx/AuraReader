const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const JSZip = require('jszip');

(async () => {
    const dom = new JSDOM(fs.readFileSync('src/client/index.html', 'utf8'), { url: 'https://reader.test' });
    const originals = new Map(['document', 'window', 'NodeFilter'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        for (const key of originals.keys()) globalThis[key] = dom.window[key];
        const { BackupController } = await import('../../dist/client/features/backup/backupController.js');
        const { AppShell } = await import('../../dist/client/app/appShell.js');
        const elements = Object.fromEntries([
            'btn-export-menu', 'export-panel', 'btn-export-selected-chapters', 'chapter-export-modal',
            'chapter-export-book-title', 'chapter-export-count', 'chapter-export-list', 'btn-close-chapter-export',
            'btn-cancel-chapter-export', 'btn-select-all-chapters', 'btn-deselect-all-chapters', 'btn-confirm-chapter-export'
        ].map(id => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));
        let book = { id: 'selection', title: '<书名>', pages: ['<h1>第一卷</h1>', '<h2>章节一</h2><p>共享正文</p>', '<h2>章节二</h2><p>独立正文</p>'],
            toc: [{ title: '第一卷', page: 1, level: 0 }, { title: '章节一', page: 2, level: 1 }, { title: '<子节>', page: 2, level: 2 }, { title: '章节二', page: 3, level: 1 }] };
        const notes = [{ id: 'note', bookId: 'selection', kind: 'note', page: 3, quote: '独立正文', comment: '本章笔记' }];
        const messages = [], calls = [];
        window.JSZip = JSZip;
        let finish;
        window.auraDesktop = { files: { saveExport: input => { calls.push(input); return new Promise(resolve => { finish = resolve; }); } } };
        let nextPage = 0;
        const shell = new AppShell({ callbacks: { onNextPage: () => nextPage++ } });
        shell.init(elements);
        const controller = new BackupController({ callbacks: { getCurrentBook: () => book, getCurrentNotes: () => notes, showToast: message => messages.push(message) } });
        controller.initUI(elements);
        const dialog = controller.chapterExportDialog;
        elements.btnExportMenu.click();
        elements.btnExportSelectedChapters.click();
        assert.ok(!elements.exportPanel.classList.contains('open'));
        assert.ok(elements.chapterExportModal.classList.contains('active'));
        assert.equal(elements.chapterExportBookTitle.textContent, '<书名>');
        assert.equal(elements.chapterExportBookTitle.children.length, 0, '书名按文本渲染');
        assert.equal(elements.chapterExportList.querySelectorAll('input').length, 2, '纯卷标题与首章组合，同源锚点不重复列出');
        assert.match(elements.chapterExportList.textContent, /同篇内容一并导出：章节一、<子节>/);
        assert.equal(elements.chapterExportList.querySelectorAll('small > *').length, 0, '目录标题按文本渲染');
        assert.equal(elements.chapterExportCount.textContent, '已选 2 / 2 项');
        elements.btnCloseChapterExport.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        assert.equal(nextPage, 0, '章节选择时阻止阅读器快捷键');
        elements.btnCloseChapterExport.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
        assert.equal(document.activeElement, elements.btnConfirmChapterExport, 'Shift+Tab 焦点留在对话框内');
        elements.btnDeselectAllChapters.click();
        assert.equal(elements.chapterExportCount.textContent, '已选 0 / 2 项');
        assert.equal(elements.btnConfirmChapterExport.disabled, true);
        await dialog.confirm();
        assert.equal(calls.length, 0);
        elements.btnSelectAllChapters.click();
        const first = elements.chapterExportList.querySelector('input');
        first.checked = false;
        first.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert.equal(elements.chapterExportCount.textContent, '已选 1 / 2 项');
        const pending = dialog.confirm();
        assert.equal(elements.btnConfirmChapterExport.disabled, true);
        assert.equal(elements.chapterExportModal.getAttribute('aria-busy'), 'true');
        await dialog.confirm();
        for (let count = 0; !finish && count < 100; count++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(calls.length, 1, '生成及保存期间防止重复导出');
        assert.ok(!messages.some(message => message.startsWith('已保存')));
        assert.match(calls[0].filename, /所选章节笔记包\.zip$/);
        const zip = await JSZip.loadAsync(calls[0].bytes);
        assert.deepEqual(Object.keys(zip.files).filter(name => name.endsWith('.md')).map(name => name.split('/').at(-1)), ['02_章节二.md', '00_目录概览.md']);
        assert.match(await zip.file('<书名>'.replace(/[<>]/g, '_') + '_所选章节笔记包/02_章节二.md').async('string'), /本章笔记/);
        finish({ ok: true, value: { status: 'canceled' } });
        await pending;
        assert.equal(messages.at(-1), '已取消保存');
        assert.ok(elements.chapterExportModal.classList.contains('active'), '取消保存后保留选择，允许重试');
        assert.equal(elements.btnConfirmChapterExport.disabled, false);
        window.auraDesktop.files.saveExport = async () => ({ ok: false, error: { message: 'disk full' } });
        await dialog.confirm();
        assert.match(messages.at(-1), /导出 Zip 失败.*disk full/);
        assert.ok(elements.chapterExportModal.classList.contains('active'));
        window.auraDesktop.files.saveExport = async () => ({ ok: true, value: { status: 'saved' } });
        await dialog.confirm();
        assert.match(messages.at(-1), /已保存/);
        assert.ok(!elements.chapterExportModal.classList.contains('active'));
        assert.equal(document.activeElement, elements.btnExportMenu);
        elements.btnExportSelectedChapters.click();
        assert.equal(elements.chapterExportCount.textContent, '已选 2 / 2 项', '重新打开从当前书籍开始');
        elements.btnCloseChapterExport.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.ok(!elements.chapterExportModal.classList.contains('active'));
        elements.btnExportSelectedChapters.click();
        elements.chapterExportModal.click();
        assert.ok(!elements.chapterExportModal.classList.contains('active'));
        book = { id: 'empty', title: '空书', pages: [] };
        elements.btnExportSelectedChapters.click();
        assert.ok(!elements.chapterExportModal.classList.contains('active'));
        assert.equal(messages.at(-1), '当前图书无可导出内容');
        console.log('PASS: chapter selection entry, grouped content, safe titles, keyboard/focus, select all/none, real selected ZIP, duplicate prevention, save cancel/error/retry');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
