const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

(async () => {
    const dom = new JSDOM('<body></body>', { url: 'https://reader.test' });
    const old = new Map(['window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try {
        globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.localStorage = dom.window.localStorage;
        let complete; const calls = [];
        dom.window.auraDesktop = { files: { saveExport: input => {
            calls.push(input); return new Promise(resolve => { complete = resolve; });
        } } };
        const { BackupController } = await import('../../dist/client/features/backup/backupController.js');
        const exporters = await import('../../dist/client/infrastructure/exporters.js');
        const messages = []; const controller = new BackupController({ callbacks: { showToast: message => messages.push(message) } });
        const pending = controller.exportMarkdown('确认保存', [{ kind: 'note', quote: '原文', comment: '内容\n😀', page: 1 }]);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(messages.length, 0, '保存确认前不能报告成功');
        assert.match(Buffer.from(calls[0].bytes).toString(), /内容/);
        complete({ ok: true, value: { status: 'canceled' } }); await pending;
        assert.equal(messages.pop(), '已取消保存');
        dom.window.auraDesktop.files.saveExport = async () => ({ ok: false, error: { message: 'disk full', status: 500 } });
        await controller.exportMarkdown('错误', []);
        assert.match(messages.pop(), /失败.*disk full/);
        let saves = 0;
        dom.window.auraDesktop.files.saveExport = async () => ({ ok: true, value: { status: ++saves === 1 ? 'saved' : 'canceled' } });
        const books = [1, 2, 3].map(id => ({ id: String(id), title: '书' + id, pages: ['<p>正文</p>'] }));
        const results = await exporters.exportSelectiveBackup({ selectedBooks: books });
        assert.deepEqual(results.map(result => result.status), ['saved', 'canceled', 'not-saved']);
        assert.equal(saves, 2, '取消后不再弹出下一本书的保存框');
        const list = document.createElement('div');
        list.innerHTML = books.map(book => `<input class="chk-backup-book" type="checkbox" data-id="${book.id}" checked>`).join('');
        controller.elements = { backupBookCheckboxList: list, chkBackupIncludeNotes: { checked: false } };
        controller.availableBackupBooks = books;
        dom.window.auraDesktop.storage = {
            status: async () => ({ ok: true, value: { initialized: true } }),
            listBooks: async () => ({ ok: true, value: { records: books.map(book => ({ id: book.id, revision: 1, generation: book.id, deleted: false, value: book })) } }),
            queryGoals: async () => ({ ok: true, value: { records: [] } }),
            queryGoalLibrary: async () => ({ ok: true, value: { id: 'reader-goals', revision: 0, deleted: false, value: { goals: [], links: [] } } })
        };
        saves = 0;
        await controller.executeSelectiveBackupExport();
        assert.match(messages.pop(), /已保存 1\/3.*取消/);
        dom.window.auraDesktop.files.saveExport = async () => ({ ok: false, error: { message: 'write denied', status: 500 } });
        const failed = await exporters.exportSelectiveBackup({ selectedBooks: books });
        assert.deepEqual(failed.map(result => result.status), ['failed', 'not-saved', 'not-saved']);
        assert.match(failed[0].message, /write denied/);
        await controller.executeSelectiveBackupExport();
        assert.match(messages.pop(), /已保存 0\/3.*保存失败.*write denied/);
        console.log('PASS: no premature export success, explicit cancel/error feedback and per-book partial/cancel outcomes');
    } finally {
        dom.window.close();
        for (const [key, descriptor] of old) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
